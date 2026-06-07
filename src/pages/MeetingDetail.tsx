import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  CheckCircle,
  Edit3,
  Printer,
  History,
  ChevronDown,
  ChevronUp,
  BellRing,
  CalendarDays,
  Lock,
  Link2,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import StatusBadge from '../components/StatusBadge'
import TaskUpdateModal from '../components/TaskUpdateModal'
import ProgressTimeline from '../components/ProgressTimeline'
import AuditLogTimeline from '../components/AuditLogTimeline'
import { cn } from '../lib/utils'
import type { Meeting, Task, TaskProgress, AuditLog } from '../../shared/types'

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { fetchMeetingDetail, fetchMeetingAuditLogs } = useAppStore()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [showAuditLogs, setShowAuditLogs] = useState(false)
  const [auditLogList, setAuditLogList] = useState<AuditLog[]>([])
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)

  const loadMeeting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const data = await fetchMeetingDetail(Number(id))
    setMeeting(data)
    setLoading(false)
  }, [id, fetchMeetingDetail])

  useEffect(() => {
    loadMeeting()
  }, [loadMeeting])

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleUpdated = () => {
    loadMeeting()
    if (showAuditLogs) {
      loadAuditLogs()
    }
  }

  const loadAuditLogs = useCallback(async () => {
    if (!id) return
    setLoadingAuditLogs(true)
    try {
      const list = await fetchMeetingAuditLogs(Number(id))
      setAuditLogList(list)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoadingAuditLogs(false)
    }
  }, [id, fetchMeetingAuditLogs])

  const toggleAuditLogs = async () => {
    if (!showAuditLogs) {
      await loadAuditLogs()
    }
    setShowAuditLogs(!showAuditLogs)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500">加载中...</div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/meetings')}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">会议纪要不存在</h1>
        </div>
      </div>
    )
  }

  const tasks = meeting.tasks || []
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length
  const pendingCount = tasks.filter((t) => t.status === 'pending').length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/meetings')}
          className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            {meeting.title}
          </h1>
          <p className="text-slate-500 text-sm">会议纪要 #{meeting.id}</p>
        </div>
        <button
          onClick={() => navigate(`/meetings/${meeting.id}/print`)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200"
        >
          <Printer className="w-4 h-4" />
          <span className="text-sm font-medium">打印预览</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-lg">
                {meeting.title}
              </h2>
              <p className="text-sm text-slate-500">
                创建于 {meeting.createdAt}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Building2 className="w-4 h-4" />
                参会部门
              </div>
              <p className="text-sm font-medium text-slate-700">
                {meeting.departments}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                会议时间
              </div>
              <p className="text-sm font-medium text-slate-700">
                {meeting.meetingDate}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <CheckCircle className="w-4 h-4" />
                完成进度
              </div>
              <p className="text-sm font-medium text-slate-700">
                {completedCount} / {tasks.length} 项已完成
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={toggleAuditLogs}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              <History className="w-4 h-4" />
              <span>变更记录</span>
              {showAuditLogs ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAuditLogs && (
              <div className="mt-4">
                {loadingAuditLogs ? (
                  <div className="py-6 text-center text-sm text-slate-500">
                    加载中...
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto pr-1">
                    <AuditLogTimeline auditLogs={auditLogList} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-800">议定事项</h3>
            <div className="flex items-center gap-3 text-sm">
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-slate-600">待办理 {pendingCount}</span>
                </span>
              )}
              {inProgressCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-slate-600">进行中 {inProgressCount}</span>
                </span>
              )}
              {completedCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-slate-600">已完成 {completedCount}</span>
                </span>
              )}
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">暂无议定事项</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  index={index}
                  onClick={() => handleTaskClick(task)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TaskUpdateModal
        task={selectedTask}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdated={handleUpdated}
        allTasks={meeting?.tasks}
      />
    </div>
  )
}

