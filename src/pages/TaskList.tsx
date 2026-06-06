import { useEffect, useState } from 'react'
import {
  CheckSquare,
  Building2,
  Filter,
  ChevronDown,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import TaskCard from '../components/TaskCard'
import TaskUpdateModal from '../components/TaskUpdateModal'
import type { Task } from '../../shared/types'
import { cn } from '../lib/utils'
import { useSearchParams } from 'react-router-dom'

export default function TaskList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    tasks,
    tasksTotal,
    departments,
    allTaskDepartments,
    fetchTasks,
    fetchDepartments,
    fetchDepartmentTaskStats,
  } = useAppStore()

  const urlDepartment = searchParams.get('department') || 'all'
  const urlStatus = searchParams.get('status') || 'all'

  const [selectedDepartment, setSelectedDepartment] = useState(urlDepartment)
  const [selectedStatus, setSelectedStatus] = useState(urlStatus)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [showDeptDropdown, setShowDeptDropdown] = useState(false)

  useEffect(() => {
    fetchDepartments()
    fetchDepartmentTaskStats()
  }, [fetchDepartments, fetchDepartmentTaskStats])

  useEffect(() => {
    if (urlDepartment !== selectedDepartment) {
      setSelectedDepartment(urlDepartment)
    }
    if (urlStatus !== selectedStatus) {
      setSelectedStatus(urlStatus)
    }
  }, [urlDepartment, urlStatus])

  useEffect(() => {
    fetchTasks(selectedDepartment, selectedStatus, 1, 50)
  }, [fetchTasks, selectedDepartment, selectedStatus])

  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept)
    setShowDeptDropdown(false)
    const params = new URLSearchParams(searchParams)
    if (dept === 'all') {
      params.delete('department')
    } else {
      params.set('department', dept)
    }
    setSearchParams(params)
  }

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status)
    const params = new URLSearchParams(searchParams)
    if (status === 'all') {
      params.delete('status')
    } else {
      params.set('status', status)
    }
    setSearchParams(params)
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleUpdated = () => {
    fetchTasks(selectedDepartment, selectedStatus, 1, 50)
  }

  const allDepartments = ['all', ...allTaskDepartments]

  const isDeptActive = (dept: string) => dept === 'all' || departments.includes(dept)

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'pending', label: '待办理' },
    { value: 'in_progress', label: '进行中' },
    { value: 'completed', label: '已完成' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">待办事项</h1>
        <p className="text-slate-500 text-sm">
          按责任科室查看和更新待办事项进展
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4.5 h-4.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">筛选：</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowDeptDropdown(!showDeptDropdown)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">
                {selectedDepartment === 'all'
                  ? '全部科室'
                  : selectedDepartment}
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
                        selectedDepartment === dept
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
                  selectedStatus === option.value
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="ml-auto text-sm text-slate-500">
            共 <span className="font-medium text-slate-700">{tasksTotal}</span>{' '}
            条事项
          </div>
        </div>
      </div>

      {allTaskDepartments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {['all', ...allTaskDepartments].map((dept) => {
            const count =
              dept === 'all'
                ? tasksTotal
                : tasks.filter((t) => t.department === dept).length
            const active = isDeptActive(dept)
            return (
              <button
                key={dept}
                onClick={() => handleDepartmentChange(dept)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  selectedDepartment === dept
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                    : active
                    ? 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                    : 'bg-white border border-dashed border-slate-300 text-slate-500 hover:border-slate-400'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {dept === 'all' ? '全部' : dept}
                  {!active && dept !== 'all' && (
                    <span className="text-[10px] opacity-70">(停用)</span>
                  )}
                  <span
                    className={cn(
                      'ml-1 px-2 py-0.5 rounded-full text-xs',
                      selectedDepartment === dept
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
    </div>
  )
}
