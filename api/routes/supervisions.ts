import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type {
  TaskSupervision,
  CreateSupervisionRequest,
  Task,
} from '../../shared/types.js'

interface SupervisionRow {
  id: number
  task_id: number
  note: string
  next_follow_up_date: string | null
  status: string
  closed_at: string | null
  created_at: string
  updated_at: string
}

interface TaskRowWithTitle {
  id: number
  meeting_id: number
  content: string
  department: string
  deadline: string
  status: string
  progress: string | null
  created_at: string
  updated_at: string
  meeting_title?: string
}

function rowToSupervision(row: SupervisionRow): TaskSupervision {
  return {
    id: row.id,
    taskId: row.task_id,
    note: row.note,
    nextFollowUpDate: row.next_follow_up_date,
    status: row.status as 'active' | 'closed',
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTask(row: TaskRowWithTitle): Task {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    content: row.content,
    department: row.department,
    deadline: row.deadline,
    status: row.status as Task['status'],
    progress: row.progress || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    meetingTitle: row.meeting_title,
  }
}

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

    const supervisionRows = db.prepare(`
      SELECT ts.*
      FROM task_supervisions ts
      INNER JOIN (
        SELECT task_id, MAX(created_at) as max_created
        FROM task_supervisions
        WHERE status = 'active'
        GROUP BY task_id
      ) latest ON ts.task_id = latest.task_id AND ts.created_at = latest.max_created
      WHERE ts.status = 'active'
    `).all() as SupervisionRow[]

    const supervisionMap = new Map<number, TaskSupervision>()
    supervisionRows.forEach((row) => {
      supervisionMap.set(row.task_id, rowToSupervision(row))
    })

    const tasks = rows.map((row) => {
      const task = rowToTask(row)
      const activeSupervision = supervisionMap.get(task.id) || null
      task.hasActiveSupervision = !!activeSupervision
      task.activeSupervision = activeSupervision
      return task
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

    const supervisions = rows.map(rowToSupervision)

    res.json({ success: true, data: supervisions })
  } catch (error) {
    console.error('Get task supervisions error:', error)
    res.status(500).json({ success: false, error: '获取督办记录失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { taskId, note, nextFollowUpDate } = req.body as CreateSupervisionRequest

    if (!taskId) {
      return res.status(400).json({ success: false, error: '事项ID不能为空' })
    }

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: '督办说明不能为空' })
    }

    const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as { id: number; status: string } | undefined
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

    const result = db.prepare(`
      INSERT INTO task_supervisions (task_id, note, next_follow_up_date)
      VALUES (?, ?, ?)
    `).run(taskId, note.trim(), nextFollowUpDate || null)

    const newRow = db.prepare(`
      SELECT * FROM task_supervisions WHERE id = ?
    `).get(result.lastInsertRowid) as SupervisionRow

    const supervision = rowToSupervision(newRow)

    res.json({ success: true, data: supervision })
  } catch (error) {
    console.error('Create supervision error:', error)
    res.status(500).json({ success: false, error: '创建督办失败' })
  }
})

router.patch('/:id/close', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const supervisionRow = db.prepare('SELECT * FROM task_supervisions WHERE id = ?').get(id) as SupervisionRow | undefined
    if (!supervisionRow) {
      return res.status(404).json({ success: false, error: '督办记录不存在' })
    }

    if (supervisionRow.status === 'closed') {
      return res.status(400).json({ success: false, error: '该督办已关闭' })
    }

    db.prepare(`
      UPDATE task_supervisions
      SET status = 'closed',
          closed_at = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(id)

    const updatedRow = db.prepare(`
      SELECT * FROM task_supervisions WHERE id = ?
    `).get(id) as SupervisionRow

    const supervision = rowToSupervision(updatedRow)

    res.json({ success: true, data: supervision })
  } catch (error) {
    console.error('Close supervision error:', error)
    res.status(500).json({ success: false, error: '关闭督办失败' })
  }
})

export default router
