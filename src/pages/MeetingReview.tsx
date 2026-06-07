import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Calendar,
  Building2,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  Clock,
  BarChart3,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/utils'
import type { MeetingReviewStats } from '../../shared/types'

export default function MeetingReview() {
  const navigate = useNavigate()
  const { meetingReviewList, meetingReviewTotal, fetchMeetingReviewStats, loading } = useAppStore()
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    fetchMeetingReviewStats(page, pageSize, startDate, endDate, search)
  }, [fetchMeetingReviewStats, page, startDate, endDate, search])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const handleReset = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const totalPages = Math.ceil(meetingReviewTotal / pageSize)

  const overallStats = meetingReviewList.reduce(
    (acc, item) => {
      acc.total += item.totalTasks
      acc.completed += item.completedTasks
      acc.overdue += item.overdueTasks
      return acc
    },
    { total: 0, completed: 0, overdue: 0 }
  )

  const overallCompletionRate = overallStats.total > 0
    ? Math.round((overallStats.completed / overallStats.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">会议复盘看板</h1>
        <p className="text-slate-500 text-sm">按会议维度统计事项完成情况，追踪会议决议落地效果</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">会议总数</p>
              <p className="text-2xl font-bold text-slate-800">{meetingReviewTotal}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">事项总数</p>
              <p className="text-2xl font-bold text-slate-800">{overallStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">已完成</p>
              <p className="text-2xl font-bold text-green-600">{overallStats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">逾期事项</p>
              <p className="text-2xl font-bold text-red-600">{overallStats.overdue}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索会议主题..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setPage(1)
                }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <span className="text-slate-400">至</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setPage(1)
                }}
                className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              搜索
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 text-slate-500 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors"
            >
              重置
            </button>
          </form>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              加载中...
            </div>
          ) : meetingReviewList.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm">暂无会议复盘数据</p>
            </div>
          ) : (
            meetingReviewList.map((meeting) => (
              <MeetingReviewCard
                key={meeting.meetingId}
                meeting={meeting}
                onClick={() => navigate(`/meetings/${meeting.meetingId}`)}
              />
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              共 {meetingReviewTotal} 条记录，第 {page} / {totalPages} 页
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MeetingReviewCard({
  meeting,
  onClick,
}: {
  meeting: MeetingReviewStats
  onClick: () => void
}) {
  const isLowCompletion = meeting.completionRate < 60
  const hasManyOverdue = meeting.overdueTasks > 0
  const isWarning = isLowCompletion || hasManyOverdue

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-5 rounded-xl border cursor-pointer transition-all hover:shadow-md group',
        isWarning
          ? 'border-red-200 bg-red-50/30 hover:border-red-300'
          : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              isWarning ? 'bg-red-100' : 'bg-primary-50'
            )}
          >
            <FileText
              className={cn(
                'w-5 h-5',
                isWarning ? 'text-red-600' : 'text-primary-600'
              )}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">
                {meeting.meetingTitle}
              </h3>
              {isWarning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  需关注
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {meeting.meetingDate}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {meeting.departments}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'text-2xl font-bold',
                meeting.completionRate >= 80
                  ? 'text-green-600'
                  : meeting.completionRate >= 60
                    ? 'text-amber-600'
                    : 'text-red-600'
              )}
            >
              {meeting.completionRate}%
            </span>
            {meeting.completionRate < 60 && (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p className="text-xs text-slate-500">完成率</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-lg font-bold text-slate-800">{meeting.totalTasks}</p>
          <p className="text-xs text-slate-500">事项总数</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-lg font-bold text-green-600">{meeting.completedTasks}</p>
          <p className="text-xs text-green-600">已完成</p>
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg">
          <p className="text-lg font-bold text-amber-600">{meeting.pendingTasks + meeting.inProgressTasks}</p>
          <p className="text-xs text-amber-600">进行中</p>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <p className="text-lg font-bold text-red-600">{meeting.overdueTasks}</p>
          <p className="text-xs text-red-600">逾期</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              meeting.completionRate >= 80
                ? 'bg-gradient-to-r from-green-400 to-green-500'
                : meeting.completionRate >= 60
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-red-400 to-red-500'
            )}
            style={{ width: `${meeting.completionRate}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {meeting.completedTasks}/{meeting.totalTasks} 项
        </span>
      </div>
    </div>
  )
}
