import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import {
  getReminderBucket,
  getReminderRule,
  getTaskEffectiveReminderDateFromRow,
  type ReminderTaskRow,
} from '../lib/task-utils.js'
import type { Stats } from '../../shared/types.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const meetingsCount = db.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }
    const tasksCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
    const completedCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get() as { count: number }

    const taskRows = db.prepare(`
      SELECT t.id, t.department, t.deadline, t.status,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision,
        (SELECT next_follow_up_date FROM task_supervisions ts
         WHERE ts.task_id = t.id AND ts.status = 'active'
         ORDER BY ts.created_at DESC, ts.id DESC LIMIT 1) as next_follow_up_date,
        (SELECT f.next_follow_up_date FROM supervision_follow_ups f
         INNER JOIN task_supervisions ts ON f.supervision_id = ts.id
         WHERE ts.task_id = t.id AND ts.status = 'active'
         ORDER BY f.created_at DESC, f.id DESC LIMIT 1) as follow_up_next_date
      FROM tasks t
      WHERE t.status != 'completed'
    `).all() as ReminderTaskRow[]

    let overdueCount = 0
    let upcomingCount = 0

    const seenTaskIds = new Set<number>()

    taskRows.forEach((row) => {
      if (seenTaskIds.has(row.id)) return

      const rule = getReminderRule(row.department)
      const bucket = getReminderBucket(getTaskEffectiveReminderDateFromRow(row, rule), rule, today)

      if (bucket === 'overdue') {
        overdueCount++
        seenTaskIds.add(row.id)
      } else if (bucket === 'today' || bucket === 'upcoming') {
        upcomingCount++
        seenTaskIds.add(row.id)
      }
    })

    const stats: Stats = {
      totalMeetings: meetingsCount.count,
      totalTasks: tasksCount.count,
      overdueTasks: overdueCount,
      dueSoonTasks: upcomingCount,
      completedTasks: completedCount.count,
    }

    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ success: false, error: '获取统计数据失败' })
  }
})

export default router
