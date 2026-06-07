import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { Meeting, Task, CreateMeetingRequest, MeetingReviewStats } from '../../shared/types.js'

interface MeetingRow {
  id: number
  title: string
  departments: string
  meeting_date: string
  created_at: string
  updated_at: string
}

interface TaskRow {
  id: number
  meeting_id: number
  content: string
  department: string
  deadline: string
  status: string
  progress: string | null
  created_at: string
  updated_at: string
}

const router = Router()

function rowToMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    departments: row.departments,
    meetingDate: row.meeting_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTask(row: TaskRow): Task {
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
  }
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { search, page = '1', pageSize = '10' } = req.query

    let whereClause = ''
    const params: (string | number)[] = []

    if (search) {
      whereClause = 'WHERE title LIKE ?'
      params.push(`%${search}%`)
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM meetings ${whereClause}`).get(...params) as { count: number }
    const total = countRow.count

    const offset = (Number(page) - 1) * Number(pageSize)
    const rows = db.prepare(
      `SELECT * FROM meetings ${whereClause} ORDER BY meeting_date DESC, id DESC LIMIT ? OFFSET ?`
    ).all(...params, Number(pageSize), offset) as MeetingRow[]

    const meetings = rows.map(rowToMeeting)

    res.json({
      success: true,
      data: {
        list: meetings,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    })
  } catch (error) {
    console.error('Get meetings error:', error)
    res.status(500).json({ success: false, error: '获取会议列表失败' })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const meetingRow = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined
    if (!meetingRow) {
      return res.status(404).json({ success: false, error: '会议纪要不存在' })
    }

    const taskRows = db.prepare('SELECT * FROM tasks WHERE meeting_id = ? ORDER BY id ASC').all(id) as TaskRow[]

    const meeting = rowToMeeting(meetingRow)
    meeting.tasks = taskRows.map(rowToTask)

    res.json({ success: true, data: meeting })
  } catch (error) {
    console.error('Get meeting detail error:', error)
    res.status(500).json({ success: false, error: '获取会议详情失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { title, departments, meetingDate, tasks } = req.body as CreateMeetingRequest

    if (!title || !departments || !meetingDate || !tasks || tasks.length === 0) {
      return res.status(400).json({ success: false, error: '请填写完整信息' })
    }

    const insertMeeting = db.prepare(`
      INSERT INTO meetings (title, departments, meeting_date)
      VALUES (?, ?, ?)
    `)

    const insertTask = db.prepare(`
      INSERT INTO tasks (meeting_id, content, department, deadline)
      VALUES (?, ?, ?, ?)
    `)

    const insertTaskProgress = db.prepare(`
      INSERT INTO task_progress (task_id, status, progress, created_at)
      VALUES (?, 'pending', '', datetime('now', 'localtime'))
    `)

    const result = db.transaction(() => {
      const meetingResult = insertMeeting.run(title, departments, meetingDate)
      const meetingId = meetingResult.lastInsertRowid as number

      tasks.forEach(task => {
        const taskResult = insertTask.run(meetingId, task.content, task.department, task.deadline)
        const taskId = taskResult.lastInsertRowid as number
        insertTaskProgress.run(taskId)
      })

      return meetingId
    })()

    const meetingRow = db.prepare('SELECT * FROM meetings WHERE id = ?').get(result) as MeetingRow
    const taskRows = db.prepare('SELECT * FROM tasks WHERE meeting_id = ? ORDER BY id ASC').all(result) as TaskRow[]

    const meeting = rowToMeeting(meetingRow)
    meeting.tasks = taskRows.map(rowToTask)

    res.status(201).json({ success: true, data: meeting })
  } catch (error) {
    console.error('Create meeting error:', error)
    res.status(500).json({ success: false, error: '创建会议纪要失败' })
  }
})

router.get('/review/stats', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, search, page = '1', pageSize = '10' } = req.query

    const today = new Date().toISOString().split('T')[0]

    const whereConditions: string[] = []
    const params: (string | number)[] = []

    if (startDate) {
      whereConditions.push('m.meeting_date >= ?')
      params.push(String(startDate))
    }
    if (endDate) {
      whereConditions.push('m.meeting_date <= ?')
      params.push(String(endDate))
    }
    if (search) {
      whereConditions.push('m.title LIKE ?')
      params.push(`%${search}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const countSql = `
      SELECT COUNT(DISTINCT m.id) as count
      FROM meetings m
      ${whereClause}
    `
    const countRow = db.prepare(countSql).get(...params) as { count: number }
    const total = countRow.count

    const offset = (Number(page) - 1) * Number(pageSize)

    const statsSql = `
      SELECT
        m.id as meetingId,
        m.title as meetingTitle,
        m.meeting_date as meetingDate,
        m.departments as departments,
        COUNT(t.id) as totalTasks,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completedTasks,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pendingTasks,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressTasks,
        SUM(CASE WHEN t.status != 'completed' AND t.deadline < ? THEN 1 ELSE 0 END) as overdueTasks
      FROM meetings m
      LEFT JOIN tasks t ON m.id = t.meeting_id
      ${whereClause}
      GROUP BY m.id
      ORDER BY m.meeting_date DESC, m.id DESC
      LIMIT ? OFFSET ?
    `

    const statsRows = db.prepare(statsSql).all(today, ...params, Number(pageSize), offset) as Array<{
      meetingId: number
      meetingTitle: string
      meetingDate: string
      departments: string
      totalTasks: number
      completedTasks: number
      pendingTasks: number
      inProgressTasks: number
      overdueTasks: number
    }>

    const list: MeetingReviewStats[] = statsRows.map((row) => ({
      meetingId: row.meetingId,
      meetingTitle: row.meetingTitle,
      meetingDate: row.meetingDate,
      departments: row.departments,
      totalTasks: row.totalTasks,
      completedTasks: row.completedTasks,
      pendingTasks: row.pendingTasks,
      inProgressTasks: row.inProgressTasks,
      overdueTasks: row.overdueTasks,
      completionRate: row.totalTasks > 0
        ? Math.round((row.completedTasks / row.totalTasks) * 100)
        : 0,
    }))

    res.json({
      success: true,
      data: {
        list,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    })
  } catch (error) {
    console.error('Get meeting review stats error:', error)
    res.status(500).json({ success: false, error: '获取会议复盘统计失败' })
  }
})

export default router
