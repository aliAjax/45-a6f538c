import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { MeetingTemplate, TemplateTask, CreateTemplateRequest } from '../../shared/types.js'

interface TemplateRow {
  id: number
  name: string
  title: string
  departments: string
  created_at: string
  updated_at: string
  task_count?: number
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

router.get('/', (req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT mt.*, COUNT(tt.id) as task_count
      FROM meeting_templates mt
      LEFT JOIN template_tasks tt ON mt.id = tt.template_id
      GROUP BY mt.id
      ORDER BY mt.created_at DESC, mt.id DESC
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

    const templateRow = db.prepare('SELECT * FROM meeting_templates WHERE id = ?').get(id) as TemplateRow | undefined
    if (!templateRow) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    const taskRows = db.prepare('SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order ASC, id ASC').all(id) as TemplateTaskRow[]

    const template = rowToTemplate(templateRow)
    template.tasks = taskRows.map(rowToTemplateTask)

    res.json({ success: true, data: template })
  } catch (error) {
    console.error('Get template detail error:', error)
    res.status(500).json({ success: false, error: '获取模板详情失败' })
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

    const result = db.transaction(() => {
      const templateResult = insertTemplate.run(name, title, departments)
      const templateId = templateResult.lastInsertRowid as number

      tasks.forEach((task, index) => {
        insertTemplateTask.run(templateId, task.content, task.department, index)
      })

      return templateId
    })()

    const templateRow = db.prepare('SELECT * FROM meeting_templates WHERE id = ?').get(result) as TemplateRow
    const taskRows = db.prepare('SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order ASC, id ASC').all(result) as TemplateTaskRow[]

    const template = rowToTemplate(templateRow)
    template.tasks = taskRows.map(rowToTemplateTask)

    res.status(201).json({ success: true, data: template })
  } catch (error) {
    console.error('Create template error:', error)
    res.status(500).json({ success: false, error: '创建模板失败' })
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
