import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AlertTriangle,
  Clock,
  CalendarDays,
  Bell,
  RefreshCw,
  Inbox,
  BellRing,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { Task } from '../../shared/types'
import { cn } from '../lib/utils'
import TaskUpdateModal from './TaskUpdateModal'

interface ReminderPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReminderPanel({ isOpen, onClose }: ReminderPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const reminderGroups = useAppStore((state) => state.reminderGroups)
  const fetchReminders = useAppStore((state) => state.fetchReminders)
  const loading = useAppStore((state) => state.loading)

  const totalCount = reminderGroups
    ? reminderGroups.overdue.length +
      reminderGroups.today.length +
      reminderGroups.nextThreeDays.length
    : 0

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setIsModalOpen(true)
  }

  const handleTaskUpdated = useCallback(() => {
    fetchReminders()
  }, [fetchReminders])

  useEffect(() => {
    if (isOpen) {
      fetchReminders()
    }
  }, [isOpen, fetchReminders])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isModalOpen) return
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, isModalOpen, onClose])

  if (!isOpen) return null

  function getDaysLeft(deadline: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diff = deadlineDate.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const TaskItem = ({ task, type }: { task: Task; type: 'overdue' | 'today' | 'nextThreeDays' }) => {
    const daysLeft = getDaysLeft(task.deadline)

    const typeStyles = {
      overdue: 'border-l-red-500 bg-red-50/50 hover:bg-red-50',
      today: 'border-l-amber-500 bg-amber-50/50 hover:bg-amber-50',
      nextThreeDays: 'border-l-blue-500 bg-blue-50/50 hover:bg-blue-50',
    }

    return (
      <button
        onClick={() => handleTaskClick(task)}
        className={cn(
          'w-full text-left p-3 border-l-4 rounded-r-lg transition-all duration-200',
          typeStyles[type]
        )}
      >
        <div className="flex items-start gap-2 mb-1">
          <p className="text-sm font-medium text-slate-800 line-clamp-2 flex-1">
            {task.content}
          </p>
          {task.hasActiveSupervision && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-medium rounded flex-shrink-0">
              <BellRing className="w-2.5 h-2.5" />
              督办
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 truncate max-w-[50%]">
            {task.department}
          </span>
          <span
            className={cn(
              'font-medium',
              type === 'overdue' && 'text-red-600',
              type === 'today' && 'text-amber-600',
              type === 'nextThreeDays' && 'text-blue-600'
            )}
          >
            {type === 'overdue'
              ? `逾期 ${Math.abs(daysLeft)} 天`
              : type === 'today'
              ? '今天到期'
              : `${daysLeft} 天后到期`}
          </span>
        </div>
        {task.meetingTitle && (
          <p className="text-xs text-slate-400 mt-1 truncate">
            来源：{task.meetingTitle}
          </p>
        )}
        {task.activeSupervision?.latestFollowUp && (
          <p className="text-xs text-rose-500 mt-1 line-clamp-1">
            最近跟进：{task.activeSupervision.latestFollowUp.content}
          </p>
        )}
      </button>
    )
  }

  const GroupSection = ({
    title,
    icon: Icon,
    tasks,
    type,
    badgeColor,
  }: {
    title: string
    icon: React.ElementType
    tasks: Task[]
    type: 'overdue' | 'today' | 'nextThreeDays'
    badgeColor: string
  }) => {
    if (tasks.length === 0) return null

    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center gap-2 px-1 mb-2">
          <Icon className={cn('w-4 h-4', badgeColor)} />
          <span className="text-xs font-semibold text-slate-600">{title}</span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-full text-xs font-medium',
              type === 'overdue' && 'bg-red-100 text-red-700',
              type === 'today' && 'bg-amber-100 text-amber-700',
              type === 'nextThreeDays' && 'bg-blue-100 text-blue-700'
            )}
          >
            {tasks.length}
          </span>
        </div>
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} type={type} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        ref={panelRef}
        className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in slide-in-from-top-2 fade-in duration-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-semibold text-slate-800">提醒中心</span>
            {totalCount > 0 && (
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                {totalCount} 项待办
              </span>
            )}
          </div>
          <button
            onClick={fetchReminders}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw
              className={cn('w-4 h-4', loading && 'animate-spin')}
            />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3">
          {loading && !reminderGroups ? (
            <div className="py-10 text-center">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">加载中...</p>
            </div>
          ) : totalCount === 0 ? (
            <div className="py-10 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Inbox className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">暂无提醒</p>
              <p className="text-xs text-slate-500">近期没有待处理的事项</p>
            </div>
          ) : (
            <>
              <GroupSection
                title="逾期事项"
                icon={AlertTriangle}
                tasks={reminderGroups?.overdue || []}
                type="overdue"
                badgeColor="text-red-500"
              />
              <GroupSection
                title="今天到期"
                icon={Clock}
                tasks={reminderGroups?.today || []}
                type="today"
                badgeColor="text-amber-500"
              />
              <GroupSection
                title="三天内到期"
                icon={CalendarDays}
                tasks={reminderGroups?.nextThreeDays || []}
                type="nextThreeDays"
                badgeColor="text-blue-500"
              />
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors py-1"
          >
            关闭面板
          </button>
        </div>
      </div>

      <TaskUpdateModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdated={handleTaskUpdated}
      />
    </>
  )
}
