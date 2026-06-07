import { useEffect, useState } from 'react'
import {
  FileText,
  CheckSquare,
  AlertTriangle,
  Clock,
  ArrowRight,
  Building2,
  BellRing,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import StatCard from '../components/StatCard'
import TaskCard from '../components/TaskCard'
import TaskUpdateModal from '../components/TaskUpdateModal'
import type { Task } from '../../shared/types'
import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    stats,
    overdueTasks,
    thisWeekTasks,
    supervisingTasks,
    departmentTaskStats,
    departments,
    fetchStats,
    fetchOverdueTasks,
    fetchThisWeekTasks,
    fetchSupervisingTasks,
    fetchDepartmentTaskStats,
    fetchDepartments,
  } = useAppStore()

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchOverdueTasks()
    fetchThisWeekTasks()
    fetchSupervisingTasks()
    fetchDepartmentTaskStats()
    fetchDepartments()
  }, [fetchStats, fetchOverdueTasks, fetchThisWeekTasks, fetchSupervisingTasks, fetchDepartmentTaskStats, fetchDepartments])

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setModalOpen(true)
  }

  const handleUpdated = () => {
    fetchStats()
    fetchOverdueTasks()
    fetchThisWeekTasks()
    fetchSupervisingTasks()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">首页概览</h1>
        <p className="text-slate-500 text-sm">
          查看会议纪要统计和待办事项进展
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="会议纪要总数"
          value={stats?.totalMeetings || 0}
          icon={FileText}
          gradient="bg-gradient-to-br from-blue-500 to-blue-700"
          iconBg="bg-white/20"
        />
        <StatCard
          title="待办事项"
          value={stats ? stats.totalTasks - stats.completedTasks : 0}
          icon={CheckSquare}
          gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          iconBg="bg-white/20"
        />
        <StatCard
          title="逾期事项"
          value={stats?.overdueTasks || 0}
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-red-500 to-red-700"
          iconBg="bg-white/20"
        />
        <StatCard
          title="本周到期"
          value={stats?.dueThisWeekTasks || 0}
          icon={Clock}
          gradient="bg-gradient-to-br from-amber-500 to-amber-700"
          iconBg="bg-white/20"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <BellRing className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">督办中事项</h2>
              <p className="text-xs text-slate-500">
                共 {supervisingTasks.length} 项正在督办
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/tasks?status=pending')}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 transition-colors"
          >
            查看全部
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {supervisingTasks.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-slate-500 text-sm">暂无督办中事项</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {supervisingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  variant="overdue"
                  onClick={() => handleTaskClick(task)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">逾期提醒</h2>
                <p className="text-xs text-slate-500">
                  共 {overdueTasks.length} 项已逾期
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/tasks?status=pending')}
              className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 transition-colors"
            >
              查看全部
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {overdueTasks.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <CheckSquare className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-slate-500 text-sm">太棒了，暂无逾期事项</p>
              </div>
            ) : (
              overdueTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  variant="overdue"
                  onClick={() => handleTaskClick(task)}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">本周到期</h2>
                <p className="text-xs text-slate-500">
                  共 {thisWeekTasks.length} 项本周内到期
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/tasks')}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1 transition-colors"
            >
              查看全部
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {thisWeekTasks.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm">本周没有即将到期的事项</p>
              </div>
            ) : (
              thisWeekTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  variant="this-week"
                  onClick={() => handleTaskClick(task)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <TaskUpdateModal
        task={selectedTask}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdated={handleUpdated}
      />

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">科室任务统计</h2>
              <p className="text-xs text-slate-500">
                共 {departmentTaskStats.length} 个科室有任务
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/tasks')}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors"
          >
            查看全部
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {departmentTaskStats.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">暂无科室任务数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {departmentTaskStats.map((stat) => {
                const isActive = departments.includes(stat.department)
                const activeCount = stat.total - stat.completed
                const completedRate = stat.total > 0
                  ? Math.round((stat.completed / stat.total) * 100)
                  : 0

                return (
                  <button
                    key={stat.department}
                    onClick={() => navigate(`/tasks?department=${encodeURIComponent(stat.department)}`)}
                    className="w-full text-left p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium text-sm',
                          isActive ? 'text-slate-800' : 'text-slate-400'
                        )}>
                          {stat.department}
                        </span>
                        {!isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                            已停用
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">
                        共 {stat.total} 项
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                        <span className="text-slate-500">待办理</span>
                        <span className="font-medium text-slate-700">{stat.pending}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-slate-500">进行中</span>
                        <span className="font-medium text-slate-700">{stat.inProgress}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span className="text-slate-500">逾期</span>
                        <span className="font-medium text-red-600">{stat.overdue}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5">
                        <span className="text-slate-500">完成率</span>
                        <span className="font-medium text-green-600">{completedRate}%</span>
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                        style={{ width: `${completedRate}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
