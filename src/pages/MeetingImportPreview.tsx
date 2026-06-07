import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Building2,
  FileText,
  Save,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  SkipForward,
  FolderPlus,
  PlusCircle,
  Copy,
  Link2,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type {
  ParsedTask,
  DuplicateCheckItem,
  DuplicateAction,
  ImportMeetingDecision,
  BatchImportResultItem,
} from '../../shared/types'

interface MeetingFormData {
  title: string
  departments: string
  meetingDate: string
  tasks: ParsedTask[]
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function isValidDateTime(dateTimeStr: string): boolean {
  if (!dateTimeStr) return false
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return false
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)
  const hours = parseInt(match[4], 10)
  const minutes = parseInt(match[5], 10)
  if (hours < 0 || hours > 23) return false
  if (minutes < 0 || minutes > 59) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function ensureDateTimeFormat(dateStr: string): string {
  if (!dateStr) return ''
  if (isValidDateTime(dateStr)) return dateStr
  if (isValidDate(dateStr)) return `${dateStr}T09:00`
  return dateStr
}

export default function MeetingImportPreview() {
  const navigate = useNavigate()
  const { checkDuplicates, departments, fetchDepartments, loading, batchImportMeetings } = useAppStore()
  const [meetings, setMeetings] = useState<MeetingFormData[]>([])
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createResults, setCreateResults] = useState<BatchImportResultItem[]>([])
  const [duplicateResults, setDuplicateResults] = useState<DuplicateCheckItem[]>([])
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [decisions, setDecisions] = useState<Map<number, ImportMeetingDecision>>(new Map())
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<number>>(new Set())
  const hasCheckedDuplicates = useRef(false)
  const checkDuplicatesTimer = useRef<number | null>(null)
  const isCheckingDuplicates = useRef(false)

