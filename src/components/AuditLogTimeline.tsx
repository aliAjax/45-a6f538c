import { Clock, FileText, Edit, Hash, Target, Folder, Calendar, Users, Layers, CheckCircle, XCircle } from 'lucide-react'
import type { AuditLog } from '../../shared/types'

interface AuditLogTimelineProps {
  auditLogs: AuditLog[]
}

const actionTypeLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  create: { label: '创建', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: FileText },
  update: { label: '更新', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Edit },
  batch_update: { label: '批量更新', color: 'bg-violet-100 text-violet-700 border-violet-200', icon: Layers },
  start_supervision: { label: '发起督办', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Target },
  close_supervision: { label: '关闭督办', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  delete: { label: '删除', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
}

const fieldNameLabels: Record<string, { label: string; icon: React.ElementType }> = {
  status: { label: '状态', icon: Hash },
  progress: { label: '进展', icon: FileText },
  department: { label: '责任科室', icon: Users },
  deadline: { label: '期限', icon: Calendar },
}

function formatValue(value: string | null): string {
  if (value === null || value === undefined) return '-'
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object') {
      return JSON.stringify(parsed, null, 2)
    }
    return String(parsed)
  } catch {
    return value
  }
}

function getActionInfo(actionType: string) {
  return actionTypeLabels[actionType] || {
    label: actionType,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: FileText,
  }
}

function getFieldInfo(fieldName: string | null) {
  if (!fieldName) return null
  return fieldNameLabels[fieldName] || {
    label: fieldName,
    icon: Hash,
  }
}

export default function AuditLogTimeline({ auditLogs }: AuditLogTimelineProps) {
  if (auditLogs.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-slate-500">暂无变更记录</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />

      <div className="space-y-4">
        {auditLogs.map((log) => {
          const actionInfo = getActionInfo(log.actionType)
          const fieldInfo = getFieldInfo(log.fieldName)
          const ActionIcon = actionInfo.icon
          const FieldIcon = fieldInfo?.icon || Hash

          return (
            <div key={log.id} className="relative pl-8">
              <div className={`absolute left-0 top-1 w-6 h-6 rounded-full ${actionInfo.color} border flex items-center justify-center`}>
                <ActionIcon className="w-3 h-3" />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${actionInfo.color}`}>
                    {actionInfo.label}
                  </span>
                  {fieldInfo && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                      <FieldIcon className="w-3 h-3" />
                      {fieldInfo.label}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {log.createdAt}
                  </span>
                </div>

                {log.fieldName && (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0 w-14">变更前:</span>
                      <div className="flex-1 text-slate-700 bg-slate-100 rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap">
                        {formatValue(log.oldValue)}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0 w-14">变更后:</span>
                      <div className="flex-1 text-slate-800 bg-blue-50 rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap">
                        {formatValue(log.newValue)}
                      </div>
                    </div>
                  </div>
                )}

                {!log.fieldName && log.newValue && (
                  <div className="text-sm text-slate-700">
                    <div className="text-slate-500 text-xs mb-1">详情:</div>
                    <pre className="bg-slate-100 rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap">
                      {formatValue(log.newValue)}
                    </pre>
                  </div>
                )}

                {log.sourcePage && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Folder className="w-3 h-3" />
                      来源: {log.sourcePage}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
