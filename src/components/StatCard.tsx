import { LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  gradient: string
  iconBg: string
  trend?: {
    value: string
    positive?: boolean
  }
}

export default function StatCard({ title, value, icon: Icon, gradient, iconBg, trend }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg',
        gradient
      )}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/80 mb-1">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
          </div>
          <div className={cn('p-3 rounded-xl', iconBg)}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>

        {trend && (
          <div className="mt-4 flex items-center gap-1.5">
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-md',
                trend.positive
                  ? 'bg-white/20 text-white'
                  : 'bg-red-500/30 text-red-100'
              )}
            >
              {trend.value}
            </span>
            <span className="text-xs text-white/60">较上月</span>
          </div>
        )}
      </div>

      <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute right-8 -bottom-8 w-20 h-20 rounded-full bg-white/5" />
    </div>
  )
}
