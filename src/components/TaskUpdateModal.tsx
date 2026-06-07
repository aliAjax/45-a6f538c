import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, Clock, AlertCircle, BellRing, Plus, XCircle, CalendarDays, MessageSquare, Link2, Lock } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { Task, TaskProgress, TaskSupervision, SupervisionFollowUp, UpdateTaskRequest } from '../../shared/types'
import { cn } from '../lib/utils'
import ProgressTimeline from './ProgressTimeline'
import StatusBadge from './StatusBadge'

interface TaskUpdateModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
  allTasks?: Task[]
}

export default function TaskUpdateModal({ task, isOpen, onClose, onUpdated, allTasks = [] }: TaskUpdateModalProps) {
  const [progress, setProgress] = useState('')
  const [status, setStatus] = useState<Task['status']>('pending')
  const [prerequisiteTaskIds, setPrerequisiteTaskIds] = useState<number[]>([])
  const updateTask = useAppStore((state) => state.updateTask)
  const fetchTaskProgress = useAppStore((state) => state.fetchTaskProgress)
  const fetchTaskSupervisions = useAppStore((state) => state.fetchTaskSupervisions)
  const createSupervision = useAppStore((state) => state.createSupervision)
  const closeSupervision = useAppStore((state) => state.closeSupervision)
  const addSupervisionFollowUp = useAppStore((state) => state.addSupervisionFollowUp)
  const fetchSupervisionFollowUps = useAppStore((state) => state.fetchSupervisionFollowUps)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progressList, setProgressList] = useState<TaskProgress[]>([])
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [supervisionList, setSupervisionList] = useState<TaskSupervision[]>([])
  const [loadingSupervisions, setLoadingSupervisions] = useState(false)
  const [showSuperviseForm, setShowSuperviseForm] = useState(false)
  const [superviseNote, setSuperviseNote] = useState('')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [submittingSupervision, setSubmittingSupervision] = useState(false)
  const [activeTab, setActiveTab] = useState<'progress' | 'supervision'>('progress')
  const [showFollowUpForm, setShowFollowUpForm] = useState(false)
  const [followUpContent, setFollowUpContent] = useState('')
  const [followUpNextDate, setFollowUpNextDate] = useState('')
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false)
  const [followUpList, setFollowUpList] = useState<SupervisionFollowUp[]>([])
  const [loadingFollowUps, setLoadingFollowUps] = useState(false)

  const loadProgressList = useCallback(async (taskId: number) => {
    setLoadingProgress(true)
    try {
      const list = await fetchTaskProgress(taskId)
      setProgressList(list)
    } catch (err) {
      console.error('Failed to load progress list:', err)
    } finally {
      setLoadingProgress(false)
    }
  }, [fetchTaskProgress])

  const loadFollowUpList = useCallback(async (supervisionId: number) => {
    setLoadingFollowUps(true)
    try {
      const list = await fetchSupervisionFollowUps(supervisionId)
      setFollowUpList(list)
    } catch (err) {
      console.error('Failed to load follow-up list:', err)
    } finally {
      setLoadingFollowUps(false)
    }
  }, [fetchSupervisionFollowUps])

  const loadSupervisionList = useCallback(async (taskId: number) => {
    setLoadingSupervisions(true)
    try {
      const list = await fetchTaskSupervisions(taskId)
      setSupervisionList(list)
      const active = list.find((s) => s.status === 'active')
      if (active) {
        loadFollowUpList(active.id)
      } else {
        setFollowUpList([])
      }
    } catch (err) {
      console.error('Failed to load supervision list:', err)
    } finally {
      setLoadingSupervisions(false)
    }
  }, [fetchTaskSupervisions, loadFollowUpList])

  useEffect(() => {
    if (task) {
      setProgress(task.progress || '')
      setStatus(task.status)
      setPrerequisiteTaskIds(task.prerequisiteTaskIds || [])
      setError('')
      setSuperviseNote('')
      setNextFollowUpDate('')
      setShowSuperviseForm(false)
      setShowFollowUpForm(false)
      setFollowUpContent('')
      setFollowUpNextDate('')
      loadProgressList(task.id)
      loadSupervisionList(task.id)
    }
  }, [task, loadProgressList, loadSupervisionList])

  if (!isOpen || !task) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const updateData: UpdateTaskRequest = { status, progress }
      if (allTasks.length > 0) {
        updateData.prerequisiteTaskIds = prerequisiteTaskIds
      }
      await updateTask(task.id, updateData)
      await loadProgressList(task.id)
      await loadSupervisionList(task.id)
      onClose()
      onUpdated?.()
    } catch (err) {
      const error = err as Error
      setError(error.message || '更新失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSupervision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!superviseNote.trim()) return

    setSubmittingSupervision(true)
    setError('')

    try {
      await createSupervision({
        taskId: task.id,
        note: superviseNote.trim(),
        nextFollowUpDate: nextFollowUpDate || undefined,
      })
      setSuperviseNote('')
      setNextFollowUpDate('')
      setShowSuperviseForm(false)
      await loadSupervisionList(task.id)
      onUpdated?.()
    } catch (err) {
      const error = err as Error
      setError(error.message || '督办失败')
    } finally {
      setSubmittingSupervision(false)
    }
  }

  const handleCloseSupervision = async (supervisionId: number) => {
    if (!confirm('确定要关闭这条督办吗？')) return

    try {
      await closeSupervision(supervisionId)
      await loadSupervisionList(task.id)
      onUpdated?.()
    } catch (err) {
      const error = err as Error
      setError(error.message || '关闭督办失败')
    }
  }

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpContent.trim()) return

    const activeSupervision = supervisionList.find((s) => s.status === 'active')
    if (!activeSupervision) return

    setSubmittingFollowUp(true)
    setError('')

    try {
      await addSupervisionFollowUp(activeSupervision.id, {
        content: followUpContent.trim(),
        nextFollowUpDate: followUpNextDate || undefined,
      })
      setFollowUpContent('')
      setFollowUpNextDate('')
      setShowFollowUpForm(false)
      await loadSupervisionList(task.id)
      onUpdated?.()
    } catch (err) {
      const error = err as Error
      setError(error.message || '添加跟进失败')
    } finally {
      setSubmittingFollowUp(false)
    }
  }

  const daysLeft = getDaysLeft(task.deadline)
  const isOverdue = daysLeft < 0 && task.status !== 'completed'
  const hasActiveSupervision = supervisionList.some((s) => s.status === 'active')
  const activeSupervision = supervisionList.find((s) => s.status === 'active') || null

  function getDaysLeft(deadline: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diff = deadlineDate.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">更新事项进展</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              来源：{task.meetingTitle || '未知会议'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-5">
            <div className="mb-5">
              <p className="text-sm font-medium text-slate-700 mb-2">事项内容</p>
              <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                {task.content}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">责任科室</p>
                <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                  {task.department}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">完成期限</p>
                <div
                  className={cn(
                    'p-3 rounded-xl text-sm font-medium',
                    isOverdue
                      ? 'bg-red-50 text-red-600'
                      : 'bg-slate-50 text-slate-600'
                  )}
                >
                  {task.deadline}
                  {isOverdue && (
                    <span className="text-xs ml-2">(逾期 {Math.abs(daysLeft)} 天)</span>
                  )}
                </div>
              </div>
            </div>

            {hasActiveSupervision && activeSupervision && (
              <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <BellRing className="w-4 h-4 text-rose-600" />
                  <span className="text-sm font-medium text-rose-700">当前督办中</span>
                  {activeSupervision.followUpCount !== undefined && (
                    <span className="text-xs text-rose-500 bg-rose-100 px-1.5 py-0.5 rounded">
                      {activeSupervision.followUpCount} 次跟进
                    </span>
                  )}
                </div>
                {activeSupervision.latestFollowUp ? (
                  <>
                    <p className="text-sm text-rose-600 mb-2">
                      {activeSupervision.latestFollowUp.content}
                    </p>
                    {activeSupervision.latestFollowUp.nextFollowUpDate && (
                      <div className="flex items-center gap-1 text-xs text-rose-500">
                        <CalendarDays className="w-3.5 h-3.5" />
                        下次跟进：{activeSupervision.latestFollowUp.nextFollowUpDate}
                      </div>
                    )}
                    <p className="text-xs text-rose-400 mt-1">
                      最近跟进：{activeSupervision.latestFollowUp.createdAt}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-rose-600 mb-2">{activeSupervision.note}</p>
                    {activeSupervision.nextFollowUpDate && (
                      <div className="flex items-center gap-1 text-xs text-rose-500">
                        <CalendarDays className="w-3.5 h-3.5" />
                        下次跟进：{activeSupervision.nextFollowUpDate}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {task.isBlocked && (
              <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">当前被阻塞</span>
                </div>
                <p className="text-xs text-slate-500">
                  前置事项未完成，无法标记为已完成。请先完成前置事项。
                </p>
              </div>
            )}

            {allTasks.length > 0 && (
              <div className="mb-5">
                <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-1">
                  <Link2 className="w-4 h-4" />
                  前置事项
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                  {allTasks.filter(t => t.id !== task.id).map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={prerequisiteTaskIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPrerequisiteTaskIds([...prerequisiteTaskIds, t.id])
                          } else {
                            setPrerequisiteTaskIds(prerequisiteTaskIds.filter(id => id !== t.id))
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{t.content}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={t.status} size="sm" />
                          <span className="text-xs text-slate-500">{t.department}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  选择同会议内需先完成的事项
                </p>
              </div>
            )}

            <div className="mb-5">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                当前状态
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('pending')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    status === 'pending'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <AlertCircle
                    className={cn(
                      'w-6 h-6',
                      status === 'pending' ? 'text-amber-600' : 'text-slate-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      status === 'pending' ? 'text-amber-700' : 'text-slate-600'
                    )}
                  >
                    待办理
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('in_progress')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    status === 'in_progress'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Clock
                    className={cn(
                      'w-6 h-6',
                      status === 'in_progress' ? 'text-blue-600' : 'text-slate-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      status === 'in_progress' ? 'text-blue-700' : 'text-slate-600'
                    )}
                  >
                    进行中
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('completed')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    status === 'completed'
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <CheckCircle
                    className={cn(
                      'w-6 h-6',
                      status === 'completed' ? 'text-green-600' : 'text-slate-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      status === 'completed' ? 'text-green-700' : 'text-slate-600'
                    )}
                  >
                    已完成
                  </span>
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                进展描述
              </label>
              <textarea
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                placeholder="请描述当前进展情况..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                rows={4}
              />
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('progress')}
                    className={cn(
                      'text-sm font-medium transition-colors',
                      activeTab === 'progress'
                        ? 'text-slate-800'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    历史进展
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('supervision')}
                    className={cn(
                      'text-sm font-medium transition-colors flex items-center gap-1',
                      activeTab === 'supervision'
                        ? 'text-slate-800'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    督办记录
                    <span className="text-xs text-slate-400">({supervisionList.length})</span>
                  </button>
                </div>
              </div>

              {activeTab === 'progress' ? (
                loadingProgress ? (
                  <div className="py-6 text-center text-sm text-slate-500">
                    加载中...
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto pr-1">
                    <ProgressTimeline progressList={progressList} />
                  </div>
                )
              ) : (
                <div>
                  {task.status !== 'completed' && !hasActiveSupervision && (
                    <div className="mb-3">
                      {!showSuperviseForm ? (
                        <button
                          type="button"
                          onClick={() => setShowSuperviseForm(true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 text-xs font-medium rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          发起督办
                        </button>
                      ) : (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-rose-700">发起督办</span>
                            <button
                              type="button"
                              onClick={() => setShowSuperviseForm(false)}
                              className="text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            value={superviseNote}
                            onChange={(e) => setSuperviseNote(e.target.value)}
                            placeholder="请输入督办说明..."
                            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none bg-white"
                            rows={3}
                          />
                          <div className="mt-2">
                            <label className="text-xs text-rose-600 block mb-1">下次跟进日期（可选）</label>
                            <input
                              type="date"
                              value={nextFollowUpDate}
                              onChange={(e) => setNextFollowUpDate(e.target.value)}
                              className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateSupervision}
                            disabled={!superviseNote.trim() || submittingSupervision}
                            className="mt-3 w-full py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingSupervision ? '提交中...' : '确认督办'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {hasActiveSupervision && activeSupervision && task.status !== 'completed' && (
                    <div className="mb-3">
                      {!showFollowUpForm ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShowFollowUpForm(true)
                            if (activeSupervision.latestFollowUp?.nextFollowUpDate) {
                              setFollowUpNextDate(activeSupervision.latestFollowUp.nextFollowUpDate)
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 text-xs font-medium rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          追加跟进
                        </button>
                      ) : (
                        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-rose-700">追加跟进记录</span>
                            <button
                              type="button"
                              onClick={() => setShowFollowUpForm(false)}
                              className="text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            value={followUpContent}
                            onChange={(e) => setFollowUpContent(e.target.value)}
                            placeholder="请输入跟进内容..."
                            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none bg-white"
                            rows={3}
                          />
                          <div className="mt-2">
                            <label className="text-xs text-rose-600 block mb-1">调整下次跟进日期（可选）</label>
                            <input
                              type="date"
                              value={followUpNextDate}
                              onChange={(e) => setFollowUpNextDate(e.target.value)}
                              className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleAddFollowUp}
                            disabled={!followUpContent.trim() || submittingFollowUp}
                            className="mt-3 w-full py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingFollowUp ? '提交中...' : '确认跟进'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {loadingSupervisions ? (
                    <div className="py-6 text-center text-sm text-slate-500">
                      加载中...
                    </div>
                  ) : supervisionList.length === 0 ? (
                    <div className="py-8 text-center">
                      <BellRing className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">暂无督办记录</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {supervisionList.map((supervision) => (
                        <div
                          key={supervision.id}
                          className={cn(
                            'p-3 rounded-xl border',
                            supervision.status === 'active'
                              ? 'bg-rose-50 border-rose-200'
                              : 'bg-slate-50 border-slate-200'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <BellRing
                                className={cn(
                                  'w-3.5 h-3.5',
                                  supervision.status === 'active'
                                    ? 'text-rose-600'
                                    : 'text-slate-400'
                                )}
                              />
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  supervision.status === 'active'
                                    ? 'text-rose-600'
                                    : 'text-slate-500'
                                )}
                              >
                                {supervision.status === 'active' ? '督办中' : '已关闭'}
                              </span>
                              {supervision.followUpCount !== undefined && (
                                <span className="text-xs text-slate-400">
                                  · {supervision.followUpCount} 次跟进
                                </span>
                              )}
                            </div>
                            {supervision.status === 'active' &&
                              task.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => handleCloseSupervision(supervision.id)}
                                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  关闭
                                </button>
                              )}
                          </div>

                          {supervision.status === 'active' && supervision.latestFollowUp
                            ? (
                              <div className="mb-2">
                                <p className="text-sm text-rose-600 mb-1">
                                  {supervision.latestFollowUp.content}
                                </p>
                                {supervision.latestFollowUp.nextFollowUpDate && (
                                  <div className="flex items-center gap-1 text-xs text-rose-500">
                                    <CalendarDays className="w-3 h-3" />
                                    下次跟进：{supervision.latestFollowUp.nextFollowUpDate}
                                  </div>
                                )}
                                <p className="text-xs text-rose-400 mt-1">
                                  最近跟进：{supervision.latestFollowUp.createdAt}
                                </p>
                              </div>
                            )
                            : (
                              <p className="text-sm text-slate-600 mb-2">{supervision.note}</p>
                            )}

                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>发起时间：{supervision.createdAt}</span>
                          </div>
                          {supervision.closedAt && supervision.status === 'closed' && (
                            <div className="mt-1 text-xs text-slate-400">
                              关闭时间：{supervision.closedAt}
                            </div>
                          )}

                          {supervision.status === 'active' && loadingFollowUps && (
                            <div className="mt-3 pt-2 border-t border-rose-200">
                              <p className="text-xs text-rose-400">加载跟进记录中...</p>
                            </div>
                          )}

                          {supervision.status === 'active' && !loadingFollowUps && followUpList.length > 1 && (
                            <div className="mt-3 pt-2 border-t border-rose-200">
                              <p className="text-xs font-medium text-rose-600 mb-2">跟进记录</p>
                              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {followUpList.map((followUp, index) => (
                                  <div
                                    key={followUp.id}
                                    className={cn(
                                      'pl-3 border-l-2 relative',
                                      index === 0 ? 'border-rose-400' : 'border-rose-200'
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        'absolute -left-1.5 top-0 w-3 h-3 rounded-full',
                                        index === 0 ? 'bg-rose-500' : 'bg-rose-200'
                                      )}
                                    />
                                    <p className="text-xs text-rose-700 mb-0.5">
                                      {followUp.content}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-rose-400">
                                      <span>{followUp.createdAt}</span>
                                      {followUp.nextFollowUpDate && (
                                        <span className="flex items-center gap-0.5">
                                          <CalendarDays className="w-3 h-3" />
                                          {followUp.nextFollowUpDate}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '保存中...' : '保存更新'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
