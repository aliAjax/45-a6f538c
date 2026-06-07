import { Calendar, Building2, Clock, ChevronRight, BellRing, CalendarDays, Lock } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { cn } from '../lib/utils'
import type { Task } from '../../shared/types'

interface TaskCardProps {
  task: Task
  variant?: 'default' | 'overdue' | 'this-week'
  onClick?: () => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export default function TaskCard({ task, variant = 'default', onClick, selectable, selected, onToggleSelect }: TaskCardProps) {
  const daysLeft = getDaysLeft(task.deadline)
  const isOverdue = daysLeft < 0 && task.status !== 'completed'
  const isUrgent = daysLeft >= 0 && daysLeft <= 3 && task.status !== 'completed'

  function getDaysLeft(deadline: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diff = deadlineDate.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const deadlineText = isOverdue
    ? `逾期 ${Math.abs(daysLeft)} 天`
    : daysLeft === 0
    ? '今天到期'
    : `剩余 ${daysLeft} 天`

  return (
    <div
      onClick={selectable ? undefined : onClick}
      className={cn(
        'bg-white rounded-xl border p-4 transition-all duration-200 group',
        selectable ? 'cursor-default' : 'cursor-pointer',
        selected && 'bg-primary-50/50 border-primary-300',
        !selected && variant === 'overdue'
          ? 'border-red-200 hover:border-red-300 hover:shadow-md hover:shadow-red-50'
          : !selected && variant === 'this-week'
          ? 'border-amber-200 hover:border-amber-300 hover:shadow-md hover:shadow-amber-50'
          : !selected
          ? 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          : ''
      )}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={selected || false}
            onChange={(e) => {
              e.stopPropagation()
              onToggleSelect?.()
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge status={task.status} size="sm" />
            {task.isBlocked && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                <Lock className="w-3 h-3" />
                被阻塞
              </span>
            )}
            {task.hasActiveSupervision && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-medium rounded">
                <BellRing className="w-3 h-3" />
                督办中
              </span>
            )}
            {task.meetingTitle && (
              <span className="text-xs text-slate-500 truncate">
                来源：{task.meetingTitle}
              </span>
            )}
          </div>

          <h3 className="text-sm font-medium text-slate-800 line-clamp-2 mb-3 group-hover:text-primary-700 transition-colors">
            {task.content}
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {task.department}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 font-medium',
                isOverdue
                  ? 'text-red-600'
                  : isUrgent
                  ? 'text-amber-600'
                  : 'text-slate-500'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              {task.deadline}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 font-medium',
                isOverdue
                  ? 'text-red-600'
                  : isUrgent
                  ? 'text-amber-600'
                  : 'text-slate-500'
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              {deadlineText}
            </span>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 transition-colors flex-shrink-0 mt-1" />
      </div>

      {task.progress && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-600 line-clamp-2">
            <span className="text-slate-400">最新进展：</span>
            {task.progress}
          </p>
        </div>
      )}

      {task.activeSupervision?.latestFollowUp && (
        <div className="mt-3 pt-3 border-t border-rose-100">
          <p className="text-xs text-rose-600 line-clamp-2">
            <span className="text-rose-400 font-medium">最近跟进：</span>
            {task.activeSupervision.latestFollowUp.content}
          </p>
          {task.activeSupervision.latestFollowUp.nextFollowUpDate && (
            <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              下次跟进：{task.activeSupervision.latestFollowUp.nextFollowUpDate}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
