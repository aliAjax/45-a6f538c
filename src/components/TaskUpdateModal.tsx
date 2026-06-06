import { useState, useEffect } from 'react'
import { X, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import StatusBadge from './StatusBadge'
import type { Task } from '../../shared/types'
import { cn } from '../lib/utils'

interface TaskUpdateModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
}

export default function TaskUpdateModal({ task, isOpen, onClose, onUpdated }: TaskUpdateModalProps) {
  const [progress, setProgress] = useState('')
  const [status, setStatus] = useState<Task['status']>('pending')
  const updateTask = useAppStore((state) => state.updateTask)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (task) {
      setProgress(task.progress || '')
      setStatus(task.status)
      setError('')
    }
  }, [task])

  if (!isOpen || !task) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await updateTask(task.id, { status, progress })
      onClose()
      onUpdated?.()
    } catch (err: any) {
      setError(err.message || '更新失败')
    } finally {
      setLoading(false)
    }
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">更新事项进展</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              来源：{task.meetingTitle || '未知会议'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-5">
            <p className="text-sm font-medium text-slate-700 mb-2">事项内容</p>
            <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
              {task.content}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">责任科室</p>
              <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
                {task.department}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">完成期限</p>
              <div
                className={cn(
                  'p-3 rounded-xl text-sm font-medium',
                  isOverdue
                    ? 'bg-red-50 text-red-600'
                    : 'bg-slate-50 text-slate-600'
                )}
              >
                {task.deadline}
                {isOverdue && (
                  <span className="text-xs ml-2">(逾期 {Math.abs(daysLeft)} 天)</span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              当前状态
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                  status === 'pending'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <AlertCircle
                  className={cn(
                    'w-6 h-6',
                    status === 'pending' ? 'text-amber-600' : 'text-slate-400'
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    status === 'pending' ? 'text-amber-700' : 'text-slate-600'
                  )}
                >
                  待办理
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('in_progress')}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                  status === 'in_progress'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <Clock
                  className={cn(
                    'w-6 h-6',
                    status === 'in_progress' ? 'text-blue-600' : 'text-slate-400'
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    status === 'in_progress' ? 'text-blue-700' : 'text-slate-600'
                  )}
                >
                  进行中
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('completed')}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                  status === 'completed'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <CheckCircle
                  className={cn(
                    'w-6 h-6',
                    status === 'completed' ? 'text-green-600' : 'text-slate-400'
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    status === 'completed' ? 'text-green-700' : 'text-slate-600'
                  )}
                >
                  已完成
                </span>
              </button>
            </div>
          </div>

          <div className="mb-5">
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              进展描述
            </label>
            <textarea
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              placeholder="请描述当前进展情况..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
              rows={4}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

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
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '保存中...' : '保存更新'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
