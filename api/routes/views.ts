import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type {
  TaskView,
  TaskFilter,
  CreateTaskViewRequest,
  UpdateTaskViewRequest,
  TaskViewValidationResult,
} from '../../shared/types.js'

interface TaskViewRow {
  id: number
  name: string
  filter_json: string
  target_page: string
  sort_order: number
  created_at: string
  updated_at: string
}

function rowToTaskView(row: TaskViewRow): TaskView {
  let filter: TaskFilter = {
    department: 'all',
    status: 'all',
    risk: '',
    search: '',
    startDate: '',
    endDate: '',
    overdueOnly: false,
    dueSoonOnly: false,
    supervisingOnly: false,
  }
  try {
    const parsed = JSON.parse(row.filter_json)
    filter = { ...filter, ...parsed }
  } catch (e) {
    console.error('Failed to parse filter JSON:', e)
  }

  return {
    id: row.id,
    name: row.name,
    filter,
    targetPage: (row.target_page as 'tasks' | 'calendar') || 'tasks',
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM task_views
      ORDER BY sort_order ASC, id ASC
    `).all() as TaskViewRow[]

    const views = rows.map(rowToTaskView)

    res.json({ success: true, data: views })
  } catch (error) {
    console.error('Get task views error:', error)
    res.status(500).json({ success: false, error: '获取视图列表失败' })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const row = db.prepare(`
      SELECT * FROM task_views WHERE id = ?
    `).get(Number(id)) as TaskViewRow | undefined

    if (!row) {
      return res.status(404).json({ success: false, error: '视图不存在' })
    }

    const view = rowToTaskView(row)

    res.json({ success: true, data: view })
  } catch (error) {
    console.error('Get task view error:', error)
    res.status(500).json({ success: false, error: '获取视图详情失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, filter, targetPage } = req.body as CreateTaskViewRequest

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: '视图名称不能为空' })
    }

    const maxSortOrderRow = db.prepare(`
      SELECT MAX(sort_order) as max_sort FROM task_views
    `).get() as { max_sort: number | null }

    const nextSortOrder = (maxSortOrderRow.max_sort || 0) + 1

    const filterJson = JSON.stringify(filter || {})
    const target = targetPage === 'calendar' ? 'calendar' : 'tasks'

    const result = db.prepare(`
      INSERT INTO task_views (name, filter_json, target_page, sort_order)
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), filterJson, target, nextSortOrder)

    const newId = result.lastInsertRowid as number

    const newRow = db.prepare(`
      SELECT * FROM task_views WHERE id = ?
    `).get(newId) as TaskViewRow

    const newView = rowToTaskView(newRow)

    res.json({ success: true, data: newView })
  } catch (error) {
    console.error('Create task view error:', error)
    res.status(500).json({ success: false, error: '创建视图失败' })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, filter, sortOrder, targetPage } = req.body as UpdateTaskViewRequest

    const existingRow = db.prepare(`
      SELECT * FROM task_views WHERE id = ?
    `).get(Number(id)) as TaskViewRow | undefined

    if (!existingRow) {
      return res.status(404).json({ success: false, error: '视图不存在' })
    }

    const fields: string[] = []
    const values: (string | number)[] = []

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, error: '视图名称不能为空' })
      }
      fields.push('name = ?')
      values.push(name.trim())
    }

    if (filter !== undefined) {
      fields.push('filter_json = ?')
      values.push(JSON.stringify(filter))
    }

    if (targetPage !== undefined) {
      fields.push('target_page = ?')
      values.push(targetPage === 'calendar' ? 'calendar' : 'tasks')
    }

    if (sortOrder !== undefined) {
      fields.push('sort_order = ?')
      values.push(sortOrder)
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' })
    }

    fields.push("updated_at = datetime('now', 'localtime')")
    values.push(Number(id))

    const stmt = db.prepare(`
      UPDATE task_views
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    stmt.run(...values)

    const updatedRow = db.prepare(`
      SELECT * FROM task_views WHERE id = ?
    `).get(Number(id)) as TaskViewRow

    const updatedView = rowToTaskView(updatedRow)

    res.json({ success: true, data: updatedView })
  } catch (error) {
    console.error('Update task view error:', error)
    res.status(500).json({ success: false, error: '更新视图失败' })
  }
})

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const existingRow = db.prepare(`
      SELECT * FROM task_views WHERE id = ?
    `).get(Number(id)) as TaskViewRow | undefined

    if (!existingRow) {
      return res.status(404).json({ success: false, error: '视图不存在' })
    }

    db.prepare('DELETE FROM task_views WHERE id = ?').run(Number(id))

    res.json({ success: true, data: { id: Number(id) } })
  } catch (error) {
    console.error('Delete task view error:', error)
    res.status(500).json({ success: false, error: '删除视图失败' })
  }
})

router.post('/reorder', (req: Request, res: Response) => {
  try {
    const { orders } = req.body as { orders: Array<{ id: number; sortOrder: number }> }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ success: false, error: '排序数据不能为空' })
    }

    const updateStmt = db.prepare(`
      UPDATE task_views
      SET sort_order = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `)

    const transaction = db.transaction((orderItems: typeof orders) => {
      for (const item of orderItems) {
        updateStmt.run(item.sortOrder, item.id)
      }
    })

    transaction(orders)

    res.json({ success: true, data: { reordered: orders.length } })
  } catch (error) {
    console.error('Reorder task views error:', error)
    res.status(500).json({ success: false, error: '视图排序失败' })
  }
})

router.get('/:id/validate', (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const viewRow = db.prepare(`
      SELECT * FROM task_views WHERE id = ?
    `).get(Number(id)) as TaskViewRow | undefined

    if (!viewRow) {
      return res.status(404).json({ success: false, error: '视图不存在' })
    }

    const view = rowToTaskView(viewRow)
    const filter = view.filter

    const invalidDepartments: string[] = []

    if (filter.department && filter.department !== 'all') {
      const deptRow = db.prepare(`
        SELECT name, is_active FROM departments WHERE name = ?
      `).get(filter.department) as { name: string; is_active: number } | undefined

      if (!deptRow) {
        invalidDepartments.push(filter.department)
      } else if (deptRow.is_active === 0) {
        invalidDepartments.push(filter.department)
      }
    }

    const isValid = invalidDepartments.length === 0

    const result: TaskViewValidationResult = {
      isValid,
      invalidDepartments,
      message: isValid ? undefined : `视图包含已失效的筛选条件：${invalidDepartments.join('、')}`,
    }

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Validate task view error:', error)
    res.status(500).json({ success: false, error: '验证视图失败' })
  }
})

export default router
