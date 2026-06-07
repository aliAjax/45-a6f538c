import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type {
  MeetingTemplate,
  TemplateTask,
  TemplateVersion,
  TemplateTaskVersion,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '../../shared/types.js'

interface TemplateRow {
  id: number
  name: string
  title: string
  departments: string
  created_at: string
  updated_at: string
  task_count?: number
  current_version?: number
  version_count?: number
}

interface TemplateTaskRow {
  id: number
  template_id: number
  content: string
  department: string
  sort_order: number
  created_at: string
  updated_at: string
}

interface TemplateVersionRow {
  id: number
  template_id: number
  version: number
  title: string
  departments: string
  task_count: number
  created_at: string
}

interface TemplateVersionTaskRow {
  id: number
  version_id: number
  content: string
  department: string
  sort_order: number
}

const router = Router()

function rowToTemplate(row: TemplateRow): MeetingTemplate {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    departments: row.departments,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taskCount: row.task_count,
    currentVersion: row.current_version,
    versionCount: row.version_count,
  }
}

function rowToTemplateTask(row: TemplateTaskRow): TemplateTask {
  return {
    id: row.id,
    templateId: row.template_id,
    content: row.content,
    department: row.department,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTemplateVersion(row: TemplateVersionRow): TemplateVersion {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    title: row.title,
    departments: row.departments,
    taskCount: row.task_count,
    createdAt: row.created_at,
  }
}

function rowToTemplateTaskVersion(row: TemplateVersionTaskRow): TemplateTaskVersion {
  return {
    id: row.id,
    versionId: row.version_id,
    content: row.content,
    department: row.department,
    sortOrder: row.sort_order,
  }
}

function getLatestVersion(templateId: number): number {
  const row = db.prepare(`
    SELECT MAX(version) as max_version
    FROM template_versions
    WHERE template_id = ?
  `).get(templateId) as { max_version: number | null }
  return row.max_version || 0
}

function createNewVersion(
  templateId: number,
  title: string,
  departments: string,
  tasks: Array<{ content: string; department: string }>
): number {
  const currentVersion = getLatestVersion(templateId)
  const newVersion = currentVersion + 1

  const insertVersion = db.prepare(`
    INSERT INTO template_versions (template_id, version, title, departments, task_count)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertVersionTask = db.prepare(`
    INSERT INTO template_version_tasks (version_id, content, department, sort_order)
    VALUES (?, ?, ?, ?)
  `)

  const versionResult = insertVersion.run(
    templateId,
    newVersion,
    title,
    departments,
    tasks.length
  )
  const versionId = versionResult.lastInsertRowid as number

  tasks.forEach((task, index) => {
    insertVersionTask.run(versionId, task.content, task.department, index)
  })

  return versionId
}

router.get('/', (req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT mt.*,
        (SELECT COUNT(*) FROM template_tasks tt WHERE tt.template_id = mt.id) as task_count,
        (SELECT MAX(version) FROM template_versions tv WHERE tv.template_id = mt.id) as current_version,
        (SELECT COUNT(*) FROM template_versions tv WHERE tv.template_id = mt.id) as version_count
      FROM meeting_templates mt
      ORDER BY mt.updated_at DESC, mt.id DESC
    `).all() as TemplateRow[]

    const templates = rows.map(rowToTemplate)

    res.json({
      success: true,
      data: templates,
    })
  } catch (error) {
    console.error('Get templates error:', error)
    res.status(500).json({ success: false, error: '获取模板列表失败' })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const templateRow = db.prepare(`
      SELECT mt.*,
        (SELECT COUNT(*) FROM template_tasks tt WHERE tt.template_id = mt.id) as task_count,
        (SELECT MAX(version) FROM template_versions tv WHERE tv.template_id = mt.id) as current_version,
        (SELECT COUNT(*) FROM template_versions tv WHERE tv.template_id = mt.id) as version_count
      FROM meeting_templates mt
      WHERE mt.id = ?
    `).get(id) as TemplateRow | undefined

    if (!templateRow) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    const taskRows = db.prepare(
      'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(id) as TemplateTaskRow[]

    const template = rowToTemplate(templateRow)
    template.tasks = taskRows.map(rowToTemplateTask)

    res.json({ success: true, data: template })
  } catch (error) {
    console.error('Get template detail error:', error)
    res.status(500).json({ success: false, error: '获取模板详情失败' })
  }
})

