import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import {
  getReminderRule,
  isTaskInReminder,
  mapRowsToTasks,
  type TaskRow as TaskRowWithTitle,
} from '../lib/task-utils.js'
import type { Task, ReminderGroups } from '../../shared/types.js'

const router = Router()

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

    const tasks = mapRowsToTasks(allRows)

    tasks.forEach((task) => {
      if (seenTaskIds.has(task.id)) return

      const rule = getReminderRule(task.department)
      const bucket = isTaskInReminder(task, rule, today)

      if (bucket === 'overdue') {
        overdue.push(task)
        seenTaskIds.add(task.id)
      } else if (bucket === 'today') {
        todayTasks.push(task)
        seenTaskIds.add(task.id)
      } else if (bucket === 'upcoming') {
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
