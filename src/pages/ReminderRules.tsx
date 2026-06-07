import { useState, useEffect } from 'react'
import {
  Settings,
  Edit3,
  X,
  Save,
  RefreshCw,
  Bell,
  BellRing,
  Repeat,
  CalendarClock,
  RotateCcw,
  Building2,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { ReminderRule, UpdateReminderRuleRequest } from '../../shared/types'
import { cn } from '../lib/utils'

export default function ReminderRules() {
  const {
    reminderRules,
    fetchReminderRules,
    updateReminderRule,
    deleteReminderRule,
    loading,
    error,
  } = useAppStore()

  const [showModal, setShowModal] = useState(false)
  const [editingDept, setEditingDept] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null)
  const [formData, setFormData] = useState<UpdateReminderRuleRequest>({
    advanceDays: 3,
    includeSupervisionFollowUp: false,
    repeatOverdue: true,
  })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchReminderRules()
  }, [fetchReminderRules])

  const resetForm = () => {
    setFormData({
      advanceDays: 3,
      includeSupervisionFollowUp: false,
      repeatOverdue: true,
    })
    setSubmitError('')
    setSubmitting(false)
    setEditingDept(null)
    setEditingRule(null)
  }

  const openEditModal = (dept: string, rule: ReminderRule, isDefault: boolean) => {
    setEditingDept(dept)
    setEditingRule(rule)
    setFormData({
      advanceDays: rule.advanceDays,
      includeSupervisionFollowUp: rule.includeSupervisionFollowUp,
      repeatOverdue: rule.repeatOverdue,
    })
    setSubmitError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)

    if (!editingDept) {
      setSubmitError('科室信息缺失')
      setSubmitting(false)
      return
    }

    if (formData.advanceDays < 0 || formData.advanceDays > 30) {
      setSubmitError('提前天数必须在 0-30 天之间')
      setSubmitting(false)
      return
    }

    try {
      await updateReminderRule(editingDept, formData)
      setShowModal(false)
      resetForm()
    } catch (err) {
      const error = err as Error
      setSubmitError(error.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetDefault = async (dept: string) => {
    if (!confirm(`确定要将「${dept}」的提醒规则重置为默认值吗？`)) {
      return
    }

    try {
      await deleteReminderRule(dept)
    } catch (err) {
      const error = err as Error
      alert(error.message || '重置失败')
    }
  }

  const defaultCount = reminderRules.filter((r) => r.isDefault).length
  const customCount = reminderRules.filter((r) => !r.isDefault).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">提醒规则管理</h1>
          <p className="text-slate-500 text-sm">
            为每个科室配置独立的提醒规则，未配置的科室使用默认规则
          </p>
        </div>
        <button
          onClick={() => fetchReminderRules()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 px-5 py-4 bg-white rounded-xl border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{reminderRules.length}</p>
            <p className="text-sm text-slate-500">科室总数</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 bg-white rounded-xl border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{defaultCount}</p>
            <p className="text-sm text-slate-500">默认规则</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 bg-white rounded-xl border border-slate-200">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{customCount}</p>
            <p className="text-sm text-slate-500">自定义规则</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading && reminderRules.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-300" />
            <p>加载中...</p>
          </div>
        ) : reminderRules.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">暂无科室</p>
            <p className="text-slate-400 text-xs mt-1">请先在科室管理中添加科室</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reminderRules.map(({ rule, isDefault }) => (
              <div
                key={rule.department}
                className={cn(
                  'px-6 py-5 hover:bg-slate-50/50 transition-colors',
                  isDefault && 'bg-slate-50/30'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800 truncate">
                          {rule.department}
                        </h3>
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full',
                            isDefault
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-700'
                          )}
                        >
                          {isDefault ? '默认规则' : '自定义规则'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm text-slate-600">
                            提前 <span className="font-medium text-slate-800">{rule.advanceDays}</span> 天
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BellRing className={cn(
                            'w-4 h-4 flex-shrink-0',
                            rule.includeSupervisionFollowUp ? 'text-rose-500' : 'text-slate-300'
                          )} />
                          <span className={cn(
                            'text-sm',
                            rule.includeSupervisionFollowUp ? 'text-slate-600' : 'text-slate-400'
                          )}>
                            督办跟进{rule.includeSupervisionFollowUp ? '已纳入' : '未纳入'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Repeat className={cn(
                            'w-4 h-4 flex-shrink-0',
                            rule.repeatOverdue ? 'text-green-500' : 'text-slate-300'
                          )} />
                          <span className={cn(
                            'text-sm',
                            rule.repeatOverdue ? 'text-slate-600' : 'text-slate-400'
                          )}>
                            逾期重复{rule.repeatOverdue ? '开启' : '关闭'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(rule.department, rule, isDefault)}
                      className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      title="编辑规则"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!isDefault && (
                      <button
                        onClick={() => handleResetDefault(rule.department)}
                        className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="重置为默认规则"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                编辑「{editingDept}」提醒规则
              </h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    提前提醒天数
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formData.advanceDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          advanceDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                        })
                      }
                      min={0}
                      max={30}
                      className="w-24 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                    <span className="text-sm text-slate-500">天前开始提醒</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    范围 0-30 天，设为 0 则只在到期当天提醒
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.includeSupervisionFollowUp}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          includeSupervisionFollowUp: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-rose-500" />
                        <span className="text-sm font-medium text-slate-700">
                          纳入督办下次跟进日期
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        开启后，督办任务的下次跟进日期会参与提醒计算，取截止日期和跟进日期中较早的一个作为提醒依据
                      </p>
                    </div>
                  </label>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.repeatOverdue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          repeatOverdue: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-slate-700">
                          逾期后持续提醒
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        开启后，逾期任务会持续出现在提醒列表中；关闭后，逾期任务不再提醒
                      </p>
                    </div>
                  </label>
                </div>

                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    {submitError}
                  </div>
                )}
              </form>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              {editingRule && !editingRule.id ? null : (
                <button
                  type="button"
                  onClick={() => {
                    if (editingDept && !editingRule?.id) return
                    if (editingDept && editingRule?.id) {
                      handleResetDefault(editingDept)
                      setShowModal(false)
                      resetForm()
                    }
                  }}
                  disabled={submitting || !editingRule?.id}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置为默认
                </button>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {submitting ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
