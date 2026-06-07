import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest, DepartmentStats, DepartmentRiskStats, RiskLevel } from '../../shared/types.js'

const router = Router()

function rowToDepartment(row: any): Department {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT *
      FROM departments
      ORDER BY sort_order ASC, id ASC
    `).all() as any[]

    const departments = rows.map(rowToDepartment)

    res.json({ success: true, data: departments })
  } catch (error) {
    console.error('Get departments error:', error)
    res.status(500).json({ success: false, error: '获取科室列表失败' })
  }
})

router.get('/active', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT *
      FROM departments
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `).all() as any[]

    const departments = rows.map(rowToDepartment)

    res.json({ success: true, data: departments })
  } catch (error) {
    console.error('Get active departments error:', error)
    res.status(500).json({ success: false, error: '获取启用科室列表失败' })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)

    const row = db.prepare(`
      SELECT * FROM departments WHERE id = ?
    `).get(id) as any

    if (!row) {
      res.status(404).json({ success: false, error: '科室不存在' })
      return
    }

    const department = rowToDepartment(row)

    res.json({ success: true, data: department })
  } catch (error) {
    console.error('Get department error:', error)
    res.status(500).json({ success: false, error: '获取科室信息失败' })
  }
})

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, sortOrder } = req.body as CreateDepartmentRequest

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: '科室名称不能为空' })
      return
    }

    const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name.trim())
    if (existing) {
      res.status(400).json({ success: false, error: '科室名称已存在' })
      return
    }

    const maxSortOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM departments').get() as { max_sort: number }
    const finalSortOrder = sortOrder ?? maxSortOrderRow.max_sort + 1

    const result = db.prepare(`
      INSERT INTO departments (name, sort_order, is_active)
      VALUES (?, ?, 1)
    `).run(name.trim(), finalSortOrder)

    const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid) as any
    const department = rowToDepartment(row)

    res.json({ success: true, data: department })
  } catch (error) {
    console.error('Create department error:', error)
    res.status(500).json({ success: false, error: '创建科室失败' })
  }
})

router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { name, sortOrder, isActive } = req.body as UpdateDepartmentRequest

    const existing = db.prepare('SELECT id FROM departments WHERE id = ?').get(id)
    if (!existing) {
      res.status(404).json({ success: false, error: '科室不存在' })
      return
    }

    if (name !== undefined && name.trim() === '') {
      res.status(400).json({ success: false, error: '科室名称不能为空' })
      return
    }

    if (name !== undefined) {
      const nameExists = db.prepare('SELECT id FROM departments WHERE name = ? AND id != ?').get(name.trim(), id)
      if (nameExists) {
        res.status(400).json({ success: false, error: '科室名称已存在' })
        return
      }
    }

    const current = db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as any

    const finalName = name !== undefined ? name.trim() : current.name
    const finalSortOrder = sortOrder !== undefined ? sortOrder : current.sort_order
    const finalIsActive = isActive !== undefined ? (isActive ? 1 : 0) : current.is_active

    db.prepare(`
      UPDATE departments
      SET name = ?, sort_order = ?, is_active = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(finalName, finalSortOrder, finalIsActive, id)

    const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as any
    const department = rowToDepartment(row)

    res.json({ success: true, data: department })
  } catch (error) {
    console.error('Update department error:', error)
    res.status(500).json({ success: false, error: '更新科室失败' })
  }
})

router.patch('/:id/toggle', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)

    const existing = db.prepare('SELECT id, is_active FROM departments WHERE id = ?').get(id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: '科室不存在' })
      return
    }

    const newIsActive = existing.is_active === 1 ? 0 : 1

    db.prepare(`
      UPDATE departments
      SET is_active = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newIsActive, id)

    const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as any
    const department = rowToDepartment(row)

    res.json({ success: true, data: department })
  } catch (error) {
    console.error('Toggle department error:', error)
    res.status(500).json({ success: false, error: '切换科室状态失败' })
  }
})

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)

    const existing = db.prepare('SELECT id FROM departments WHERE id = ?').get(id)
    if (!existing) {
      res.status(404).json({ success: false, error: '科室不存在' })
      return
    }

    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE department = (SELECT name FROM departments WHERE id = ?)').get(id) as { count: number }
    const templateTaskCount = db.prepare('SELECT COUNT(*) as count FROM template_tasks WHERE department = (SELECT name FROM departments WHERE id = ?)').get(id) as { count: number }

    if (taskCount.count > 0 || templateTaskCount.count > 0) {
      res.status(400).json({ success: false, error: '该科室有关联的待办事项或模板，无法删除，请先停用' })
      return
    }

    db.prepare('DELETE FROM departments WHERE id = ?').run(id)

    res.json({ success: true })
  } catch (error) {
    console.error('Delete department error:', error)
    res.status(500).json({ success: false, error: '删除科室失败' })
  }
})