function TaskItem({
  task,
  index,
  onClick,
}: {
  task: Task
  index: number
  onClick: () => void
}) {
  const fetchTaskProgress = useAppStore((state) => state.fetchTaskProgress)
  const [expanded, setExpanded] = useState(false)
  const [progressList, setProgressList] = useState<TaskProgress[]>([])
  const [loadingProgress, setLoadingProgress] = useState(false)

  const daysLeft = getDaysLeft(task.deadline)
  const isOverdue = daysLeft < 0 && task.status !== 'completed'
  const isUrgent = daysLeft >= 0 && daysLeft <= 3 && task.status !== 'completed'

  function getDaysLeft(deadline: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)
    const diff = deadlineDate.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  async function handleToggleExpand(e: React.MouseEvent) {
    e.stopPropagation()
    if (!expanded) {
      setLoadingProgress(true)
      try {
        const list = await fetchTaskProgress(task.id)
        setProgressList(list)
      } catch (err) {
        console.error('Failed to load progress list:', err)
      } finally {
        setLoadingProgress(false)
      }
    }
    setExpanded(!expanded)
  }

  return (
    <div
      onClick={onClick}
      className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-white transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-sm font-medium text-slate-600">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge status={task.status} size="sm" />
            {task.isBlocked && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                <Lock className="w-3 h-3" />
                被阻塞
              </span>
            )}
            {task.hasActiveSupervision && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-medium rounded">
                <BellRing className="w-3 h-3" />
                督办中
              </span>
            )}
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500">
              责任科室：{task.department}
            </span>
          </div>

          <p className="text-sm text-slate-800 font-medium mb-2 group-hover:text-primary-700 transition-colors">
            {task.content}
          </p>

          <div className="flex items-center gap-4 text-xs">
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                isOverdue
                  ? 'text-red-600'
                  : isUrgent
                  ? 'text-amber-600'
                  : 'text-slate-500'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              截止：{task.deadline}
              {isOverdue && ` (逾期${Math.abs(daysLeft)}天)`}
              {!isOverdue && daysLeft >= 0 && ` (剩余${daysLeft}天)`}
            </span>
          </div>

          {task.progress && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-600 line-clamp-2">
                <span className="text-slate-400 font-medium">最新进展：</span>
                {task.progress}
              </p>
            </div>
          )}

          {task.activeSupervision?.latestFollowUp && (
            <div className="mt-3 pt-3 border-t border-rose-100">
              <p className="text-xs text-rose-600 line-clamp-2">
                <span className="text-rose-400 font-medium">最近跟进：</span>
                {task.activeSupervision.latestFollowUp.content}
              </p>
              {task.activeSupervision.latestFollowUp.nextFollowUpDate && (
                <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  下次跟进：{task.activeSupervision.latestFollowUp.nextFollowUpDate}
                </p>
              )}
            </div>
          )}

          {task.prerequisiteTasks && task.prerequisiteTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                前置事项：
              </p>
              <div className="space-y-1">
                {task.prerequisiteTasks.map((prereq) => (
                  <div key={prereq.id} className="text-xs text-slate-600 flex items-center gap-2">
                    <StatusBadge status={prereq.status} size="sm" />
                    <span className="truncate">{prereq.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.blockingTasks && task.blockingTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                阻塞事项：
              </p>
              <div className="space-y-1">
                {task.blockingTasks.map((blocking) => (
                  <div key={blocking.id} className="text-xs text-slate-600 flex items-center gap-2">
                    <StatusBadge status={blocking.status} size="sm" />
                    <span className="truncate">{blocking.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={cn("flex items-center gap-3", (task.progress || task.activeSupervision?.latestFollowUp || (task.prerequisiteTasks && task.prerequisiteTasks.length > 0) || (task.blockingTasks && task.blockingTasks.length > 0)) ? "mt-3" : "mt-3 pt-3 border-t border-slate-200")}>
            <button
              onClick={handleToggleExpand}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary-600 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>历史进展 ({progressList.length || '...'})</span>
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              {loadingProgress ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  加载中...
                </div>
              ) : (
                <ProgressTimeline progressList={progressList} />
              )}
            </div>
          )}
        </div>

        <button className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors opacity-0 group-hover:opacity-100">
          <Edit3 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
