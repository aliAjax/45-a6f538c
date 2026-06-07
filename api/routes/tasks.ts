import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type {
  Task,
  TaskProgress,
  TaskSupervision,
  SupervisionFollowUp,
  UpdateTaskRequest,
  CalendarDayTasks,
  BatchUpdateTaskRequest,
  BatchUpdateTaskResponse,
  BatchUpdateTaskResult,
  BatchUpdateTaskItem,
  DepartmentWorkbenchData,
  DepartmentRiskDetail,
  DepartmentRiskStats,
} from '../../shared/types.js'

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

interface TaskProgressRow {
  id: number
  task_id: number
  status: string
  progress: string | null
  created_at: string
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

function rowToTaskProgress(row: TaskProgressRow): TaskProgress {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status as TaskProgress['status'],
    progress: row.progress || '',
    createdAt: row.created_at,
  }
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

const router = Router()

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

function enrichTasksWithDependencies(tasks: Task[]) {
  if (tasks.length === 0) return

  const taskMap = new Map<number, Task>()
  tasks.forEach(task => taskMap.set(task.id, task))

  const allRelatedIds = new Set<number>()
  tasks.forEach(task => allRelatedIds.add(task.id))

  const dependencyRows = db.prepare(`
    SELECT td.task_id, td.prerequisite_task_id,
           t.status as prereq_status,
           t.content as prereq_content,
           t.meeting_id as prereq_meeting_id
    FROM task_dependencies td
    LEFT JOIN tasks t ON td.prerequisite_task_id = t.id
    WHERE td.task_id IN (${tasks.map(() => '?').join(',')})
       OR td.prerequisite_task_id IN (${tasks.map(() => '?').join(',')})
  `).all(...[...tasks.map(t => t.id), ...tasks.map(t => t.id)]) as Array<{
    task_id: number
    prerequisite_task_id: number
    prereq_status: string
    prereq_content: string
    prereq_meeting_id: number
  }>

  tasks.forEach(task => {
    const prereqIds: number[] = []
    const blockingIds: number[] = []
    const prereqInfoMap = new Map<number, { status: string; content: string; meetingId: number }>()

    dependencyRows.forEach(row => {
      if (row.task_id === task.id) {
        prereqIds.push(row.prerequisite_task_id)
        prereqInfoMap.set(row.prerequisite_task_id, {
          status: row.prereq_status,
          content: row.prereq_content,
          meetingId: row.prereq_meeting_id,
        })
      }
      if (row.prerequisite_task_id === task.id) {
        blockingIds.push(row.task_id)
      }
    })

    task.prerequisiteTaskIds = prereqIds
    task.blockingTaskIds = blockingIds

    const uncompletedPrereqs = prereqIds.filter(id => {
      const prereqInfo = prereqInfoMap.get(id)
      return prereqInfo && prereqInfo.status !== 'completed'
    })
    task.isBlocked = uncompletedPrereqs.length > 0

    task.prerequisiteTasks = prereqIds
      .map(id => {
        const existing = taskMap.get(id)
        if (existing) return existing
        const info = prereqInfoMap.get(id)
        if (info) {
          return {
            id,
            meetingId: info.meetingId,
            content: info.content,
            department: '',
            deadline: '',
            status: info.status as Task['status'],
            progress: '',
            createdAt: '',
            updatedAt: '',
            isBlocked: false,
            prerequisiteTaskIds: [],
            blockingTaskIds: [],
          }
        }
        return null
      })
      .filter((t): t is Task => t !== null)
    task.blockingTasks = blockingIds
      .map(id => taskMap.get(id))
      .filter((t): t is Task => t !== undefined)
  })
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
    const { department, status, risk, page = '1', pageSize = '20' } = req.query
    const today = new Date().toISOString().split('T')[0]
    const { start: dueSoonStart, end: dueSoonEnd } = getDueSoonRange()
    const longNoUpdateDate = getLongNoUpdateDate()

    let whereClause = 'WHERE 1=1'
    const params: (string | number)[] = []

    if (department && department !== 'all') {
      whereClause += ' AND t.department = ?'
      params.push(department as string)
    }

    if (risk === 'overdue') {
      whereClause += ' AND t.status != ? AND t.deadline < ?'
      params.push('completed', today)
    } else if (risk === 'dueSoon') {
      whereClause += ' AND t.status != ? AND t.deadline >= ? AND t.deadline <= ?'
      params.push('completed', dueSoonStart, dueSoonEnd)
    } else if (risk === 'supervising') {
      whereClause += ` AND t.status != ? AND EXISTS (
        SELECT 1 FROM task_supervisions ts
        WHERE ts.task_id = t.id AND ts.status = 'active'
      )`
      params.push('completed')
    } else if (risk === 'longNoUpdate') {
      whereClause += ' AND t.status != ? AND t.updated_at < ?'
      params.push('completed', longNoUpdateDate)
    } else if (status && status !== 'all') {
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
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
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
    enrichTasksWithDependencies(tasks)

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
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.status != 'completed' AND t.deadline < ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(today) as TaskRowWithTitle[]

    const tasks = rows.map(rowToTask)
    enrichTasksWithDependencies(tasks)

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
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.status != 'completed'
        AND t.deadline >= ?
        AND t.deadline <= ?
        AND t.deadline >= ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(start, end, today) as TaskRowWithTitle[]

    const tasks = rows.map(rowToTask)
    enrichTasksWithDependencies(tasks)

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
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      ${whereClause}
      ORDER BY t.deadline ASC, t.id DESC
    `).all(...params) as TaskRowWithTitle[]

    const tasks = rows.map(rowToTask)
    enrichTasksWithDependencies(tasks)

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
    const { status, progress, prerequisiteTaskIds } = req.body as UpdateTaskRequest

    const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRowWithTitle | undefined
    if (!taskRow) {
      return res.status(404).json({ success: false, error: '事项不存在' })
    }

    if (status === 'completed') {
      const uncompletedPrereqs = db.prepare(`
        SELECT t.id, t.content, t.status
        FROM task_dependencies td
        JOIN tasks t ON td.prerequisite_task_id = t.id
        WHERE td.task_id = ? AND t.status != 'completed'
      `).all(Number(id)) as Array<{ id: number; content: string; status: string }>

      if (uncompletedPrereqs.length > 0) {
        const prereqNames = uncompletedPrereqs.map(p => p.content.slice(0, 20)).join('、')
        return res.status(400).json({
          success: false,
          error: `无法标记为完成，还有 ${uncompletedPrereqs.length} 个前置事项未完成：${prereqNames}...`,
          blockedBy: uncompletedPrereqs,
        })
      }
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

    const hasFieldUpdates = fields.length > 0

    if (hasFieldUpdates) {
      fields.push("updated_at = datetime('now', 'localtime')")
      values.push(Number(id))
    }

    const newStatus = status !== undefined ? status : taskRow.status
    const newProgress = progress !== undefined ? progress : taskRow.progress || ''

    db.transaction(() => {
      if (hasFieldUpdates) {
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

        if (newStatus === 'completed') {
          db.prepare(`
            UPDATE task_supervisions
            SET status = 'closed',
                closed_at = datetime('now', 'localtime'),
                updated_at = datetime('now', 'localtime')
            WHERE task_id = ? AND status = 'active'
          `).run(Number(id))
        }
      }

      if (prerequisiteTaskIds !== undefined) {
        const taskId = Number(id)
        const meetingId = taskRow.meeting_id

        db.prepare(`DELETE FROM task_dependencies WHERE task_id = ?`).run(taskId)

        const insertDep = db.prepare(`
          INSERT OR IGNORE INTO task_dependencies (task_id, prerequisite_task_id)
          VALUES (?, ?)
        `)

        prerequisiteTaskIds.forEach(prereqId => {
          if (prereqId !== taskId) {
            const prereqRow = db.prepare(
              'SELECT meeting_id FROM tasks WHERE id = ?'
            ).get(prereqId) as { meeting_id: number } | undefined
            if (prereqRow && prereqRow.meeting_id === meetingId) {
              insertDep.run(taskId, prereqId)
            }
          }
        })
      }
    })()

    const updatedRow = db.prepare(`
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.id = ?
    `).get(id) as TaskRowWithTitle

    const task = rowToTask(updatedRow)
    enrichTasksWithDependencies([task])

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

router.patch('/batch/update', (req: Request, res: Response) => {
  try {
    const { updates } = req.body as BatchUpdateTaskRequest

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: '更新列表不能为空' })
    }

    if (updates.length > 100) {
      return res.status(400).json({ success: false, error: '单次批量更新不能超过100条' })
    }

    const results: BatchUpdateTaskResult[] = []
    let successCount = 0
    let failCount = 0

    const updateMap = new Map<number, BatchUpdateTaskItem>()
    updates.forEach(u => updateMap.set(u.id, u))

    const taskRows = new Map<number, TaskRowWithTitle>()
    updates.forEach(update => {
      const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(update.id) as TaskRowWithTitle | undefined
      if (row) taskRows.set(update.id, row)
    })

    const allPrereqMap = new Map<number, number[]>()
    const allBlockingMap = new Map<number, number[]>()

    const depRows = db.prepare(`
      SELECT task_id, prerequisite_task_id
      FROM task_dependencies
      WHERE task_id IN (${updates.map(() => '?').join(',')})
         OR prerequisite_task_id IN (${updates.map(() => '?').join(',')})
    `).all(...[...updates.map(u => u.id), ...updates.map(u => u.id)]) as Array<{
      task_id: number
      prerequisite_task_id: number
    }>

    depRows.forEach(row => {
      const prereqs = allPrereqMap.get(row.task_id) || []
      prereqs.push(row.prerequisite_task_id)
      allPrereqMap.set(row.task_id, prereqs)

      const blocking = allBlockingMap.get(row.prerequisite_task_id) || []
      blocking.push(row.task_id)
      allBlockingMap.set(row.prerequisite_task_id, blocking)
    })

    function isTaskBlocked(taskId: number, completingSet: Set<number>): boolean {
      const prereqs = allPrereqMap.get(taskId) || []
      for (const prereqId of prereqs) {
        const prereqRow = taskRows.get(prereqId)
        const prereqUpdate = updateMap.get(prereqId)
        const willBeCompleted = prereqUpdate?.status === 'completed'
        const isCompleted = prereqRow?.status === 'completed'
        if (!isCompleted && !willBeCompleted) {
          return true
        }
        if (!prereqRow && !completingSet.has(prereqId)) {
          const actualRow = db.prepare('SELECT status FROM tasks WHERE id = ?').get(prereqId) as { status: string } | undefined
          if (actualRow && actualRow.status !== 'completed') {
            return true
          }
        }
      }
      return false
    }

    const toComplete: number[] = []
    updates.forEach(update => {
      if (update.status === 'completed') {
        toComplete.push(update.id)
      }
    })

    const blockedTasks: number[] = []
    if (toComplete.length > 0) {
      const completingSet = new Set<number>(toComplete)
      toComplete.forEach(taskId => {
        if (isTaskBlocked(taskId, completingSet)) {
          blockedTasks.push(taskId)
        }
      })
    }

    if (blockedTasks.length > 0) {
      const blockedDetails = blockedTasks.map(taskId => {
        const task = taskRows.get(taskId)
        const prereqs = allPrereqMap.get(taskId) || []
        const uncompletedPrereqs = prereqs.filter(prereqId => {
          const prereqTask = taskRows.get(prereqId)
          const prereqUpdate = updateMap.get(prereqId)
          return prereqTask?.status !== 'completed' && prereqUpdate?.status !== 'completed'
        })
        return {
          id: taskId,
          content: task?.content || '',
          uncompletedPrereqCount: uncompletedPrereqs.length,
        }
      })

      return res.status(400).json({
        success: false,
        error: `有 ${blockedTasks.length} 个事项因前置事项未完成而无法标记为已完成`,
        blockedTasks: blockedDetails,
      })
    }

    const processed = new Set<number>()

    function processUpdate(update: BatchUpdateTaskItem) {
      if (processed.has(update.id)) return

      const taskRow = taskRows.get(update.id)
      if (!taskRow) {
        results.push({ id: update.id, success: false, error: '事项不存在' })
        failCount++
        processed.add(update.id)
        return
      }

      const fields: string[] = []
      const values: (string | number)[] = []

      if (update.status !== undefined) {
        fields.push('status = ?')
        values.push(update.status)
      }

      if (update.progress !== undefined) {
        fields.push('progress = ?')
        values.push(update.progress)
      }

      if (fields.length === 0) {
        results.push({ id: update.id, success: false, error: '没有需要更新的字段' })
        failCount++
        processed.add(update.id)
        return
      }

      fields.push("updated_at = datetime('now', 'localtime')")
      values.push(Number(update.id))

      const newStatus = update.status !== undefined ? update.status : taskRow.status
      const newProgress = update.progress !== undefined ? update.progress : taskRow.progress || ''

      try {
        const updateTransaction = db.transaction(() => {
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
          insertProgress.run(Number(update.id), newStatus, newProgress)

          if (newStatus === 'completed') {
            db.prepare(`
              UPDATE task_supervisions
              SET status = 'closed',
                  closed_at = datetime('now', 'localtime'),
                  updated_at = datetime('now', 'localtime')
              WHERE task_id = ? AND status = 'active'
            `).run(Number(update.id))
          }
        })

        updateTransaction()

        const updatedRow = db.prepare(`
          SELECT t.*, m.title as meeting_title,
            EXISTS (
              SELECT 1 FROM task_supervisions ts
              WHERE ts.task_id = t.id AND ts.status = 'active'
            ) as has_active_supervision
          FROM tasks t
          LEFT JOIN meetings m ON t.meeting_id = m.id
          WHERE t.id = ?
        `).get(update.id) as TaskRowWithTitle

        const task = rowToTask(updatedRow)

        results.push({ id: update.id, success: true, task })
        successCount++
      } catch (err) {
        console.error(`Batch update task ${update.id} error:`, err)
        results.push({ id: update.id, success: false, error: '更新失败' })
        failCount++
      }
      processed.add(update.id)
    }

    function topologicalSortAndProcess(ids: number[]) {
      const visited = new Set<number>()
      const temp = new Set<number>()

      function visit(id: number) {
        if (visited.has(id)) return
        if (temp.has(id)) return

        temp.add(id)
        const prereqs = allPrereqMap.get(id) || []
        for (const prereqId of prereqs) {
          if (updateMap.has(prereqId)) {
            visit(prereqId)
          }
        }
        temp.delete(id)
        visited.add(id)

        const update = updateMap.get(id)
        if (update) {
          processUpdate(update)
        }
      }

      ids.forEach(id => visit(id))
    }

    topologicalSortAndProcess(updates.map(u => u.id))

    const taskResults = results
      .filter(r => r.success && r.task)
      .map(r => r.task!)
    if (taskResults.length > 0) {
      enrichTasksWithDependencies(taskResults)
    }

    const response: BatchUpdateTaskResponse = {
      total: updates.length,
      successCount,
      failCount,
      results,
    }

    res.json({ success: true, data: response })
  } catch (error) {
    console.error('Batch update tasks error:', error)
    res.status(500).json({ success: false, error: '批量更新失败' })
  }
})

router.get('/workbench/:department', (req: Request, res: Response) => {
  try {
    const { department } = req.params
    const today = new Date().toISOString().split('T')[0]
    const { start, end } = getThisWeekRange()

    const pendingRows = db.prepare(`
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.department = ?
        AND t.status = 'pending'
        AND t.deadline >= ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(department, today) as TaskRowWithTitle[]

    const overdueRows = db.prepare(`
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.department = ?
        AND t.status != 'completed'
        AND t.deadline < ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(department, today) as TaskRowWithTitle[]

    const dueThisWeekRows = db.prepare(`
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.department = ?
        AND t.status != 'completed'
        AND t.deadline >= ?
        AND t.deadline <= ?
        AND t.deadline >= ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(department, start, end, today) as TaskRowWithTitle[]

    const completedRows = db.prepare(`
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.department = ?
        AND t.status = 'completed'
      ORDER BY t.updated_at DESC, t.id DESC
      LIMIT 50
    `).all(department) as TaskRowWithTitle[]

    const pending = pendingRows.map(rowToTask)
    const overdue = overdueRows.map(rowToTask)
    const dueThisWeek = dueThisWeekRows.map(rowToTask)
    const completed = completedRows.map(rowToTask)

    const allTasks = [...pending, ...overdue, ...dueThisWeek, ...completed]
    enrichTasksWithDependencies(allTasks)

    const totalCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE department = ?
    `).get(department) as { count: number }

    const completedCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE department = ? AND status = 'completed'
    `).get(department) as { count: number }

    const workbenchData: DepartmentWorkbenchData = {
      department,
      pending,
      overdue,
      dueThisWeek,
      completed,
      stats: {
        total: totalCountRow.count,
        pending: pending.length,
        overdue: overdue.length,
        dueThisWeek: dueThisWeek.length,
        completed: completedCountRow.count,
      },
    }

    res.json({ success: true, data: workbenchData })
  } catch (error) {
    console.error('Get department workbench error:', error)
    res.status(500).json({ success: false, error: '获取科室工作台数据失败' })
  }
})

