import { Router, type Request, type Response } from 'express'
import db from '../db.js'
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

router.get('/', (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const threeDaysLater = new Date(today)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)
    threeDaysLater.setHours(23, 59, 59, 999)
    const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0]

    const allRows = db.prepare(`
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.status != 'completed'
        AND t.deadline <= ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(threeDaysLaterStr) as TaskRowWithTitle[]

    const overdue: Task[] = []
    const todayTasks: Task[] = []
    const nextThreeDays: Task[] = []

    allRows.forEach((row) => {
      const task = rowToTask(row)
      const deadlineDate = new Date(row.deadline)
      deadlineDate.setHours(0, 0, 0, 0)

      if (deadlineDate < today) {
        overdue.push(task)
      } else if (deadlineDate.getTime() === today.getTime()) {
        todayTasks.push(task)
      } else {
        nextThreeDays.push(task)
      }
    })

    const groups: ReminderGroups = {
      overdue,
      today: todayTasks,
      nextThreeDays,
    }

    res.json({ success: true, data: groups })
  } catch (error) {
    console.error('Get reminders error:', error)
    res.status(500).json({ success: false, error: '获取提醒列表失败' })
  }
})

export default router
