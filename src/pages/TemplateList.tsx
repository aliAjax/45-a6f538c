import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  FileText,
  Building2,
  ListTodo,
  X,
  Save,
  LayoutTemplate,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { MeetingTemplate } from '../../shared/types'

interface TaskFormData {
  content: string
  department: string
}

export default function TemplateList() {
  const navigate = useNavigate()
  const { templates, fetchTemplates, createTemplate, deleteTemplate, departments, fetchDepartments, loading } = useAppStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [templateDepartments, setTemplateDepartments] = useState('')
  const [tasks, setTasks] = useState<TaskFormData[]>([
    { content: '', department: '' },
  ])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchTemplates()
    fetchDepartments()
  }, [fetchTemplates, fetchDepartments])

  const addTask = () => {
    setTasks([...tasks, { content: '', department: '' }])
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

  const resetForm = () => {
    setName('')
    setTitle('')
    setTemplateDepartments('')
    setTasks([{ content: '', department: '' }])
    setError('')
    setSubmitting(false)
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    if (!name.trim()) {
      setError('请输入模板名称')
      setSubmitting(false)
      return
    }

    if (!title.trim()) {
      setError('请输入会议主题默认文案')
      setSubmitting(false)
      return
    }

    if (!templateDepartments.trim()) {
      setError('请输入参会部门')
      setSubmitting(false)
      return
    }

    const validTasks = tasks.filter(
      (t) => t.content.trim() && t.department
    )

    if (validTasks.length === 0) {
      setError('请至少添加一条完整的议定事项')
      setSubmitting(false)
      return
    }

    try {
      await createTemplate({
        name: name.trim(),
        title: title.trim(),
        departments: templateDepartments.trim(),
        tasks: validTasks,
      })
      setShowCreateModal(false)
      resetForm()
      fetchTemplates()
    } catch (err) {
      const error = err as Error
      setError(error.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定要删除这个模板吗？')) {
      return
    }

    try {
      await deleteTemplate(id)
      fetchTemplates()
    } catch (err) {
      const error = err as Error
      alert(error.message || '删除失败')
    }
  }

  const handleUseTemplate = (template: MeetingTemplate) => {
    navigate('/meetings/new', { state: { templateId: template.id } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">会议模板库</h1>
          <p className="text-slate-500 text-sm">管理常用会议模板，快速创建会议纪要</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200"
        >
          <Plus className="w-4.5 h-4.5" />
          新建模板
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            加载中...
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <LayoutTemplate className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">暂无会议模板</p>
            <p className="text-slate-400 text-xs mt-1">点击上方按钮创建第一个模板</p>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <LayoutTemplate className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">
                      {template.name}
                    </h3>
                    <p className="text-xs text-slate-500">创建于 {template.createdAt}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="删除模板"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600 line-clamp-2" title={template.title}>
                    {template.title}
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600 line-clamp-1" title={template.departments}>
                    {template.departments}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-600">
                    {template.taskCount ?? template.tasks?.length ?? 0} 条议定事项
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleUseTemplate(template)}
                className="w-full py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
              >
                使用模板
              </button>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">新建会议模板</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleCreateTemplate} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    模板名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：季度工作部署会"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      会议主题默认文案 <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：202X年第X季度工作部署会"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      参会部门 <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={templateDepartments}
                    onChange={(e) => setTemplateDepartments(e.target.value)}
                    placeholder="例如：办公室、人事科、财务科"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-700">
                      议定事项草稿 <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addTask}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加事项
                    </button>
                  </div>

                  <div className="space-y-3">
                    {tasks.map((task, index) => (
                      <div
                        key={index}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-600">
                            事项 {index + 1}
                          </span>
                          {tasks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTask(index)}
                              className="p-1 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div>
                            <textarea
                              value={task.content}
                              onChange={(e) => updateTask(index, 'content', e.target.value)}
                              placeholder="请输入议定事项内容"
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none bg-white"
                            />
                          </div>

                          <div>
                            <select
                              value={task.department}
                              onChange={(e) => updateTask(index, 'department', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
                            >
                              <option value="">请选择责任科室</option>
                              {departments.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    {error}
                  </div>
                )}
              </form>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                onClick={handleCreateTemplate}
                disabled={submitting || loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {submitting ? '保存中...' : '保存模板'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
