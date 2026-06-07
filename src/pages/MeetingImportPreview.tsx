import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Building2,
  FileText,
  Save,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { ParsedTask } from '../../shared/types'

interface MeetingFormData {
  title: string
  departments: string
  meetingDate: string
  tasks: ParsedTask[]
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function isValidDateTime(dateTimeStr: string): boolean {
  if (!dateTimeStr) return false
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return false
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  const hours = parseInt(match[4], 10)
  const minutes = parseInt(match[5], 10)
  if (hours < 0 || hours > 23) return false
  if (minutes < 0 || minutes > 59) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function ensureDateTimeFormat(dateStr: string): string {
  if (!dateStr) return ''
  if (isValidDateTime(dateStr)) return dateStr
  if (isValidDate(dateStr)) return `${dateStr}T09:00`
  return dateStr
}

export default function MeetingImportPreview() {
  const navigate = useNavigate()
  const { createMeeting, departments, fetchDepartments, loading } = useAppStore()
  const [meetings, setMeetings] = useState<MeetingFormData[]>([])
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdCount, setCreatedCount] = useState(0)
  const [createResults, setCreateResults] = useState<{ success: boolean; title: string; error?: string }[]>([])

  useEffect(() => {
    fetchDepartments()
    const stored = sessionStorage.getItem('importMeetings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as MeetingFormData[]
        const normalized = parsed.map((m) => ({
          ...m,
          meetingDate: ensureDateTimeFormat(m.meetingDate),
          tasks: m.tasks.map((t) => ({
            ...t,
            deadline: isValidDate(t.deadline) ? t.deadline : '',
          })),
        }))
        setMeetings(normalized)
        setExpandedMeetings(new Set(normalized.map((_, i) => i)))
      } catch {
        setError('数据加载失败，请重新导入')
      }
    } else {
      navigate('/meetings/import')
    }
  }, [fetchDepartments, navigate])

  const toggleMeeting = (index: number) => {
    const newExpanded = new Set(expandedMeetings)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedMeetings(newExpanded)
  }

  const updateMeeting = (index: number, field: keyof MeetingFormData, value: string) => {
    const newMeetings = [...meetings]
    newMeetings[index] = { ...newMeetings[index], [field]: value }
    setMeetings(newMeetings)
  }

  const addTask = (meetingIndex: number) => {
    const newMeetings = [...meetings]
    newMeetings[meetingIndex].tasks.push({
      content: '',
      department: '',
      deadline: '',
    })
    setMeetings(newMeetings)
  }

  const removeTask = (meetingIndex: number, taskIndex: number) => {
    const newMeetings = [...meetings]
    if (newMeetings[meetingIndex].tasks.length > 1) {
      newMeetings[meetingIndex].tasks.splice(taskIndex, 1)
      setMeetings(newMeetings)
    }
  }

  const updateTask = (
    meetingIndex: number,
    taskIndex: number,
    field: keyof ParsedTask,
    value: string
  ) => {
    const newMeetings = [...meetings]
    newMeetings[meetingIndex].tasks[taskIndex] = {
      ...newMeetings[meetingIndex].tasks[taskIndex],
      [field]: value,
    }
    setMeetings(newMeetings)
  }

  const addMeeting = () => {
    setMeetings([
      ...meetings,
      {
        title: '',
        departments: '',
        meetingDate: '',
        tasks: [{ content: '', department: '', deadline: '' }],
      },
    ])
    setExpandedMeetings(new Set([...expandedMeetings, meetings.length]))
  }

  const removeMeeting = (index: number) => {
    if (meetings.length > 1) {
      const newMeetings = meetings.filter((_, i) => i !== index)
      setMeetings(newMeetings)
      const newExpanded = new Set(expandedMeetings)
      newExpanded.delete(index)
      setExpandedMeetings(newExpanded)
    }
  }

  const validateMeeting = (meeting: MeetingFormData): string[] => {
    const errors: string[] = []
    if (!meeting.title.trim()) {
      errors.push('会议主题不能为空')
    }
    if (!meeting.departments.trim()) {
      errors.push('参会部门不能为空')
    }
    if (!meeting.meetingDate) {
      errors.push('会议时间不能为空')
    } else if (!isValidDateTime(meeting.meetingDate)) {
      errors.push('会议时间格式无效')
    }
    const validTasks = meeting.tasks.filter(
      (t) => t.content.trim() && t.department && t.deadline && isValidDate(t.deadline)
    )
    if (validTasks.length === 0) {
      errors.push('至少需要一条完整的议定事项')
    }
    return errors
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    setCreatedCount(0)
    setCreateResults([])

    let allValid = true
    for (let i = 0; i < meetings.length; i++) {
      const errors = validateMeeting(meetings[i])
      if (errors.length > 0) {
        setError(`第 ${i + 1} 个会议：${errors[0]}`)
        allValid = false
        break
      }
    }

    if (!allValid) {
      setSubmitting(false)
      return
    }

    const results: { success: boolean; title: string; error?: string }[] = []
    let successCount = 0

    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i]
      const validTasks = meeting.tasks.filter(
        (t) => t.content.trim() && t.department && t.deadline && isValidDate(t.deadline)
      )

