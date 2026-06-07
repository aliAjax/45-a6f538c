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
  Edit3,
  History,
  Clock,
  RotateCcw,
  Check,
  ChevronRight,
  GitCompare,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { MeetingTemplate, TemplateVersion, TemplateTaskVersion } from '../../shared/types'

interface TaskFormData {
  content: string
  department: string
}

export default function TemplateList() {
  const navigate = useNavigate()
  const {
    templates,
    fetchTemplates,
    fetchTemplateDetail,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    departments,
    fetchDepartments,
    templateVersions,
    fetchTemplateVersions,
    fetchTemplateVersionDetail,
    restoreTemplateVersion,
    loading,
  } = useAppStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MeetingTemplate | null>(null)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [templateDepartments, setTemplateDepartments] = useState('')
  const [tasks, setTasks] = useState<TaskFormData[]>([
    { content: '', department: '' },
  ])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)

  const [showVersionModal, setShowVersionModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplate | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null)
  const [compareVersion, setCompareVersion] = useState<TemplateVersion | null>(null)
  const [versionDetail, setVersionDetail] = useState<TemplateVersion | null>(null)
  const [compareDetail, setCompareDetail] = useState<TemplateVersion | null>(null)
  const [loadingVersionDetail, setLoadingVersionDetail] = useState(false)

  useEffect(() => {
    fetchTemplates()
    fetchDepartments()
  }, [fetchTemplates, fetchDepartments])

  useEffect(() => {
    if (selectedTemplate && showVersionModal) {
      fetchTemplateVersions(selectedTemplate.id)
    }
  }, [selectedTemplate, showVersionModal, fetchTemplateVersions])

  useEffect(() => {
    if (selectedVersion && showVersionModal) {
      loadVersionDetail(selectedVersion.id)
    }
  }, [selectedVersion, showVersionModal])

  useEffect(() => {
    if (compareVersion && showVersionModal) {
      loadCompareDetail(compareVersion.id)
    }
  }, [compareVersion, showVersionModal])

  const loadVersionDetail = async (versionId: number) => {
    if (!selectedTemplate) return
    setLoadingVersionDetail(true)
    try {
      const detail = await fetchTemplateVersionDetail(selectedTemplate.id, versionId)
      setVersionDetail(detail)
    } finally {
      setLoadingVersionDetail(false)
    }
  }

  const loadCompareDetail = async (versionId: number) => {
    if (!selectedTemplate) return
    const detail = await fetchTemplateVersionDetail(selectedTemplate.id, versionId)
    setCompareDetail(detail)
  }

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
    setEditingTemplate(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = async (template: MeetingTemplate) => {
    setEditingTemplate(template)
    setName(template.name)
    setTitle(template.title)
    setTemplateDepartments(template.departments)
    setTasks([{ content: '', department: '' }])
    setLoadingEdit(true)
    setError('')
    setShowCreateModal(true)

    try {
      const detail = await fetchTemplateDetail(template.id)
      if (detail && detail.tasks && detail.tasks.length > 0) {
        setTasks(detail.tasks.map(t => ({ content: t.content, department: t.department })))
      }
    } catch {
      // 保持默认空任务
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          name: name.trim(),
          title: title.trim(),
          departments: templateDepartments.trim(),
          tasks: validTasks,
        })
      } else {
        await createTemplate({
          name: name.trim(),
          title: title.trim(),
          departments: templateDepartments.trim(),
          tasks: validTasks,
        })
      }
      setShowCreateModal(false)
      resetForm()
      fetchTemplates()
    } catch (err) {
      const error = err as Error
      setError(error.message || '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定要删除这个模板吗？所有版本也会被删除。')) {
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

  const openVersionHistory = (template: MeetingTemplate) => {
    setSelectedTemplate(template)
    setSelectedVersion(null)
    setCompareVersion(null)
    setVersionDetail(null)
    setCompareDetail(null)
    setShowVersionModal(true)
  }

  const handleRestoreVersion = async () => {
    if (!selectedTemplate || !selectedVersion) return
    if (!confirm(`确定要将版本 ${selectedVersion.version} 恢复为当前版本吗？这将生成一个新版本。`)) {
      return
    }

    try {
      await restoreTemplateVersion(selectedTemplate.id, selectedVersion.id)
      fetchTemplates()
      fetchTemplateVersions(selectedTemplate.id)
      alert('恢复成功，已生成新版本')
    } catch (err) {
      const error = err as Error
      alert(error.message || '恢复失败')
    }
  }

  const getTaskDiff = (tasksA: TemplateTaskVersion[] | undefined, tasksB: TemplateTaskVersion[] | undefined) => {
    if (!tasksA || !tasksB) return { added: [] as TemplateTaskVersion[], removed: [] as TemplateTaskVersion[], same: [] as TemplateTaskVersion[] }

    const aContents = new Set(tasksA.map(t => t.content))
    const bContents = new Set(tasksB.map(t => t.content))

    const added = tasksB.filter(t => !aContents.has(t.content))
    const removed = tasksA.filter(t => !bContents.has(t.content))
    const same = tasksB.filter(t => aContents.has(t.content))

    return { added, removed, same }
  }

  const isCurrentVersion = (version: TemplateVersion) => {
    return selectedTemplate && version.version === selectedTemplate.currentVersion
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">会议模板库</h1>
          <p className="text-slate-500 text-sm">管理常用会议模板，快速创建会议纪要</p>
        </div>
        <button
          onClick={openCreateModal}
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-medium">
                        v{template.currentVersion || 1}
                      </span>
                      <span className="text-xs text-slate-400">
                        {template.versionCount || 1} 个版本
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 transition-colors"
                    title="编辑模板"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openVersionHistory(template)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                    title="版本历史"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="删除模板"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-500">
                    最近更新：{template.updatedAt}
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
              <h2 className="text-lg font-semibold text-slate-800">
                {editingTemplate ? '编辑模板' : '新建会议模板'}
              </h2>
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
              <form onSubmit={handleSubmit} className="space-y-5">
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
                      {loadingEdit && editingTemplate && (
                        <span className="ml-2 text-xs font-normal text-slate-400">加载中...</span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={addTask}
                      disabled={loadingEdit}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加事项
                    </button>
                  </div>

                  <div className="space-y-3">
                    {loadingEdit && editingTemplate ? (
                      <div className="p-8 text-center">
                        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm text-slate-500">正在加载模板事项...</p>
                      </div>
                    ) : (
                      tasks.map((task, index) => (
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
                    ))
                    )}
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
                onClick={handleSubmit}
                disabled={submitting || loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {submitting ? '保存中...' : editingTemplate ? '保存新版本' : '保存模板'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVersionModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">版本历史</h2>
                <p className="text-sm text-slate-500 mt-0.5">{selectedTemplate.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowVersionModal(false)
                  setSelectedTemplate(null)
                  setSelectedVersion(null)
                  setCompareVersion(null)
                  setVersionDetail(null)
                  setCompareDetail(null)
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex">
              <div className="w-72 border-r border-slate-200 overflow-y-auto">
                <div className="p-3 border-b border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-2">版本列表</p>
                </div>
                <div className="p-2 space-y-1">
                  {templateVersions.map((version) => (
                    <div
                      key={version.id}
                      onClick={() => {
                        setSelectedVersion(version)
                        setCompareVersion(null)
                        setCompareDetail(null)
                      }}
                      className={`p-3 rounded-xl cursor-pointer transition-all ${
                        selectedVersion?.id === version.id
                          ? 'bg-primary-50 border border-primary-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium text-sm ${
                          selectedVersion?.id === version.id ? 'text-primary-700' : 'text-slate-800'
                        }`}>
                          v{version.version}
                        </span>
                        {isCurrentVersion(version) && (
                          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            当前
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{version.createdAt}</p>
                      <p className="text-xs text-slate-400">{version.taskCount} 条事项</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {!selectedVersion ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">请选择一个版本查看详情</p>
                    </div>
                  </div>
                ) : loadingVersionDetail ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-500 text-sm">加载中...</p>
                  </div>
                ) : versionDetail ? (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                          <GitCompare className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">
                            版本 v{versionDetail.version}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {versionDetail.createdAt}
                          </p>
                        </div>
                        {isCurrentVersion(versionDetail) && (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                            当前版本
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isCurrentVersion(versionDetail) && (
                          <button
                            onClick={handleRestoreVersion}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            恢复此版本
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (compareVersion) {
                              setCompareVersion(null)
                              setCompareDetail(null)
                            } else {
                              const idx = templateVersions.findIndex(v => v.id === selectedVersion.id)
                              if (idx < templateVersions.length - 1) {
                                setCompareVersion(templateVersions[idx + 1])
                              }
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            compareVersion
                              ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                              : 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                          }`}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          {compareVersion ? '取消对比' : '对比上一版本'}
                        </button>
                      </div>
                    </div>

                    {compareVersion && compareDetail ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">对比：</span>
                          <span className="font-medium text-primary-600">v{versionDetail.version}</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-600">v{compareDetail.version}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-medium text-slate-500 mb-1">会议主题</p>
                            <p className="text-sm text-slate-700">{versionDetail.title}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-medium text-slate-500 mb-1">会议主题 (旧版)</p>
                            <p className="text-sm text-slate-700">{compareDetail.title}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-medium text-slate-500 mb-1">参会部门</p>
                            <p className="text-sm text-slate-700">{versionDetail.departments}</p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs font-medium text-slate-500 mb-1">参会部门 (旧版)</p>
                            <p className="text-sm text-slate-700">{compareDetail.departments}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-3">议定事项变更</p>
                          {(() => {
                            const diff = getTaskDiff(compareDetail.tasks, versionDetail.tasks)
                            return (
                              <div className="space-y-3">
                                {diff.added.length > 0 && (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                                    <p className="text-xs font-medium text-green-700 mb-2">新增事项</p>
                                    <ul className="space-y-1">
                                      {diff.added.map((task, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                                          <span className="text-green-500">+</span>
                                          <span className="flex-1">
                                            {task.content}
                                            <span className="text-green-600 text-xs ml-2">({task.department})</span>
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {diff.removed.length > 0 && (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                    <p className="text-xs font-medium text-red-700 mb-2">删除事项</p>
                                    <ul className="space-y-1">
                                      {diff.removed.map((task, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                                          <span className="text-red-500">−</span>
                                          <span className="flex-1">
                                            {task.content}
                                            <span className="text-red-600 text-xs ml-2">({task.department})</span>
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {diff.same.length > 0 && (
                                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <p className="text-xs font-medium text-slate-600 mb-2">未变更事项</p>
                                    <ul className="space-y-1">
                                      {diff.same.map((task, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                          <span className="text-slate-400">•</span>
                                          <span className="flex-1">
                                            {task.content}
                                            <span className="text-slate-500 text-xs ml-2">({task.department})</span>
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-xs font-medium text-slate-500 mb-1">会议主题</p>
                          <p className="text-sm text-slate-700 font-medium">{versionDetail.title}</p>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-xs font-medium text-slate-500 mb-1">参会部门</p>
                          <p className="text-sm text-slate-700">{versionDetail.departments}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-3">议定事项 ({versionDetail.taskCount} 条)</p>
                          <div className="space-y-2">
                            {versionDetail.tasks?.map((task, index) => (
                              <div
                                key={task.id}
                                className="p-3 bg-slate-50 rounded-xl flex items-start gap-3"
                              >
                                <span className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-medium text-slate-500 flex-shrink-0">
                                  {index + 1}
                                </span>
                                <div className="flex-1">
                                  <p className="text-sm text-slate-700">{task.content}</p>
                                  <p className="text-xs text-slate-500 mt-1">{task.department}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
