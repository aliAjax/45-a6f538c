import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Building2,
  FileText,
  Save,
  LayoutTemplate,
  X,
  Check,
  Link2,
  ChevronDown,
  Clock,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { MeetingTemplate, TemplateVersion } from '../../shared/types'

interface TaskFormData {
  content: string
  department: string
  deadline: string
  prerequisiteIndexes: number[]
}

export default function MeetingNew() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    createMeeting,
    departments,
    fetchDepartments,
    templates,
    fetchTemplates,
    fetchTemplateDetail,
    templateVersions,
    fetchTemplateVersions,
    fetchTemplateVersionDetail,
    loading,
  } = useAppStore()

  const [title, setTitle] = useState('')
  const [meetingDepartments, setMeetingDepartments] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [tasks, setTasks] = useState<TaskFormData[]>([
    { content: '', department: '', deadline: '', prerequisiteIndexes: [] },
  ])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplate | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null)

  const [expandedTemplateId, setExpandedTemplateId] = useState<number | null>(null)

  useEffect(() => {
    fetchDepartments()
    fetchTemplates()
  }, [fetchDepartments, fetchTemplates])

  useEffect(() => {
    const state = location.state as { templateId?: number } | null
    if (state?.templateId) {
      loadTemplate(state.templateId)
    }
  }, [location.state])

  const loadTemplate = async (templateId: number) => {
    const template = await fetchTemplateDetail(templateId)
    if (template && template.tasks) {
      setTitle(template.title)
      setMeetingDepartments(template.departments)
      setSelectedTemplate(template)
      setSelectedVersion(null)
      const newTasks = template.tasks.map((t) => ({
        content: t.content,
        department: t.department,
        deadline: '',
        prerequisiteIndexes: [] as number[],
      }))
      if (newTasks.length > 0) {
        setTasks(newTasks)
      }
    }
  }

  const loadTemplateVersion = async (templateId: number, versionId: number) => {
    const version = await fetchTemplateVersionDetail(templateId, versionId)
    if (version && version.tasks) {
      setTitle(version.title)
      setMeetingDepartments(version.departments)
      setSelectedVersion(version)
      const template = templates.find(t => t.id === templateId)
      if (template) {
        setSelectedTemplate(template)
      }
      const newTasks = version.tasks.map((t) => ({
        content: t.content,
        department: t.department,
        deadline: '',
        prerequisiteIndexes: [] as number[],
      }))
      if (newTasks.length > 0) {
        setTasks(newTasks)
      }
      setShowTemplateModal(false)
    }
  }

  const handleSelectTemplate = (template: MeetingTemplate) => {
    if (expandedTemplateId === template.id) {
      loadTemplate(template.id)
      setShowTemplateModal(false)
    } else {
      setExpandedTemplateId(template.id)
      fetchTemplateVersions(template.id)
    }
  }

  const handleUseLatestVersion = (template: MeetingTemplate) => {
    loadTemplate(template.id)
    setShowTemplateModal(false)
  }

  const handleUseVersion = (template: MeetingTemplate, version: TemplateVersion) => {
    loadTemplateVersion(template.id, version.id)
  }

  const clearTemplate = () => {
    setSelectedTemplate(null)
    setSelectedVersion(null)
    setTitle('')
    setMeetingDepartments('')
    setTasks([{ content: '', department: '', deadline: '', prerequisiteIndexes: [] }])
  }

  const addTask = () => {
    setTasks([...tasks, { content: '', department: '', deadline: '', prerequisiteIndexes: [] }])
  }

  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      const newTasks = tasks.filter((_, idx) => idx !== index)
      const adjustedTasks = newTasks.map((task) => ({
        ...task,
        prerequisiteIndexes: task.prerequisiteIndexes
          .filter(idx => idx !== index)
          .map(idx => idx > index ? idx - 1 : idx)
      }))
      setTasks(adjustedTasks)
    }
  }

  const updateTask = (index: number, field: 'content' | 'department' | 'deadline', value: string) => {
    const newTasks = [...tasks]
    newTasks[index][field] = value
    setTasks(newTasks)
  }

  const togglePrerequisite = (taskIndex: number, prereqIndex: number) => {
    const newTasks = [...tasks]
    const current = newTasks[taskIndex].prerequisiteIndexes
    if (current.includes(prereqIndex)) {
      newTasks[taskIndex].prerequisiteIndexes = current.filter(i => i !== prereqIndex)
    } else {
      newTasks[taskIndex].prerequisiteIndexes = [...current, prereqIndex]
    }
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

    const originalIndexToValidIndex = new Map<number, number>()
    let validIdx = 0
    tasks.forEach((task, origIdx) => {
      if (task.content.trim() && task.department && task.deadline) {
        originalIndexToValidIndex.set(origIdx, validIdx)
        validIdx++
      }
    })

    const tasksWithPrereqs = validTasks.map((task) => {
      const origPrereqs = task.prerequisiteIndexes || []
      const validPrereqs = origPrereqs
        .filter(origPrereqIdx => originalIndexToValidIndex.has(origPrereqIdx))
        .map(origPrereqIdx => originalIndexToValidIndex.get(origPrereqIdx)!)
      return {
        content: task.content.trim(),
        department: task.department,
        deadline: task.deadline,
        prerequisiteIndexes: validPrereqs,
      }
    })

    try {
      const meeting = await createMeeting({
        title: title.trim(),
        departments: meetingDepartments.trim(),
        meetingDate,
        tasks: tasksWithPrereqs,
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
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => setShowTemplateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
        >
          <LayoutTemplate className="w-4 h-4" />
          选择模板
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">会议基本信息</h2>
                {selectedTemplate && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      模板：{selectedTemplate.name}
                      {selectedVersion ? ` v${selectedVersion.version}` : ` v${selectedTemplate.currentVersion || 1} (最新)`}
                    </span>
                    <button
                      type="button"
                      onClick={clearTemplate}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      清除
                    </button>
                  </div>
                )}
              </div>
            </div>
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

                  {index > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        前置事项
                      </label>
                      <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                        {tasks.slice(0, index).map((_, prereqIndex) => (
                          <label
                            key={prereqIndex}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={task.prerequisiteIndexes.includes(prereqIndex)}
                              onChange={() => togglePrerequisite(index, prereqIndex)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-xs text-slate-600 truncate">
                              事项 {prereqIndex + 1}：{tasks[prereqIndex].content || '(未填写)'}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        选择需先完成的事项
                      </p>
                    </div>
                  )}
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

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">选择会议模板</h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="py-12 text-center text-slate-500">
                  加载中...
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <LayoutTemplate className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-sm">暂无模板</p>
                  <p className="text-slate-400 text-xs mt-1">
                    请先在模板库中创建会议模板
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => {
                    const isExpanded = expandedTemplateId === template.id
                    const isSelected = selectedTemplate?.id === template.id
                    return (
                      <div key={template.id} className="space-y-1">
                        <div
                          onClick={() => handleSelectTemplate(template)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                isSelected ? 'bg-primary-100' : 'bg-indigo-50'
                              }`}>
                                <LayoutTemplate className={`w-4.5 h-4.5 ${
                                  isSelected ? 'text-primary-600' : 'text-indigo-600'
                                }`} />
                              </div>
                              <div>
                                <h3 className={`font-medium text-sm ${
                                  isSelected ? 'text-primary-700' : 'text-slate-800'
                                }`}>
                                  {template.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-slate-500">
                                    {template.taskCount ?? template.tasks?.length ?? 0} 条议定事项
                                  </span>
                                  <span className="text-xs text-indigo-500 font-medium">
                                    v{template.currentVersion || 1}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`} />
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="ml-4 pl-4 border-l-2 border-slate-100 space-y-1 py-1">
                            {templateVersions.length > 0 && templateVersions[0]?.templateId === template.id ? (
                              <>
                                {templateVersions.map((version) => {
                                  const isLatest = version.version === template.currentVersion
                                  return (
                                    <div
                                      key={version.id}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleUseVersion(template, version)
                                      }}
                                      className="p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between group"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-sm font-medium text-slate-700">
                                          版本 v{version.version}
                                        </span>
                                        {isLatest && (
                                          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                            最新
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        {version.taskCount} 条 · {version.createdAt}
                                      </div>
                                    </div>
                                  )
                                })}
                              </>
                            ) : (
                              <div className="p-3 text-center">
                                <p className="text-xs text-slate-400">加载版本中...</p>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUseLatestVersion(template)
                              }}
                              className="w-full p-2 text-center text-xs text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors font-medium"
                            >
                              使用最新版本
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setShowTemplateModal(false)
                  navigate('/templates')
                }}
                className="w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                前往模板库管理模板
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