router.get('/:id/versions', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const templateRow = db.prepare('SELECT id FROM meeting_templates WHERE id = ?').get(id)
    if (!templateRow) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    const versionRows = db.prepare(`
      SELECT * FROM template_versions
      WHERE template_id = ?
      ORDER BY version DESC, id DESC
    `).all(id) as TemplateVersionRow[]

    const versions = versionRows.map(rowToTemplateVersion)

    res.json({ success: true, data: versions })
  } catch (error) {
    console.error('Get template versions error:', error)
    res.status(500).json({ success: false, error: '获取模板版本列表失败' })
  }
})

router.get('/:id/versions/:versionId', (req: Request, res: Response) => {
  try {
    const { id, versionId } = req.params

    const versionRow = db.prepare(`
      SELECT * FROM template_versions
      WHERE id = ? AND template_id = ?
    `).get(versionId, id) as TemplateVersionRow | undefined

    if (!versionRow) {
      return res.status(404).json({ success: false, error: '版本不存在' })
    }

    const taskRows = db.prepare(`
      SELECT * FROM template_version_tasks
      WHERE version_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(versionId) as TemplateVersionTaskRow[]

    const version = rowToTemplateVersion(versionRow)
    version.tasks = taskRows.map(rowToTemplateTaskVersion)

    res.json({ success: true, data: version })
  } catch (error) {
    console.error('Get template version detail error:', error)
    res.status(500).json({ success: false, error: '获取版本详情失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, title, departments, tasks } = req.body as CreateTemplateRequest

    if (!name || !title || !departments || !tasks || tasks.length === 0) {
      return res.status(400).json({ success: false, error: '请填写完整信息' })
    }

    const insertTemplate = db.prepare(`
      INSERT INTO meeting_templates (name, title, departments)
      VALUES (?, ?, ?)
    `)

    const insertTemplateTask = db.prepare(`
      INSERT INTO template_tasks (template_id, content, department, sort_order)
      VALUES (?, ?, ?, ?)
    `)

    const templateId = db.transaction(() => {
      const templateResult = insertTemplate.run(name, title, departments)
      const tid = templateResult.lastInsertRowid as number

      tasks.forEach((task, index) => {
        insertTemplateTask.run(tid, task.content, task.department, index)
      })

      createNewVersion(tid, title, departments, tasks)

      return tid
    })()

    const templateRow = db.prepare(`
      SELECT mt.*,
        (SELECT COUNT(*) FROM template_tasks tt WHERE tt.template_id = mt.id) as task_count,
        (SELECT MAX(version) FROM template_versions tv WHERE tv.template_id = mt.id) as current_version,
        (SELECT COUNT(*) FROM template_versions tv WHERE tv.template_id = mt.id) as version_count
      FROM meeting_templates mt
      WHERE mt.id = ?
    `).get(templateId) as TemplateRow

    const taskRows = db.prepare(
      'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(templateId) as TemplateTaskRow[]

    const template = rowToTemplate(templateRow)
    template.tasks = taskRows.map(rowToTemplateTask)

    res.status(201).json({ success: true, data: template })
  } catch (error) {
    console.error('Create template error:', error)
    res.status(500).json({ success: false, error: '创建模板失败' })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, title, departments, tasks } = req.body as UpdateTemplateRequest

    const templateRow = db.prepare('SELECT * FROM meeting_templates WHERE id = ?').get(id) as TemplateRow | undefined
    if (!templateRow) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ success: false, error: '请至少添加一条议定事项' })
    }

    const finalName = name || templateRow.name
    const finalTitle = title || templateRow.title
    const finalDepartments = departments || templateRow.departments

    db.transaction(() => {
      db.prepare('UPDATE meeting_templates SET name = ?, title = ?, departments = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
        .run(finalName, finalTitle, finalDepartments, id)

      db.prepare('DELETE FROM template_tasks WHERE template_id = ?').run(id)

      const insertTask = db.prepare(`
        INSERT INTO template_tasks (template_id, content, department, sort_order)
        VALUES (?, ?, ?, ?)
      `)

      tasks.forEach((task, index) => {
        insertTask.run(id, task.content, task.department, index)
      })

      createNewVersion(Number(id), finalTitle, finalDepartments, tasks)
    })()

    const updatedTemplateRow = db.prepare(`
      SELECT mt.*,
        (SELECT COUNT(*) FROM template_tasks tt WHERE tt.template_id = mt.id) as task_count,
        (SELECT MAX(version) FROM template_versions tv WHERE tv.template_id = mt.id) as current_version,
        (SELECT COUNT(*) FROM template_versions tv WHERE tv.template_id = mt.id) as version_count
      FROM meeting_templates mt
      WHERE mt.id = ?
    `).get(id) as TemplateRow

    const taskRows = db.prepare(
      'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(id) as TemplateTaskRow[]

    const template = rowToTemplate(updatedTemplateRow)
    template.tasks = taskRows.map(rowToTemplateTask)

    res.json({ success: true, data: template })
  } catch (error) {
    console.error('Update template error:', error)
    res.status(500).json({ success: false, error: '更新模板失败' })
  }
})

router.post('/:id/versions/:versionId/restore', (req: Request, res: Response) => {
  try {
    const { id, versionId } = req.params

    const versionRow = db.prepare(`
      SELECT * FROM template_versions
      WHERE id = ? AND template_id = ?
    `).get(versionId, id) as TemplateVersionRow | undefined

    if (!versionRow) {
      return res.status(404).json({ success: false, error: '版本不存在' })
    }

    const taskRows = db.prepare(`
      SELECT * FROM template_version_tasks
      WHERE version_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(versionId) as TemplateVersionTaskRow[]

    const tasks = taskRows.map(t => ({
      content: t.content,
      department: t.department,
    }))

    db.transaction(() => {
      db.prepare('UPDATE meeting_templates SET title = ?, departments = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
        .run(versionRow.title, versionRow.departments, id)

      db.prepare('DELETE FROM template_tasks WHERE template_id = ?').run(id)

      const insertTask = db.prepare(`
        INSERT INTO template_tasks (template_id, content, department, sort_order)
        VALUES (?, ?, ?, ?)
      `)

      taskRows.forEach((task, index) => {
        insertTask.run(id, task.content, task.department, index)
      })

      createNewVersion(Number(id), versionRow.title, versionRow.departments, tasks)
    })()

    const updatedTemplateRow = db.prepare(`
      SELECT mt.*,
        (SELECT COUNT(*) FROM template_tasks tt WHERE tt.template_id = mt.id) as task_count,
        (SELECT MAX(version) FROM template_versions tv WHERE tv.template_id = mt.id) as current_version,
        (SELECT COUNT(*) FROM template_versions tv WHERE tv.template_id = mt.id) as version_count
      FROM meeting_templates mt
      WHERE mt.id = ?
    `).get(id) as TemplateRow

    const updatedTaskRows = db.prepare(
      'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(id) as TemplateTaskRow[]

    const template = rowToTemplate(updatedTemplateRow)
    template.tasks = updatedTaskRows.map(rowToTemplateTask)

    res.json({ success: true, data: template })
  } catch (error) {
    console.error('Restore template version error:', error)
    res.status(500).json({ success: false, error: '恢复版本失败' })
  }
})

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const templateRow = db.prepare('SELECT * FROM meeting_templates WHERE id = ?').get(id) as TemplateRow | undefined
    if (!templateRow) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    db.prepare('DELETE FROM meeting_templates WHERE id = ?').run(id)

    res.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete template error:', error)
    res.status(500).json({ success: false, error: '删除模板失败' })
  }
})

export default router
