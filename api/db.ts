import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '..', 'data', 'meeting.db')

import fs from 'fs'

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function initDatabase() {
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
  `)

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

initDatabase()

export default db
