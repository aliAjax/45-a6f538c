import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Upload,
  FileText,
  Sparkles,
  AlertCircle,
  ClipboardPaste,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { ParsedMeeting } from '../../shared/types'

const SAMPLE_TEXT = `会议主题：2024年第三季度工作部署会
参会部门：办公室、人事科、财务科、业务一科、业务二科、办公室
会议时间：2024年7月15日

1. 办公室：完成上半年工作总结，于2024年7月20日前提交
2. 人事科（办公室）：开展中层干部竞聘工作
3. 财务科：上半年财务决算，2024-08-05前完成
4. 业务一科：推进重点项目落地
   确保项目按时按质完成
   做好项目风险防控
5. 业务二科：优化业务办理流程，截止2024年8月31日`

export default function MeetingImport() {
  const navigate = useNavigate()
  const { parseMeetingText, loading } = useAppStore()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [parsedMeetings, setParsedMeetings] = useState<ParsedMeeting[] | null>(null)
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleParse = async () => {
    setError('')
    if (!text.trim()) {
      setError('请输入或粘贴会议纪要文本')
      return
    }

    try {
      const result = await parseMeetingText(text)
      setParsedMeetings(result.meetings)
      setParseWarnings(result.warnings)
    } catch (err) {
      const e = err as Error
      setError(e.message || '解析失败')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setText(content)
      setError('')
    }
    reader.onerror = () => {
      setError('文件读取失败')
    }
    reader.readAsText(file)
  }

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (clipboardText) {
        setText(clipboardText)
        setError('')
      } else {
        setError('剪贴板为空')
      }
    } catch {
      setError('无法读取剪贴板，请手动粘贴')
    }
  }

  const handleLoadSample = () => {
    setText(SAMPLE_TEXT)
    setError('')
  }

  const handleContinue = () => {
    if (!parsedMeetings || parsedMeetings.length === 0) return
    sessionStorage.setItem(
      'importMeetings',
      JSON.stringify(parsedMeetings.map((m) => ({
        title: m.title,
        departments: m.departments,
        meetingDate: m.meetingDate,
        tasks: m.tasks,
      })))
    )
    navigate('/meetings/import/preview')
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/meetings')}
          className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">批量导入会议纪要</h1>
          <p className="text-slate-500 text-sm">
            粘贴或上传纯文本会议记录，系统将自动解析
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">会议记录文本</h2>
              <p className="text-xs text-slate-500">
                支持粘贴文本或上传 .txt 文件
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePaste}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <ClipboardPaste className="w-4 h-4" />
              粘贴
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <Upload className="w-4 h-4" />
              上传文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`请粘贴会议纪要文本...\n\n支持的格式示例：\n会议主题：XXX会议\n参会部门：办公室、人事科\n会议时间：2024年1月1日\n\n1. 办公室：完成某项工作，于2024年1月15日前\n2. 人事科（责任科室）：开展某项工作\n3. 财务科：截止2024-02-01完成财务报表`}
            rows={16}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none font-mono text-slate-700"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleLoadSample}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            加载示例文本
          </button>
          <div className="text-xs text-slate-400">
            {text.length} 字符
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      {parsedMeetings && parsedMeetings.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">解析结果预览</h2>
              <p className="text-xs text-slate-500">
                共识别出 {parsedMeetings.length} 个会议
              </p>
            </div>
          </div>

          {parseWarnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                <AlertCircle className="w-4 h-4" />
                解析提示（{parseWarnings.length} 条）
              </div>
              <ul className="text-xs text-amber-600 space-y-1 pl-6 list-disc">
                {parseWarnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
                {parseWarnings.length > 5 && (
                  <li>...还有 {parseWarnings.length - 5} 条提示</li>
                )}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {parsedMeetings.map((meeting, idx) => (
              <div
                key={idx}
                className="p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    会议 {idx + 1}
                  </span>
                  {meeting.warnings.length > 0 && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                      {meeting.warnings.length} 条提示
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-20 flex-shrink-0">主题：</span>
                    <span className="text-slate-800 font-medium">
                      {meeting.title || <span className="text-red-500">未识别</span>}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-20 flex-shrink-0">部门：</span>
                    <span className="text-slate-700">
                      {meeting.departments || <span className="text-red-500">未识别</span>}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-20 flex-shrink-0">时间：</span>
                    <span className="text-slate-700">
                      {meeting.meetingDate || <span className="text-red-500">未识别</span>}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-20 flex-shrink-0">事项：</span>
                    <span className="text-slate-700">
                      {meeting.tasks.length} 条议定事项
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate('/meetings')}
          className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
        >
          取消
        </button>
        {parsedMeetings && parsedMeetings.length > 0 ? (
          <button
            onClick={handleContinue}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200"
          >
            <Sparkles className="w-4.5 h-4.5" />
            继续编辑并创建
          </button>
        ) : (
          <button
            onClick={handleParse}
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4.5 h-4.5" />
            {loading ? '解析中...' : '开始解析'}
          </button>
        )}
      </div>
    </div>
  )
}
