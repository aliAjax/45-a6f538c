import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, FileText, BarChart3, Building2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { MeetingReviewReport, MeetingReviewStats, DepartmentReviewStats, MeetingReviewFilter } from '../../shared/types'

export default function MeetingReviewReportPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchMeetingReviewReport } = useAppStore()
  const [report, setReport] = useState<MeetingReviewReport | null>(null)
  const [loading, setLoading] = useState(true)

  const loadReport = useCallback(async () => {
    setLoading(true)
    const filter: MeetingReviewFilter = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      department: searchParams.get('department') || undefined,
      status: searchParams.get('status') as MeetingReviewFilter['status'] || undefined,
      overdueOnly: searchParams.get('overdueOnly') === 'true',
      supervisingOnly: searchParams.get('supervisingOnly') === 'true',
    }
    const data = await fetchMeetingReviewReport(filter)
    setReport(data)
    setLoading(false)
  }, [searchParams, fetchMeetingReviewReport])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handlePrint = () => {
    window.print()
  }

  const handleBack = () => {
    navigate('/review')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 no-print"
          >
            <ArrowLeft className="w-4 h-4" />
            返回复盘
          </button>
          <div className="text-center py-20">
            <p className="text-slate-500">暂无报表数据</p>
          </div>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return dateStr.split('T')[0]
  }

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getCompletionRateBg = (rate: number) => {
    if (rate >= 80) return 'bg-green-500'
    if (rate >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="max-w-4xl mx-auto py-6 px-4 print:py-0 print:px-0">
        <div className="flex items-center justify-between mb-6 no-print">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回复盘
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            打印报表
          </button>
        </div>

        <div className="bg-white print:shadow-none shadow-lg rounded-2xl print:rounded-none p-12 print:p-8">
          <div className="text-center mb-10 pb-6 border-b-2 border-slate-300">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              会议复盘报表
            </h1>
            <p className="text-slate-500 text-sm">
              报表生成时间：{new Date(report.generatedAt).toLocaleString('zh-CN')}
            </p>
            {(report.startDate || report.endDate) && (
              <p className="text-slate-500 text-sm mt-1">
                统计范围：{report.startDate || '不限'} 至 {report.endDate || '不限'}
              </p>
            )}
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              总体统计
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{report.summary.totalMeetings}</p>
                <p className="text-xs text-blue-600 mt-1">会议总数</p>
              </div>
              <div className="text-center p-4 bg-violet-50 rounded-lg">
                <p className="text-2xl font-bold text-violet-600">{report.summary.totalTasks}</p>
                <p className="text-xs text-violet-600 mt-1">事项总数</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{report.summary.completedTasks}</p>
                <p className="text-xs text-green-600 mt-1">已完成</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className={`text-2xl font-bold ${getCompletionRateColor(report.summary.overallCompletionRate)}`}>
                  {report.summary.overallCompletionRate}%
                </p>
                <p className="text-xs text-slate-600 mt-1">总完成率</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-xl font-bold text-amber-600">{report.summary.pendingTasks + report.summary.inProgressTasks}</p>
                <p className="text-xs text-amber-600 mt-1">进行中</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-xl font-bold text-red-600">{report.summary.overdueTasks}</p>
                <p className="text-xs text-red-600 mt-1">逾期事项</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-xl font-bold text-orange-600">{report.summary.supervisingTasks}</p>
                <p className="text-xs text-orange-600 mt-1">督办事项</p>
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              会议维度统计
            </h2>
            {report.meetingStats.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                暂无会议数据
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse print-table">
                  <thead>
                    <tr className="bg-slate-50 print:bg-slate-100">
                      <th className="border border-slate-300 px-3 py-2.5 text-left text-sm font-semibold text-slate-700">
                        会议名称
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 w-24">
                        会议时间
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        总数
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        已完成
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        进行中
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        逾期
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        督办
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-24">
                        完成率
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.meetingStats.map((meeting: MeetingReviewStats) => (
                      <tr key={meeting.meetingId} className="align-top">
                        <td className="border border-slate-300 px-3 py-2 text-sm text-slate-800">
                          <div className="font-medium">{meeting.meetingTitle}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{meeting.departments}</div>
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-slate-600">
                          {formatDate(meeting.meetingDate)}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-slate-700 text-center">
                          {meeting.totalTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-green-600 text-center font-medium">
                          {meeting.completedTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-amber-600 text-center">
                          {meeting.pendingTasks + meeting.inProgressTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-red-600 text-center">
                          {meeting.overdueTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-orange-600 text-center">
                          {meeting.supervisingTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getCompletionRateBg(meeting.completionRate)}`}
                                style={{ width: `${meeting.completionRate}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${getCompletionRateColor(meeting.completionRate)}`}>
                              {meeting.completionRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              科室维度统计
            </h2>
            {report.departmentStats.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                暂无科室数据
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse print-table">
                  <thead>
                    <tr className="bg-slate-50 print:bg-slate-100">
                      <th className="border border-slate-300 px-3 py-2.5 text-left text-sm font-semibold text-slate-700">
                        责任科室
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-20">
                        涉及会议
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        事项总数
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        已完成
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        进行中
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        逾期
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-16">
                        督办
                      </th>
                      <th className="border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 w-24">
                        完成率
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.departmentStats.map((dept: DepartmentReviewStats, index: number) => (
                      <tr key={dept.department} className="align-top">
                        <td className="border border-slate-300 px-3 py-2 text-sm text-slate-800 font-medium">
                          {index + 1}. {dept.department}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-slate-700 text-center">
                          {dept.meetingCount}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-slate-700 text-center">
                          {dept.totalTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-green-600 text-center font-medium">
                          {dept.completedTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-amber-600 text-center">
                          {dept.pendingTasks + dept.inProgressTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-red-600 text-center">
                          {dept.overdueTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-sm text-orange-600 text-center">
                          {dept.supervisingTasks}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getCompletionRateBg(dept.completionRate)}`}
                                style={{ width: `${dept.completionRate}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${getCompletionRateColor(dept.completionRate)}`}>
                              {dept.completionRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-16 pt-8 border-t border-slate-200 flex justify-between text-sm text-slate-500">
            <div>
              <p>制表人：___________</p>
            </div>
            <div className="text-right">
              <p>审核人：___________</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-slate-400 no-print">
          提示：点击"打印报表"按钮或使用浏览器打印功能（Ctrl/Cmd + P）进行打印或导出 PDF
        </div>
      </div>
    </div>
  )
}
