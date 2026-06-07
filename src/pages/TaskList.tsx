import { useEffect, useState, useMemo } from 'react'
import {
  CheckSquare,
  Building2,
  Filter,
  ChevronDown,
  ShieldAlert,
  Edit3,
  ListChecks,
  X,
  Search,
  Calendar as CalendarIcon,
  AlertTriangle,
  Clock,
  BellRing,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import TaskCard from '../components/TaskCard'
import TaskUpdateModal from '../components/TaskUpdateModal'
import BatchUpdateModal, { type BatchUpdateFormData } from '../components/BatchUpdateModal'
import ViewSelector from '../components/ViewSelector'
import type { Task, RiskLevel, BatchUpdateTaskResult, TaskFilter, TaskView } from '../../shared/types'
import { cn } from '../lib/utils'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ApiError } from '../utils/api'

function getRiskLevelConfig(level: RiskLevel) {
  switch (level) {
    case 'high':
      return {
        label: '高风险',
        colorClass: 'text-red-600',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200',
        dotClass: 'bg-red-500',
      }
    case 'medium':
      return {
        label: '中风险',
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
      }
    case 'low':
      return {
        label: '低风险',
        colorClass: 'text-green-600',
        bgClass: 'bg-green-50',
        borderClass: 'border-green-200',
        dotClass: 'bg-green-500',
      }
  }
}

