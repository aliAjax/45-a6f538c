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
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface TaskFormData {
  content: string
  department: string
  deadline: string
}

export default function MeetingNew() {
  const navigate = useNavigate()
  const { createMeeting, departments, fetchDepartments, loading } = useAppStore()

  const [title, setTitle] = useState('')
  const [meetingDepartments, setMeetingDepartments] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [tasks, setTasks] = useState<TaskFormData[]>([
    { content: '', department: '', deadline: '' },
  ])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  const addTask = () => {
    setTasks([...tasks, { content: '', department: '', deadline: '' }])
  }

  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter((_, i) => i !== index))
    }
  }

  const updateTask = (index: number, field: keyof TaskFormData, value: string) => {
    const newTasks = [...tasks]
    newTasks[index][field] = value
    setTasks(newTasks)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    if (!title.trim()) {
      setError('请输入会议主题')
      setSubmitting(false)
      return
    }

    if (!meetingDepartments.trim()) {
      setError('请输入参会部门')
      setSubmitting(false)
      return
    }

    if (!meetingDate) {
      setError('请选择会议时间')
      setSubmitting(false)
      return
    }

    const validTasks = tasks.filter(
      (t) => t.content.trim() && t.department && t.deadline
    )

    if (validTasks.length === 0) {
      setError('请至少添加一条完整的议定事项')
      setSubmitting(false)
      return
    }

    try {
      const meeting = await createMeeting({
        title: title.trim(),
        departments: meetingDepartments.trim(),
        meetingDate,
        tasks: validTasks,
      })
      navigate(`/meetings/${meeting.id}`)
    } catch (err) {
      const error = err as Error
      setError(error.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/meetings')}
          className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">新建会议纪要</h1>
          <p className="text-slate-500 text-sm">
            填写会议信息和议定事项
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="font-semibold text-slate-800">会议基本信息</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              会议主题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入会议主题"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  参会部门 <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="text"
                value={meetingDepartments}
                onChange={(e) => setMeetingDepartments(e.target.value)}
                placeholder="例如：办公室、人事科、财务科"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  会议时间 <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">议定事项</h2>
                <p className="text-xs text-slate-500">至少添加一条议定事项</p>
              </div>
            </div>
            <button
              type="button"
              onClick={addTask}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加事项
            </button>
          </div>

          <div className="space-y-4">
            {tasks.map((task, index) => (
              <div
                key={index}
                className="p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    事项 {index + 1}
                  </span>
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      事项内容 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={task.content}
                      onChange={(e) => updateTask(index, 'content', e.target.value)}
                      placeholder="请输入议定事项内容"
                      rows={2}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        责任科室 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={task.department}
                        onChange={(e) => updateTask(index, 'department', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
                      >
                        <option value="">请选择责任科室</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                        <option value="办公室">办公室</option>
                        <option value="人事科">人事科</option>
                        <option value="财务科">财务科</option>
                        <option value="业务一科">业务一科</option>
                        <option value="业务二科">业务二科</option>
                        <option value="安全科">安全科</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        完成期限 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={task.deadline}
                        onChange={(e) => updateTask(index, 'deadline', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/meetings')}
            className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4.5 h-4.5" />
            {submitting ? '保存中...' : '保存纪要'}
          </button>
        </div>
      </form>
    </div>
  )
}
