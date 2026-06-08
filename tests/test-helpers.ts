import os from 'os'
import path from 'path'
import fs from 'fs'
import type { Database } from 'better-sqlite3'
import { createDatabaseInstance, type DatabaseInstance } from '../api/db.js'

let tempDir: string | null = null

export function getTempDbPath(): string {
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-test-'))
  }
  return path.join(tempDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
}

export function createTestDb(): { instance: DatabaseInstance; dbPath: string } {
  const dbPath = getTempDbPath()
  const instance = createDatabaseInstance(dbPath, { seed: false })
  return { instance, dbPath }
}

export function closeTestDb(instance: DatabaseInstance): void {
  instance.db.close()
}

export function cleanupTempDbs(): void {
  if (tempDir && fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
    tempDir = null
  }
}

export interface TestDataOptions {
  meetings?: number
  tasksPerMeeting?: number
}

export interface CreateMeetingOptions {
  title?: string
  departments?: string
  meetingDate?: string
}

export interface CreateTaskOptions {
  meetingId: number
  content?: string
  department?: string
  deadline?: string
  status?: 'pending' | 'in_progress' | 'completed'
  progress?: string
}

export interface CreateSupervisionOptions {
  taskId: number
  note?: string
  nextFollowUpDate?: string
  status?: 'active' | 'closed'
}

export interface CreateFollowUpOptions {
  supervisionId: number
  content?: string
  nextFollowUpDate?: string
  createdAt?: string
}

export interface SetReminderRuleOptions {
  department: string
  advanceDays?: number
  includeSupervisionFollowUp?: boolean
  repeatOverdue?: boolean
}

export function createMeeting(db: Database, options: CreateMeetingOptions = {}): number {
  const {
    title = '测试会议',
    departments = '办公室、业务一科',
    meetingDate = '2025-01-15 09:00',
  } = options

  const result = db.prepare(`
    INSERT INTO meetings (title, departments, meeting_date)
    VALUES (?, ?, ?)
  `).run(title, departments, meetingDate)

  return Number(result.lastInsertRowid)
}

export function createTask(db: Database, options: CreateTaskOptions): number {
  const {
    meetingId,
    content = '测试任务',
    department = '办公室',
    deadline = '2025-02-01',
    status = 'pending',
    progress = '',
  } = options

  const result = db.prepare(`
    INSERT INTO tasks (meeting_id, content, department, deadline, status, progress)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(meetingId, content, department, deadline, status, progress)

  return Number(result.lastInsertRowid)
}

export function createSupervision(db: Database, options: CreateSupervisionOptions): number {
  const {
    taskId,
    note = '督办说明',
    nextFollowUpDate,
    status = 'active',
  } = options

  const result = db.prepare(`
    INSERT INTO task_supervisions (task_id, note, next_follow_up_date, status)
    VALUES (?, ?, ?, ?)
  `).run(taskId, note, nextFollowUpDate || null, status)

  const supervisionId = Number(result.lastInsertRowid)

  db.prepare(`
    INSERT INTO supervision_follow_ups (supervision_id, content, next_follow_up_date)
    VALUES (?, ?, ?)
  `).run(supervisionId, note, nextFollowUpDate || null)

  return supervisionId
}

export function createFollowUp(db: Database, options: CreateFollowUpOptions): number {
  const {
    supervisionId,
    content = '跟进内容',
    nextFollowUpDate,
    createdAt,
  } = options

  let followUpId: number

  if (createdAt) {
    const result = db.prepare(`
      INSERT INTO supervision_follow_ups (supervision_id, content, next_follow_up_date, created_at)
      VALUES (?, ?, ?, ?)
    `).run(supervisionId, content, nextFollowUpDate || null, createdAt)
    followUpId = Number(result.lastInsertRowid)
  } else {
    const result = db.prepare(`
      INSERT INTO supervision_follow_ups (supervision_id, content, next_follow_up_date)
      VALUES (?, ?, ?)
    `).run(supervisionId, content, nextFollowUpDate || null)
    followUpId = Number(result.lastInsertRowid)
  }

  if (nextFollowUpDate) {
    db.prepare(`
      UPDATE task_supervisions
      SET next_follow_up_date = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(nextFollowUpDate, supervisionId)
  }

  return followUpId
}

export function setReminderRule(db: Database, options: SetReminderRuleOptions): void {
  const {
    department,
    advanceDays = 3,
    includeSupervisionFollowUp = false,
    repeatOverdue = true,
  } = options

  db.prepare(`
    INSERT OR REPLACE INTO reminder_rules
    (department, advance_days, include_supervision_follow_up, repeat_overdue, updated_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(
    department,
    advanceDays,
    includeSupervisionFollowUp ? 1 : 0,
    repeatOverdue ? 1 : 0
  )
}

function padZero(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function daysFromToday(days: number): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return formatDate(addDays(today, days))
}
