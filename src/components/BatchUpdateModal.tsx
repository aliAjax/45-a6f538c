import { useState } from 'react'
import {
  X,
  Check,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  CalendarDays,
  ChevronDown,
  Lock,
} from 'lucide-react'
import type { Task, BatchUpdateTaskResult } from '../../shared/types'
import { cn } from '../lib/utils'
import StatusBadge from './StatusBadge'

export interface BatchUpdateFormData {
  status?: Task['status']
  progress?: string
  department?: string
  deadline?: string
}

interface BatchUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  departments: string[]
  onSubmit: (data: BatchUpdateFormData) => Promise<void>
  loading: boolean
  results: BatchUpdateTaskResult[] | null
  error: string | null
  blockedTasks?: Array<{ id: number; content: string; uncompletedPrereqCount: number }> | null
  onRetry?: (data: BatchUpdateFormData) => Promise<void>
}

export default function BatchUpdateModal({
  isOpen,
  onClose,
  selectedCount,
  departments,
  onSubmit,
  loading,
  results,
  error,
  blockedTasks,
  onRetry,
}: BatchUpdateModalProps) {
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [formData, setFormData] = useState<BatchUpdateFormData>({})
  const [updateStatus, setUpdateStatus] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(false)
  const [updateDepartment, setUpdateDepartment] = useState(false)
  const [updateDeadline, setUpdateDeadline] = useState(false)
  const [status, setStatus] = useState<Task['status']>('in_progress')
  const [progress, setProgress] = useState('')
  const [department, setDepartment] = useState('')
  const [deadline, setDeadline] = useState('')
  const [showDeptDropdown, setShowDeptDropdown] = useState(false)

  const hasAnyField = updateStatus || updateProgress || updateDepartment || updateDeadline

  const handleNextStep = () => {
    const data: BatchUpdateFormData = {}
    if (updateStatus) data.status = status
    if (updateProgress) data.progress = progress
    if (updateDepartment) data.department = department
    if (updateDeadline) data.deadline = deadline
    setFormData(data)
    setStep('confirm')
  }

  const handleBackStep = () => {
    setStep('form')
  }

  const handleSubmit = async () => {
    await onSubmit(formData)
  }

  const handleClose = () => {
    if (loading) return
    onClose()
    setTimeout(() => {
      setStep('form')
      setFormData({})
      setUpdateStatus(false)
      setUpdateProgress(false)
      setUpdateDepartment(false)
      setUpdateDeadline(false)
      setStatus('in_progress')
      setProgress('')
      setDepartment('')
      setDeadline('')
    }, 200)
  }

  const handleRetry = async () => {
    if (onRetry) {
      await onRetry(formData)
    }
  }

  if (!isOpen) return null

  const successCount = results?.filter((r) => r.success).length ?? 0
  const failCount = results?.filter((r) => !r.success).length ?? 0
  const hasResults = results !== null
  const allSuccess = hasResults && failCount === 0
  const hasFailures = hasResults && failCount > 0
  const hasBlockedError = blockedTasks !== null && blockedTasks.length > 0
  const hasGlobalError = error !== null && !hasResults && !hasBlockedError

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">批量更新事项</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              已选择 {selectedCount} 条事项
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {hasBlockedError ? (
            <div className="p-5">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-amber-800 mb-1">存在阻塞事项</p>
                    <p className="text-sm text-amber-600">{error}</p>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-sm font-medium text-slate-700 mb-2">被阻塞的事项：</p>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {blockedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-start gap-2">
                        <Lock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 line-clamp-2">{task.content}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            #{task.id} · {task.uncompletedPrereqCount} 个前置事项未完成
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 mb-5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span>
                    请先完成这些事项的前置依赖，然后再尝试标记为已完成。您也可以先更新其他状态。
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  返回修改
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
                >
                  我知道了
                </button>
              </div>
            </div>
          ) : hasGlobalError ? (
            <div className="p-5">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-red-800 mb-1">批量更新失败</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 mb-5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span>
                    本次操作未能完成，所有事项均未更新。您可以检查网络连接后重试，或关闭对话框稍后再试。
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '重试中...' : '重试'}
                </button>
              </div>
            </div>
          ) : hasResults ? (
            <div className="p-5">
              <div
                className={cn(
                  'p-4 rounded-xl mb-5',
                  allSuccess
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-amber-50 border border-amber-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      allSuccess ? 'bg-green-100' : 'bg-amber-100'
                    )}
                  >
                    {allSuccess ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p
                      className={cn(
                        'font-medium',
                        allSuccess ? 'text-green-800' : 'text-amber-800'
                      )}
                    >
                      {allSuccess ? '全部更新成功' : '部分更新失败'}
                    </p>
                    <p
                      className={cn(
                        'text-sm',
                        allSuccess ? 'text-green-600' : 'text-amber-600'
                      )}
                    >
                      成功 {successCount} 条，失败 {failCount} 条
                    </p>
                  </div>
                </div>
              </div>

              {hasFailures && (
                <div className="mb-5 max-h-60 overflow-y-auto space-y-2">
                  <p className="text-sm font-medium text-slate-700 mb-2">失败详情：</p>
                  {results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm"
                      >
                        <span className="font-medium text-red-700">事项 #{r.id}：</span>
                        <span className="text-red-600">{r.error}</span>
                      </div>
                    ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
                >
                  {allSuccess ? '完成' : '我知道了'}
                </button>
              </div>
            </div>
          ) : step === 'confirm' ? (
            <div className="p-5">
              <div className="p-4 bg-slate-50 rounded-xl mb-5">
                <p className="text-sm font-medium text-slate-700 mb-3">请确认以下更新信息：</p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">更新数量：</span>
                    <span className="font-medium text-slate-800">{selectedCount} 条</span>
                  </div>
                  {updateStatus && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-24">目标状态：</span>
                      <StatusBadge status={status} size="sm" />
                    </div>
                  )}
                  {updateProgress && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 w-24 pt-0.5">进展说明：</span>
                      <span className="font-medium text-slate-800 flex-1">
                        {progress || <span className="text-slate-400">（无）</span>}
                      </span>
                    </div>
                  )}
                  {updateDepartment && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-24">责任科室：</span>
                      <span className="font-medium text-slate-800">{department}</span>
                    </div>
                  )}
                  {updateDeadline && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-24">完成期限：</span>
                      <span className="font-medium text-slate-800">{deadline}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    此操作将批量更新选中的事项，请确认后提交。系统将逐条处理并返回每条的更新结果，单条失败不会影响其他事项。
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  上一步
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '更新中...' : '确认提交'}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleNextStep()
              }}
              className="p-5 space-y-5"
            >
              <div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    更新状态
                  </span>
                </label>

                {updateStatus && (
                  <div className="mt-3 ml-7">
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
                            'w-5 h-5',
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
                            'w-5 h-5',
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
                            'w-5 h-5',
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
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={updateProgress}
                    onChange={(e) => setUpdateProgress(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    更新进展说明
                  </span>
                </label>

                {updateProgress && (
                  <div className="mt-3 ml-7">
                    <textarea
                      value={progress}
                      onChange={(e) => setProgress(e.target.value)}
                      placeholder="请输入进展说明，将应用到所有选中的事项..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={updateDepartment}
                    onChange={(e) => setUpdateDepartment(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    更新责任科室
                  </span>
                </label>

                {updateDepartment && (
                  <div className="mt-3 ml-7">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowDeptDropdown(!showDeptDropdown)}
                        className="w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span className={department ? 'text-slate-700' : 'text-slate-400'}>
                            {department || '请选择科室'}
                          </span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </button>

                      {showDeptDropdown && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowDeptDropdown(false)}
                          />
                          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                            {departments.map((dept) => (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => {
                                  setDepartment(dept)
                                  setShowDeptDropdown(false)
                                }}
                                className={cn(
                                  'w-full px-3 py-2 text-left text-sm transition-colors',
                                  department === dept
                                    ? 'bg-primary-50 text-primary-700 font-medium'
                                    : 'text-slate-700 hover:bg-slate-50'
                                )}
                              >
                                {dept}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={updateDeadline}
                    onChange={(e) => setUpdateDeadline(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    更新完成期限
                  </span>
                </label>

                {updateDeadline && (
                  <div className="mt-3 ml-7">
                    <div className="relative">
                      <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                      <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!hasAnyField}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一步
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
