import { cn } from '../lib/utils'
import type { Task } from '../../shared/types'

interface StatusBadgeProps {
  status: Task['status']
  size?: 'sm' | 'md'
  count?: number
}

const statusConfig = {
  pending: {
    label: '待办理',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  in_progress: {
    label: '进行中',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  completed: {
    label: '已完成',
    className: 'bg-green-50 text-green-700 border-green-200',
    dotClass: 'bg-green-500',
  },
}

export default function StatusBadge({ status, size = 'md', count }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full font-medium',
        config.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotClass)} />
      {count !== undefined ? count : config.label}
    </span>
  )
}