router.get('/stats/tasks', (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const rows = db.prepare(`
      SELECT
        t.department,
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.status != 'completed' AND t.deadline < ? THEN 1 ELSE 0 END) as overdue
      FROM tasks t
      GROUP BY t.department
      ORDER BY
        (SELECT COALESCE(sort_order, 9999) FROM departments d WHERE d.name = t.department) ASC,
        t.department ASC
    `).all(today) as any[]

    const stats: DepartmentStats[] = rows.map((row) => ({
      department: row.department,
      total: row.total,
      pending: row.pending,
      inProgress: row.in_progress,
      completed: row.completed,
      overdue: row.overdue,
    }))

    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('Get department task stats error:', error)
    res.status(500).json({ success: false, error: '获取科室任务统计失败' })
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
}): { level: RiskLevel; score: number; factors: string[] } {
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

  let level: RiskLevel = 'low'
  if (score >= 40) {
    level = 'high'
  } else if (score >= 15) {
    level = 'medium'
  }

  if (factors.length === 0) {
    factors.push('风险可控')
  }

  return { level: level as RiskLevel, score, factors }
}

router.get('/stats/risk', (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { start: dueSoonStart, end: dueSoonEnd } = getDueSoonRange()
    const longNoUpdateDate = getLongNoUpdateDate()

    const rows = db.prepare(`
      SELECT
        t.department,
        COUNT(*) as total,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN t.status != 'completed' AND t.deadline < ? THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN t.status != 'completed' AND t.deadline < ?
            THEN CAST((julianday(?) - julianday(t.deadline)) AS INTEGER)
            ELSE 0 END) as total_overdue_days,
        MAX(CASE WHEN t.status != 'completed' AND t.deadline < ?
            THEN CAST((julianday(?) - julianday(t.deadline)) AS INTEGER)
            ELSE 0 END) as max_overdue_days,
        AVG(CASE WHEN t.status != 'completed' AND t.deadline < ?
            THEN CAST((julianday(?) - julianday(t.deadline)) AS INTEGER)
            ELSE NULL END) as avg_overdue_days,
        SUM(CASE WHEN t.status != 'completed' AND t.deadline >= ? AND t.deadline <= ? THEN 1 ELSE 0 END) as due_soon_count,
        SUM(CASE WHEN EXISTS (
            SELECT 1 FROM task_supervisions ts
            WHERE ts.task_id = t.id AND ts.status = 'active'
          ) THEN 1 ELSE 0 END) as supervising_count,
        SUM(CASE WHEN t.status != 'completed' AND t.updated_at < ? THEN 1 ELSE 0 END) as long_no_update_count
      FROM tasks t
      GROUP BY t.department
      ORDER BY
        (SELECT COALESCE(sort_order, 9999) FROM departments d WHERE d.name = t.department) ASC,
        t.department ASC
    `).all(today, today, today, today, today, today, today, dueSoonStart, dueSoonEnd, longNoUpdateDate) as any[]

    const deptMap = new Map<string, boolean>()
    const deptRows = db.prepare('SELECT name, is_active FROM departments').all() as { name: string; is_active: number }[]
    deptRows.forEach((d) => deptMap.set(d.name, d.is_active === 1))

    const stats: DepartmentRiskStats[] = rows.map((row) => {
      const total = row.total
      const completed = row.completed
      const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0
      const overdueCount = row.overdue_count
      const totalOverdueDays = row.total_overdue_days || 0
      const maxOverdueDays = row.max_overdue_days || 0
      const avgOverdueDays = row.avg_overdue_days ? Math.round(row.avg_overdue_days * 10) / 10 : 0
      const dueSoonCount = row.due_soon_count
      const supervisingCount = row.supervising_count
      const longNoUpdateCount = row.long_no_update_count

      const { level, score, factors } = calculateRiskLevel({
        overdueCount,
        totalOverdueDays,
        maxOverdueDays,
        dueSoonCount,
        supervisingCount,
        longNoUpdateCount,
        completionRate,
        total,
      })

      return {
        department: row.department,
        isActive: deptMap.get(row.department) ?? true,
        total,
        completed,
        completionRate,
        overdueCount,
        totalOverdueDays,
        maxOverdueDays,
        avgOverdueDays,
        dueSoonCount,
        supervisingCount,
        longNoUpdateCount,
        riskLevel: level,
        riskScore: score,
        riskFactors: factors,
      }
    })

    stats.sort((a, b) => b.riskScore - a.riskScore)

    res.json({ success: true, data: stats })
  } catch (error) {
    console.error('Get department risk stats error:', error)
    res.status(500).json({ success: false, error: '获取科室风险统计失败' })
  }
})

export default router
