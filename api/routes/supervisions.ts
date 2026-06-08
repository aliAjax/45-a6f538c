import { Router, type Request, type Response } from 'express'
import db, { createAuditLog } from '../db.js'
import {
  enrichSupervision,
  getTaskSupervisionForList,
  mapRowsToTasks,
  rowToFollowUp,
  rowToSupervision,
  type FollowUpRow,
  type SupervisionRow,
  type TaskRow as TaskRowWithTitle,
} from '../lib/task-utils.js'
import type {
  CreateSupervisionRequest,
  CreateSupervisionFollowUpRequest,
} from '../../shared/types.js'

const router = Router()

router.get('/active', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT t.*, m.title as meeting_title
      FROM tasks t
      INNER JOIN task_supervisions ts ON t.id = ts.task_id
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE ts.status = 'active' AND t.status != 'completed'
      ORDER BY ts.created_at DESC, t.id DESC
    `).all() as TaskRowWithTitle[]

    const tasks = mapRowsToTasks(rows)
    const supervisionMap = getTaskSupervisionForList(tasks.map((task) => task.id))

    tasks.forEach((task) => {
      const activeSupervision = supervisionMap.get(task.id) || null
      task.hasActiveSupervision = !!activeSupervision
      task.activeSupervision = activeSupervision
    })

    res.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Get active supervisions error:', error)
    res.status(500).json({ success: false, error: '获取督办中事项失败' })
  }
})

router.get('/task/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params

    const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
    if (!taskRow) {
      return res.status(404).json({ success: false, error: '事项不存在' })
    }

    const rows = db.prepare(`
      SELECT * FROM task_supervisions
      WHERE task_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(taskId) as SupervisionRow[]

    const supervisions = rows.map((row) => enrichSupervision(rowToSupervision(row)))

    res.json({ success: true, data: supervisions })
  } catch (error) {
    console.error('Get task supervisions error:', error)
    res.status(500).json({ success: false, error: '获取督办记录失败' })
  }
})

router.get('/:id/follow-ups', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const supervisionRow = db.prepare('SELECT * FROM task_supervisions WHERE id = ?').get(id) as SupervisionRow | undefined
    if (!supervisionRow) {
      return res.status(404).json({ success: false, error: '督办记录不存在' })
    }

    const rows = db.prepare(`
      SELECT * FROM supervision_follow_ups
      WHERE supervision_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(id) as FollowUpRow[]

    const followUps = rows.map(rowToFollowUp)

    res.json({ success: true, data: followUps })
  } catch (error) {
    console.error('Get supervision follow-ups error:', error)
    res.status(500).json({ success: false, error: '获取跟进记录失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { taskId, note, nextFollowUpDate, sourcePage } = req.body as CreateSupervisionRequest & { sourcePage?: string }

    if (!taskId) {
      return res.status(400).json({ success: false, error: '事项ID不能为空' })
    }

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: '督办说明不能为空' })
    }

    const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as {
      id: number
      status: string
      meeting_id: number
      department: string
    } | undefined
    if (!taskRow) {
      return res.status(404).json({ success: false, error: '事项不存在' })
    }

    if (taskRow.status === 'completed') {
      return res.status(400).json({ success: false, error: '已完成的事项不能发起督办' })
    }

    const activeSupervision = db.prepare(`
      SELECT id FROM task_supervisions
      WHERE task_id = ? AND status = 'active'
      LIMIT 1
    `).get(taskId) as { id: number } | undefined

    if (activeSupervision) {
      return res.status(400).json({ success: false, error: '该事项已有督办在进行中' })
    }

    const supervisionId = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO task_supervisions (task_id, note, next_follow_up_date)
        VALUES (?, ?, ?)
      `).run(taskId, note.trim(), nextFollowUpDate || null)

      const newSupervisionId = Number(result.lastInsertRowid)

      db.prepare(`
        INSERT INTO supervision_follow_ups (supervision_id, content, next_follow_up_date, created_at)
        VALUES (?, ?, ?, datetime('now', 'localtime'))
      `).run(newSupervisionId, note.trim(), nextFollowUpDate || null)

      createAuditLog({
        entityType: 'supervision',
        entityId: newSupervisionId,
        actionType: 'start_supervision',
        fieldName: null,
        oldValue: null,
        newValue: { note: note.trim(), nextFollowUpDate: nextFollowUpDate || null },
        sourcePage: sourcePage || null,
        taskId: Number(taskId),
        meetingId: taskRow.meeting_id,
        department: taskRow.department,
      })

      return newSupervisionId
    })()

    const newRow = db.prepare(`
      SELECT * FROM task_supervisions WHERE id = ?
    `).get(supervisionId) as SupervisionRow

    const supervision = enrichSupervision(rowToSupervision(newRow))

    res.json({ success: true, data: supervision })
  } catch (error) {
    console.error('Create supervision error:', error)
    res.status(500).json({ success: false, error: '创建督办失败' })
  }
})

