import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { Task, TaskProgress, UpdateTaskRequest, CalendarDayTasks } from '../../shared/types.js'

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

interface TaskProgressRow {
  id: number
  task_id: number
  status: string
  progress: string | null
  created_at: string
}

function rowToTaskProgress(row: TaskProgressRow): TaskProgress {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status as TaskProgress['status'],
    progress: row.progress || '',
    createdAt: row.created_at,
  }
}

const router = Router()

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

router.get('/', (req: Request, res: Response) => {
  try {
    const { department, status, page = '1', pageSize = '20' } = req.query

    let whereClause = 'WHERE 1=1'
    const params: (string | number)[] = []

    if (department && department !== 'all') {
      whereClause += ' AND t.department = ?'
      params.push(department as string)
    }

    if (status && status !== 'all') {
      whereClause += ' AND t.status = ?'
      params.push(status as string)
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks t
      ${whereClause}
    `).get(...params) as { count: number }
    const total = countRow.count

    const offset = (Number(page) - 1) * Number(pageSize)
    const rows = db.prepare(`
      SELECT t.*, m.title as meeting_title
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      ${whereClause}
      ORDER BY
        CASE t.status
          WHEN 'pending' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'completed' THEN 3
        END,
        t.deadline ASC,
        t.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, Number(pageSize), offset) as TaskRowWithTitle[]

    const tasks = rows.map(rowToTask)

    res.json({
      success: true,
      data: {
        list: tasks,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    })
  } catch (error) {
    console.error('Get tasks error:', error)
    res.status(500).json({ success: false, error: '获取待办事项失败' })
  }
})

router.get('/overdue', (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const rows = db.prepare(`
      SELECT t.*, m.title as meeting_title
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.status != 'completed' AND t.deadline < ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(today) as TaskRowWithTitle[]

    const tasks = rows.map(rowToTask)

    res.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Get overdue tasks error:', error)
    res.status(500).json({ success: false, error: '获取逾期事项失败' })
  }
})

router.get('/this-week', (_req: Request, res: Response) => {
  try {
    const { start, end } = getThisWeekRange()
    const today = new Date().toISOString().split('T')[0]

    const rows = db.prepare(`
      SELECT t.*, m.title as meeting_title
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.status != 'completed'
        AND t.deadline >= ?
        AND t.deadline <= ?
        AND t.deadline >= ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(start, end, today) as TaskRowWithTitle[]

    const tasks = rows.map(rowToTask)

    res.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Get this week tasks error:', error)
    res.status(500).json({ success: false, error: '获取本周到期事项失败' })
  }
})

router.get('/calendar', (req: Request, res: Response) => {
  try {
    const { year, month, department = 'all' } = req.query

    if (!year || !month) {
      return res.status(400).json({ success: false, error: '年份和月份不能为空' })
    }

    const y = Number(year)
    const m = Number(month)

    const daysInMonth = new Date(y, m, 0).getDate()
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    let whereClause = `WHERE t.status != 'completed' AND date(t.deadline) >= date(?) AND date(t.deadline) <= date(?)`
    const params: (string | number)[] = [startDate, endDate]

    if (department && department !== 'all') {
      whereClause += ' AND t.department = ?'
      params.push(department as string)
    }

    const rows = db.prepare(`
      SELECT t.*, m.title as meeting_title
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      ${whereClause}
      ORDER BY t.deadline ASC, t.id DESC
    `).all(...params) as TaskRowWithTitle[]

    const tasks = rows.map(rowToTask)

    const daysMap = new Map<string, CalendarDayTasks>()

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      daysMap.set(dateStr, { date: dateStr, tasks: [] })
    }

    tasks.forEach((task) => {
      const deadlineDate = task.deadline.split('T')[0].split(' ')[0]
      if (daysMap.has(deadlineDate)) {
        daysMap.get(deadlineDate)!.tasks.push(task)
      }
    })

    const days: CalendarDayTasks[] = Array.from(daysMap.values())

    res.json({
      success: true,
      data: {
        year: y,
        month: m,
        days,
      },
    })
  } catch (error) {
    console.error('Get calendar tasks error:', error)
    res.status(500).json({ success: false, error: '获取日历事项失败' })
  }
})

router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status, progress } = req.body as UpdateTaskRequest

    const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRowWithTitle | undefined
    if (!taskRow) {
      return res.status(404).json({ success: false, error: '事项不存在' })
    }

    const fields: string[] = []
    const values: (string | number)[] = []

    if (status !== undefined) {
      fields.push('status = ?')
      values.push(status)
    }

    if (progress !== undefined) {
      fields.push('progress = ?')
      values.push(progress)
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' })
    }

    fields.push("updated_at = datetime('now', 'localtime')")
    values.push(Number(id))

    const newStatus = status !== undefined ? status : taskRow.status
    const newProgress = progress !== undefined ? progress : taskRow.progress || ''

    db.transaction(() => {
      const stmt = db.prepare(`
        UPDATE tasks
        SET ${fields.join(', ')}
        WHERE id = ?
      `)
      stmt.run(...values)

      const insertProgress = db.prepare(`
        INSERT INTO task_progress (task_id, status, progress)
        VALUES (?, ?, ?)
      `)
      insertProgress.run(Number(id), newStatus, newProgress)
    })()

    const updatedRow = db.prepare(`
      SELECT t.*, m.title as meeting_title
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.id = ?
    `).get(id) as TaskRowWithTitle

    const task = rowToTask(updatedRow)

    res.json({ success: true, data: task })
  } catch (error) {
    console.error('Update task error:', error)
    res.status(500).json({ success: false, error: '更新事项失败' })
  }
})

router.get('/:id/progress', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRowWithTitle | undefined
    if (!taskRow) {
      return res.status(404).json({ success: false, error: '事项不存在' })
    }

    const rows = db.prepare(`
      SELECT * FROM task_progress
      WHERE task_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(id) as TaskProgressRow[]

    const progressList = rows.map(rowToTaskProgress)

    res.json({ success: true, data: progressList })
  } catch (error) {
    console.error('Get task progress error:', error)
    res.status(500).json({ success: false, error: '获取进展记录失败' })
  }
})

export default router
