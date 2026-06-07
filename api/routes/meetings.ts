import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type {
  Meeting,
  Task,
  CreateMeetingRequest,
  MeetingReviewStats,
  ParsedMeeting,
  ParsedTask,
  ParseMeetingRequest,
  ParseMeetingResponse,
} from '../../shared/types.js'

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
  has_active_supervision?: number
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
    hasActiveSupervision: !!row.has_active_supervision,
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

    const taskRows = db.prepare(`
      SELECT t.*,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      WHERE t.meeting_id = ?
      ORDER BY t.id ASC
    `).all(id) as TaskRow[]

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
    const taskRows = db.prepare(`
      SELECT t.*,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      WHERE t.meeting_id = ?
      ORDER BY t.id ASC
    `).all(result) as TaskRow[]

    const meeting = rowToMeeting(meetingRow)
    meeting.tasks = taskRows.map(rowToTask)

    res.status(201).json({ success: true, data: meeting })
  } catch (error) {
    console.error('Create meeting error:', error)
    res.status(500).json({ success: false, error: '创建会议纪要失败' })
  }
})

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

function normalizeDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return ''

  const cleaned = dateStr.trim().replace(/年|月/g, '-').replace(/日/g, '')
  const date = new Date(cleaned)
  if (isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  const cnMatch = dateStr.trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/)
  const match = isoMatch || cnMatch

  if (match) {
    const inputYear = parseInt(match[1], 10)
    const inputMonth = parseInt(match[2], 10)
    const inputDay = parseInt(match[3], 10)
    if (
      inputYear !== year ||
      inputMonth !== month ||
      inputDay !== day
    ) {
      return ''
    }
  }

  if (year < 1900 || year > 2100) return ''
  if (month < 1 || month > 12) return ''
  if (day < 1 || day > 31) return ''

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  const normalized = normalizeDate(dateStr)
  if (!normalized) return false

  const [yearStr, monthStr, dayStr] = normalized.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function normalizeDateTime(dateTimeStr: string): string {
  if (!dateTimeStr || !dateTimeStr.trim()) return ''

  const trimmed = dateTimeStr.trim()

  const fullPatterns = [
    /^(\d{4})[-年](\d{1,2})[-月](\d{1,2})[日\s]*[ T]?(\d{1,2}):(\d{2})(?::(\d{2}))?/,
  ]

  for (const pattern of fullPatterns) {
    const match = trimmed.match(pattern)
    if (match) {
      const year = parseInt(match[1], 10)
      const month = parseInt(match[2], 10)
      const day = parseInt(match[3], 10)
      const hours = parseInt(match[4], 10)
      const minutes = parseInt(match[5], 10)

      if (month < 1 || month > 12) return ''
      if (day < 1 || day > 31) return ''
      if (hours < 0 || hours > 23) return ''
      if (minutes < 0 || minutes > 59) return ''

      const date = new Date(year, month - 1, day)
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return ''
      }

      const mm = String(month).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      const hh = String(hours).padStart(2, '0')
      const min = String(minutes).padStart(2, '0')
      return `${year}-${mm}-${dd}T${hh}:${min}`
    }
  }

  const dateOnly = normalizeDate(trimmed)
  if (dateOnly) {
    return `${dateOnly}T09:00`
  }

  return ''
}

function deduplicateDepartments(departments: string): string {
  const parts = departments
    .split(/[、,，;；\s]+/)
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
  const seen = new Set<string>()
  const result: string[] = []
  for (const dept of parts) {
    if (!seen.has(dept)) {
      seen.add(dept)
      result.push(dept)
    }
  }
  return result.join('、')
}

