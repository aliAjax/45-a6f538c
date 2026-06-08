import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../api/app.js'
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanupTempDbs,
  clearAllTables,
  createMeeting,
  createTask,
  createSupervision,
  createFollowUp,
  setReminderRule,
  daysFromToday,
} from './test-helpers.js'
import type { ReminderGroups } from '../shared/types.js'

describe('Reminders API - 回归测试', () => {
  beforeAll(() => {
    setupTestDatabase()
  })

  beforeEach(() => {
    clearAllTables()
  })

  afterAll(() => {
    teardownTestDatabase()
    cleanupTempDbs()
  })

  async function getReminders(): Promise<ReminderGroups> {
    const res = await request(app).get('/api/reminders')
    expect(res.body.success).toBe(true)
    return res.body.data as ReminderGroups
  }

  describe('部门自定义 reminder_rules', () => {
    it('不同部门 advanceDays 不同，提前提醒范围不同', async () => {
      const meetingId = createMeeting()

      createTask({
        meetingId,
        content: '办公室的5天任务',
        department: '办公室',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      createTask({
        meetingId,
        content: '业务一科的5天任务',
        department: '业务一科',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      setReminderRule({ department: '办公室', advanceDays: 3 })
      setReminderRule({ department: '业务一科', advanceDays: 7 })

      const groups = await getReminders()

      const officeTasks = groups.upcoming.filter((t) => t.department === '办公室')
      const dept1Tasks = groups.upcoming.filter((t) => t.department === '业务一科')

      expect(officeTasks.length).toBe(0)
      expect(dept1Tasks.length).toBe(1)
    })

    it('没有自定义规则的部门使用默认规则 advanceDays=3', async () => {
      const meetingId = createMeeting()

      createTask({
        meetingId,
        content: '默认规则的2天任务',
        department: '默认测试科',
        deadline: daysFromToday(2),
        status: 'pending',
      })

      createTask({
        meetingId,
        content: '默认规则的5天任务',
        department: '默认测试科',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      const groups = await getReminders()
      const defaultDeptTasks = groups.upcoming.filter((t) => t.department === '默认测试科')
      expect(defaultDeptTasks.length).toBe(1)
      expect(defaultDeptTasks[0].content).toBe('默认规则的2天任务')
    })
  })

  describe('督办 nextFollowUpDate 优先于任务 deadline', () => {
    it('includeSupervisionFollowUp=true 时，督办日期早于 deadline 则使用督办日期', async () => {
      const meetingId = createMeeting()

      const taskId = createTask({
        meetingId,
        content: '有督办的任务',
        department: '督办科',
        deadline: daysFromToday(10),
        status: 'pending',
      })

      createSupervision({
        taskId,
        note: '重点督办',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule({
        department: '督办科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = await getReminders()
      const task = groups.upcoming.find((t) => t.content === '有督办的任务')
      expect(task).toBeDefined()
      expect(task?.hasActiveSupervision).toBe(true)
    })

    it('includeSupervisionFollowUp=false 时，忽略督办日期', async () => {
      const meetingId = createMeeting()

      const taskId = createTask({
        meetingId,
        content: '忽略督办的任务',
        department: '督办二科',
        deadline: daysFromToday(10),
        status: 'pending',
      })

      createSupervision({
        taskId,
        note: '督办但不纳入提醒',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule({
        department: '督办二科',
        advanceDays: 5,
        includeSupervisionFollowUp: false,
      })

      const groups = await getReminders()
      const task = groups.upcoming.find((t) => t.content === '忽略督办的任务')
      expect(task).toBeUndefined()
    })

    it('督办日期晚于 deadline 时，仍使用 deadline', async () => {
      const meetingId = createMeeting()

      const taskId = createTask({
        meetingId,
        content: '督办日期晚的任务',
        department: '督办三科',
        deadline: daysFromToday(3),
        status: 'pending',
      })

      createSupervision({
        taskId,
        note: '督办日期在 deadline 之后',
        nextFollowUpDate: daysFromToday(15),
      })

      setReminderRule({
        department: '督办三科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = await getReminders()
      const task = groups.upcoming.find((t) => t.content === '督办日期晚的任务')
      expect(task).toBeDefined()
    })
  })

  describe('follow_up 里的下一次跟进日期覆盖督办日期', () => {
    it('最新跟进记录日期比督办日期更早，使用跟进记录日期', async () => {
      const meetingId = createMeeting()

      const taskId = createTask({
        meetingId,
        content: '有跟进记录的任务',
        department: '跟进科',
        deadline: daysFromToday(20),
        status: 'pending',
      })

      const supervisionId = createSupervision({
        taskId,
        note: '初始督办',
        nextFollowUpDate: daysFromToday(10),
      })

      createFollowUp({
        supervisionId,
        content: '第一次跟进',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule({
        department: '跟进科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = await getReminders()
      expect(groups.upcoming.length).toBe(1)
      expect(groups.upcoming[0].content).toBe('有跟进记录的任务')
    })

    it('最新跟进记录的日期比督办日期更晚，使用最新跟进日期', async () => {
      const meetingId = createMeeting()

      const taskId = createTask({
        meetingId,
        content: '跟进日期更晚的任务',
        department: '跟进二科',
        deadline: daysFromToday(20),
        status: 'pending',
      })

      const supervisionId = createSupervision({
        taskId,
        note: '初始督办',
        nextFollowUpDate: daysFromToday(2),
      })

      createFollowUp({
        supervisionId,
        content: '推迟跟进',
        nextFollowUpDate: daysFromToday(10),
      })

      setReminderRule({
        department: '跟进二科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = await getReminders()
      expect(groups.upcoming.length).toBe(0)
      expect(groups.overdue.length).toBe(0)
      expect(groups.today.length).toBe(0)
    })

    it('使用最新跟进记录日期而非督办日期（日期更早时验证）', async () => {
      const meetingId = createMeeting()

      const taskId = createTask({
        meetingId,
        content: '验证使用最新跟进日期',
        department: '跟进三科',
        deadline: daysFromToday(20),
        status: 'pending',
      })

      const supervisionId = createSupervision({
        taskId,
        note: '初始督办',
        nextFollowUpDate: daysFromToday(10),
      })

      createFollowUp({
        supervisionId,
        content: '提前跟进',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule({
        department: '跟进三科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = await getReminders()
      expect(groups.upcoming.length).toBe(1)
      expect(groups.upcoming[0].content).toBe('验证使用最新跟进日期')
    })
  })

  describe('repeatOverdue 关闭后逾期任务不再进入提醒', () => {
    it('repeatOverdue=true 时，逾期任务出现在 overdue 列表', async () => {
      const meetingId = createMeeting()

      createTask({
        meetingId,
        content: '重复提醒的逾期任务',
        department: '逾期科',
        deadline: daysFromToday(-3),
        status: 'pending',
      })

      setReminderRule({
        department: '逾期科',
        repeatOverdue: true,
      })

      const groups = await getReminders()
      const overdueTask = groups.overdue.find((t) => t.content === '重复提醒的逾期任务')
      expect(overdueTask).toBeDefined()
    })

    it('repeatOverdue=false 时，逾期任务不出现在任何提醒列表', async () => {
      const meetingId = createMeeting()

      createTask({
        meetingId,
        content: '不重复提醒的逾期任务',
        department: '逾期二科',
        deadline: daysFromToday(-3),
        status: 'pending',
      })

      setReminderRule({
        department: '逾期二科',
        repeatOverdue: false,
      })

      const groups = await getReminders()
      const inOverdue = groups.overdue.some((t) => t.content === '不重复提醒的逾期任务')
      const inToday = groups.today.some((t) => t.content === '不重复提醒的逾期任务')
      const inUpcoming = groups.upcoming.some((t) => t.content === '不重复提醒的逾期任务')

      expect(inOverdue).toBe(false)
      expect(inToday).toBe(false)
      expect(inUpcoming).toBe(false)
    })
  })

  describe('已完成任务不参与提醒', () => {
    it('completed 状态的任务不出现在任何提醒分组中', async () => {
      const meetingId = createMeeting()

      createTask({
        meetingId,
        content: '已完成的逾期任务',
        department: '完成科',
        deadline: daysFromToday(-5),
        status: 'completed',
      })

      createTask({
        meetingId,
        content: '已完成的近期任务',
        department: '完成科',
        deadline: daysFromToday(1),
        status: 'completed',
      })

      const groups = await getReminders()
      const allTasks = [...groups.overdue, ...groups.today, ...groups.upcoming]
      const completedTasks = allTasks.filter((t) => t.status === 'completed')
      expect(completedTasks.length).toBe(0)
    })
  })

  describe('综合场景', () => {
    it('多个部门多种状态的任务正确分组', async () => {
      const meetingId = createMeeting()

      createTask({
        meetingId,
        content: '综合-逾期-重复',
        department: '综合一科',
        deadline: daysFromToday(-2),
        status: 'pending',
      })

      createTask({
        meetingId,
        content: '综合-逾期-不重复',
        department: '综合二科',
        deadline: daysFromToday(-2),
        status: 'pending',
      })

      createTask({
        meetingId,
        content: '综合-即将到期-督办',
        department: '综合三科',
        deadline: daysFromToday(10),
        status: 'pending',
      })

      const task4Id = createTask({
        meetingId,
        content: '综合-即将到期-有督办',
        department: '综合三科',
        deadline: daysFromToday(15),
        status: 'pending',
      })

      createSupervision({
        taskId: task4Id,
        note: '重点督办',
        nextFollowUpDate: daysFromToday(2),
      })

      createTask({
        meetingId,
        content: '综合-已完成',
        department: '综合一科',
        deadline: daysFromToday(-1),
        status: 'completed',
      })

      setReminderRule({ department: '综合一科', repeatOverdue: true, advanceDays: 3 })
      setReminderRule({ department: '综合二科', repeatOverdue: false, advanceDays: 3 })
      setReminderRule({
        department: '综合三科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const groups = await getReminders()

      expect(groups.overdue.some((t) => t.content === '综合-逾期-重复')).toBe(true)
      expect(groups.overdue.some((t) => t.content === '综合-逾期-不重复')).toBe(false)
      expect(groups.upcoming.some((t) => t.content === '综合-即将到期-督办')).toBe(false)
      expect(groups.upcoming.some((t) => t.content === '综合-即将到期-有督办')).toBe(true)
      expect(groups.overdue.some((t) => t.content === '综合-已完成')).toBe(false)
      expect(groups.upcoming.some((t) => t.content === '综合-已完成')).toBe(false)
    })
  })
})
