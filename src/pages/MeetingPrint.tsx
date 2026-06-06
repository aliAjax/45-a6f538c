import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { Meeting, Task } from '../../shared/types'

export default function MeetingPrint() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { fetchMeetingDetail } = useAppStore()

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)

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

  const handlePrint = () => {
    window.print()
  }

  const handleBack = () => {
    if (id) {
      navigate(`/meetings/${id}`)
    } else {
      navigate('/meetings')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 no-print"
          >
            <ArrowLeft className="w-4 h-4" />
            返回详情
          </button>
          <div className="text-center py-20">
            <p className="text-slate-500">会议纪要不存在</p>
          </div>
        </div>
      </div>
    )
  }

  const tasks = meeting.tasks || []

  const getStatusText = (status: Task['status']) => {
    const map: Record<Task['status'], string> = {
      pending: '待办理',
      in_progress: '进行中',
      completed: '已完成',
    }
    return map[status]
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="max-w-3xl mx-auto py-6 px-4 print:py-0 print:px-0">
        <div className="flex items-center justify-between mb-6 no-print">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回详情
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            打印纪要
          </button>
        </div>

        <div className="bg-white print:shadow-none shadow-lg rounded-2xl print:rounded-none p-12 print:p-8">
          <div className="text-center mb-10 pb-6 border-b-2 border-slate-300">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              会议纪要
            </h1>
            <p className="text-slate-500 text-sm">
              会议编号：纪要字第 {meeting.id} 号
            </p>
          </div>

          <div className="space-y-5 mb-10">
            <div className="flex">
              <div className="w-24 flex-shrink-0 text-slate-600 font-medium">
                会议主题：
              </div>
              <div className="flex-1 text-slate-900 font-semibold">
                {meeting.title}
              </div>
            </div>

            <div className="flex">
              <div className="w-24 flex-shrink-0 text-slate-600 font-medium">
                参会部门：
              </div>
              <div className="flex-1 text-slate-800">
                {meeting.departments}
              </div>
            </div>

            <div className="flex">
              <div className="w-24 flex-shrink-0 text-slate-600 font-medium">
                会议时间：
              </div>
              <div className="flex-1 text-slate-800">
                {meeting.meetingDate}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              议定事项
            </h2>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              暂无议定事项
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse print-table">
                <thead>
                  <tr className="bg-slate-50 print:bg-slate-100">
                    <th className="border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700 w-12">
                      序号
                    </th>
                    <th className="border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700">
                      议定事项
                    </th>
                    <th className="border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700 w-28">
                      责任科室
                    </th>
                    <th className="border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700 w-28">
                      完成期限
                    </th>
                    <th className="border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700 w-20">
                      当前状态
                    </th>
                    <th className="border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700 w-40">
                      当前进展
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={task.id} className="align-top">
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700 text-center">
                        {index + 1}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-800">
                        {task.content}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        {task.department}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        {task.deadline}
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-sm">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            task.status === 'completed'
                              ? 'bg-green-100 text-green-700 print:bg-green-50'
                              : task.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-700 print:bg-blue-50'
                              : 'bg-amber-100 text-amber-700 print:bg-amber-50'
                          }`}
                        >
                          {getStatusText(task.status)}
                        </span>
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        {task.progress || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-16 pt-8 border-t border-slate-200 flex justify-between text-sm text-slate-500">
            <div>
              <p>记录人：___________</p>
            </div>
            <div className="text-right">
              <p>印发日期：{meeting.createdAt}</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-slate-400 no-print">
          提示：点击"打印纪要"按钮或使用浏览器打印功能（Ctrl/Cmd + P）进行打印
        </div>
      </div>
    </div>
  )
}