  useEffect(() => {
    fetchDepartments()
    const stored = sessionStorage.getItem('importMeetings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as MeetingFormData[]
        const normalized = parsed.map((m) => ({
          ...m,
          meetingDate: ensureDateTimeFormat(m.meetingDate),
          tasks: m.tasks.map((t) => ({
            ...t,
            deadline: isValidDate(t.deadline) ? t.deadline : '',
            prerequisiteIndexes: t.prerequisiteIndexes || [],
          })),
        }))
        setMeetings(normalized)
        setExpandedMeetings(new Set(normalized.map((_, i) => i)))
        if (normalized.length > 0) {
          hasCheckedDuplicates.current = true
          checkDuplicatesTimer.current = window.setTimeout(() => {
            handleCheckDuplicatesWithData(normalized)
          }, 0)
        }
      } catch {
        setError('数据加载失败，请重新导入')
      }
    } else {
      navigate('/meetings/import')
    }
    return () => {
      if (checkDuplicatesTimer.current) {
        clearTimeout(checkDuplicatesTimer.current)
      }
    }
  }, [fetchDepartments, navigate])

  useEffect(() => {
    if (meetings.length > 0 && !hasCheckedDuplicates.current) {
      hasCheckedDuplicates.current = true
      handleCheckDuplicates()
    }
  }, [meetings])

  const handleCheckDuplicates = async () => {
    await handleCheckDuplicatesWithData(meetings)
  }

  const handleCheckDuplicatesWithData = async (meetingList: MeetingFormData[]) => {
    if (isCheckingDuplicates.current) return
    isCheckingDuplicates.current = true
    setCheckingDuplicates(true)
    setError('')
    try {
      const checkData = meetingList.map((m) => ({
        title: m.title,
        meetingDate: m.meetingDate,
        departments: m.departments,
        tasks: m.tasks,
      }))
      const result = await checkDuplicates(checkData)
      setDuplicateResults(result.results)

      const newDecisions = new Map<number, ImportMeetingDecision>()
      result.results.forEach((item) => {
        if (item.hasDuplicate && item.suspectedDuplicates.length > 0) {
          newDecisions.set(item.index, {
            action: 'append',
            targetMeetingId: item.suspectedDuplicates[0].meetingId,
          })
        } else {
          newDecisions.set(item.index, { action: 'create' })
        }
      })
      setDecisions(newDecisions)
    } catch (err) {
      const e = err as Error
      setError(`查重失败：${e.message}`)
    } finally {
      setCheckingDuplicates(false)
      isCheckingDuplicates.current = false
    }
  }

  const toggleMeeting = (index: number) => {
    const newExpanded = new Set(expandedMeetings)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedMeetings(newExpanded)
  }

  const toggleDuplicateDetail = (index: number) => {
    const newExpanded = new Set(expandedDuplicates)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedDuplicates(newExpanded)
  }

  const updateMeeting = (index: number, field: keyof MeetingFormData, value: string) => {
    const newMeetings = [...meetings]
    newMeetings[index] = { ...newMeetings[index], [field]: value }
    setMeetings(newMeetings)
  }

  const addTask = (meetingIndex: number) => {
    const newMeetings = [...meetings]
    newMeetings[meetingIndex].tasks.push({
      content: '',
      department: '',
      deadline: '',
      prerequisiteIndexes: [],
    })
    setMeetings(newMeetings)
  }

  const removeTask = (meetingIndex: number, taskIndex: number) => {
    const newMeetings = [...meetings]
    if (newMeetings[meetingIndex].tasks.length > 1) {
      const tasks = newMeetings[meetingIndex].tasks
      tasks.splice(taskIndex, 1)
      const adjustedTasks = tasks.map((task) => ({
        ...task,
        prerequisiteIndexes: (task.prerequisiteIndexes || [])
          .filter(idx => idx !== taskIndex)
          .map(idx => idx > taskIndex ? idx - 1 : idx)
      }))
      newMeetings[meetingIndex].tasks = adjustedTasks
      setMeetings(newMeetings)
    }
  }

  const updateTask = (
    meetingIndex: number,
    taskIndex: number,
    field: keyof ParsedTask,
    value: string
  ) => {
    const newMeetings = [...meetings]
    newMeetings[meetingIndex].tasks[taskIndex] = {
      ...newMeetings[meetingIndex].tasks[taskIndex],
      [field]: value,
    }
    setMeetings(newMeetings)
  }

  const togglePrerequisite = (
    meetingIndex: number,
    taskIndex: number,
    prereqIndex: number
  ) => {
    const newMeetings = [...meetings]
    const task = newMeetings[meetingIndex].tasks[taskIndex]
    const current = task.prerequisiteIndexes || []
    if (current.includes(prereqIndex)) {
      task.prerequisiteIndexes = current.filter(i => i !== prereqIndex)
    } else {
      task.prerequisiteIndexes = [...current, prereqIndex]
    }
    setMeetings(newMeetings)
  }

  const addMeeting = () => {
    setMeetings([
      ...meetings,
      {
        title: '',
        departments: '',
        meetingDate: '',
        tasks: [{ content: '', department: '', deadline: '', prerequisiteIndexes: [] }],
      },
    ])
    setExpandedMeetings(new Set([...expandedMeetings, meetings.length]))
  }

  const removeMeeting = (index: number) => {
    if (meetings.length > 1) {
      const newMeetings = meetings.filter((_, i) => i !== index)
      setMeetings(newMeetings)
      const newExpanded = new Set(expandedMeetings)
      newExpanded.delete(index)
      setExpandedMeetings(newExpanded)

      const newDuplicates = duplicateResults
        .filter((d) => d.index !== index)
        .map((d) => (d.index > index ? { ...d, index: d.index - 1 } : d))
      setDuplicateResults(newDuplicates)

      const newDecisions = new Map<number, ImportMeetingDecision>()
      decisions.forEach((decision, key) => {
        if (key < index) {
          newDecisions.set(key, decision)
        } else if (key > index) {
          newDecisions.set(key - 1, decision)
        }
      })
      setDecisions(newDecisions)
    }
  }

  const setDecision = (index: number, action: DuplicateAction, targetMeetingId?: number) => {
    const newDecisions = new Map(decisions)
    newDecisions.set(index, { action, targetMeetingId })
    setDecisions(newDecisions)
  }

  const validateMeeting = (meeting: MeetingFormData): string[] => {
    const errors: string[] = []
    if (!meeting.title.trim()) {
      errors.push('会议主题不能为空')
    }
    if (!meeting.departments.trim()) {
      errors.push('参会部门不能为空')
    }
    if (!meeting.meetingDate) {
      errors.push('会议时间不能为空')
    } else if (!isValidDateTime(meeting.meetingDate)) {
      errors.push('会议时间格式无效')
    }
    const validTasks = meeting.tasks.filter(
      (t) => t.content.trim() && t.department && t.deadline && isValidDate(t.deadline)
    )
    if (validTasks.length === 0) {
      errors.push('至少需要一条完整的议定事项')
    }
    return errors
  }

  const getDuplicateInfo = (index: number): DuplicateCheckItem | undefined => {
    return duplicateResults.find((d) => d.index === index)
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    setCreateResults([])

    let allValid = true
    for (let i = 0; i < meetings.length; i++) {
      const decision = decisions.get(i)
      if (decision?.action === 'skip') continue

      const errors = validateMeeting(meetings[i])
      if (errors.length > 0) {
        setError(`第 ${i + 1} 个会议：${errors[0]}`)
        allValid = false
        break
      }
    }

    if (!allValid) {
      setSubmitting(false)
      return
    }

    try {
      const importItems = meetings.map((meeting, index) => {
        const decision = decisions.get(index) || { action: 'create' as DuplicateAction }
        const validTasks = meeting.tasks.filter(
          (t) => t.content.trim() && t.department && t.deadline && isValidDate(t.deadline)
        )

        const originalIndexToValidIndex = new Map<number, number>()
        let validIdx = 0
        meeting.tasks.forEach((task, origIdx) => {
          if (task.content.trim() && task.department && task.deadline && isValidDate(task.deadline)) {
            originalIndexToValidIndex.set(origIdx, validIdx)
            validIdx++
          }
        })

        const tasksWithPrereqs = validTasks.map((task) => {
          const origPrereqs = task.prerequisiteIndexes || []
          const validPrereqs = origPrereqs
            .filter(origPrereqIdx => originalIndexToValidIndex.has(origPrereqIdx))
            .map(origPrereqIdx => originalIndexToValidIndex.get(origPrereqIdx)!)
          return {
            content: task.content.trim(),
            department: task.department,
            deadline: task.deadline,
            prerequisiteIndexes: validPrereqs,
          }
        })

        return {
          meeting: {
            title: meeting.title.trim(),
            departments: meeting.departments.trim(),
            meetingDate: meeting.meetingDate,
            tasks: tasksWithPrereqs,
          },
          decision: {
            action: decision.action,
            targetMeetingId: decision.targetMeetingId,
          },
        }
      })

      const result = await batchImportMeetings({ items: importItems })
      setCreateResults(result.results)

      const hasErrors = result.results.some((r) => !r.success)
      if (!hasErrors) {
        sessionStorage.removeItem('importMeetings')
        setTimeout(() => {
          navigate('/meetings')
        }, 1500)
      } else {
        const failedIndices: number[] = []
        result.results.forEach((r, i) => {
          if (!r.success) failedIndices.push(i)
        })
        const remainingMeetings = meetings.filter((_, i) => failedIndices.includes(i))
        const remainingDuplicates = duplicateResults
          .filter((d) => failedIndices.includes(d.index))
          .map((d, i) => ({ ...d, index: i }))
        const remainingDecisions = new Map<number, ImportMeetingDecision>()
        failedIndices.forEach((oldIdx, newIdx) => {
          const decision = decisions.get(oldIdx)
          if (decision) remainingDecisions.set(newIdx, decision)
        })

        if (remainingMeetings.length > 0) {
          sessionStorage.setItem('importMeetings', JSON.stringify(remainingMeetings))
          setMeetings(remainingMeetings)
          setDuplicateResults(remainingDuplicates)
          setDecisions(remainingDecisions)
          setExpandedMeetings(new Set(remainingMeetings.map((_, i) => i)))
          hasCheckedDuplicates.current = false
          handleCheckDuplicatesWithData(remainingMeetings)
        } else {
          sessionStorage.removeItem('importMeetings')
        }
      }
    } catch (err) {
      const e = err as Error
      setError(e.message || '导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  const validMeetingCount = useMemo(() => {
    return meetings.filter((m) => validateMeeting(m).length === 0).length
  }, [meetings])

  const duplicateCount = useMemo(() => {
    return duplicateResults.filter((d) => d.hasDuplicate).length
  }, [duplicateResults])

  const skipCount = useMemo(() => {
    let count = 0
    decisions.forEach((d) => {
      if (d.action === 'skip') count++
    })
    return count
  }, [decisions])

  const appendCount = useMemo(() => {
    let count = 0
    decisions.forEach((d) => {
      if (d.action === 'append') count++
    })
    return count
  }, [decisions])

  const createCount = useMemo(() => {
    let count = 0
    decisions.forEach((d) => {
      if (d.action === 'create') count++
    })
    return count
  }, [decisions])

  if (meetings.length === 0) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">暂无导入数据，请重新导入</p>
          <button
            onClick={() => navigate('/meetings/import')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm"
          >
            前往导入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/meetings/import')}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">确认导入</h1>
            <p className="text-slate-500 text-sm">
              检查重复项并选择处理方式，确认后创建会议纪要
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckDuplicates}
            disabled={checkingDuplicates || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checkingDuplicates ? 'animate-spin' : ''}`} />
            重新查重
          </button>
          <button
            onClick={addMeeting}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加会议
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-50 to-indigo-50 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">
                共 {meetings.length} 个会议
              </p>
              <p className="text-xs text-slate-500">
                {validMeetingCount} 个信息完整 · {meetings.length - validMeetingCount} 个待补充
              </p>
            </div>
          </div>
          {checkingDuplicates ? (
            <div className="text-sm text-primary-700 font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              正在检查重复...
            </div>
          ) : duplicateResults.length > 0 ? (
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                疑似重复 {duplicateCount}
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <SkipForward className="w-3.5 h-3.5" />
                跳过 {skipCount}
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <FolderPlus className="w-3.5 h-3.5" />
                追加 {appendCount}
              </span>
              <span className="flex items-center gap-1 text-primary-600">
                <PlusCircle className="w-3.5 h-3.5" />
                新建 {createCount}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        {meetings.map((meeting, mIndex) => {
          const errors = validateMeeting(meeting)
          const isExpanded = expandedMeetings.has(mIndex)
          const dupInfo = getDuplicateInfo(mIndex)
          const decision = decisions.get(mIndex) || { action: 'create' as DuplicateAction }
          const isDuplicateExpanded = expandedDuplicates.has(mIndex)

          return (
            <div
              key={mIndex}
              className={`bg-white rounded-2xl border transition-all ${
                errors.length > 0
                  ? 'border-red-200'
                  : dupInfo?.hasDuplicate
                  ? 'border-amber-300'
                  : 'border-slate-200'
              }`}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => toggleMeeting(mIndex)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                      errors.length > 0
                        ? 'bg-red-100 text-red-600'
                        : dupInfo?.hasDuplicate
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {mIndex + 1}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800 text-sm">
                      {meeting.title || '未命名会议'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {meeting.tasks.length} 条事项 · {meeting.departments || '未设置部门'}
                    </p>
                  </div>
                  {errors.length > 0 && (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.length} 项待完善
                    </span>
                  )}
                  {dupInfo?.hasDuplicate && errors.length === 0 && (
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      疑似重复
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {meetings.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeMeeting(mIndex)
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-5 border-t border-slate-100 pt-4">
                  {dupInfo?.hasDuplicate && dupInfo.suspectedDuplicates.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">
                            发现 {dupInfo.suspectedDuplicates.length} 个疑似重复的会议
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleDuplicateDetail(mIndex)
                          }}
                          className="text-xs text-amber-700 hover:text-amber-800"
                        >
                          {isDuplicateExpanded ? '收起详情' : '查看详情'}
                        </button>
                      </div>

                      {isDuplicateExpanded && (
                        <div className="space-y-2">
                          {dupInfo.suspectedDuplicates.map((dup, dIndex) => (
                            <div
                              key={dIndex}
                              className={`bg-white rounded-lg p-3 border ${
                                decision.targetMeetingId === dup.meetingId && decision.action === 'append'
                                  ? 'border-primary-400 ring-1 ring-primary-200'
                                  : 'border-amber-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate">
                                    {dup.title}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {dup.meetingDate}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Building2 className="w-3 h-3" />
                                      {dup.departments}
                                    </span>
                                    <span>{dup.taskCount} 条事项</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2 text-xs">
                                    <span className={dup.titleSimilarity >= 0.7 ? 'text-amber-700' : 'text-slate-500'}>
                                      标题相似度 {Math.round(dup.titleSimilarity * 100)}%
                                    </span>
                                    {dup.dateMatch && (
                                      <span className="text-emerald-600">日期匹配</span>
                                    )}
                                    <span className="text-slate-500">
                                      部门重叠 {Math.round(dup.deptOverlap * 100)}%
                                    </span>
                                  </div>
                                  {dup.matchingTasks.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-amber-100 space-y-1">
                                      <p className="text-xs text-amber-700 font-medium">
                                        疑似重复事项（{dup.matchingTasks.length} 条）：
                                      </p>
                                      {dup.matchingTasks.map((task, tIndex) => (
                                        <div key={tIndex} className="text-xs text-slate-600 pl-2">
                                          <Copy className="w-3 h-3 inline mr-1 text-amber-500" />
                                          {task.content.slice(0, 40)}
                                          {task.content.length > 40 ? '...' : ''}
                                          <span className="text-amber-600 ml-1">
                                            ({Math.round(task.similarity * 100)}%)
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDecision(mIndex, 'append', dup.meetingId)
                                  }}
                                  className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                    decision.targetMeetingId === dup.meetingId && decision.action === 'append'
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                  }`}
                                >
                                  {decision.targetMeetingId === dup.meetingId && decision.action === 'append'
                                    ? '已选择'
                                    : '追加到此会议'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-xs text-amber-700 font-medium">处理方式：</span>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDecision(mIndex, 'skip')
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              decision.action === 'skip'
                                ? 'bg-slate-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            跳过
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (dupInfo.suspectedDuplicates.length > 0) {
                                setDecision(mIndex, 'append', dupInfo.suspectedDuplicates[0].meetingId)
                              }
                            }}
                            disabled={dupInfo.suspectedDuplicates.length === 0}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                              decision.action === 'append'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                          >
                            追加到已有会议
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDecision(mIndex, 'create')
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              decision.action === 'create'
                                ? 'bg-primary-600 text-white'
                                : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                            }`}
                          >
                            仍然新建
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        会议主题 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={meeting.title}
                        onChange={(e) => updateMeeting(mIndex, 'title', e.target.value)}
                        placeholder="请输入会议主题"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          参会部门 <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={meeting.departments}
                        onChange={(e) => updateMeeting(mIndex, 'departments', e.target.value)}
                        placeholder="例如：办公室、人事科"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          会议时间 <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <input
                        type="datetime-local"
                        value={meeting.meetingDate}
                        onChange={(e) => updateMeeting(mIndex, 'meetingDate', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        议定事项
                      </span>
                      <button
                        type="button"
                        onClick={() => addTask(mIndex)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        添加事项
                      </button>
                    </div>

                    <div className="space-y-3">
                      {meeting.tasks.map((task, tIndex) => (
                        <div
                          key={tIndex}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-100"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-600">
                              事项 {tIndex + 1}
                            </span>
                            {meeting.tasks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTask(mIndex, tIndex)}
                                className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="space-y-2.5">
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">
                                事项内容 <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                value={task.content}
                                onChange={(e) =>
                                  updateTask(mIndex, tIndex, 'content', e.target.value)
                                }
                                placeholder="请输入议定事项内容"
                                rows={2}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none bg-white"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  责任科室 <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={task.department}
                                  onChange={(e) =>
                                    updateTask(mIndex, tIndex, 'department', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
                                >
                                  <option value="">请选择</option>
                                  {departments.map((dept) => (
                                    <option key={dept} value={dept}>
                                      {dept}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  完成期限 <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={task.deadline}
                                  onChange={(e) =>
                                    updateTask(mIndex, tIndex, 'deadline', e.target.value)
                                  }
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white"
                                />
                              </div>
                            </div>

                            {tIndex > 0 && (
                              <div className="pt-2 border-t border-slate-200">
                                <label className="block text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  前置事项
                                </label>
                                <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-lg p-1.5 space-y-0.5 bg-white">
                                  {meeting.tasks.slice(0, tIndex).map((_, prereqIndex) => (
                                    <label
                                      key={prereqIndex}
                                      className="flex items-center gap-2 p-1 rounded hover:bg-slate-50 cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={(task.prerequisiteIndexes || []).includes(prereqIndex)}
                                        onChange={() => togglePrerequisite(mIndex, tIndex, prereqIndex)}
                                        className="w-3 h-3 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                      />
                                      <span className="text-[11px] text-slate-600 truncate">
                                        事项 {prereqIndex + 1}：{meeting.tasks[prereqIndex].content || '(未填写)'}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {createResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 text-sm">导入结果</h3>
          <div className="space-y-2">
            {createResults.map((result, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm ${
                  result.success
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{result.title}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/60">
                  {result.action === 'create' ? '新建' : result.action === 'append' ? '追加' : '跳过'}
                </span>
                {!result.success && result.error && (
                  <span className="text-xs opacity-80">{result.error}</span>
                )}
              </div>
            ))}
          </div>
          {createResults.some((r) => !r.success) && (
            <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
              提示：失败的会议已保留在页面中，修正后可重新提交
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-slate-50/95 backdrop-blur-sm py-4 -mx-4 md:-mx-6 px-4 md:px-6 border-t border-slate-200">
        <button
          onClick={() => navigate('/meetings')}
          disabled={submitting}
          className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || loading || validMeetingCount === 0 || checkingDuplicates}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4.5 h-4.5" />
          {submitting
            ? '导入中...'
            : `确认导入（新建${createCount} + 追加${appendCount} + 跳过${skipCount}）`}
        </button>
      </div>
    </div>
  )
}