function getDueSoonRange(): { start: string; end: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 3)
  return {
    start: today.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  }
}

function getLongNoUpdateDate(): string {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  date.setDate(date.getDate() - 15)
  return date.toISOString().split('T')[0]
}

function calculateRiskLevel(stats: {
  overdueCount: number
  totalOverdueDays: number
  maxOverdueDays: number
  dueSoonCount: number
  supervisingCount: number
  longNoUpdateCount: number
  completionRate: number
  total: number
}): { level: 'high' | 'medium' | 'low'; score: number; factors: string[] } {
  let score = 0
  const factors: string[] = []

  if (stats.overdueCount > 0) {
    const overdueScore = Math.min(stats.overdueCount * 10 + stats.totalOverdueDays, 40)
    score += overdueScore
    factors.push(`逾期 ${stats.overdueCount} 项，累计逾期 ${stats.totalOverdueDays} 天，最长逾期 ${stats.maxOverdueDays} 天`)
  }

  if (stats.supervisingCount > 0) {
    const superviseScore = Math.min(stats.supervisingCount * 15, 30)
    score += superviseScore
    factors.push(`督办中 ${stats.supervisingCount} 项`)
  }

  if (stats.longNoUpdateCount > 0) {
    const longNoUpdateScore = Math.min(stats.longNoUpdateCount * 8, 25)
    score += longNoUpdateScore
    factors.push(`长期未更新 ${stats.longNoUpdateCount} 项`)
  }

  if (stats.dueSoonCount > 0) {
    const dueSoonScore = Math.min(stats.dueSoonCount * 3, 15)
    score += dueSoonScore
    factors.push(`临期 ${stats.dueSoonCount} 项`)
  }

  if (stats.total > 0 && stats.completionRate < 60) {
    score += 15
    factors.push(`完成率仅 ${stats.completionRate.toFixed(1)}%`)
  }

  let level: 'high' | 'medium' | 'low' = 'low'
  if (score >= 40) {
    level = 'high'
  } else if (score >= 15) {
    level = 'medium'
  }

  if (factors.length === 0) {
    factors.push('风险可控')
  }

  return { level, score, factors }
}

