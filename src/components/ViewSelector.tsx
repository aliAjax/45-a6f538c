import { useState, useRef, useEffect } from 'react'
import {
  Layers,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  X,
  AlertTriangle,
  Check,
  Calendar,
  List,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { TaskView, TaskFilter } from '../../shared/types'
import { cn } from '../lib/utils'

interface ViewSelectorProps {
  currentFilter: TaskFilter
  onViewSelect: (view: TaskView) => void
  onCreateView?: (name: string, filter: TaskFilter, targetPage?: 'tasks' | 'calendar') => void
  onDeleteView?: (id: number) => void
  currentViewId: number | null
  showSaveButton?: boolean
  defaultTargetPage?: 'tasks' | 'calendar'
  className?: string
}

export default function ViewSelector({
  currentFilter,
  onViewSelect,
  onCreateView,
  onDeleteView,
  currentViewId,
  showSaveButton = true,
  defaultTargetPage = 'tasks',
  className,
}: ViewSelectorProps) {
  const { taskViews, departments, fetchTaskViews, createTaskView, deleteTaskView } = useAppStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [viewName, setViewName] = useState('')
  const [targetPage, setTargetPage] = useState<'tasks' | 'calendar'>(defaultTargetPage)
  const [invalidViewIds, setInvalidViewIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchTaskViews()
  }, [fetchTaskViews])

  useEffect(() => {
    async function checkInvalidViews() {
      const invalidIds = new Set<number>()
      for (const view of taskViews) {
        if (view.filter.department && view.filter.department !== 'all') {
          const isActive = departments.includes(view.filter.department)
          if (!isActive) {
            invalidIds.add(view.id)
          }
        }
      }
      setInvalidViewIds(invalidIds)
    }
    if (taskViews.length > 0 && departments.length > 0) {
      checkInvalidViews()
    }
  }, [taskViews, departments])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentView = taskViews.find((v) => v.id === currentViewId)

  const handleSelectView = (view: TaskView) => {
    setShowDropdown(false)
    onViewSelect(view)
  }

  const handleSaveView = async () => {
    if (!viewName.trim()) return
    setSaving(true)
    try {
      if (onCreateView) {
        onCreateView(viewName.trim(), currentFilter, targetPage)
      } else {
        await createTaskView({ name: viewName.trim(), filter: currentFilter, targetPage })
      }
      setShowSaveModal(false)
      setViewName('')
      setTargetPage(defaultTargetPage)
    } catch (err) {
      console.error('Failed to save view:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteView = async (e: React.MouseEvent, viewId: number) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个视图吗？')) return
    try {
      if (onDeleteView) {
        onDeleteView(viewId)
      } else {
        await deleteTaskView(viewId)
      }
    } catch (err) {
      console.error('Failed to delete view:', err)
    }
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
        >
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="text-slate-700">
            {currentView ? currentView.name : '工作视图'}
          </span>
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', showDropdown && 'rotate-180')} />
        </button>

        {showSaveButton && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors"
          >
            <Save className="w-4 h-4" />
            保存视图
          </button>
        )}
      </div>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100">
              我的视图
            </div>
            {taskViews.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                暂无保存的视图
              </div>
            ) : (
              taskViews.map((view) => {
                const isInvalid = invalidViewIds.has(view.id)
                return (
                  <div
                    key={view.id}
                    className={cn(
                      'group flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors',
                      currentViewId === view.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-slate-50'
                    )}
                    onClick={() => handleSelectView(view)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {currentViewId === view.id && (
                        <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      )}
                      {isInvalid && (
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <span className={cn(
                        'text-sm truncate',
                        currentViewId === view.id ? 'font-medium' : 'text-slate-700'
                      )}>
                        {view.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteView(e, view.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 transition-all"
                      title="删除视图"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                )
              })
            )}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => {
                  setShowDropdown(false)
                  setShowSaveModal(true)
                }}
                className="w-full px-3 py-2 text-left text-sm text-primary-600 hover:bg-primary-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新建视图
              </button>
            </div>
          </div>
        </>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowSaveModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">保存为视图</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                视图名称
              </label>
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="请输入视图名称"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveView()
                  }
                }}
              />

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  目标页面
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTargetPage('tasks')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                      targetPage === 'tasks'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <List className={cn(
                      'w-5 h-5',
                      targetPage === 'tasks' ? 'text-primary-600' : 'text-slate-400'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      targetPage === 'tasks' ? 'text-primary-700' : 'text-slate-600'
                    )}>
                      任务列表
                    </span>
                  </button>
                  <button
                    onClick={() => setTargetPage('calendar')}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                      targetPage === 'calendar'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <Calendar className={cn(
                      'w-5 h-5',
                      targetPage === 'calendar' ? 'text-primary-600' : 'text-slate-400'
                    )} />
                    <span className={cn(
                      'text-sm font-medium',
                      targetPage === 'calendar' ? 'text-primary-700' : 'text-slate-600'
                    )}>
                      任务日历
                    </span>
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                将保存当前的筛选条件为常用视图
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveView}
                disabled={!viewName.trim() || saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