router.post('/:id/follow-ups', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { content, nextFollowUpDate } = req.body as CreateSupervisionFollowUpRequest

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '跟进内容不能为空' })
    }

    const supervisionRow = db.prepare('SELECT * FROM task_supervisions WHERE id = ?').get(id) as SupervisionRow | undefined
    if (!supervisionRow) {
      return res.status(404).json({ success: false, error: '督办记录不存在' })
    }

    if (supervisionRow.status === 'closed') {
      return res.status(400).json({ success: false, error: '已关闭的督办不能追加跟进' })
    }

    const followUpId = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO supervision_follow_ups (supervision_id, content, next_follow_up_date)
        VALUES (?, ?, ?)
      `).run(Number(id), content.trim(), nextFollowUpDate || null)

      db.prepare(`
        UPDATE task_supervisions
        SET next_follow_up_date = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(nextFollowUpDate || null, Number(id))

      return Number(result.lastInsertRowid)
    })()

    const newRow = db.prepare(`
      SELECT * FROM supervision_follow_ups WHERE id = ?
    `).get(followUpId) as FollowUpRow

    const followUp = rowToFollowUp(newRow)

    res.json({ success: true, data: followUp })
  } catch (error) {
    console.error('Create supervision follow-up error:', error)
    res.status(500).json({ success: false, error: '添加跟进记录失败' })
  }
})

router.patch('/:id/close', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { sourcePage } = req.body as { sourcePage?: string }

    const supervisionRow = db.prepare('SELECT * FROM task_supervisions WHERE id = ?').get(id) as SupervisionRow | undefined
    if (!supervisionRow) {
      return res.status(404).json({ success: false, error: '督办记录不存在' })
    }

    if (supervisionRow.status === 'closed') {
      return res.status(400).json({ success: false, error: '该督办已关闭' })
    }

    const taskRow = db.prepare('SELECT meeting_id, department FROM tasks WHERE id = ?').get(supervisionRow.task_id) as {
      meeting_id: number
      department: string
    } | undefined

    db.transaction(() => {
      db.prepare(`
        UPDATE task_supervisions
        SET status = 'closed',
            closed_at = datetime('now', 'localtime'),
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(id)

      createAuditLog({
        entityType: 'supervision',
        entityId: Number(id),
        actionType: 'close_supervision',
        fieldName: 'status',
        oldValue: 'active',
        newValue: 'closed',
        sourcePage: sourcePage || null,
        taskId: supervisionRow.task_id,
        meetingId: taskRow?.meeting_id || null,
        department: taskRow?.department || null,
      })
    })()

    const updatedRow = db.prepare(`
      SELECT * FROM task_supervisions WHERE id = ?
    `).get(id) as SupervisionRow

    const supervision = enrichSupervision(rowToSupervision(updatedRow))

    res.json({ success: true, data: supervision })
  } catch (error) {
    console.error('Close supervision error:', error)
    res.status(500).json({ success: false, error: '关闭督办失败' })
  }
})

export default router