router.get('/risk/:department', (req: Request, res: Response) => {
  try {
    const { department } = req.params
    const today = new Date().toISOString().split('T')[0]
    const { start: dueSoonStart, end: dueSoonEnd } = getDueSoonRange()
    const longNoUpdateDate = getLongNoUpdateDate()

    const baseQuery = `
      SELECT t.*, m.title as meeting_title,
        EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        ) as has_active_supervision
      FROM tasks t
      LEFT JOIN meetings m ON t.meeting_id = m.id
      WHERE t.department = ?
    `

    const overdueRows = db.prepare(`
      ${baseQuery}
        AND t.status != 'completed'
        AND t.deadline < ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(department, today) as TaskRowWithTitle[]

    const dueSoonRows = db.prepare(`
      ${baseQuery}
        AND t.status != 'completed'
        AND t.deadline >= ?
        AND t.deadline <= ?
      ORDER BY t.deadline ASC, t.id DESC
    `).all(department, dueSoonStart, dueSoonEnd) as TaskRowWithTitle[]

    const supervisingRows = db.prepare(`
      ${baseQuery}
        AND t.status != 'completed'
        AND EXISTS (
          SELECT 1 FROM task_supervisions ts
          WHERE ts.task_id = t.id AND ts.status = 'active'
        )
      ORDER BY t.updated_at DESC, t.id DESC
    `).all(department) as TaskRowWithTitle[]

    const longNoUpdateRows = db.prepare(`
      ${baseQuery}
        AND t.status != 'completed'
        AND t.updated_at < ?
      ORDER BY t.updated_at ASC, t.id DESC
    `).all(department, longNoUpdateDate) as TaskRowWithTitle[]

    const overdueTasks = overdueRows.map(rowToTask)
    const dueSoonTasks = dueSoonRows.map(rowToTask)
    const supervisingTasks = supervisingRows.map(rowToTask)
    const longNoUpdateTasks = longNoUpdateRows.map(rowToTask)

    const allRiskTasks = [...overdueTasks, ...dueSoonTasks, ...supervisingTasks, ...longNoUpdateTasks]
    enrichTasksWithDependencies(allRiskTasks)

    const riskTaskIds = new Set<number>()
    overdueTasks.forEach((t) => riskTaskIds.add(t.id))
    dueSoonTasks.forEach((t) => riskTaskIds.add(t.id))
    supervisingTasks.forEach((t) => riskTaskIds.add(t.id))
    longNoUpdateTasks.forEach((t) => riskTaskIds.add(t.id))

    const allRiskMap = new Map<number, Task>()
    ;[...overdueTasks, ...dueSoonTasks, ...supervisingTasks, ...longNoUpdateTasks].forEach((t) => {
      if (!allRiskMap.has(t.id)) {
        allRiskMap.set(t.id, t)
      }
    })
    const riskTasks = Array.from(allRiskMap.values()).sort((a, b) => {
      const aOverdue = overdueTasks.some((t) => t.id === a.id)
      const bOverdue = overdueTasks.some((t) => t.id === b.id)
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      if (a.deadline < b.deadline) return -1
      if (a.deadline > b.deadline) return 1
      return b.id - a.id
    })

    const totalCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE department = ?
    `).get(department) as { count: number }

    const completedCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE department = ? AND status = 'completed'
    `).get(department) as { count: number }

    const maxOverdueRow = db.prepare(`
      SELECT MAX(CAST((julianday(?) - julianday(t.deadline)) AS INTEGER)) as max_days
      FROM tasks t
      WHERE t.department = ?
        AND t.status != 'completed'
        AND t.deadline < ?
    `).get(today, department, today) as { max_days: number | null }

    const total = totalCountRow.count
    const completed = completedCountRow.count
    const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0
    const maxOverdueDays = maxOverdueRow.max_days || 0

    const totalOverdueDays = overdueTasks.reduce((sum, task) => {
      const days = Math.floor((new Date(today).getTime() - new Date(task.deadline).getTime()) / (1000 * 60 * 60 * 24))
      return sum + Math.max(0, days)
    }, 0)

    const avgOverdueDays = overdueTasks.length > 0
      ? Math.round((totalOverdueDays / overdueTasks.length) * 10) / 10
      : 0

    const { level, score, factors } = calculateRiskLevel({
      overdueCount: overdueTasks.length,
      totalOverdueDays,
      maxOverdueDays,
      dueSoonCount: dueSoonTasks.length,
      supervisingCount: supervisingTasks.length,
      longNoUpdateCount: longNoUpdateTasks.length,
      completionRate,
      total,
    })

    const deptRow = db.prepare('SELECT is_active FROM departments WHERE name = ?').get(department) as { is_active: number } | undefined

    const stats: DepartmentRiskStats = {
      department,
      isActive: deptRow ? deptRow.is_active === 1 : true,
      total,
      completed,
      completionRate,
      overdueCount: overdueTasks.length,
      totalOverdueDays,
      maxOverdueDays,
      avgOverdueDays,
      dueSoonCount: dueSoonTasks.length,
      supervisingCount: supervisingTasks.length,
      longNoUpdateCount: longNoUpdateTasks.length,
      riskLevel: level,
      riskScore: score,
      riskFactors: factors,
    }

    const detail: DepartmentRiskDetail = {
      department,
      stats,
      overdueTasks,
      dueSoonTasks,
      supervisingTasks,
      longNoUpdateTasks,
      riskTasks,
    }

    res.json({ success: true, data: detail })
  } catch (error) {
    console.error('Get department risk detail error:', error)
    res.status(500).json({ success: false, error: '获取科室风险详情失败' })
  }
})

export default router
