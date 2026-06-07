import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import type { ReminderRule, UpdateReminderRuleRequest, DEFAULT_REMINDER_RULE } from '../../shared/types.js'

const router = Router()

interface ReminderRuleRow {
  id: number
  department: string
  advance_days: number
  include_supervision_follow_up: number | boolean
  repeat_overdue: number | boolean
  created_at: string
  updated_at: string
}

function rowToReminderRule(row: ReminderRuleRow): ReminderRule {
  return {
    id: row.id,
    department: row.department,
    advanceDays: row.advance_days,
    includeSupervisionFollowUp: row.include_supervision_follow_up === 1 || row.include_supervision_follow_up === true,
    repeatOverdue: row.repeat_overdue === 1 || row.repeat_overdue === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getDefaultRuleForDepartment(department: string): ReminderRule {
  return {
    id: 0,
    department,
    advanceDays: 3,
    includeSupervisionFollowUp: false,
    repeatOverdue: true,
    createdAt: '',
    updatedAt: '',
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT *
      FROM reminder_rules
      ORDER BY department ASC
    `).all() as ReminderRuleRow[]

    const rules = rows.map(rowToReminderRule)

    res.json({ success: true, data: rules })
  } catch (error) {
    console.error('Get reminder rules error:', error)
    res.status(500).json({ success: false, error: '获取提醒规则列表失败' })
  }
})

router.get('/department/:department', (req: Request, res: Response) => {
  try {
    const department = decodeURIComponent(req.params.department)

    const row = db.prepare(`
      SELECT * FROM reminder_rules WHERE department = ?
    `).get(department) as ReminderRuleRow | undefined

    if (!row) {
      const defaultRule = getDefaultRuleForDepartment(department)
      res.json({ success: true, data: defaultRule, isDefault: true })
      return
    }

    const rule = rowToReminderRule(row)
    res.json({ success: true, data: rule, isDefault: false })
  } catch (error) {
    console.error('Get reminder rule error:', error)
    res.status(500).json({ success: false, error: '获取提醒规则失败' })
  }
})

router.get('/all-with-defaults', (_req: Request, res: Response) => {
  try {
    const deptRows = db.prepare(`
      SELECT name FROM departments WHERE is_active = 1 ORDER BY sort_order ASC, id ASC
    `).all() as { name: string }[]

    const ruleRows = db.prepare(`
      SELECT * FROM reminder_rules
    `).all() as ReminderRuleRow[]

    const ruleMap = new Map<string, ReminderRuleRow>()
    ruleRows.forEach((row) => ruleMap.set(row.department, row))

    const result: Array<{ rule: ReminderRule; isDefault: boolean }> = deptRows.map((dept) => {
      const row = ruleMap.get(dept.name)
      if (row) {
        return { rule: rowToReminderRule(row), isDefault: false }
      }
      return { rule: getDefaultRuleForDepartment(dept.name), isDefault: true }
    })

    const taskDeptRows = db.prepare(`
      SELECT DISTINCT department 
      FROM tasks 
      WHERE department NOT IN (SELECT name FROM departments)
      ORDER BY department ASC
    `).all() as { department: string }[]

    taskDeptRows.forEach((dept) => {
      if (dept.department && dept.department.trim()) {
        const row = ruleMap.get(dept.department)
        if (row) {
          result.push({ rule: rowToReminderRule(row), isDefault: false })
        } else {
          result.push({ rule: getDefaultRuleForDepartment(dept.department), isDefault: true })
        }
      }
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error('Get all reminder rules with defaults error:', error)
    res.status(500).json({ success: false, error: '获取提醒规则列表失败' })
  }
})

router.put('/department/:department', (req: Request, res: Response) => {
  try {
    const department = decodeURIComponent(req.params.department)
    const { advanceDays, includeSupervisionFollowUp, repeatOverdue } = req.body as UpdateReminderRuleRequest

    if (advanceDays !== undefined && advanceDays < 0) {
      res.status(400).json({ success: false, error: '提前提醒天数不能为负数' })
      return
    }

    if (advanceDays !== undefined && advanceDays > 365) {
      res.status(400).json({ success: false, error: '提前提醒天数不能超过365天' })
      return
    }

    const existing = db.prepare('SELECT id FROM reminder_rules WHERE department = ?').get(department)

    if (existing) {
      const current = db.prepare('SELECT * FROM reminder_rules WHERE department = ?').get(department) as ReminderRuleRow

      const finalAdvanceDays = advanceDays !== undefined ? advanceDays : current.advance_days
      const finalIncludeSupervision = includeSupervisionFollowUp !== undefined
        ? (includeSupervisionFollowUp ? 1 : 0)
        : current.include_supervision_follow_up
      const finalRepeatOverdue = repeatOverdue !== undefined
        ? (repeatOverdue ? 1 : 0)
        : current.repeat_overdue

      db.prepare(`
        UPDATE reminder_rules
        SET advance_days = ?, include_supervision_follow_up = ?, repeat_overdue = ?,
            updated_at = datetime('now', 'localtime')
        WHERE department = ?
      `).run(finalAdvanceDays, finalIncludeSupervision, finalRepeatOverdue, department)
    } else {
      const finalAdvanceDays = advanceDays !== undefined ? advanceDays : 3
      const finalIncludeSupervision = includeSupervisionFollowUp !== undefined
        ? (includeSupervisionFollowUp ? 1 : 0)
        : 0
      const finalRepeatOverdue = repeatOverdue !== undefined
        ? (repeatOverdue ? 1 : 0)
        : 1

      db.prepare(`
        INSERT INTO reminder_rules (department, advance_days, include_supervision_follow_up, repeat_overdue)
        VALUES (?, ?, ?, ?)
      `).run(department, finalAdvanceDays, finalIncludeSupervision, finalRepeatOverdue)
    }

    const row = db.prepare('SELECT * FROM reminder_rules WHERE department = ?').get(department) as ReminderRuleRow
    const rule = rowToReminderRule(row)

    res.json({ success: true, data: rule })
  } catch (error) {
    console.error('Update reminder rule error:', error)
    res.status(500).json({ success: false, error: '更新提醒规则失败' })
  }
})

router.delete('/department/:department', (req: Request, res: Response) => {
  try {
    const department = decodeURIComponent(req.params.department)

    const existing = db.prepare('SELECT id FROM reminder_rules WHERE department = ?').get(department)
    if (!existing) {
      res.status(404).json({ success: false, error: '该科室没有自定义提醒规则' })
      return
    }

    db.prepare('DELETE FROM reminder_rules WHERE department = ?').run(department)

    res.json({ success: true })
  } catch (error) {
    console.error('Delete reminder rule error:', error)
    res.status(500).json({ success: false, error: '删除提醒规则失败' })
  }
})

export function getReminderRuleForDepartment(department: string): {
  advanceDays: number
  includeSupervisionFollowUp: boolean
  repeatOverdue: boolean
} {
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
    return {
      advanceDays: 3,
      includeSupervisionFollowUp: false,
      repeatOverdue: true,
    }
  }

  return {
    advanceDays: row.advance_days,
    includeSupervisionFollowUp: row.include_supervision_follow_up === 1 || row.include_supervision_follow_up === true,
    repeatOverdue: row.repeat_overdue === 1 || row.repeat_overdue === true,
  }
}

export default router
