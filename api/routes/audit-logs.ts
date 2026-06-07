import { Router, type Request, type Response } from 'express'
import db, { createAuditLog } from '../db.js'
import type {
  AuditLog,
  CreateAuditLogRequest,
} from '../../shared/types.js'

interface AuditLogRow {
  id: number
  entity_type: string
  entity_id: number
  action_type: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  source_page: string | null
  task_id: number | null
  meeting_id: number | null
  department: string | null
  created_at: string
}

function rowToAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    entityType: row.entity_type as AuditLog['entityType'],
    entityId: row.entity_id,
    actionType: row.action_type as AuditLog['actionType'],
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    sourcePage: row.source_page,
    taskId: row.task_id,
    meetingId: row.meeting_id,
    department: row.department,
    createdAt: row.created_at,
  }
}

const router = Router()

router.get('/task/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params

    const taskRow = db.prepare('SELECT id FROM tasks WHERE id = ?').get(Number(taskId))
    if (!taskRow) {
      return res.status(404).json({ success: false, error: '事项不存在' })
    }

    const rows = db.prepare(`
      SELECT * FROM audit_logs
      WHERE task_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(Number(taskId)) as AuditLogRow[]

    const logs = rows.map(rowToAuditLog)

    res.json({ success: true, data: logs })
  } catch (error) {
    console.error('Get task audit logs error:', error)
    res.status(500).json({ success: false, error: '获取事项变更记录失败' })
  }
})

router.get('/meeting/:meetingId', (req: Request, res: Response) => {
  try {
    const { meetingId } = req.params

    const meetingRow = db.prepare('SELECT id FROM meetings WHERE id = ?').get(Number(meetingId))
    if (!meetingRow) {
      return res.status(404).json({ success: false, error: '会议不存在' })
    }

    const rows = db.prepare(`
      SELECT * FROM audit_logs
      WHERE meeting_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(Number(meetingId)) as AuditLogRow[]

    const logs = rows.map(rowToAuditLog)

    res.json({ success: true, data: logs })
  } catch (error) {
    console.error('Get meeting audit logs error:', error)
    res.status(500).json({ success: false, error: '获取会议变更记录失败' })
  }
})

router.get('/department/:department', (req: Request, res: Response) => {
  try {
    const { department } = req.params
    const { limit = '100', offset = '0' } = req.query

    const rows = db.prepare(`
      SELECT * FROM audit_logs
      WHERE department = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(decodeURIComponent(department), Number(limit), Number(offset)) as AuditLogRow[]

    const logs = rows.map(rowToAuditLog)

    const countRow = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs WHERE department = ?
    `).get(decodeURIComponent(department)) as { count: number }

    res.json({
      success: true,
      data: {
        list: logs,
        total: countRow.count,
        limit: Number(limit),
        offset: Number(offset),
      },
    })
  } catch (error) {
    console.error('Get department audit logs error:', error)
    res.status(500).json({ success: false, error: '获取科室变更记录失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateAuditLogRequest

    if (!body.entityType || !body.entityId || !body.actionType) {
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }

    const logId = createAuditLog({
      entityType: body.entityType,
      entityId: body.entityId,
      actionType: body.actionType,
      fieldName: body.fieldName || null,
      oldValue: body.oldValue,
      newValue: body.newValue,
      sourcePage: body.sourcePage || null,
      taskId: body.taskId || null,
      meetingId: body.meetingId || null,
      department: body.department || null,
    })

    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(logId) as AuditLogRow
    const log = rowToAuditLog(row)

    res.status(201).json({ success: true, data: log })
  } catch (error) {
    console.error('Create audit log error:', error)
    res.status(500).json({ success: false, error: '创建审计记录失败' })
  }
})

export default router
