import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { getReminderRuleForDepartment } from './reminder-rules.js'
import type { Task, ReminderGroups, TaskSupervision, SupervisionFollowUp } from '../../shared/types.js'

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
  has_active_supervision?: number
}

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

interface FollowUpRow {
  id: number
  supervision_id: number
  content: string
  next_follow_up_date: string | null
  created_at: string
}

function rowToFollowUp(row: FollowUpRow): SupervisionFollowUp {
  return {
    id: row.id,
    supervisionId: row.supervision_id,
    content: row.content,
    nextFollowUpDate: row.next_follow_up_date,
    createdAt: row.created_at,
  }
}

function getActiveSupervisionWithLatestFollowUp(taskId: number): TaskSupervision | null {
  const supervisionRow = db.prepare(`
    SELECT * FROM task_supervisions
    WHERE task_id = ? AND status = 'active'
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(taskId) as SupervisionRow | undefined

  if (!supervisionRow) return null

  const followUpRow = db.prepare(`
    SELECT * FROM supervision_follow_ups
    WHERE supervision_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(supervisionRow.id) as FollowUpRow | undefined

  const followUpCountRow = db.prepare(`
    SELECT COUNT(*) as count FROM supervision_follow_ups
    WHERE supervision_id = ?
  `).get(supervisionRow.id) as { count: number }

  return {
    id: supervisionRow.id,
    taskId: supervisionRow.task_id,
    note: supervisionRow.note,
    nextFollowUpDate: supervisionRow.next_follow_up_date,
    status: supervisionRow.status as 'active' | 'closed',
    closedAt: supervisionRow.closed_at,
    createdAt: supervisionRow.created_at,
    updatedAt: supervisionRow.updated_at,
    latestFollowUp: followUpRow ? rowToFollowUp(followUpRow) : null,
    followUpCount: followUpCountRow.count,
  }
}

function rowToTask(row: TaskRowWithTitle): Task {
  const task: Task = {
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
    hasActiveSupervision: !!row.has_active_supervision,
  }

  if (task.hasActiveSupervision) {
    task.activeSupervision = getActiveSupervisionWithLatestFollowUp(row.id)
  }

  return task
}

const router = Router()

function getTaskEffectiveReminderDate(task: Task, rule: {
  advanceDays: number
  includeSupervisionFollowUp: boolean
  repeatOverdue: boolean
}): string | null {
  const deadlineStr = task.deadline.split('T')[0].split(' ')[0]

  if (rule.includeSupervisionFollowUp && task.activeSupervision) {
    const supervisionNextDate = task.activeSupervision.nextFollowUpDate
      ? task.activeSupervision.nextFollowUpDate.split('T')[0].split(' ')[0]
      : null

    const followUpNextDate = task.activeSupervision.latestFollowUp?.nextFollowUpDate
      ? task.activeSupervision.latestFollowUp.nextFollowUpDate.split('T')[0].split(' ')[0]
      : null

    const effectiveSupervisionDate = followUpNextDate || supervisionNextDate

    if (effectiveSupervisionDate && effectiveSupervisionDate < deadlineStr) {
      return effectiveSupervisionDate
    }
  }

  return deadlineStr
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const allRows = db.prepare(`
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.status != 'completed'
      ORDER BY t.deadline ASC, t.id DESC
    `).all() as TaskRowWithTitle[]

    const overdue: Task[] = []
    const todayTasks: Task[] = []
    const upcoming: Task[] = []

    const seenTaskIds = new Set<number>()

    allRows.forEach((row) => {
      if (seenTaskIds.has(row.id)) return

      const task = rowToTask(row)
      const rule = getReminderRuleForDepartment(task.department)
      const effectiveDate = getTaskEffectiveReminderDate(task, rule)

      if (!effectiveDate) return

      const date = new Date(effectiveDate)
      date.setHours(0, 0, 0, 0)

      const isOverdue = date < today

      if (isOverdue) {
        if (rule.repeatOverdue) {
          overdue.push(task)
          seenTaskIds.add(task.id)
        }
        return
      }

      const isToday = date.getTime() === today.getTime()

      if (isToday) {
        todayTasks.push(task)
        seenTaskIds.add(task.id)
        return
      }

      const diffTime = date.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= rule.advanceDays) {
        upcoming.push(task)
        seenTaskIds.add(task.id)
      }
    })

    const groups: ReminderGroups = {
      overdue,
      today: todayTasks,
      upcoming,
    }

    res.json({ success: true, data: groups })
  } catch (error) {
    console.error('Get reminders error:', error)
    res.status(500).json({ success: false, error: '获取提醒列表失败' })
  }
})

export default router