function parseSingleMeeting(text: string): ParsedMeeting {
  const lines = text.split('\n').map((l) => l.trim())
  const warnings: string[] = []
  let title = ''
  let departments = ''
  let meetingDate = ''
  const tasks: ParsedTask[] = []

  const titlePatterns = [
    /^会议主题[:：]\s*(.+)/i,
    /^主题[:：]\s*(.+)/i,
    /^会议名称[:：]\s*(.+)/i,
    /^会议议题[:：]\s*(.+)/i,
  ]

  const deptPatterns = [
    /^参会部门[:：]\s*(.+)/i,
    /^部门[:：]\s*(.+)/i,
    /^参会人员[:：]\s*(.+)/i,
    /^参加部门[:：]\s*(.+)/i,
    /^与会部门[:：]\s*(.+)/i,
  ]

  const datePatterns = [
    /^会议时间[:：]\s*(.+)/i,
    /^时间[:：]\s*(.+)/i,
    /^日期[:：]\s*(.+)/i,
    /^会议日期[:：]\s*(.+)/i,
    /^召开时间[:：]\s*(.+)/i,
  ]

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line) {
      i++
      continue
    }

    let matched = false

    for (const pattern of titlePatterns) {
      const match = line.match(pattern)
      if (match) {
        title = match[1].trim()
        matched = true
        break
      }
    }
    if (matched) {
      i++
      continue
    }

    for (const pattern of deptPatterns) {
      const match = line.match(pattern)
      if (match) {
        departments = match[1].trim()
        matched = true
        break
      }
    }
    if (matched) {
      i++
      continue
    }

    for (const pattern of datePatterns) {
      const match = line.match(pattern)
      if (match) {
        meetingDate = match[1].trim()
        matched = true
        break
      }
    }
    if (matched) {
      i++
      continue
    }

    const taskMatch = line.match(/^(\d+)[.、．]\s*(.+)/)
    const bulletMatch = line.match(/^[•\-●○■▪▫–—]\s*(.+)/)

    if (taskMatch || bulletMatch) {
      const taskContent = taskMatch ? taskMatch[2] : bulletMatch![1]
      let content = taskContent.trim()
      let taskDepartment = ''
      let taskDeadline = ''

      const deptInContentMatch = content.match(/^(.+?)[（(]([^)）]+)[）)]\s*[:：]?\s*(.*)$/)
      if (deptInContentMatch) {
        taskDepartment = deptInContentMatch[2].trim()
        content = (deptInContentMatch[1] + (deptInContentMatch[3] ? '：' + deptInContentMatch[3] : '')).trim()
      }

      const deadlinePatterns = [
        /[于在]\s*(\d{4}[年\-]\d{1,2}[月\-]\d{1,2}日?)\s*(?:前|之前|完成|提交|截止)?/,
        /(?:截止|期限|完成期限)[:：]?\s*(\d{4}[年\-]\d{1,2}[月\-]\d{1,2}日?)\s*(?:前|之前|完成)?/,
        /(\d{4}[年\-]\d{1,2}[月\-]\d{1,2}日?)\s*(?:前|之前|完成|截止)/,
      ]

      for (const pattern of deadlinePatterns) {
        const dlMatch = content.match(pattern)
        if (dlMatch) {
          const dateStr = dlMatch[1].trim()
          const normalized = normalizeDate(dateStr)
          if (normalized) {
            taskDeadline = normalized
            let cleaned = content.replace(dlMatch[0], '')
            cleaned = cleaned.replace(/[，,。.：:；;、\s]+$/, '')
            cleaned = cleaned.replace(/^[，,。.：:；;、\s]+/, '')
            cleaned = cleaned.replace(/\s{2,}/g, ' ')
            content = cleaned.trim()
          }
          break
        }
      }

      if (!taskDepartment) {
        const deptColonMatch = content.match(/^(.+?)[:：]\s*(.+)$/)
        if (deptColonMatch) {
          const potentialDept = deptColonMatch[1].trim()
          if (potentialDept.length <= 10 && !potentialDept.includes(' ')) {
            taskDepartment = potentialDept
            content = deptColonMatch[2].trim()
          }
        }
      }

      i++
      while (i < lines.length) {
        const nextLine = lines[i]
        if (!nextLine) {
          i++
          break
        }
        const isNextTask =
          /^(\d+)[.、．]/.test(nextLine) ||
          /^[•\-●○■▪▫–—]/.test(nextLine) ||
          titlePatterns.some((p) => p.test(nextLine)) ||
          deptPatterns.some((p) => p.test(nextLine)) ||
          datePatterns.some((p) => p.test(nextLine))
        if (isNextTask) {
          break
        }
        content += ' ' + nextLine.trim()
        i++
      }

      tasks.push({
        content: content.trim(),
        department: taskDepartment,
        deadline: taskDeadline,
      })
      continue
    }

    if (!title && line.length > 0 && line.length < 50 && i < 3) {
      title = line
    }

    i++
  }

  if (departments) {
    const originalDepts = departments
    departments = deduplicateDepartments(departments)
    if (originalDepts !== departments) {
      warnings.push('参会部门已去重')
    }
  }

  if (meetingDate) {
    const normalized = normalizeDateTime(meetingDate)
    if (normalized) {
      meetingDate = normalized
    } else {
      warnings.push('会议时间格式无法识别，请手动填写')
      meetingDate = ''
    }
  }

  if (!title) {
    warnings.push('未识别到会议主题，请手动填写')
  }
  if (!departments) {
    warnings.push('未识别到参会部门，请手动填写')
  }
  if (!meetingDate) {
    warnings.push('未识别到会议时间，请手动填写')
  }
  if (tasks.length === 0) {
    warnings.push('未识别到议定事项，请手动添加')
  }

  tasks.forEach((task, idx) => {
    if (!task.content.trim()) {
      warnings.push(`第 ${idx + 1} 条事项内容为空`)
    }
    if (!task.department) {
      warnings.push(`第 ${idx + 1} 条事项未识别到责任科室`)
    }
    if (!task.deadline) {
      warnings.push(`第 ${idx + 1} 条事项未识别到完成期限`)
    } else if (!isValidDate(task.deadline)) {
      warnings.push(`第 ${idx + 1} 条事项完成期限无效`)
    }
  })

  return {
    title,
    departments,
    meetingDate,
    tasks,
    warnings,
  }
}

function splitMeetings(text: string): string[] {
  const separators = [
    /\n\s*-{3,}\s*\n/,
    /\n\s*={3,}\s*\n/,
    /\n\s*【.*?】\s*\n/,
  ]

  let parts = [text]

  for (const sep of separators) {
    const newParts: string[] = []
    for (const part of parts) {
      newParts.push(...part.split(sep))
    }
    parts = newParts
  }

  const result = parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (result.length === 1 && result[0].length > 0) {
    return [result[0]]
  }

  return result
}

router.post('/parse', (req: Request, res: Response) => {
  try {
    const { text } = req.body as ParseMeetingRequest

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: '请输入要解析的文本内容' })
    }

    const meetingTexts = splitMeetings(text)
    const meetings: ParsedMeeting[] = meetingTexts.map(parseSingleMeeting)

    const allWarnings: string[] = []
    meetings.forEach((m, idx) => {
      if (m.warnings.length > 0) {
        allWarnings.push(...m.warnings.map((w) => `第 ${idx + 1} 个会议：${w}`))
      }
    })

    const response: ParseMeetingResponse = {
      meetings,
      warnings: allWarnings,
    }

    res.json({ success: true, data: response })
  } catch (error) {
    console.error('Parse meeting error:', error)
    res.status(500).json({ success: false, error: '解析会议纪要失败' })
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
      whereConditions.push('m.meeting_date < ?')
      params.push(addDays(String(endDate), 1))
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
