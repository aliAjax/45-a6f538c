import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { assertRuntimeConfig, getConfig } from './config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type CreateAuditLogFn = (params: {
  entityType: string
  entityId: number
  actionType: string
  fieldName?: string | null
  oldValue?: unknown
  newValue?: unknown
  sourcePage?: string | null
  taskId?: number | null
  meetingId?: number | null
  department?: string | null
  createdAt?: string | null
}) => number

export interface DatabaseInstance {
  db: Database.Database
  createAuditLog: CreateAuditLogFn
}

function initDatabaseSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      departments TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      department TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
    CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON tasks(meeting_id);

    CREATE TABLE IF NOT EXISTS meeting_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      departments TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS template_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      department TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (template_id) REFERENCES meeting_templates(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_template_tasks_template_id ON template_tasks(template_id);

    CREATE TABLE IF NOT EXISTS template_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      departments TEXT NOT NULL,
      task_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (template_id) REFERENCES meeting_templates(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
    CREATE INDEX IF NOT EXISTS idx_template_versions_template_version ON template_versions(template_id, version);

    CREATE TABLE IF NOT EXISTS template_version_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      department TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (version_id) REFERENCES template_versions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_template_version_tasks_version_id ON template_version_tasks(version_id);

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
    CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);
    CREATE INDEX IF NOT EXISTS idx_departments_sort_order ON departments(sort_order);

    CREATE TABLE IF NOT EXISTS task_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_task_progress_task_id ON task_progress(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_progress_created_at ON task_progress(created_at);

    CREATE TABLE IF NOT EXISTS task_supervisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      next_follow_up_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_task_supervisions_task_id ON task_supervisions(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_supervisions_status ON task_supervisions(status);
    CREATE INDEX IF NOT EXISTS idx_task_supervisions_next_follow_up_date ON task_supervisions(next_follow_up_date);

    CREATE TABLE IF NOT EXISTS supervision_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supervision_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      next_follow_up_date TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supervision_id) REFERENCES task_supervisions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_supervision_follow_ups_supervision_id ON supervision_follow_ups(supervision_id);
    CREATE INDEX IF NOT EXISTS idx_supervision_follow_ups_created_at ON supervision_follow_ups(created_at);

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      prerequisite_task_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (prerequisite_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE(task_id, prerequisite_task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_dependencies_prerequisite_task_id ON task_dependencies(prerequisite_task_id);

    CREATE TABLE IF NOT EXISTS task_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filter_json TEXT NOT NULL DEFAULT '{}',
      target_page TEXT NOT NULL DEFAULT 'tasks',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_task_views_sort_order ON task_views(sort_order);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      source_page TEXT,
      task_id INTEGER,
      meeting_id INTEGER,
      department TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_meeting_id ON audit_logs(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_department ON audit_logs(department);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS reminder_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department TEXT NOT NULL UNIQUE,
      advance_days INTEGER NOT NULL DEFAULT 3,
      include_supervision_follow_up INTEGER NOT NULL DEFAULT 0,
      repeat_overdue INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_reminder_rules_department ON reminder_rules(department);
  `)
}

function runMigrations(db: Database.Database) {
  migrateTaskProgress(db)
  migrateSupervisionFollowUps(db)
  migrateTemplateVersions(db)
  migrateTaskViewsTargetPage(db)
  migrateAuditLogsFromProgress(db)
  fixAuditLogNullCreatedAt(db)
}

function seedInitialData(db: Database.Database) {
  const meetingCount = db.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }
  if (meetingCount.count === 0) {
    const insertMeeting = db.prepare(`
      INSERT INTO meetings (title, departments, meeting_date)
      VALUES (?, ?, ?)
    `)

    const insertTask = db.prepare(`
      INSERT INTO tasks (meeting_id, content, department, deadline, status, progress)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    const meeting1 = insertMeeting.run(
      '2024年第二季度工作部署会',
      '办公室、人事科、财务科、业务一科、业务二科',
      formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)) + ' 09:00'
    )

    const tasks1 = [
      { content: '完成上半年工作总结', department: '办公室', deadline: formatDate(new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)), status: 'completed', progress: '已完成并提交领导审阅' },
      { content: '开展中层干部竞聘工作', department: '人事科', deadline: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)), status: 'in_progress', progress: '已发布竞聘公告，正在报名阶段' },
      { content: '上半年财务决算', department: '财务科', deadline: formatDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)), status: 'pending', progress: '' },
      { content: '推进重点项目落地', department: '业务一科', deadline: formatDate(new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)), status: 'in_progress', progress: '已完成方案设计，正在招标' },
      { content: '优化业务办理流程', department: '业务二科', deadline: formatDate(new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000)), status: 'pending', progress: '' },
    ]

    tasks1.forEach(task => {
      insertTask.run(meeting1.lastInsertRowid, task.content, task.department, task.deadline, task.status, task.progress)
    })

    const meeting2 = insertMeeting.run(
      '安全生产专题会议',
      '安全科、业务一科、业务二科、办公室',
      formatDate(new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)) + ' 14:00'
    )

    const tasks2 = [
      { content: '开展安全隐患排查', department: '安全科', deadline: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)), status: 'in_progress', progress: '已排查出3处隐患，正在整改' },
      { content: '组织消防安全培训', department: '安全科', deadline: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)), status: 'pending', progress: '' },
      { content: '完善应急预案', department: '办公室', deadline: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)), status: 'pending', progress: '' },
    ]

    tasks2.forEach(task => {
      insertTask.run(meeting2.lastInsertRowid, task.content, task.department, task.deadline, task.status, task.progress)
    })
  }

  const templateCount = db.prepare('SELECT COUNT(*) as count FROM meeting_templates').get() as { count: number }
  if (templateCount.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO meeting_templates (name, title, departments)
      VALUES (?, ?, ?)
    `)

    const insertTemplateTask = db.prepare(`
      INSERT INTO template_tasks (template_id, content, department, sort_order)
      VALUES (?, ?, ?, ?)
    `)

    const template1 = insertTemplate.run(
      '季度工作部署会',
      '202X年第X季度工作部署会',
      '办公室、人事科、财务科、业务一科、业务二科'
    )

    const tasks1 = [
      { content: '总结上季度工作完成情况', department: '办公室', sortOrder: 0 },
      { content: '各科室汇报重点工作进展', department: '业务一科', sortOrder: 1 },
      { content: '部署本季度重点工作任务', department: '办公室', sortOrder: 2 },
      { content: '讨论工作中存在的问题及解决方案', department: '人事科', sortOrder: 3 },
    ]

    tasks1.forEach((task, index) => {
      insertTemplateTask.run(template1.lastInsertRowid, task.content, task.department, index)
    })

    const template2 = insertTemplate.run(
      '安全生产专题会',
      '安全生产专题工作会议',
      '安全科、业务一科、业务二科、办公室'
    )

    const tasks2 = [
      { content: '通报近期安全生产情况', department: '安全科', sortOrder: 0 },
      { content: '排查安全隐患并制定整改措施', department: '安全科', sortOrder: 1 },
      { content: '部署下阶段安全生产重点工作', department: '安全科', sortOrder: 2 },
    ]

    tasks2.forEach((task, index) => {
      insertTemplateTask.run(template2.lastInsertRowid, task.content, task.department, index)
    })
  }

  const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number }
  if (deptCount.count === 0) {
    const insertDept = db.prepare(`
      INSERT INTO departments (name, sort_order, is_active)
      VALUES (?, ?, 1)
    `)

    const defaultDepartments = [
      { name: '办公室', sortOrder: 1 },
      { name: '人事科', sortOrder: 2 },
      { name: '财务科', sortOrder: 3 },
      { name: '业务一科', sortOrder: 4 },
      { name: '业务二科', sortOrder: 5 },
      { name: '安全科', sortOrder: 6 },
    ]

    defaultDepartments.forEach((dept) => {
      insertDept.run(dept.name, dept.sortOrder)
    })

    const taskDepts = db.prepare(`
      SELECT DISTINCT department
      FROM tasks
      WHERE department NOT IN (SELECT name FROM departments)
      ORDER BY department ASC
    `).all() as { department: string }[]

    let nextSortOrder = defaultDepartments.length + 1
    taskDepts.forEach((row) => {
      if (row.department && row.department.trim()) {
        insertDept.run(row.department.trim(), nextSortOrder)
        nextSortOrder++
      }
    })

    const templateDepts = db.prepare(`
      SELECT DISTINCT department
      FROM template_tasks
      WHERE department NOT IN (SELECT name FROM departments)
      ORDER BY department ASC
    `).all() as { department: string }[]

    templateDepts.forEach((row) => {
      if (row.department && row.department.trim()) {
        insertDept.run(row.department.trim(), nextSortOrder)
        nextSortOrder++
      }
    })
  }
}

function migrateTaskProgress(db: Database.Database) {
  const tasksWithoutProgress = db.prepare(`
    SELECT t.id, t.status, t.progress, t.created_at
    FROM tasks t
    WHERE NOT EXISTS (
      SELECT 1 FROM task_progress tp WHERE tp.task_id = t.id
    )
  `).all() as Array<{
    id: number
    status: string
    progress: string | null
    created_at: string
  }>

  if (tasksWithoutProgress.length > 0) {
    const insertProgress = db.prepare(`
      INSERT INTO task_progress (task_id, status, progress, created_at)
      VALUES (?, ?, ?, ?)
    `)

    const transaction = db.transaction((tasks: typeof tasksWithoutProgress) => {
      for (const task of tasks) {
        insertProgress.run(
          task.id,
          task.status,
          task.progress || '',
          task.created_at
        )
      }
    })

    transaction(tasksWithoutProgress)
  }
}

function migrateSupervisionFollowUps(db: Database.Database) {
  const supervisionsWithoutFollowUps = db.prepare(`
    SELECT s.id, s.note, s.next_follow_up_date, s.created_at
    FROM task_supervisions s
    WHERE NOT EXISTS (
      SELECT 1 FROM supervision_follow_ups f WHERE f.supervision_id = s.id
    )
  `).all() as Array<{
    id: number
    note: string
    next_follow_up_date: string | null
    created_at: string
  }>

  if (supervisionsWithoutFollowUps.length > 0) {
    const insertFollowUp = db.prepare(`
      INSERT INTO supervision_follow_ups (supervision_id, content, next_follow_up_date, created_at)
      VALUES (?, ?, ?, ?)
    `)

    const transaction = db.transaction((supervisions: typeof supervisionsWithoutFollowUps) => {
      for (const supervision of supervisions) {
        insertFollowUp.run(
          supervision.id,
          supervision.note || '',
          supervision.next_follow_up_date,
          supervision.created_at
        )
      }
    })

    transaction(supervisionsWithoutFollowUps)
  }
}

function migrateTemplateVersions(db: Database.Database) {
  const templatesWithoutVersions = db.prepare(`
    SELECT mt.id, mt.title, mt.departments, mt.created_at
    FROM meeting_templates mt
    WHERE NOT EXISTS (
      SELECT 1 FROM template_versions tv WHERE tv.template_id = mt.id
    )
  `).all() as Array<{
    id: number
    title: string
    departments: string
    created_at: string
  }>

  if (templatesWithoutVersions.length === 0) {
    return
  }

  const insertVersion = db.prepare(`
    INSERT INTO template_versions (template_id, version, title, departments, task_count, created_at)
    VALUES (?, 1, ?, ?, ?, ?)
  `)

  const insertVersionTask = db.prepare(`
    INSERT INTO template_version_tasks (version_id, content, department, sort_order)
    VALUES (?, ?, ?, ?)
  `)

  const getTemplateTasks = db.prepare(`
    SELECT content, department, sort_order
    FROM template_tasks
    WHERE template_id = ?
    ORDER BY sort_order ASC, id ASC
  `)

  const transaction = db.transaction((templates: typeof templatesWithoutVersions) => {
    for (const template of templates) {
      const tasks = getTemplateTasks.all(template.id) as Array<{
        content: string
        department: string
        sort_order: number
      }>

      const versionResult = insertVersion.run(
        template.id,
        template.title,
        template.departments,
        tasks.length,
        template.created_at
      )
      const versionId = versionResult.lastInsertRowid as number

      for (const task of tasks) {
        insertVersionTask.run(versionId, task.content, task.department, task.sort_order)
      }
    }
  })

  transaction(templatesWithoutVersions)
}

function migrateTaskViewsTargetPage(db: Database.Database) {
  const columns = db.prepare(`
    PRAGMA table_info(task_views)
  `).all() as Array<{ name: string }>

  const hasTargetPage = columns.some((col) => col.name === 'target_page')

  if (!hasTargetPage) {
    db.exec(`
      ALTER TABLE task_views ADD COLUMN target_page TEXT NOT NULL DEFAULT 'tasks';
    `)
  }
}

function migrateAuditLogsFromProgress(db: Database.Database) {
  const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }
  if (auditCount.count > 0) {
    return
  }

  const progressRows = db.prepare(`
    SELECT tp.*, t.department, t.meeting_id
    FROM task_progress tp
    INNER JOIN tasks t ON tp.task_id = t.id
    ORDER BY tp.created_at ASC, tp.id ASC
  `).all() as Array<{
    id: number
    task_id: number
    status: string
    progress: string | null
    created_at: string
    department: string
    meeting_id: number
  }>

  if (progressRows.length === 0) {
    return
  }

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (
      entity_type, entity_id, action_type, field_name,
      old_value, new_value, source_page, task_id, meeting_id, department, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const taskPrevState = new Map<number, { status: string; progress: string }>()

  const transaction = db.transaction((rows: typeof progressRows) => {
    for (const row of rows) {
      const prev = taskPrevState.get(row.task_id)
      const newStatus = row.status
      const newProgress = row.progress || ''

      if (!prev) {
        insertAudit.run(
          'task', row.task_id, 'create', null,
          null, JSON.stringify({ status: newStatus, progress: newProgress }),
          '历史数据迁移', row.task_id, row.meeting_id, row.department, row.created_at
        )
      } else {
        if (prev.status !== newStatus) {
          insertAudit.run(
            'task', row.task_id, 'update', 'status',
            prev.status, newStatus,
            '历史数据迁移', row.task_id, row.meeting_id, row.department, row.created_at
          )
        }
        if (prev.progress !== newProgress) {
          insertAudit.run(
            'task', row.task_id, 'update', 'progress',
            prev.progress, newProgress,
            '历史数据迁移', row.task_id, row.meeting_id, row.department, row.created_at
          )
        }
      }

      taskPrevState.set(row.task_id, { status: newStatus, progress: newProgress })
    }
  })

  transaction(progressRows)
}

function fixAuditLogNullCreatedAt(db: Database.Database) {
  const nullCountRow = db.prepare(`
    SELECT COUNT(*) as count FROM audit_logs 
    WHERE created_at IS NULL OR created_at = ''
  `).get() as { count: number }

  if (nullCountRow.count > 0) {
    console.log(`[DB] 发现 ${nullCountRow.count} 条 audit_logs 记录 created_at 为空，正在修复...`)
    const result = db.prepare(`
      UPDATE audit_logs 
      SET created_at = datetime('now', 'localtime')
      WHERE created_at IS NULL OR created_at = ''
    `).run()
    console.log(`[DB] 已修复 ${result.changes} 条记录`)
  }
}

function createAuditLogWithDb(
  db: Database.Database,
  params: {
    entityType: string
    entityId: number
    actionType: string
    fieldName?: string | null
    oldValue?: unknown
    newValue?: unknown
    sourcePage?: string | null
    taskId?: number | null
    meetingId?: number | null
    department?: string | null
    createdAt?: string | null
  }
) {
  const fields: string[] = [
    'entity_type', 'entity_id', 'action_type', 'field_name',
    'old_value', 'new_value', 'source_page', 'task_id', 'meeting_id', 'department'
  ]
  const values: unknown[] = []

  const oldVal = params.oldValue !== undefined && params.oldValue !== null
    ? (typeof params.oldValue === 'string' ? params.oldValue : JSON.stringify(params.oldValue))
    : null
  const newVal = params.newValue !== undefined && params.newValue !== null
    ? (typeof params.newValue === 'string' ? params.newValue : JSON.stringify(params.newValue))
    : null

  values.push(
    params.entityType,
    params.entityId,
    params.actionType,
    params.fieldName || null,
    oldVal,
    newVal,
    params.sourcePage || null,
    params.taskId || null,
    params.meetingId || null,
    params.department || null,
  )

  if (params.createdAt) {
    fields.push('created_at')
    values.push(params.createdAt)
  }

  const placeholders = values.map(() => '?').join(', ')
  const stmt = db.prepare(`
    INSERT INTO audit_logs (${fields.join(', ')})
    VALUES (${placeholders})
  `)

  const result = stmt.run(...values)

  return Number(result.lastInsertRowid)
}

export function createDatabaseInstance(dbPath: string, options: { seed?: boolean } = {}): DatabaseInstance {
  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initDatabaseSchema(db)
  runMigrations(db)

  if (options.seed) {
    seedInitialData(db)
  }

  const createAuditLogBound: CreateAuditLogFn = (params) =>
    createAuditLogWithDb(db, params)

  return {
    db,
    createAuditLog: createAuditLogBound,
  }
}

export function getDefaultDbPath(): string {
  const config = getConfig()
  assertRuntimeConfig(config)
  return config.databasePath
}

export function ensureDataDir(): void {
  const dataDir = path.dirname(getDefaultDbPath())
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

let _defaultInstance: DatabaseInstance | null = null

export function getDefaultInstance(): DatabaseInstance {
  if (!_defaultInstance) {
    const config = getConfig()
    assertRuntimeConfig(config)
    ensureDataDir()
    _defaultInstance = createDatabaseInstance(config.databasePath, { seed: config.seedData })
  }
  return _defaultInstance
}

let _activeDb: Database.Database | null = null
let _activeAuditLog: CreateAuditLogFn | null = null

function getActiveDb(): Database.Database {
  if (!_activeDb) {
    _activeDb = getDefaultInstance().db
    _activeAuditLog = getDefaultInstance().createAuditLog
  }
  return _activeDb
}

export function setActiveDatabase(instance: DatabaseInstance): void {
  _activeDb = instance.db
  _activeAuditLog = instance.createAuditLog
}

export function restoreDefaultDatabase(): void {
  _activeDb = null
  _activeAuditLog = null
}

export const createAuditLog: CreateAuditLogFn = (params) => {
  if (!_activeAuditLog) {
    getActiveDb()
  }
  return _activeAuditLog!(params)
}

const dbProxy = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const db = getActiveDb()
    const value = (db as any)[prop]
    if (typeof value === 'function') {
      return value.bind(db)
    }
    return value
  },
  set(_target, prop, value) {
    const db = getActiveDb()
    ;(db as any)[prop] = value
    return true
  },
  has(_target, prop) {
    const db = getActiveDb()
    return prop in db
  },
})

export default dbProxy
