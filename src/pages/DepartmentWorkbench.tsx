import { useEffect, useState, useMemo } from 'react'
import {
  Building2,
  ChevronDown,
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
  Edit3,
  X,
  AlertCircle,
  Check,
  ListTodo,
  RefreshCw,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import StatusBadge from '../components/StatusBadge'
import type { Task, BatchUpdateTaskResult } from '../../shared/types'
import { cn } from '../lib/utils'
import { useSearchParams, useNavigate } from 'react-router-dom'

type QueueType = 'pending' | 'overdue' | 'dueThisWeek' | 'completed'

const queueConfig: Record<QueueType, {
  label: string
  icon: typeof AlertTriangle
  colorClass: string
  bgClass: string
  borderClass: string
}> = {
  pending: {
    label: '待办理队列',
    icon: ListTodo,
    colorClass: 'text-violet-600',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
  },
  overdue: {
    label: '逾期队列',
    icon: AlertTriangle,
    colorClass: 'text-red-600',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
  },
  dueThisWeek: {
    label: '本周到期',
    icon: Clock,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  completed: {
    label: '已完成记录',
    icon: CheckCircle,
    colorClass: 'text-green-600',
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
  },
}

export default function DepartmentWorkbench() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    departments,
    departmentWorkbench,
    fetchDepartments,
    fetchDepartmentWorkbench,
    batchUpdateTasks,
  } = useAppStore()

  const urlDepartment = searchParams.get('department') || ''

  const [selectedDepartment, setSelectedDepartment] = useState(urlDepartment)
  const [showDeptDropdown, setShowDeptDropdown] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchStatus, setBatchStatus] = useState<Task['status']>('in_progress')
  const [batchProgress, setBatchProgress] = useState('')
  const [showConfirmStep, setShowConfirmStep] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchUpdateTaskResult[] | null>(null)
  const [activeQueue, setActiveQueue] = useState<QueueType>('pending')

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0])
    }
  }, [departments, selectedDepartment])

  useEffect(() => {
    if (selectedDepartment) {
      fetchDepartmentWorkbench(selectedDepartment)
      setSelectedTaskIds(new Set())
    }
  }, [selectedDepartment, fetchDepartmentWorkbench])

  useEffect(() => {
    if (urlDepartment !== selectedDepartment && departments.includes(urlDepartment)) {
      setSelectedDepartment(urlDepartment)
    }
  }, [urlDepartment, selectedDepartment, departments])

  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept)
    setShowDeptDropdown(false)
    setSelectedTaskIds(new Set())
    const params = new URLSearchParams(searchParams)
    params.set('department', dept)
    setSearchParams(params)
  }

  const getTasksForQueue = (queue: QueueType): Task[] => {
    if (!departmentWorkbench) return []
    switch (queue) {
      case 'pending':
        return departmentWorkbench.pending
      case 'overdue':
        return departmentWorkbench.overdue
      case 'dueThisWeek':
        return departmentWorkbench.dueThisWeek
      case 'completed':
        return departmentWorkbench.completed
      default:
        return []
    }
  }

  const activeTasks = getTasksForQueue(activeQueue)
  const selectableTasks = activeQueue !== 'completed' ? activeTasks : []

  const allSelected = useMemo(() => {
    if (selectableTasks.length === 0) return false
    return selectableTasks.every((t) => selectedTaskIds.has(t.id))
  }, [selectableTasks, selectedTaskIds])

  const someSelected = useMemo(() => {
    if (selectableTasks.length === 0) return false
    return selectableTasks.some((t) => selectedTaskIds.has(t.id))
  }, [selectableTasks, selectedTaskIds])

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTaskIds(new Set())
    } else {
      const ids = new Set(selectableTasks.map((t) => t.id))
      setSelectedTaskIds(ids)
    }
  }

  const toggleSelectTask = (taskId: number) => {
    const newSelected = new Set(selectedTaskIds)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTaskIds(newSelected)
  }

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks?department=${encodeURIComponent(task.department)}`)
  }

  const openBatchModal = () => {
    if (selectedTaskIds.size === 0) return
    setBatchStatus('in_progress')
    setBatchProgress('')
    setShowConfirmStep(false)
    setBatchResults(null)
    setShowBatchModal(true)
  }

  const handleNextStep = () => {
    setShowConfirmStep(true)
  }

  const handleBackStep = () => {
    setShowConfirmStep(false)
  }

  const handleBatchUpdate = async () => {
    setBatchLoading(true)
    setBatchResults(null)

    try {
      const updates = Array.from(selectedTaskIds).map((id) => ({
        id,
        status: batchStatus,
        progress: batchProgress,
      }))

      const result = await batchUpdateTasks({ updates })
      setBatchResults(result.results)

      if (result.failCount === 0) {
        setTimeout(() => {
          setShowBatchModal(false)
          setSelectedTaskIds(new Set())
          if (selectedDepartment) {
            fetchDepartmentWorkbench(selectedDepartment)
          }
        }, 1500)
      }
    } catch (err) {
      console.error('Batch update failed:', err)
    } finally {
      setBatchLoading(false)
    }
  }

  const handleCloseBatchModal = () => {
    if (batchLoading) return
    setShowBatchModal(false)
    if (batchResults) {
      if (selectedDepartment) {
        fetchDepartmentWorkbench(selectedDepartment)
      }
      setBatchResults(null)
    }
  }

  const handleRefresh = () => {
    if (selectedDepartment) {
      fetchDepartmentWorkbench(selectedDepartment)
    }
  }

  const selectedCount = selectedTaskIds.size

  if (!departmentWorkbench && selectedDepartment) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">科室任务工作台</h1>
          <p className="text-slate-500 text-sm">
            按科室查看待办事项队列，支持批量更新状态和进展
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>

          {selectedCount > 0 && (
            <button
              onClick={openBatchModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm shadow-primary-200"
            >
              <Edit3 className="w-4 h-4" />
              批量更新 ({selectedCount})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4.5 h-4.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">选择科室：</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowDeptDropdown(!showDeptDropdown)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              <span className="text-slate-700 font-medium">
                {selectedDepartment || '请选择科室'}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {showDeptDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDeptDropdown(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => handleDepartmentChange(dept)}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-sm transition-colors',
                        selectedDepartment === dept
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {departmentWorkbench && (
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
              <span>共 <span className="font-medium text-slate-700">{departmentWorkbench.stats.total}</span> 条事项</span>
              <span className="text-slate-300">|</span>
              <span>已完成 <span className="font-medium text-green-600">{departmentWorkbench.stats.completed}</span> 条</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(queueConfig) as QueueType[]).map((queue) => {
          const config = queueConfig[queue]
          const Icon = config.icon
          const count = departmentWorkbench?.stats[queue] ?? 0
          const isActive = activeQueue === queue

          return (
            <button
              key={queue}
              onClick={() => setActiveQueue(queue)}
              className={cn(
                'p-4 rounded-2xl border text-left transition-all duration-200',
                isActive
                  ? `${config.bgClass} ${config.borderClass} shadow-sm`
                  : 'bg-white border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    isActive ? `${config.bgClass}` : 'bg-slate-50'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isActive ? config.colorClass : 'text-slate-500')} />
                </div>
                <div>
                  <p className={cn('text-xs', isActive ? 'text-slate-600' : 'text-slate-500')}>
                    {config.label}
                  </p>
                  <p className={cn(
                    'text-xl font-bold',
                    isActive ? config.colorClass : 'text-slate-800'
                  )}>
                    {count}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(() => {
              const config = queueConfig[activeQueue]
              const Icon = config.icon
              return (
                <>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', config.bgClass)}>
                    <Icon className={cn('w-5 h-5', config.colorClass)} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">{config.label}</h2>
                    <p className="text-xs text-slate-500">
                      共 {activeTasks.length} 条事项
                    </p>
                  </div>
                </>
              )
            })()}
          </div>

          {activeQueue !== 'completed' && selectableTasks.length > 0 && (
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span>全选当前页</span>
            </label>
          )}
        </div>

        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {activeTasks.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm">暂无事项</p>
            </div>
          ) : (
            activeTasks.map((task) => (
              <WorkbenchTaskItem
                key={task.id}
                task={task}
                selected={selectedTaskIds.has(task.id)}
                selectable={activeQueue !== 'completed'}
                onToggleSelect={() => toggleSelectTask(task.id)}
                onClick={() => handleTaskClick(task)}
              />
            ))
          )}
        </div>
      </div>

      {showBatchModal && (
        <BatchUpdateModal
          isOpen={showBatchModal}
          onClose={handleCloseBatchModal}
          selectedCount={selectedCount}
          batchStatus={batchStatus}
          setBatchStatus={setBatchStatus}
          batchProgress={batchProgress}
          setBatchProgress={setBatchProgress}
          showConfirmStep={showConfirmStep}
          onNextStep={handleNextStep}
          onBackStep={handleBackStep}
          onSubmit={handleBatchUpdate}
          loading={batchLoading}
          results={batchResults}
        />
      )}
    </div>
  )
}

function WorkbenchTaskItem({
  task,
  selected,
  selectable,
  onToggleSelect,
  onClick,
}: {
  task: Task
  selected: boolean
  selectable: boolean
  onToggleSelect: () => void
  onClick: () => void
}) {
  const daysLeft = getDaysLeft(task.deadline)
  const isOverdue = daysLeft < 0 && task.status !== 'completed'

  function getDaysLeft(deadline: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diff = deadlineDate.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div
      className={cn(
        'p-4 hover:bg-slate-50 transition-colors cursor-pointer',
        selected && 'bg-primary-50/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelect()
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <StatusBadge status={task.status} size="sm" />
            {task.meetingTitle && (
              <span className="text-xs text-slate-500 truncate">
                来源：{task.meetingTitle}
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-slate-800 line-clamp-1 mb-2 group-hover:text-primary-700 transition-colors">
            {task.content}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span
              className={cn(
                'inline-flex items-center gap-1 font-medium',
                isOverdue ? 'text-red-600' : 'text-slate-500'
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              截止：{task.deadline}
              {isOverdue && ` (逾期${Math.abs(daysLeft)}天)`}
              {!isOverdue && daysLeft >= 0 && ` (剩余${daysLeft}天)`}
            </span>
          </div>

          {task.progress && (
            <p className="mt-2 text-xs text-slate-600 line-clamp-1">
              <span className="text-slate-400">最新进展：</span>
              {task.progress}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function BatchUpdateModal({
  isOpen,
  onClose,
  selectedCount,
  batchStatus,
  setBatchStatus,
  batchProgress,
  setBatchProgress,
  showConfirmStep,
  onNextStep,
  onBackStep,
  onSubmit,
  loading,
  results,
}: {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  batchStatus: Task['status']
  setBatchStatus: (s: Task['status']) => void
  batchProgress: string
  setBatchProgress: (s: string) => void
  showConfirmStep: boolean
  onNextStep: () => void
  onBackStep: () => void
  onSubmit: () => void
  loading: boolean
  results: BatchUpdateTaskResult[] | null
}) {
  if (!isOpen) return null

  const successCount = results?.filter((r) => r.success).length ?? 0
  const failCount = results?.filter((r) => !r.success).length ?? 0
  const hasResults = results !== null
  const allSuccess = hasResults && failCount === 0
  const hasFailures = hasResults && failCount > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">批量更新事项</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              已选择 {selectedCount} 条事项
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasResults ? (
          <div className="p-5">
            <div
              className={cn(
                'p-4 rounded-xl mb-5',
                allSuccess
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    allSuccess ? 'bg-green-100' : 'bg-amber-100'
                  )}
                >
                  {allSuccess ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      allSuccess ? 'text-green-800' : 'text-amber-800'
                    )}
                  >
                    {allSuccess ? '全部更新成功' : '部分更新失败'}
                  </p>
                  <p
                    className={cn(
                      'text-sm',
                      allSuccess ? 'text-green-600' : 'text-amber-600'
                    )}
                  >
                    成功 {successCount} 条，失败 {failCount} 条
                  </p>
                </div>
              </div>
            </div>

            {hasFailures && (
              <div className="mb-5 max-h-60 overflow-y-auto space-y-2">
                <p className="text-sm font-medium text-slate-700 mb-2">失败详情：</p>
                {results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm"
                    >
                      <span className="font-medium text-red-700">事项 #{r.id}：</span>
                      <span className="text-red-600">{r.error}</span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
              >
                {allSuccess ? '完成' : '我知道了'}
              </button>
            </div>
          </div>
        ) : showConfirmStep ? (
          <div className="p-5">
            <div className="p-4 bg-slate-50 rounded-xl mb-5">
              <p className="text-sm font-medium text-slate-700 mb-3">请确认以下更新信息：</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-20">更新数量：</span>
                  <span className="font-medium text-slate-800">{selectedCount} 条</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-20">目标状态：</span>
                  <StatusBadge status={batchStatus} size="sm" />
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 w-20 pt-0.5">进展说明：</span>
                  <span className="font-medium text-slate-800 flex-1">
                    {batchProgress || <span className="text-slate-400">（无）</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  此操作将批量更新选中的事项，请确认后提交。系统将逐条处理并返回每条的更新结果。
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onBackStep}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                上一步
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '更新中...' : '确认提交'}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onNextStep()
            }}
            className="p-5"
          >
            <div className="mb-5">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                更新为状态
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBatchStatus('pending')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    batchStatus === 'pending'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <AlertCircle
                    className={cn(
                      'w-6 h-6',
                      batchStatus === 'pending' ? 'text-amber-600' : 'text-slate-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      batchStatus === 'pending' ? 'text-amber-700' : 'text-slate-600'
                    )}
                  >
                    待办理
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchStatus('in_progress')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    batchStatus === 'in_progress'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Clock
                    className={cn(
                      'w-6 h-6',
                      batchStatus === 'in_progress' ? 'text-blue-600' : 'text-slate-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      batchStatus === 'in_progress' ? 'text-blue-700' : 'text-slate-600'
                    )}
                  >
                    进行中
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchStatus('completed')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                    batchStatus === 'completed'
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <CheckCircle
                    className={cn(
                      'w-6 h-6',
                      batchStatus === 'completed' ? 'text-green-600' : 'text-slate-400'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      batchStatus === 'completed' ? 'text-green-700' : 'text-slate-600'
                    )}
                  >
                    已完成
                  </span>
                </button>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                进展说明
                <span className="text-slate-400 font-normal ml-1">（选填）</span>
              </label>
              <textarea
                value={batchProgress}
                onChange={(e) => setBatchProgress(e.target.value)}
                placeholder="请输入进展说明，将应用到所有选中的事项..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                rows={4}
              />
            </div>

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
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
              >
                下一步
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
