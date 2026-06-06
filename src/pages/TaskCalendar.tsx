import { useEffect, useState } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Building2,
  ChevronDown,
  X,
  Clock,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import TaskUpdateModal from '../components/TaskUpdateModal'
import StatusBadge from '../components/StatusBadge'
import type { Task, CalendarDayTasks } from '../../shared/types'
import { cn } from '../lib/utils'

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

export default function TaskCalendar() {
  const {
    calendarData,
    departments,
    allTaskDepartments,
    fetchCalendarTasks,
    fetchDepartments,
    fetchDepartmentTaskStats,
  } = useAppStore()

  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedDay, setSelectedDay] = useState<CalendarDayTasks | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [showDeptDropdown, setShowDeptDropdown] = useState(false)

  useEffect(() => {
    fetchDepartments()
    fetchDepartmentTaskStats()
  }, [fetchDepartments, fetchDepartmentTaskStats])

  useEffect(() => {
    fetchCalendarTasks(currentYear, currentMonth, selectedDepartment)
  }, [fetchCalendarTasks, currentYear, currentMonth, selectedDepartment])

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth() + 1)
  }

  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept)
    setShowDeptDropdown(false)
  }

  const handleDayClick = (day: CalendarDayTasks) => {
    setSelectedDay(day)
    setShowDayModal(true)
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setTaskModalOpen(true)
  }

  const handleTaskUpdated = () => {
    fetchCalendarTasks(currentYear, currentMonth, selectedDepartment)
  }

  const getCalendarGrid = () => {
    if (!calendarData) return []

    const firstDay = new Date(currentYear, currentMonth - 1, 1)
    const firstDayOfWeek = firstDay.getDay()
    const daysInMonth = calendarData.days.length

    const cells: Array<{
      date: string | null
      dayNumber: number | null
      tasks: Task[]
      isCurrentMonth: boolean
      isToday: boolean
    }> = []

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        date: null,
        dayNumber: null,
        tasks: [],
        isCurrentMonth: false,
        isToday: false,
      })
    }

    const todayStr = today.toISOString().split('T')[0]

    for (let i = 0; i < daysInMonth; i++) {
      const dayData = calendarData.days[i]
      const dateStr = dayData.date
      const isToday = dateStr === todayStr

      cells.push({
        date: dateStr,
        dayNumber: i + 1,
        tasks: dayData.tasks,
        isCurrentMonth: true,
        isToday,
      })
    }

    const remainingCells = 42 - cells.length
    for (let i = 0; i < remainingCells; i++) {
      cells.push({
        date: null,
        dayNumber: null,
        tasks: [],
        isCurrentMonth: false,
        isToday: false,
      })
    }

    return cells
  }

  const isOverdue = (deadline: string) => {
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    return deadlineDate < todayDate
  }

  const allDepartments = ['all', ...allTaskDepartments]
  const isDeptActive = (dept: string) => dept === 'all' || departments.includes(dept)

  const calendarCells = getCalendarGrid()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">任务日历</h1>
        <p className="text-slate-500 text-sm">
          按月查看未完成议定事项的完成期限
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center min-w-[140px]">
              <h2 className="text-lg font-semibold text-slate-800">
                {currentYear}年{currentMonth}月
              </h2>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={handleToday}
              className="ml-2 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              今天
            </button>
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
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
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
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={cn(
                'text-center text-xs md:text-sm font-medium py-2',
                index === 0 || index === 6 ? 'text-red-400' : 'text-slate-500'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {calendarCells.map((cell, index) => {
            if (!cell.isCurrentMonth || !cell.date) {
              return (
                <div
                  key={index}
                  className="min-h-[60px] md:min-h-[90px] rounded-xl bg-slate-50/50"
                />
              )
            }

            const dayOfWeek = new Date(cell.date).getDay()
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
            const overdueCount = cell.tasks.filter((t) => isOverdue(t.deadline)).length

            return (
              <button
                key={cell.date}
                onClick={() => handleDayClick({ date: cell.date, tasks: cell.tasks })}
                className={cn(
                  'min-h-[60px] md:min-h-[90px] rounded-xl border p-1.5 md:p-2 text-left transition-all duration-200 hover:shadow-md',
                  cell.isToday
                    ? 'border-primary-300 bg-primary-50/50 ring-2 ring-primary-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <div
                  className={cn(
                    'text-xs md:text-sm font-semibold mb-1',
                    cell.isToday
                      ? 'text-primary-700'
                      : isWeekend
                      ? 'text-red-400'
                      : 'text-slate-700'
                  )}
                >
                  {cell.dayNumber}
                </div>

                <div className="space-y-1 hidden md:block">
                  {cell.tasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded truncate',
                        isOverdue(task.deadline)
                          ? 'bg-red-100 text-red-700'
                          : 'bg-primary-100 text-primary-700'
                      )}
                    >
                      {task.content}
                    </div>
                  ))}
                  {cell.tasks.length > 2 && (
                    <div className="text-xs text-slate-500 px-1.5">
                      +{cell.tasks.length - 2} 更多
                    </div>
                  )}
                </div>

                <div className="md:hidden flex items-center gap-1">
                  {cell.tasks.length > 0 && (
                    <span
                      className={cn(
                        'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium',
                        overdueCount > 0
                          ? 'bg-red-500 text-white'
                          : 'bg-primary-500 text-white'
                      )}
                    >
                      {cell.tasks.length}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary-500" />
            <span className="text-xs text-slate-500">待办事项</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-slate-500">已逾期</span>
          </div>
        </div>
      </div>

      {showDayModal && selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setShowDayModal(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {selectedDay.date} 到期事项
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  共 {selectedDay.tasks.length} 条事项
                </p>
              </div>
              <button
                onClick={() => setShowDayModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {selectedDay.tasks.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm">当天无到期事项</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDay.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className={cn(
                        'p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md',
                        isOverdue(task.deadline)
                          ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={task.status} size="sm" />
                            {isOverdue(task.deadline) && (
                              <span className="text-xs text-red-600 font-medium">
                                已逾期
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-medium text-slate-800 mb-2 line-clamp-2">
                            {task.content}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {task.department}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              来源：{task.meetingTitle || '未知会议'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TaskUpdateModal
        task={selectedTask}
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onUpdated={handleTaskUpdated}
      />
    </div>
  )
}