const defaultFilter: TaskFilter = {
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

function getFilterFromParams(searchParams: URLSearchParams): TaskFilter {
  return {
    department: searchParams.get('department') || 'all',
    status: searchParams.get('status') || 'all',
    risk: searchParams.get('risk') || '',
    search: searchParams.get('search') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    overdueOnly: searchParams.get('overdueOnly') === 'true',
    dueSoonOnly: searchParams.get('dueSoonOnly') === 'true',
    supervisingOnly: searchParams.get('supervisingOnly') === 'true',
  }
}

function setFilterToParams(filter: TaskFilter, searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(searchParams)

  if (filter.department === 'all') {
    params.delete('department')
  } else {
    params.set('department', filter.department)
  }

  if (filter.status === 'all') {
    params.delete('status')
  } else {
    params.set('status', filter.status)
  }

  if (filter.risk) {
    params.set('risk', filter.risk)
  } else {
    params.delete('risk')
  }

  if (filter.search) {
    params.set('search', filter.search)
  } else {
    params.delete('search')
  }

  if (filter.startDate) {
    params.set('startDate', filter.startDate)
  } else {
    params.delete('startDate')
  }

  if (filter.endDate) {
    params.set('endDate', filter.endDate)
  } else {
    params.delete('endDate')
  }

  if (filter.overdueOnly) {
    params.set('overdueOnly', 'true')
  } else {
    params.delete('overdueOnly')
  }

  if (filter.dueSoonOnly) {
    params.set('dueSoonOnly', 'true')
  } else {
    params.delete('dueSoonOnly')
  }

  if (filter.supervisingOnly) {
    params.set('supervisingOnly', 'true')
  } else {
    params.delete('supervisingOnly')
  }

  params.delete('view')

  return params
}

function filtersEqual(a: TaskFilter, b: TaskFilter): boolean {
  return (
    a.department === b.department &&
    a.status === b.status &&
    a.risk === b.risk &&
    a.search === b.search &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.overdueOnly === b.overdueOnly &&
    a.dueSoonOnly === b.dueSoonOnly &&
    a.supervisingOnly === b.supervisingOnly
  )
}

function getInvalidDepartments(view: TaskView, departments: string[]): string[] {
  if (!view.filter.department || view.filter.department === 'all') {
    return []
  }
  return departments.includes(view.filter.department) ? [] : [view.filter.department]
}

export default function TaskList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    tasks,
    tasksTotal,
    departments,
    allTaskDepartments,
    departmentRiskStats,
    taskViews,
    currentViewId,
    fetchTasks,
    fetchDepartments,
    fetchDepartmentTaskStats,
    fetchDepartmentRiskStats,
    batchUpdateTasks,
    setCurrentViewId,
    createTaskView,
    deleteTaskView,
    fetchTaskViews,
  } = useAppStore()

  const urlView = searchParams.get('view')
  const urlFilter = getFilterFromParams(searchParams)

  const [filter, setFilter] = useState<TaskFilter>(urlFilter)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [showDeptDropdown, setShowDeptDropdown] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResults, setBatchResults] = useState<BatchUpdateTaskResult[] | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [warningMessage, setWarningMessage] = useState('')

  useEffect(() => {
    fetchDepartments()
    fetchDepartmentTaskStats()
    fetchDepartmentRiskStats()
    fetchTaskViews()
  }, [fetchDepartments, fetchDepartmentTaskStats, fetchDepartmentRiskStats, fetchTaskViews])

  useEffect(() => {
    const newFilter = getFilterFromParams(searchParams)
    setFilter(newFilter)

    const viewId = searchParams.get('view')
    if (viewId) {
      setCurrentViewId(Number(viewId))
    } else {
      setCurrentViewId(null)
    }
  }, [searchParams, setCurrentViewId])

  useEffect(() => {
    if (urlView) {
      const view = taskViews.find((v) => v.id === Number(urlView))
      if (view) {
        const currentFilter = getFilterFromParams(searchParams)
        if (!filtersEqual(currentFilter, view.filter)) {
          const params = setFilterToParams(view.filter, searchParams)
          params.set('view', String(view.id))
          setFilter(view.filter)
          setSearchParams(params)
          return
        }

        const invalidDepts = getInvalidDepartments(view, departments)
        if (invalidDepts.length > 0) {
          setWarningMessage(`视图"${view.name}"包含已失效的筛选条件：${invalidDepts.join('、')}，视图仍可使用但结果可能不符合预期。`)
          setShowWarning(true)
        } else {
          setShowWarning(false)
        }
      }
    }
    if (!urlView) {
      setShowWarning(false)
    }
  }, [urlView, searchParams, taskViews, departments, setSearchParams])

  useEffect(() => {
    fetchTasks('all', 'all', 1, 50, '', filter)
  }, [fetchTasks, filter])

  const updateFilter = (updates: Partial<TaskFilter>) => {
    const newFilter = { ...filter, ...updates }
    setFilter(newFilter)
    const params = setFilterToParams(newFilter, searchParams)
    setSearchParams(params)
  }

  const handleViewSelect = (view: TaskView) => {
    const params = setFilterToParams(view.filter, searchParams)
    params.set('view', String(view.id))
    setSearchParams(params)
    setCurrentViewId(view.id)
  }

  const handleCreateView = (name: string, viewFilter: TaskFilter, targetPage?: 'tasks' | 'calendar') => {
    return createTaskView({ name, filter: viewFilter, targetPage })
  }

  const handleDeleteView = (id: number) => {
    return deleteTaskView(id)
  }

  const handleDepartmentChange = (dept: string) => {
    setShowDeptDropdown(false)
    updateFilter({ department: dept })
  }

  const handleStatusChange = (status: string) => {
    updateFilter({ status, risk: '' })
  }

  const handleSearchChange = (search: string) => {
    updateFilter({ search })
  }

  const handleStartDateChange = (startDate: string) => {
    updateFilter({ startDate })
  }

  const handleEndDateChange = (endDate: string) => {
    updateFilter({ endDate })
  }

  const handleToggleOverdue = () => {
    updateFilter({ overdueOnly: !filter.overdueOnly, risk: '' })
  }

  const handleToggleDueSoon = () => {
    updateFilter({ dueSoonOnly: !filter.dueSoonOnly, risk: '' })
  }

  const handleToggleSupervising = () => {
    updateFilter({ supervisingOnly: !filter.supervisingOnly, risk: '' })
  }

  const clearDateRange = () => {
    updateFilter({ startDate: '', endDate: '' })
  }

  const clearAllFilters = () => {
    setFilter(defaultFilter)
    setSearchParams(new URLSearchParams())
    setCurrentViewId(null)
  }

  const hasActiveFilters = useMemo(() => {
    return (
      filter.department !== 'all' ||
      filter.status !== 'all' ||
      filter.search !== '' ||
      filter.startDate !== '' ||
      filter.endDate !== '' ||
      filter.overdueOnly ||
      filter.dueSoonOnly ||
      filter.supervisingOnly ||
      filter.risk !== ''
    )
  }, [filter])

  const handleUpdated = () => {
    fetchTasks('all', 'all', 1, 50, '', filter)
  }

  const selectableTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'completed')
  }, [tasks])

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
    if (selectMode) {
      toggleSelectTask(task.id)
    } else {
      setSelectedTask(task)
      setModalOpen(true)
    }
  }

  const openBatchModal = () => {
    if (selectedTaskIds.size === 0) return
    setBatchResults(null)
    setBatchError(null)
    setShowBatchModal(true)
  }

  const handleBatchUpdate = async (data: BatchUpdateFormData) => {
    setBatchLoading(true)
    setBatchResults(null)
    setBatchError(null)

    try {
      const updates = Array.from(selectedTaskIds).map((id) => ({
        id,
        ...data,
      }))

      const result = await batchUpdateTasks({ updates })
      setBatchResults(result.results)

      if (result.failCount === 0) {
        setTimeout(() => {
          setShowBatchModal(false)
          setSelectedTaskIds(new Set())
          setSelectMode(false)
          fetchTasks('all', 'all', 1, 50, '', filter)
        }, 1500)
      }
    } catch (err) {
      console.error('Batch update failed:', err)
      const error = err as ApiError
      setBatchError(error.message || '批量更新失败，请稍后重试')
    } finally {
      setBatchLoading(false)
    }
  }

  const handleCloseBatchModal = () => {
    if (batchLoading) return
    setShowBatchModal(false)
    if (batchResults) {
      fetchTasks('all', 'all', 1, 50, '', filter)
      setBatchResults(null)
    }
  }

  const handleToggleSelectMode = () => {
    setSelectMode(!selectMode)
    setSelectedTaskIds(new Set())
  }

  const allDepartments = ['all', ...allTaskDepartments]

  const isDeptActive = (dept: string) => dept === 'all' || departments.includes(dept)

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'pending', label: '待办理' },
    { value: 'in_progress', label: '进行中' },
    { value: 'completed', label: '已完成' },
  ]

  const riskFilterLabels: Record<string, string> = {
    overdue: '逾期事项',
    dueSoon: '临期事项',
    supervising: '督办中事项',
    longNoUpdate: '长期未更新',
  }

  const clearRiskFilter = () => {
    updateFilter({ risk: '' })
  }

  const goRiskWorkbench = () => {
    const params = new URLSearchParams({ tab: 'risk' })
    if (filter.department !== 'all') {
      params.set('department', filter.department)
    }
    navigate(`/workbench?${params.toString()}`)
  }

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filter.department !== 'all') count++
    if (filter.status !== 'all') count++
    if (filter.search) count++
    if (filter.startDate || filter.endDate) count++
    if (filter.overdueOnly) count++
    if (filter.dueSoonOnly) count++
    if (filter.supervisingOnly) count++
    if (filter.risk) count++
    return count
  }, [filter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">待办事项</h1>
        <p className="text-slate-500 text-sm">
          按责任科室查看和更新待办事项进展
        </p>
      </div>

      {showWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-amber-800">{warningMessage}</p>
          </div>
          <button
            onClick={() => setShowWarning(false)}
            className="text-amber-500 hover:text-amber-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4.5 h-4.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">筛选：</span>
          </div>

          <ViewSelector
            currentFilter={filter}
            onViewSelect={handleViewSelect}
            onCreateView={handleCreateView}
            onDeleteView={handleDeleteView}
            currentViewId={currentViewId}
            showSaveButton={true}
            defaultTargetPage="tasks"
          />

          <div className="relative">
            <button
              onClick={() => setShowDeptDropdown(!showDeptDropdown)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">
                {filter.department === 'all'
                  ? '全部科室'
                  : filter.department}
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
                  {allDepartments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => handleDepartmentChange(dept)}
                      className={cn(
                        'w-full px-4 py-2.5 text-left text-sm transition-colors',
                        filter.department === dept
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : isDeptActive(dept)
                          ? 'text-slate-700 hover:bg-slate-50'
                          : 'text-slate-400 hover:bg-slate-50'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {dept === 'all' ? '全部科室' : dept}
                        {!isDeptActive(dept) && dept !== 'all' && (
                          <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                            已停用
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className={cn(
                  'px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all',
                  filter.status === option.value
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filter.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索事项内容或会议..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="ml-auto flex items-center gap-4">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
                清除筛选
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={goRiskWorkbench}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors"
            >
              <ShieldAlert className="w-4 h-4" />
              风险研判
            </button>

            {selectMode ? (
              <button
                onClick={handleToggleSelectMode}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
                取消选择
              </button>
            ) : (
              <button
                onClick={handleToggleSelectMode}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                <ListChecks className="w-4 h-4" />
                批量操作
              </button>
            )}

            <div className="text-sm text-slate-500">
              共 <span className="font-medium text-slate-700">{tasksTotal}</span>{' '}
              条事项
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">快捷筛选：</span>
            <button
              onClick={handleToggleOverdue}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter.overdueOnly
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              仅逾期
            </button>
            <button
              onClick={handleToggleDueSoon}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter.dueSoonOnly
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              仅临期
            </button>
            <button
              onClick={handleToggleSupervising}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter.supervisingOnly
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <BellRing className="w-3.5 h-3.5" />
              仅督办
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">日期范围：</span>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <span className="text-slate-400 text-xs">至</span>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {(filter.startDate || filter.endDate) && (
              <button
                onClick={clearDateRange}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                清除
              </button>
            )}
          </div>
        </div>

        {filter.risk && riskFilterLabels[filter.risk] && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
            <span>风险筛选：{riskFilterLabels[filter.risk]}</span>
            <button
              onClick={clearRiskFilter}
              className="text-rose-500 hover:text-rose-700"
            >
              清除
            </button>
          </div>
        )}
      </div>

      {allTaskDepartments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {['all', ...allTaskDepartments].map((dept) => {
            const count =
              dept === 'all'
                ? tasksTotal
                : tasks.filter((t) => t.department === dept).length
            const active = isDeptActive(dept)
            const riskStat = departmentRiskStats.find(r => r.department === dept)
            const riskConfig = riskStat ? getRiskLevelConfig(riskStat.riskLevel) : null
            return (
              <button
                key={dept}
                onClick={() => handleDepartmentChange(dept)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all relative',
                  filter.department === dept
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                    : active
                    ? 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                    : 'bg-white border border-dashed border-slate-300 text-slate-500 hover:border-slate-400'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {dept !== 'all' && riskConfig && (
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        filter.department === dept ? 'bg-white' : riskConfig.dotClass
                      )}
                    />
                  )}
                  {dept === 'all' ? '全部' : dept}
                  {!active && dept !== 'all' && (
                    <span className="text-[10px] opacity-70">(停用)</span>
                  )}
                  <span
                    className={cn(
                      'ml-1 px-2 py-0.5 rounded-full text-xs',
                      filter.department === dept
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {count}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {selectMode && tasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-primary-200 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
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
              <span>
                全选当前页
                <span className="text-slate-400 ml-1">
                  (已选 {selectedTaskIds.size} / {selectableTasks.length})
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTaskIds(new Set())}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              disabled={selectedTaskIds.size === 0}
            >
              清空选择
            </button>
            <button
              onClick={openBatchModal}
              disabled={selectedTaskIds.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit3 className="w-4 h-4" />
              批量更新 ({selectedTaskIds.size})
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <CheckSquare className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm">暂无待办事项</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              selectable={selectMode}
              selected={selectedTaskIds.has(task.id)}
              onToggleSelect={() => toggleSelectTask(task.id)}
              onClick={() => handleTaskClick(task)}
            />
          ))
        )}
      </div>

      <TaskUpdateModal
        task={selectedTask}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdated={handleUpdated}
      />

      <BatchUpdateModal
        isOpen={showBatchModal}
        onClose={handleCloseBatchModal}
        selectedCount={selectedTaskIds.size}
        departments={departments}
        onSubmit={handleBatchUpdate}
        loading={batchLoading}
        results={batchResults}
        error={batchError}
        onRetry={handleBatchUpdate}
      />
    </div>
  )
}
