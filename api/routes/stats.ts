import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { Stats } from '../../shared/types.js'

const router = Router()

function getThisWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { start, end } = getThisWeekRange()

    const meetingsCount = db.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }
    const tasksCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
    const completedCount = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get() as { count: number }

    const overdueCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE status != 'completed' AND deadline < ?
    `).get(today) as { count: number }

    const dueThisWeekCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE status != 'completed'
        AND deadline >= ?
        AND deadline <= ?
        AND deadline >= ?
    `).get(start, end, today) as { count: number }

    const stats: Stats = {
      totalMeetings: meetingsCount.count,
      totalTasks: tasksCount.count,
      overdueTasks: overdueCount.count,
      dueThisWeekTasks: dueThisWeekCount.count,
      completedTasks: completedCount.count,
    }

    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ success: false, error: '获取统计数据失败' })
  }
})

export default router
