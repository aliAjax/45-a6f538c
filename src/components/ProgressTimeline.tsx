import { Clock } from 'lucide-react'
import StatusBadge from './StatusBadge'
import type { TaskProgress } from '../../shared/types'

interface ProgressTimelineProps {
  progressList: TaskProgress[]
}

export default function ProgressTimeline({ progressList }: ProgressTimelineProps) {
  if (progressList.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-slate-500">暂无进展记录</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />

      <div className="space-y-4">
        {progressList.map((progress) => (
          <div key={progress.id} className="relative pl-8">
            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={progress.status} size="sm" />
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {progress.createdAt}
                </span>
              </div>

              {progress.progress ? (
                <p className="text-sm text-slate-700 leading-relaxed">
                  {progress.progress}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  无进展描述
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
