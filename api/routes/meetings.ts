import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { Meeting, Task, CreateMeetingRequest } from '../../shared/types.js'

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

export default router
