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
import type { Stats } from '../shared/types.js'

describe('Stats API - 回归测试', () => {
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

  async function getStats(): Promise<Stats> {
    const res = await request(app).get('/api/stats')
    expect(res.body.success).toBe(true)
    return res.body.data as Stats
  }

  describe('基础统计数据', () => {
    it('空数据库统计为0', async () => {
      const stats = await getStats()
      expect(stats.totalMeetings).toBe(0)
      expect(stats.totalTasks).toBe(0)
      expect(stats.overdueTasks).toBe(0)
      expect(stats.dueSoonTasks).toBe(0)
      expect(stats.completedTasks).toBe(0)
    })

    it('统计正确的会议和任务总数', async () => {
      const meeting1 = createMeeting({ title: '会议1' })
      const meeting2 = createMeeting({ title: '会议2' })

      createTask({ meetingId: meeting1, content: '任务1', deadline: daysFromToday(10) })
      createTask({ meetingId: meeting1, content: '任务2', deadline: daysFromToday(20) })
      createTask({ meetingId: meeting2, content: '任务3', deadline: daysFromToday(5) })

      const stats = await getStats()
      expect(stats.totalMeetings).toBe(2)
      expect(stats.totalTasks).toBe(3)
    })

    it('已完成任务数统计正确', async () => {
      const meetingId = createMeeting({ title: '完成任务会议' })

      createTask({ meetingId, content: '完成1', status: 'completed', deadline: daysFromToday(-1) })
      createTask({ meetingId, content: '完成2', status: 'completed', deadline: daysFromToday(5) })
      createTask({ meetingId, content: '待办1', status: 'pending', deadline: daysFromToday(10) })

      const stats = await getStats()
      expect(stats.completedTasks).toBe(2)
    })
  })

  describe('部门自定义 reminder_rules 影响统计', () => {
    it('advanceDays 影响 dueSoonTasks 计数', async () => {
      const meetingId = createMeeting({ title: '规则测试会议' })

      createTask({
        meetingId,
        content: '统计-5天任务',
        department: '统计一科',
        deadline: daysFromToday(5),
        status: 'pending',
      })

      setReminderRule({ department: '统计一科', advanceDays: 3 })
      const stats1 = await getStats()
      const dept1DueSoon1 = stats1.dueSoonTasks

      setReminderRule({ department: '统计一科', advanceDays: 7 })
      const stats2 = await getStats()
      const dept1DueSoon2 = stats2.dueSoonTasks

      expect(dept1DueSoon2).toBeGreaterThan(dept1DueSoon1)
    })
  })

  describe('督办日期优先于 deadline 影响统计', () => {
    it('includeSupervisionFollowUp=true 时，督办日期提前导致 dueSoonTasks 增加', async () => {
      const meetingId = createMeeting({ title: '督办统计会议' })

      const taskId = createTask({
        meetingId,
        content: '统计-有督办的任务',
        department: '督办统计科',
        deadline: daysFromToday(15),
        status: 'pending',
      })

      createSupervision({
        taskId,
        note: '督办',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule({
        department: '督办统计科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const stats = await getStats()
      expect(stats.dueSoonTasks).toBeGreaterThanOrEqual(1)
    })

    it('includeSupervisionFollowUp=false 时，督办日期不影响统计', async () => {
      const meetingId = createMeeting({ title: '无督办统计会议' })

      const taskId = createTask({
        meetingId,
        content: '统计-忽略督办的任务',
        department: '无督办统计科',
        deadline: daysFromToday(15),
        status: 'pending',
      })

      createSupervision({
        taskId,
        note: '督办',
        nextFollowUpDate: daysFromToday(2),
      })

      setReminderRule({
        department: '无督办统计科',
        advanceDays: 5,
        includeSupervisionFollowUp: false,
      })

      const stats = await getStats()
      const taskInDueSoon = stats.dueSoonTasks > 0
      expect(taskInDueSoon).toBe(false)
    })

    it('督办日期晚于 deadline 时，使用 deadline 统计', async () => {
      const meetingId = createMeeting({ title: '晚督办会议' })

      const taskId = createTask({
        meetingId,
        content: '统计-督办晚的任务',
        department: '晚督办科',
        deadline: daysFromToday(3),
        status: 'pending',
      })

      createSupervision({
        taskId,
        note: '督办日期在 deadline 之后',
        nextFollowUpDate: daysFromToday(20),
      })

      setReminderRule({
        department: '晚督办科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const stats = await getStats()
      expect(stats.dueSoonTasks).toBeGreaterThanOrEqual(1)
    })
  })

  describe('follow_up 日期覆盖督办日期影响统计', () => {
    it('跟进记录日期比督办日期更早，影响 dueSoonTasks 计数', async () => {
      const meetingId = createMeeting({ title: '跟进统计会议' })

      const taskId = createTask({
        meetingId,
        content: '统计-有跟进的任务',
        department: '跟进统计科',
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
        department: '跟进统计科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })

      const stats = await getStats()
      expect(stats.dueSoonTasks).toBeGreaterThanOrEqual(1)
    })
  })

  describe('repeatOverdue 关闭后逾期任务不计入 stats', () => {
    it('repeatOverdue=true 时，逾期任务计入 overdueTasks', async () => {
      const meetingId = createMeeting({ title: '逾期统计会议' })

      createTask({
        meetingId,
        content: '统计-重复逾期',
        department: '逾期统计科',
        deadline: daysFromToday(-3),
        status: 'pending',
      })

      setReminderRule({ department: '逾期统计科', repeatOverdue: true })

      const stats = await getStats()
      expect(stats.overdueTasks).toBeGreaterThanOrEqual(1)
    })

    it('repeatOverdue=false 时，逾期任务不计入 overdueTasks', async () => {
      const meetingId = createMeeting({ title: '不重复逾期会议' })

      createTask({
        meetingId,
        content: '统计-不重复逾期',
        department: '不逾期统计科',
        deadline: daysFromToday(-3),
        status: 'pending',
      })

      setReminderRule({ department: '不逾期统计科', repeatOverdue: false })

      const stats = await getStats()
      const taskInOverdue = stats.overdueTasks > 0
      expect(taskInOverdue).toBe(false)
    })
  })

  describe('已完成任务不参与提醒类统计', () => {
    it('已完成任务不计入 overdueTasks', async () => {
      const meetingId = createMeeting({ title: '完成逾期会议' })

      createTask({
        meetingId,
        content: '统计-已完成逾期',
        department: '完成统计科',
        deadline: daysFromToday(-5),
        status: 'completed',
      })

      setReminderRule({ department: '完成统计科', repeatOverdue: true })

      const stats = await getStats()
      expect(stats.overdueTasks).toBe(0)
    })

    it('已完成任务不计入 dueSoonTasks', async () => {
      const meetingId = createMeeting({ title: '完成即将到期会议' })

      createTask({
        meetingId,
        content: '统计-已完成即将到期',
        department: '完成统计二科',
        deadline: daysFromToday(2),
        status: 'completed',
      })

      setReminderRule({ department: '完成统计二科', advanceDays: 5 })

      const stats = await getStats()
      expect(stats.dueSoonTasks).toBe(0)
    })

    it('已完成任务计入 totalTasks 和 completedTasks', async () => {
      const meetingId = createMeeting({ title: '总数统计会议' })

      createTask({
        meetingId,
        content: '统计-总数-完成',
        department: '总数统计科',
        deadline: daysFromToday(1),
        status: 'completed',
      })

      createTask({
        meetingId,
        content: '统计-总数-待办',
        department: '总数统计科',
        deadline: daysFromToday(10),
        status: 'pending',
      })

      const stats = await getStats()
      expect(stats.totalTasks).toBe(2)
      expect(stats.completedTasks).toBe(1)
    })
  })

  describe('综合统计场景', () => {
    it('多部门多状态任务统计正确', async () => {
      const meetingId = createMeeting({ title: '综合统计会议' })

      createTask({
        meetingId,
        content: '综合统计-逾期-重复',
        department: '综合统计一科',
        deadline: daysFromToday(-2),
        status: 'pending',
      })

      createTask({
        meetingId,
        content: '综合统计-逾期-不重复',
        department: '综合统计二科',
        deadline: daysFromToday(-2),
        status: 'pending',
      })

      const task3Id = createTask({
        meetingId,
        content: '综合统计-有督办',
        department: '综合统计三科',
        deadline: daysFromToday(15),
        status: 'pending',
      })

      createSupervision({
        taskId: task3Id,
        note: '督办',
        nextFollowUpDate: daysFromToday(2),
      })

      createTask({
        meetingId,
        content: '综合统计-已完成',
        department: '综合统计一科',
        deadline: daysFromToday(-1),
        status: 'completed',
      })

      createTask({
        meetingId,
        content: '综合统计-即将到期',
        department: '综合统计四科',
        deadline: daysFromToday(2),
        status: 'pending',
      })

      setReminderRule({ department: '综合统计一科', repeatOverdue: true, advanceDays: 3 })
      setReminderRule({ department: '综合统计二科', repeatOverdue: false, advanceDays: 3 })
      setReminderRule({
        department: '综合统计三科',
        advanceDays: 5,
        includeSupervisionFollowUp: true,
      })
      setReminderRule({ department: '综合统计四科', advanceDays: 3 })

      const stats = await getStats()

      expect(stats.totalTasks).toBe(5)
      expect(stats.completedTasks).toBe(1)
      expect(stats.overdueTasks).toBe(1)
      expect(stats.dueSoonTasks).toBe(2)
    })
  })
})
