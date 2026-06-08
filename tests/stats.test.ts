import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { getStats } from '../api/lib/reminder-stats.js'
import {
  createTestDb,
  cleanupTempDbs,
  createMeeting,
  createTask,
  createSupervision,
  createFollowUp,
  setReminderRule,
  daysFromToday,
} from './test-helpers.js'
import type { DatabaseInstance } from '../api/db.js'

describe('stats 统计逻辑回归测试', () => {
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

  describe('基础统计数据', () => {
    it('totalMeetings 统计会议总数', () => {
      createMeeting(db, { title: '会议1' })
      createMeeting(db, { title: '会议2' })

      const stats = getStats(db)
      expect(stats.totalMeetings).toBe(2)
    })

    it('totalTasks 统计所有任务总数（包括已完成）', () => {
      const meetingId = createMeeting(db)

      createTask(db, { meetingId, content: '任务1', status: 'pending' })
      createTask(db, { meetingId, content: '任务2', status: 'in_progress' })
      createTask(db, { meetingId, content: '任务3', status: 'completed' })

      const stats = getStats(db)
      expect(stats.totalTasks).toBe(3)
    })

    it('completedTasks 统计已完成任务数', () => {
      const meetingId = createMeeting(db)

      createTask(db, { meetingId, content: '未完成', status: 'pending' })
      createTask(db, { meetingId, content: '已完成1', status: 'completed' })
      createTask(db, { meetingId, content: '已完成2', status: 'completed' })

      const stats = getStats(db)
      expect(stats.completedTasks).toBe(2)
    })
  })

  describe('部门自定义 reminder_rules 影响统计', () => {
    it('advanceDays 影响 dueSoonTasks 计数', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '部门A任务',
        department: '部门A',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      createTask(db, {
        meetingId,
        content: '部门B任务',
        department: '部门B',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      setReminderRule(db, { department: '部门A', advanceDays: 7 })
      setReminderRule(db, { department: '部门B', advanceDays: 3 })

      const stats = getStats(db)
      expect(stats.dueSoonTasks).toBe(1)
    })
  })

  describe('督办日期优先于 deadline 影响统计', () => {
    it('includeSupervisionFollowUp=true 时，督办日期影响 overdue 和 dueSoon 统计', () => {
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
        note: '督办',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule(db, {
        department: '督办科',
        advanceDays: 3,
        includeSupervisionFollowUp: true,
      })

      const stats = getStats(db)
      expect(stats.dueSoonTasks).toBe(1)
    })

    it('includeSupervisionFollowUp=false 时，督办日期不影响统计', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '有督办的任务',
        department: '普通科',
        deadline: daysFromToday(10),
        status: 'pending',
      })

      createSupervision(db, {
        taskId,
        note: '督办',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule(db, {
        department: '普通科',
        advanceDays: 3,
        includeSupervisionFollowUp: false,
      })

      const stats = getStats(db)
      expect(stats.dueSoonTasks).toBe(0)
    })

    it('督办日期更早会使任务从 dueSoon 变为 overdue', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '督办逾期任务',
        department: '督办科',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      createSupervision(db, {
        taskId,
        note: '督办',
        nextFollowUpDate: daysFromToday(-2),
      })

      setReminderRule(db, {
        department: '督办科',
        advanceDays: 3,
        includeSupervisionFollowUp: true,
      })

      const stats = getStats(db)
      expect(stats.overdueTasks).toBe(1)
      expect(stats.dueSoonTasks).toBe(0)
    })
  })

  describe('follow_up 日期覆盖督办日期影响统计', () => {
    it('跟进记录日期比督办日期更早，影响统计结果', () => {
      const meetingId = createMeeting(db)

      const taskId = createTask(db, {
        meetingId,
        content: '有跟进的任务',
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

      const stats = getStats(db)
      expect(stats.dueSoonTasks).toBe(1)
    })
  })

  describe('repeatOverdue 关闭后逾期任务不计入 stats', () => {
    it('repeatOverdue=true 时，逾期任务计入 overdueTasks', () => {
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

      const stats = getStats(db)
      expect(stats.overdueTasks).toBe(1)
    })

    it('repeatOverdue=false 时，逾期任务不计入 overdueTasks', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '逾期但不重复',
        department: '逾期科',
        deadline: daysFromToday(-3),
        status: 'pending',
      })

      setReminderRule(db, {
        department: '逾期科',
        repeatOverdue: false,
      })

      const stats = getStats(db)
      expect(stats.overdueTasks).toBe(0)
    })
  })

  describe('已完成任务不参与提醒类统计', () => {
    it('已完成任务不计入 overdueTasks', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '已完成逾期',
        department: '完成科',
        deadline: daysFromToday(-10),
        status: 'completed',
      })

      setReminderRule(db, {
        department: '完成科',
        repeatOverdue: true,
      })

      const stats = getStats(db)
      expect(stats.overdueTasks).toBe(0)
    })

    it('已完成任务不计入 dueSoonTasks', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '已完成即将到期',
        department: '完成科',
        deadline: daysFromToday(2),
        status: 'completed',
      })

      setReminderRule(db, {
        department: '完成科',
        advanceDays: 5,
      })

      const stats = getStats(db)
      expect(stats.dueSoonTasks).toBe(0)
    })

    it('已完成任务计入 totalTasks 和 completedTasks', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '进行中',
        department: '完成科',
        deadline: daysFromToday(2),
        status: 'in_progress',
      })

      createTask(db, {
        meetingId,
        content: '已完成',
        department: '完成科',
        deadline: daysFromToday(5),
        status: 'completed',
      })

      const stats = getStats(db)
      expect(stats.totalTasks).toBe(2)
      expect(stats.completedTasks).toBe(1)
    })
  })

  describe('综合统计场景', () => {
    it('多部门混合场景下统计数据正确', () => {
      const meetingId = createMeeting(db)

      createTask(db, {
        meetingId,
        content: '逾期任务A',
        department: '部门A',
        deadline: daysFromToday(-3),
        status: 'pending',
      })

      createTask(db, {
        meetingId,
        content: '即将到期B',
        department: '部门B',
        deadline: daysFromToday(2),
        status: 'pending',
      })

      createTask(db, {
        meetingId,
        content: '已完成C',
        department: '部门C',
        deadline: daysFromToday(-1),
        status: 'completed',
      })

      createTask(db, {
        meetingId,
        content: '远期任务D',
        department: '部门D',
        deadline: daysFromToday(30),
        status: 'pending',
      })

      setReminderRule(db, { department: '部门A', advanceDays: 3, repeatOverdue: true })
      setReminderRule(db, { department: '部门B', advanceDays: 3, repeatOverdue: true })
      setReminderRule(db, { department: '部门C', advanceDays: 3, repeatOverdue: true })
      setReminderRule(db, { department: '部门D', advanceDays: 3, repeatOverdue: true })

      const stats = getStats(db)

      expect(stats.totalTasks).toBe(4)
      expect(stats.completedTasks).toBe(1)
      expect(stats.overdueTasks).toBe(1)
      expect(stats.dueSoonTasks).toBe(1)
      expect(stats.totalMeetings).toBe(1)
    })
  })
})
