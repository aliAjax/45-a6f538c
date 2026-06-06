import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { Task, ReminderGroups } from '../../shared/types.js'

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

router.get('/', (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const threeDaysLater = new Date(today)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)
    threeDaysLater.setHours(23, 59, 59, 999)
    const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0]

    const allRows = db.prepare(`
      SELECT t.*, m.title as meeting_title
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
