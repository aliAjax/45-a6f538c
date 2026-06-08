import db from '../db.js'
import { DEFAULT_REMINDER_RULE, type Task, type TaskSupervision, type SupervisionFollowUp } from '../../shared/types.js'

export interface TaskRow {
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
  has_active_supervision?: number | boolean
}

export interface SupervisionRow {
  id: number
  task_id: number
  note: string
  next_follow_up_date: string | null
  status: string
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface FollowUpRow {
  id: number
  supervision_id: number
  content: string
  next_follow_up_date: string | null
  created_at: string
}

export interface ReminderRuleForDepartment {
  advanceDays: number
  includeSupervisionFollowUp: boolean
  repeatOverdue: boolean
}

export interface ReminderTaskRow {
  id: number
  department: string
  deadline: string
  status: string
  has_active_supervision?: number | boolean
  next_follow_up_date?: string | null
  follow_up_next_date?: string | null
}

export type ReminderBucket = 'overdue' | 'today' | 'upcoming'

function normalizeDateString(value: string | null | undefined): string | null {
  return value ? value.split('T')[0].split(' ')[0] : null
}

export function rowToFollowUp(row: FollowUpRow): SupervisionFollowUp {
  return {
    id: row.id,
    supervisionId: row.supervision_id,
    content: row.content,
    nextFollowUpDate: row.next_follow_up_date,
    createdAt: row.created_at,
  }
}

export function rowToSupervision(row: SupervisionRow): TaskSupervision {
  return {
    id: row.id,
    taskId: row.task_id,
    note: row.note,
    nextFollowUpDate: row.next_follow_up_date,
    status: row.status as TaskSupervision['status'],
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getLatestFollowUp(supervisionId: number): SupervisionFollowUp | null {
  const row = db.prepare(`
    SELECT * FROM supervision_follow_ups
    WHERE supervision_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(supervisionId) as FollowUpRow | undefined

  return row ? rowToFollowUp(row) : null
}

export function getFollowUpCount(supervisionId: number): number {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM supervision_follow_ups
    WHERE supervision_id = ?
  `).get(supervisionId) as { count: number }

  return row.count
}

export function enrichSupervision(supervision: TaskSupervision): TaskSupervision {
  return {
    ...supervision,
    latestFollowUp: getLatestFollowUp(supervision.id),
    followUpCount: getFollowUpCount(supervision.id),
  }
}

export function getTaskSupervisionForList(taskIds: number[]): Map<number, TaskSupervision> {
  const uniqueTaskIds = Array.from(new Set(taskIds))
  const result = new Map<number, TaskSupervision>()
  if (uniqueTaskIds.length === 0) return result

  const supervisionRows = db.prepare(`
    SELECT *
    FROM task_supervisions
    WHERE status = 'active'
      AND task_id IN (${uniqueTaskIds.map(() => '?').join(',')})
    ORDER BY task_id ASC, created_at DESC, id DESC
  `).all(...uniqueTaskIds) as SupervisionRow[]

  const latestByTaskId = new Map<number, SupervisionRow>()
  supervisionRows.forEach((row) => {
    if (!latestByTaskId.has(row.task_id)) {
      latestByTaskId.set(row.task_id, row)
    }
  })

  const activeRows = Array.from(latestByTaskId.values())
  if (activeRows.length === 0) return result

  const supervisionIds = activeRows.map((row) => row.id)
  const followUpRows = db.prepare(`
    SELECT *
    FROM supervision_follow_ups
    WHERE supervision_id IN (${supervisionIds.map(() => '?').join(',')})
    ORDER BY supervision_id ASC, created_at DESC, id DESC
  `).all(...supervisionIds) as FollowUpRow[]

  const latestFollowUpBySupervisionId = new Map<number, SupervisionFollowUp>()
  followUpRows.forEach((row) => {
    if (!latestFollowUpBySupervisionId.has(row.supervision_id)) {
      latestFollowUpBySupervisionId.set(row.supervision_id, rowToFollowUp(row))
    }
  })

  const countRows = db.prepare(`
    SELECT supervision_id, COUNT(*) as count
    FROM supervision_follow_ups
    WHERE supervision_id IN (${supervisionIds.map(() => '?').join(',')})
    GROUP BY supervision_id
  `).all(...supervisionIds) as Array<{ supervision_id: number; count: number }>

  const followUpCountBySupervisionId = new Map<number, number>()
  countRows.forEach((row) => {
    followUpCountBySupervisionId.set(row.supervision_id, row.count)
  })

  activeRows.forEach((row) => {
    result.set(row.task_id, {
      ...rowToSupervision(row),
      latestFollowUp: latestFollowUpBySupervisionId.get(row.id) || null,
      followUpCount: followUpCountBySupervisionId.get(row.id) || 0,
    })
  })

  return result
}

export function getActiveSupervisionWithLatestFollowUp(taskId: number): TaskSupervision | null {
  return getTaskSupervisionForList([taskId]).get(taskId) || null
}

export function rowToTask(row: TaskRow, includeActiveSupervision = true): Task {
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

  if (includeActiveSupervision && task.hasActiveSupervision) {
    task.activeSupervision = getActiveSupervisionWithLatestFollowUp(row.id)
  }

  return task
}

export function mapRowsToTasks(rows: TaskRow[]): Task[] {
  if (rows.length === 0) return []

  const tasks = rows.map((row) => rowToTask(row, false))
  const supervisedTaskIds = tasks
    .filter((task) => task.hasActiveSupervision)
    .map((task) => task.id)
  const supervisionMap = getTaskSupervisionForList(supervisedTaskIds)

  tasks.forEach((task) => {
    if (task.hasActiveSupervision) {
      task.activeSupervision = supervisionMap.get(task.id) || null
    }
  })

  return tasks
}

function buildTaskReference(id: number, info: { status: string | null; content: string | null; meetingId: number | null } | undefined): Task | null {
  if (!info || !info.status) return null

  return {
    id,
    meetingId: info.meetingId || 0,
    content: info.content || '',
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

export function enrichTasksWithDependencies(tasks: Task[]): void {
  if (tasks.length === 0) return

  const taskIds = tasks.map((task) => task.id)
  const taskMap = new Map<number, Task>()
  tasks.forEach((task) => taskMap.set(task.id, task))

  const dependencyRows = db.prepare(`
    SELECT
      td.task_id,
      td.prerequisite_task_id,
      prereq.status as prereq_status,
      prereq.content as prereq_content,
      prereq.meeting_id as prereq_meeting_id,
      blocked.status as blocked_status,
      blocked.content as blocked_content,
      blocked.meeting_id as blocked_meeting_id
    FROM task_dependencies td
    LEFT JOIN tasks prereq ON td.prerequisite_task_id = prereq.id
    LEFT JOIN tasks blocked ON td.task_id = blocked.id
    WHERE td.task_id IN (${taskIds.map(() => '?').join(',')})
       OR td.prerequisite_task_id IN (${taskIds.map(() => '?').join(',')})
  `).all(...taskIds, ...taskIds) as Array<{
    task_id: number
    prerequisite_task_id: number
    prereq_status: string | null
    prereq_content: string | null
    prereq_meeting_id: number | null
    blocked_status: string | null
    blocked_content: string | null
    blocked_meeting_id: number | null
  }>

  tasks.forEach((task) => {
    const prereqIds: number[] = []
    const blockingIds: number[] = []
    const prereqInfoMap = new Map<number, { status: string | null; content: string | null; meetingId: number | null }>()
    const blockingInfoMap = new Map<number, { status: string | null; content: string | null; meetingId: number | null }>()

    dependencyRows.forEach((row) => {
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
        blockingInfoMap.set(row.task_id, {
          status: row.blocked_status,
          content: row.blocked_content,
          meetingId: row.blocked_meeting_id,
        })
      }
    })

    task.prerequisiteTaskIds = prereqIds
    task.blockingTaskIds = blockingIds
    task.isBlocked = prereqIds.some((id) => {
      const prereqInfo = prereqInfoMap.get(id)
      return !prereqInfo?.status || prereqInfo.status !== 'completed'
    })

    task.prerequisiteTasks = prereqIds
      .map((id) => taskMap.get(id) || buildTaskReference(id, prereqInfoMap.get(id)))
      .filter((taskRef): taskRef is Task => taskRef !== null)

    task.blockingTasks = blockingIds
      .map((id) => taskMap.get(id) || buildTaskReference(id, blockingInfoMap.get(id)))
      .filter((taskRef): taskRef is Task => taskRef !== null)
  })
}

export function getReminderRule(department: string): ReminderRuleForDepartment {
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
    return { ...DEFAULT_REMINDER_RULE }
  }

  return {
    advanceDays: row.advance_days,
    includeSupervisionFollowUp: row.include_supervision_follow_up === 1 || row.include_supervision_follow_up === true,
    repeatOverdue: row.repeat_overdue === 1 || row.repeat_overdue === true,
  }
}

export function getTaskEffectiveReminderDate(task: Task, rule: ReminderRuleForDepartment): string | null {
  const deadlineStr = normalizeDateString(task.deadline)
  if (!deadlineStr) return null

  if (rule.includeSupervisionFollowUp && task.activeSupervision?.status === 'active') {
    const supervisionNextDate = normalizeDateString(task.activeSupervision.nextFollowUpDate)
    const followUpNextDate = normalizeDateString(task.activeSupervision.latestFollowUp?.nextFollowUpDate)
    const effectiveSupervisionDate = followUpNextDate || supervisionNextDate

    if (effectiveSupervisionDate && effectiveSupervisionDate < deadlineStr) {
      return effectiveSupervisionDate
    }
  }

  return deadlineStr
}

export function getTaskEffectiveReminderDateFromRow(row: ReminderTaskRow, rule: ReminderRuleForDepartment): string | null {
  const deadlineStr = normalizeDateString(row.deadline)
  if (!deadlineStr) return null

  if (rule.includeSupervisionFollowUp && row.has_active_supervision) {
    const supervisionNextDate = normalizeDateString(row.next_follow_up_date)
    const followUpNextDate = normalizeDateString(row.follow_up_next_date)
    const effectiveSupervisionDate = followUpNextDate || supervisionNextDate

    if (effectiveSupervisionDate && effectiveSupervisionDate < deadlineStr) {
      return effectiveSupervisionDate
    }
  }

  return deadlineStr
}

export function getReminderBucket(effectiveDateStr: string | null, rule: ReminderRuleForDepartment, today = new Date()): ReminderBucket | null {
  if (!effectiveDateStr) return null

  const date = new Date(effectiveDateStr)
  date.setHours(0, 0, 0, 0)

  const normalizedToday = new Date(today)
  normalizedToday.setHours(0, 0, 0, 0)

  if (date < normalizedToday) {
    return rule.repeatOverdue ? 'overdue' : null
  }

  if (date.getTime() === normalizedToday.getTime()) {
    return 'today'
  }

  const diffTime = date.getTime() - normalizedToday.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= rule.advanceDays ? 'upcoming' : null
}

export function isTaskInReminder(task: Task, rule: ReminderRuleForDepartment, today = new Date()): ReminderBucket | null {
  return getReminderBucket(getTaskEffectiveReminderDate(task, rule), rule, today)
}
