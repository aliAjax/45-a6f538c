import type { Database } from 'better-sqlite3'
import type { Task, ReminderGroups, Stats, TaskSupervision, SupervisionFollowUp } from '../../shared/types.js'

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

interface TaskRow {
  id: number
  department: string
  deadline: string
  status: string
  has_active_supervision?: number
  next_follow_up_date?: string | null
  follow_up_next_date?: string | null
}

interface ReminderRule {
  advanceDays: number
  includeSupervisionFollowUp: boolean
  repeatOverdue: boolean
}

const DEFAULT_RULE: ReminderRule = {
  advanceDays: 3,
  includeSupervisionFollowUp: false,
  repeatOverdue: true,
}

export function getReminderRuleForDepartment(db: Database, department: string): ReminderRule {
  const row = db.prepare(`
    SELECT advance_days, include_supervision_follow_up, repeat_overdue
    FROM reminder_rules
    WHERE department = ?
  `).get(department) as {
    advance_days: number
    include_supervision_follow_up: number | boolean
    repeat_overdue: number | boolean
  } | undefined

  if (!row) {
    return { ...DEFAULT_RULE }
  }

  return {
    advanceDays: row.advance_days,
    includeSupervisionFollowUp: row.include_supervision_follow_up === 1 || row.include_supervision_follow_up === true,
    repeatOverdue: row.repeat_overdue === 1 || row.repeat_overdue === true,
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

function getActiveSupervisionWithLatestFollowUp(db: Database, taskId: number): TaskSupervision | null {
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

function rowToTask(db: Database, row: TaskRowWithTitle): Task {
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
    task.activeSupervision = getActiveSupervisionWithLatestFollowUp(db, row.id)
  }

  return task
}

export function getTaskEffectiveReminderDate(task: Task, rule: ReminderRule): string | null {
  const deadlineStr = task.deadline.split('T')[0].split(' ')[0]

  if (rule.includeSupervisionFollowUp && task.activeSupervision) {
    const supervisionNextDate = task.activeSupervision.nextFollowUpDate
      ? task.activeSupervision.nextFollowUpDate.split('T')[0].split(' ')[0]
      : null

    const followUpNextDate = task.activeSupervision.latestFollowUp?.nextFollowUpDate
      ? task.activeSupervision.latestFollowUp.nextFollowUpDate.split('T')[0].split(' ')[0]
      : null

    const effectiveSupervisionDate = followUpNextDate || supervisionNextDate

    if (effectiveSupervisionDate && effectiveSupervisionDate < deadlineStr) {
      return effectiveSupervisionDate
    }
  }

  return deadlineStr
}

export function getReminderGroups(db: Database): ReminderGroups {
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

  allRows.forEach((row) => {
    if (seenTaskIds.has(row.id)) return

    const task = rowToTask(db, row)
    const rule = getReminderRuleForDepartment(db, task.department)
    const effectiveDate = getTaskEffectiveReminderDate(task, rule)

    if (!effectiveDate) return

    const date = new Date(effectiveDate)
    date.setHours(0, 0, 0, 0)

    const isOverdue = date < today

    if (isOverdue) {
      if (rule.repeatOverdue) {
        overdue.push(task)
        seenTaskIds.add(task.id)
      }
      return
    }

    const isToday = date.getTime() === today.getTime()

    if (isToday) {
      todayTasks.push(task)
      seenTaskIds.add(task.id)
      return
    }

    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= rule.advanceDays) {
      upcoming.push(task)
      seenTaskIds.add(task.id)
    }
  })

  return {
    overdue,
    today: todayTasks,
    upcoming,
  }
}

export function getStats(db: Database): Stats {
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
  `).all() as TaskRow[]

  let overdueCount = 0
  let upcomingCount = 0

  const seenTaskIds = new Set<number>()

  taskRows.forEach((row) => {
    if (seenTaskIds.has(row.id)) return

    const rule = getReminderRuleForDepartment(db, row.department)

    const deadlineStr = row.deadline.split('T')[0].split(' ')[0]

    let effectiveDateStr = deadlineStr

    if (rule.includeSupervisionFollowUp && row.has_active_supervision) {
      const supervisionNextDate = row.next_follow_up_date
        ? row.next_follow_up_date.split('T')[0].split(' ')[0]
        : null

      const followUpNextDate = row.follow_up_next_date
        ? row.follow_up_next_date.split('T')[0].split(' ')[0]
        : null

      const effectiveSupervisionDate = followUpNextDate || supervisionNextDate

      if (effectiveSupervisionDate && effectiveSupervisionDate < deadlineStr) {
        effectiveDateStr = effectiveSupervisionDate
      }
    }

    const effectiveDate = new Date(effectiveDateStr)
    effectiveDate.setHours(0, 0, 0, 0)

    if (effectiveDate < today) {
      if (rule.repeatOverdue) {
        overdueCount++
        seenTaskIds.add(row.id)
      }
    } else {
      const diffTime = effectiveDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= rule.advanceDays) {
        upcomingCount++
        seenTaskIds.add(row.id)
      }
    }
  })

  return {
    totalMeetings: meetingsCount.count,
    totalTasks: tasksCount.count,
    overdueTasks: overdueCount,
    dueSoonTasks: upcomingCount,
    completedTasks: completedCount.count,
  }
}