      try {
        await createMeeting({
          title: meeting.title.trim(),
          departments: meeting.departments.trim(),
          meetingDate: meeting.meetingDate,
          tasks: validTasks.map((t) => ({
            content: t.content.trim(),
            department: t.department,
            deadline: t.deadline,
          })),
        })
        successCount++
        results.push({ success: true, title: meeting.title })
      } catch (err) {
        const e = err as Error
        results.push({ success: false, title: meeting.title, error: e.message })
      }
      setCreatedCount(successCount)
      setCreateResults([...results])
    }

    setSubmitting(false)

    const hasErrors = results.some((r) => !r.success)
    if (!hasErrors) {
      sessionStorage.removeItem('importMeetings')
      navigate('/meetings')
    }
  }

  const validMeetingCount = meetings.filter((m) => validateMeeting(m).length === 0).length

  if (meetings.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">暂无导入数据，请重新导入</p>
          <button
            onClick={() => navigate('/meetings/import')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm"
          >
            前往导入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/meetings/import')}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">确认导入</h1>
            <p className="text-slate-500 text-sm">
              请检查并修正解析结果，确认无误后创建会议纪要
            </p>
          </div>
        </div>
        <button
          onClick={addMeeting}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加会议
        </button>
      </div>

      <div className="bg-gradient-to-r from-primary-50 to-indigo-50 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
            <FileText className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">
              共 {meetings.length} 个会议待创建
            </p>
            <p className="text-xs text-slate-500">
              其中 {validMeetingCount} 个信息完整，{meetings.length - validMeetingCount} 个需要补充
            </p>
          </div>
        </div>
        {submitting && (
          <div className="text-sm text-primary-700 font-medium">
            正在创建：{createdCount} / {meetings.length}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {meetings.map((meeting, mIndex) => {
          const errors = validateMeeting(meeting)
          const isExpanded = expandedMeetings.has(mIndex)

          return (
            <div
              key={mIndex}
              className={`bg-white rounded-2xl border transition-all ${
                errors.length > 0
                  ? 'border-red-200'
                  : 'border-slate-200'
              }`}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => toggleMeeting(mIndex)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                      errors.length > 0
                        ? 'bg-red-100 text-red-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {mIndex + 1}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800 text-sm">
                      {meeting.title || '未命名会议'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {meeting.tasks.length} 条事项 · {meeting.departments || '未设置部门'}
                    </p>
                  </div>
                  {errors.length > 0 && (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.length} 项待完善
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {meetings.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeMeeting(mIndex)
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-5 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        会议主题 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={meeting.title}
                        onChange={(e) => updateMeeting(mIndex, 'title', e.target.value)}
                        placeholder="请输入会议主题"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          参会部门 <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={meeting.departments}
                        onChange={(e) => updateMeeting(mIndex, 'departments', e.target.value)}
                        placeholder="例如：办公室、人事科"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          会议时间 <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="datetime-local"
                        value={meeting.meetingDate}
                        onChange={(e) => updateMeeting(mIndex, 'meetingDate', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        议定事项
                      </span>
                      <button
                        type="button"
                        onClick={() => addTask(mIndex)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加事项
                      </button>
                    </div>

                    <div className="space-y-3">
                      {meeting.tasks.map((task, tIndex) => (
                        <div
                          key={tIndex}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-100"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600">
                              事项 {tIndex + 1}
                            </span>
                            {meeting.tasks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTask(mIndex, tIndex)}
                                className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-2.5">
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">
                                事项内容 <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                value={task.content}
                                onChange={(e) =>
                                  updateTask(mIndex, tIndex, 'content', e.target.value)
                                }
                                placeholder="请输入议定事项内容"
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none bg-white"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  责任科室 <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={task.department}
                                  onChange={(e) =>
                                    updateTask(mIndex, tIndex, 'department', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
                                >
                                  <option value="">请选择</option>
                                  {departments.map((dept) => (
                                    <option key={dept} value={dept}>
                                      {dept}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  完成期限 <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={task.deadline}
                                  onChange={(e) =>
                                    updateTask(mIndex, tIndex, 'deadline', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {createResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 text-sm">创建结果</h3>
          <div className="space-y-2">
            {createResults.map((result, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm ${
                  result.success
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{result.title}</span>
                {!result.success && result.error && (
                  <span className="text-xs opacity-80">{result.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50/95 backdrop-blur-sm py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-t border-slate-200">
        <button
          onClick={() => navigate('/meetings')}
          disabled={submitting}
          className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || loading || validMeetingCount === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4.5 h-4.5" />
          {submitting
            ? `创建中... ${createdCount}/${meetings.length}`
            : `确认创建 ${meetings.length} 个会议`}
        </button>
      </div>
    </div>
  )
}
