import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Building2,
  Edit3,
  X,
  Save,
  ArrowUp,
  ArrowDown,
  Power,
  PowerOff,
  GripVertical,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { Department } from '../../shared/types'
import { cn } from '../lib/utils'

export default function DepartmentList() {
  const {
    departmentList,
    fetchAllDepartments,
    createDepartment,
    updateDepartment,
    toggleDepartmentStatus,
    deleteDepartment,
    loading,
  } = useAppStore()

  const [showModal, setShowModal] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAllDepartments()
  }, [fetchAllDepartments])

  const resetForm = () => {
    setName('')
    setSortOrder(0)
    setError('')
    setSubmitting(false)
    setEditingDept(null)
  }

  const openCreateModal = () => {
    resetForm()
    const maxSort = departmentList.length > 0
      ? Math.max(...departmentList.map((d) => d.sortOrder))
      : 0
    setSortOrder(maxSort + 1)
    setShowModal(true)
  }

  const openEditModal = (dept: Department) => {
    setEditingDept(dept)
    setName(dept.name)
    setSortOrder(dept.sortOrder)
    setError('')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    if (!name.trim()) {
      setError('请输入科室名称')
      setSubmitting(false)
      return
    }

    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, {
          name: name.trim(),
          sortOrder,
        })
      } else {
        await createDepartment({
          name: name.trim(),
          sortOrder,
        })
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      const error = err as Error
      setError(error.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (dept: Department) => {
    const action = dept.isActive ? '停用' : '启用'
    if (!confirm(`确定要${action}科室「${dept.name}」吗？${dept.isActive ? '停用后，新增纪要时将不再显示该科室，但历史数据不受影响。' : ''}`)) {
      return
    }

    try {
      await toggleDepartmentStatus(dept.id)
    } catch (err) {
      const error = err as Error
      alert(error.message || '操作失败')
    }
  }

  const handleDelete = async (dept: Department) => {
    if (!confirm(`确定要删除科室「${dept.name}」吗？删除后不可恢复。`)) {
      return
    }

    try {
      await deleteDepartment(dept.id)
    } catch (err) {
      const error = err as Error
      alert(error.message || '删除失败')
    }
  }

  const moveDept = async (dept: Department, direction: 'up' | 'down') => {
    const currentIndex = departmentList.findIndex((d) => d.id === dept.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= departmentList.length) {
      return
    }

    const targetDept = departmentList[targetIndex]
    const currentSort = dept.sortOrder
    const targetSort = targetDept.sortOrder

    try {
      await updateDepartment(dept.id, { sortOrder: targetSort })
      await updateDepartment(targetDept.id, { sortOrder: currentSort })
    } catch (err) {
      const error = err as Error
      alert(error.message || '排序失败')
    }
  }

  const activeCount = departmentList.filter((d) => d.isActive).length
  const inactiveCount = departmentList.filter((d) => !d.isActive).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">科室管理</h1>
          <p className="text-slate-500 text-sm">
            维护科室名称、排序和启用状态
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200"
        >
          <Plus className="w-4.5 h-4.5" />
          新增科室
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-xl">
          <span className="text-sm text-primary-600 font-medium">启用中</span>
          <span className="text-sm font-bold text-primary-700">{activeCount}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
          <span className="text-sm text-slate-600 font-medium">已停用</span>
          <span className="text-sm font-bold text-slate-700">{inactiveCount}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">加载中...</div>
        ) : departmentList.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">暂无科室</p>
            <p className="text-slate-400 text-xs mt-1">点击上方按钮创建第一个科室</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {departmentList.map((dept, index) => (
              <div
                key={dept.id}
                className={cn(
                  'flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors',
                  !dept.isActive && 'bg-slate-50/50'
                )}
              >
                <div className="flex items-center gap-1 text-slate-300">
                  <GripVertical className="w-4 h-4" />
                </div>

                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        'font-medium text-slate-800',
                        !dept.isActive && 'text-slate-400 line-through'
                      )}
                    >
                      {dept.name}
                    </h3>
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs rounded-full font-medium',
                        dept.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-200 text-slate-500'
                      )}
                    >
                      {dept.isActive ? '启用' : '停用'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    排序：{dept.sortOrder} · 创建于 {dept.createdAt}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveDept(dept, 'up')}
                    disabled={index === 0}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      index === 0
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    )}
                    title="上移"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveDept(dept, 'down')}
                    disabled={index === departmentList.length - 1}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      index === departmentList.length - 1
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    )}
                    title="下移"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-200 mx-1" />

                  <button
                    onClick={() => handleToggle(dept)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      dept.isActive
                        ? 'text-amber-500 hover:bg-amber-50'
                        : 'text-green-500 hover:bg-green-50'
                    )}
                    title={dept.isActive ? '停用' : '启用'}
                  >
                    {dept.isActive ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(dept)}
                    className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="编辑"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingDept ? '编辑科室' : '新增科室'}
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
                    科室名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入科室名称"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    排序值
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    min={0}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    数值越小排序越靠前，也可在列表中直接调整顺序
                  </p>
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
      )}
    </div>
  )
}
