import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getReminderGroups, getTaskEffectiveReminderDate, getReminderRuleForDepartment } from '../api/lib/reminder-stats.js'
import {
  createTestDb,
  closeTestDb,
  cleanupTempDbs,
  createMeeting,
  createTask,
  createSupervision,
  createFollowUp,
  setReminderRule,
  daysFromToday,
} from './test-helpers.js'
import type { DatabaseInstance } from '../api/db.js'
import type { Task } from '../shared/types.js'

describe('reminders 提醒逻辑回归测试', () => {
  let instance: DatabaseInstance
  let db: import('better-sqlite3').Database

  beforeEach(() => {
    const testDb = createTestDb()
    instance = testDb.instance
    db = instance.db
  })

  afterAll(() => {
    cleanupTempDbs()
  })

  describe('部门自定义 reminder_rules', () => {
    it('不同部门的 advanceDays 不同，提前提醒范围不同', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '办公室任务',
        department: '办公室',
        deadline: daysFromToday(2),
        status: 'pending',
      })

      createTask(db, {
        meetingId,
        content: '业务一科任务',
        department: '业务一科',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      setReminderRule(db, { department: '办公室', advanceDays: 1 })
      setReminderRule(db, { department: '业务一科', advanceDays: 7 })

      const groups = getReminderGroups(db)

      const officeTask = groups.upcoming.find(t => t.department === '办公室')
      const deptTask = groups.upcoming.find(t => t.department === '业务一科')

      expect(officeTask).toBeUndefined()
      expect(deptTask).toBeDefined()
      expect(groups.upcoming.length).toBe(1)
    })

    it('没有自定义规则的部门使用默认规则（advanceDays=3）', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '两天后到期',
        department: '默认部门',
        deadline: daysFromToday(2),
        status: 'pending',
      })

      createTask(db, {
        meetingId,
        content: '五天后到期',
        department: '默认部门',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      const rule = getReminderRuleForDepartment(db, '默认部门')
      expect(rule.advanceDays).toBe(3)

      const groups = getReminderGroups(db)
      expect(groups.upcoming.length).toBe(1)
      expect(groups.upcoming[0].content).toBe('两天后到期')
    })
  })

  describe('督办 nextFollowUpDate 优先于任务 deadline', () => {
    it('includeSupervisionFollowUp=true 时，督办日期早于 deadline 则使用督办日期', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '有督办的任务',
        department: '督办科',
        deadline: daysFromToday(10),
        status: 'pending',
      })

      createSupervision(db, {
        taskId,
        note: '督办一下',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule(db, {
        department: '督办科',
        advanceDays: 3,
        includeSupervisionFollowUp: true,
      })

      const groups = getReminderGroups(db)
      expect(groups.upcoming.length).toBe(1)
      expect(groups.upcoming[0].content).toBe('有督办的任务')
    })

    it('includeSupervisionFollowUp=false 时，忽略督办日期', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '有督办但不包含的任务',
        department: '普通科',
        deadline: daysFromToday(10),
        status: 'pending',
      })

      createSupervision(db, {
        taskId,
        note: '督办一下',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule(db, {
        department: '普通科',
        advanceDays: 3,
        includeSupervisionFollowUp: false,
      })

      const groups = getReminderGroups(db)
      expect(groups.upcoming.length).toBe(0)
      expect(groups.today.length).toBe(0)
      expect(groups.overdue.length).toBe(0)
    })

    it('督办日期晚于 deadline 时，仍使用 deadline', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '督办日期更晚',
        department: '督办科',
        deadline: daysFromToday(3),
        status: 'pending',
      })

      createSupervision(db, {
        taskId,
        note: '稍后督办',
        nextFollowUpDate: daysFromToday(10),
      })

      setReminderRule(db, {
        department: '督办科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = getReminderGroups(db)
      const task = groups.upcoming.find(t => t.content === '督办日期更晚')
      expect(task).toBeDefined()

      const rule = getReminderRuleForDepartment(db, '督办科')
      const effectiveDate = getTaskEffectiveReminderDate(task as Task, rule)
      const deadlineStr = task!.deadline.split('T')[0].split(' ')[0]
      expect(effectiveDate).toBe(deadlineStr)
    })
  })

  describe('follow_up 里的下一次跟进日期覆盖督办日期', () => {
    it('最新跟进记录的日期比督办日期更早，使用跟进记录日期', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '有跟进记录的任务',
        department: '跟进科',
        deadline: daysFromToday(20),
        status: 'pending',
      })

      const supervisionId = createSupervision(db, {
        taskId,
        note: '初始督办',
        nextFollowUpDate: daysFromToday(10),
      })

      createFollowUp(db, {
        supervisionId,
        content: '第一次跟进',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule(db, {
        department: '跟进科',
        advanceDays: 3,
        includeSupervisionFollowUp: true,
      })

      const groups = getReminderGroups(db)
      expect(groups.upcoming.length).toBe(1)
      expect(groups.upcoming[0].content).toBe('有跟进记录的任务')
    })

    it('最新跟进记录的日期比督办日期更晚，使用最新跟进日期', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '跟进日期更晚的任务',
        department: '跟进科',
        deadline: daysFromToday(20),
        status: 'pending',
      })

      const supervisionId = createSupervision(db, {
        taskId,
        note: '初始督办',
        nextFollowUpDate: daysFromToday(2),
      })

      createFollowUp(db, {
        supervisionId,
        content: '推迟跟进',
        nextFollowUpDate: daysFromToday(10),
      })

      setReminderRule(db, {
        department: '跟进科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = getReminderGroups(db)
      expect(groups.upcoming.length).toBe(0)
      expect(groups.overdue.length).toBe(0)
      expect(groups.today.length).toBe(0)
    })

    it('使用最新跟进记录日期而非督办日期（日期更早时验证）', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '验证使用最新跟进日期',
        department: '跟进科',
        deadline: daysFromToday(20),
        status: 'pending',
      })

      const supervisionId = createSupervision(db, {
        taskId,
        note: '初始督办',
        nextFollowUpDate: daysFromToday(10),
      })

      createFollowUp(db, {
        supervisionId,
        content: '提前跟进',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule(db, {
        department: '跟进科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = getReminderGroups(db)
      expect(groups.upcoming.length).toBe(1)
      expect(groups.upcoming[0].content).toBe('验证使用最新跟进日期')
    })
  })

  describe('repeatOverdue 关闭后逾期任务不再进入提醒', () => {
    it('repeatOverdue=true 时，逾期任务出现在 overdue 列表', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '逾期任务',
        department: '逾期科',
        deadline: daysFromToday(-5),
        status: 'pending',
      })

      setReminderRule(db, {
        department: '逾期科',
        repeatOverdue: true,
      })

      const groups = getReminderGroups(db)
      expect(groups.overdue.length).toBe(1)
      expect(groups.overdue[0].content).toBe('逾期任务')
    })

    it('repeatOverdue=false 时，逾期任务不进入提醒列表', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '逾期但不重复提醒',
        department: '逾期科',
        deadline: daysFromToday(-3),
        status: 'pending',
      })

      setReminderRule(db, {
        department: '逾期科',
        repeatOverdue: false,
      })

      const groups = getReminderGroups(db)
      expect(groups.overdue.length).toBe(0)
      expect(groups.today.length).toBe(0)
      expect(groups.upcoming.length).toBe(0)
    })
  })

  describe('已完成任务不参与提醒', () => {
    it('completed 状态的任务不出现在任何提醒分组中', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '已完成的逾期任务',
        department: '完成科',
        deadline: daysFromToday(-10),
        status: 'completed',
      })

      createTask(db, {
        meetingId,
        content: '已完成的即将到期任务',
        department: '完成科',
        deadline: daysFromToday(1),
        status: 'completed',
      })

      createTask(db, {
        meetingId,
        content: '今天到期已完成',
        department: '完成科',
        deadline: daysFromToday(0),
        status: 'completed',
      })

      setReminderRule(db, {
        department: '完成科',
        advanceDays: 3,
        repeatOverdue: true,
      })

      const groups = getReminderGroups(db)
      expect(groups.overdue.length).toBe(0)
      expect(groups.today.length).toBe(0)
      expect(groups.upcoming.length).toBe(0)
    })
  })

  describe('综合场景', () => {
    it('多个部门混合场景下的提醒分组正确', () => {
      const meetingId = createMeeting(db, { title: '综合会议' })

      createTask(db, {
        meetingId,
        content: 'A部门逾期任务',
        department: '部门A',
        deadline: daysFromToday(-2),
        status: 'pending',
      })

      createTask(db, {
        meetingId,
        content: 'B部门今天到期',
        department: '部门B',
        deadline: daysFromToday(0),
        status: 'in_progress',
      })

      createTask(db, {
        meetingId,
        content: 'C部门即将到期',
        department: '部门C',
        deadline: daysFromToday(2),
        status: 'pending',
      })

      createTask(db, {
        meetingId,
        content: '已完成任务',
        department: '部门A',
        deadline: daysFromToday(-5),
        status: 'completed',
      })

      setReminderRule(db, { department: '部门A', advanceDays: 3, repeatOverdue: true })
      setReminderRule(db, { department: '部门B', advanceDays: 3, repeatOverdue: true })
      setReminderRule(db, { department: '部门C', advanceDays: 3, repeatOverdue: true })

      const groups = getReminderGroups(db)

      expect(groups.overdue.length).toBe(1)
      expect(groups.overdue[0].content).toBe('A部门逾期任务')

      expect(groups.today.length).toBe(1)
      expect(groups.today[0].content).toBe('B部门今天到期')

      expect(groups.upcoming.length).toBe(1)
      expect(groups.upcoming[0].content).toBe('C部门即将到期')
    })
  })
})
