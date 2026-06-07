import { create } from 'zustand'
import type {
  Meeting,
  Task,
  TaskProgress,
  TaskSupervision,
  SupervisionFollowUp,
  CreateSupervisionRequest,
  CreateSupervisionFollowUpRequest,
  Stats,
  CreateMeetingRequest,
  UpdateTaskRequest,
  MeetingTemplate,
  TemplateVersion,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  DepartmentStats,
  DepartmentRiskStats,
  DepartmentRiskDetail,
  CalendarMonthData,
  ReminderGroups,
  MeetingReviewStats,
  MeetingReviewDetail,
  MeetingReviewReport,
  MeetingReviewFilter,
  ParseMeetingResponse,
  BatchUpdateTaskRequest,
  BatchUpdateTaskResponse,
  DepartmentWorkbenchData,
  DuplicateCheckRequest,
  DuplicateCheckResponse,
  AppendTasksRequest,
  BatchImportRequest,
  BatchImportResponse,
  TaskView,
  TaskFilter,
  CreateTaskViewRequest,
  UpdateTaskViewRequest,
  TaskViewValidationResult,
  AuditLog,
} from '../../shared/types'
import api from '../utils/api'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '操作失败'
}

interface AppState {
  stats: Stats | null
  meetings: Meeting[]
  meetingsTotal: number
  tasks: Task[]
  tasksTotal: number
  overdueTasks: Task[]
  thisWeekTasks: Task[]
  departments: string[]
  departmentList: Department[]
  departmentTaskStats: DepartmentStats[]
  allTaskDepartments: string[]
  templates: MeetingTemplate[]
  templateVersions: TemplateVersion[]
  calendarData: CalendarMonthData | null
  reminderGroups: ReminderGroups | null
  meetingReviewList: MeetingReviewStats[]
  meetingReviewTotal: number
  meetingReviewDetail: MeetingReviewDetail | null
  meetingReviewReport: MeetingReviewReport | null
  departmentWorkbench: DepartmentWorkbenchData | null
  departmentRiskStats: DepartmentRiskStats[]
  departmentRiskDetail: DepartmentRiskDetail | null
  supervisingTasks: Task[]
  taskViews: TaskView[]
  currentViewId: number | null
  loading: boolean
  error: string | null

  fetchStats: () => Promise<void>
  fetchMeetings: (page?: number, pageSize?: number, search?: string) => Promise<void>
  fetchMeetingDetail: (id: number) => Promise<Meeting | null>
  createMeeting: (data: CreateMeetingRequest) => Promise<Meeting>
  fetchTasks: (department?: string, status?: string, page?: number, pageSize?: number, risk?: string, filter?: Partial<TaskFilter>) => Promise<void>
  fetchOverdueTasks: () => Promise<void>
  fetchThisWeekTasks: () => Promise<void>
  fetchCalendarTasks: (year: number, month: number, department?: string, filter?: Partial<TaskFilter>) => Promise<void>
  fetchDepartments: () => Promise<void>
  fetchAllDepartments: () => Promise<void>
  fetchDepartmentTaskStats: () => Promise<void>
  fetchDepartmentRiskStats: () => Promise<void>
  fetchDepartmentRiskDetail: (department: string) => Promise<void>
  createDepartment: (data: CreateDepartmentRequest) => Promise<Department>
  updateDepartment: (id: number, data: UpdateDepartmentRequest) => Promise<Department>
  toggleDepartmentStatus: (id: number) => Promise<Department>
  deleteDepartment: (id: number) => Promise<void>
  updateTask: (id: number, data: UpdateTaskRequest) => Promise<Task>
  batchUpdateTasks: (updates: BatchUpdateTaskRequest) => Promise<BatchUpdateTaskResponse>
  fetchDepartmentWorkbench: (department: string) => Promise<void>
  fetchTaskProgress: (taskId: number) => Promise<TaskProgress[]>
  fetchTaskSupervisions: (taskId: number) => Promise<TaskSupervision[]>
  createSupervision: (data: CreateSupervisionRequest) => Promise<TaskSupervision>
  closeSupervision: (id: number, sourcePage?: string) => Promise<TaskSupervision>
  fetchSupervisionFollowUps: (supervisionId: number) => Promise<SupervisionFollowUp[]>
  addSupervisionFollowUp: (supervisionId: number, data: CreateSupervisionFollowUpRequest) => Promise<SupervisionFollowUp>
  fetchSupervisingTasks: () => Promise<void>
  fetchTemplates: () => Promise<void>
  fetchTemplateDetail: (id: number) => Promise<MeetingTemplate | null>
  createTemplate: (data: CreateTemplateRequest) => Promise<MeetingTemplate>
  updateTemplate: (id: number, data: UpdateTemplateRequest) => Promise<MeetingTemplate>
  deleteTemplate: (id: number) => Promise<void>
  fetchTemplateVersions: (templateId: number) => Promise<void>
  fetchTemplateVersionDetail: (templateId: number, versionId: number) => Promise<TemplateVersion | null>
  restoreTemplateVersion: (templateId: number, versionId: number) => Promise<MeetingTemplate>
  fetchReminders: () => Promise<void>
  fetchMeetingReviewStats: (page?: number, pageSize?: number, filter?: MeetingReviewFilter) => Promise<void>
  fetchMeetingReviewDetail: (meetingId: number) => Promise<MeetingReviewDetail | null>
  fetchMeetingReviewReport: (filter?: MeetingReviewFilter) => Promise<MeetingReviewReport | null>
  parseMeetingText: (text: string) => Promise<ParseMeetingResponse>
  checkDuplicates: (meetings: DuplicateCheckRequest['meetings']) => Promise<DuplicateCheckResponse>
  appendTasksToMeeting: (meetingId: number, tasks: AppendTasksRequest['tasks']) => Promise<Task[]>
  batchImportMeetings: (request: BatchImportRequest) => Promise<BatchImportResponse>
  fetchTaskViews: () => Promise<void>
  createTaskView: (data: CreateTaskViewRequest) => Promise<TaskView>
  updateTaskView: (id: number, data: UpdateTaskViewRequest) => Promise<TaskView>
  deleteTaskView: (id: number) => Promise<void>
  reorderTaskViews: (orders: Array<{ id: number; sortOrder: number }>) => Promise<void>
  validateTaskView: (id: number) => Promise<TaskViewValidationResult>
  setCurrentViewId: (id: number | null) => void
  fetchTaskAuditLogs: (taskId: number) => Promise<AuditLog[]>
  fetchMeetingAuditLogs: (meetingId: number) => Promise<AuditLog[]>
  fetchDepartmentAuditLogs: (department: string, limit?: number, offset?: number) => Promise<{ list: AuditLog[]; total: number; limit: number; offset: number }>
}

export const useAppStore = create<AppState>((set, get) => ({
  stats: null,
  meetings: [],
  meetingsTotal: 0,
  tasks: [],
  tasksTotal: 0,
  overdueTasks: [],
  thisWeekTasks: [],
  departments: [],
  departmentList: [],
  departmentTaskStats: [],
  allTaskDepartments: [],
  templates: [],
  templateVersions: [],
  calendarData: null,
  reminderGroups: null,
  meetingReviewList: [],
  meetingReviewTotal: 0,
  meetingReviewDetail: null,
  meetingReviewReport: null,
  departmentWorkbench: null,
  departmentRiskStats: [],
  departmentRiskDetail: null,
  supervisingTasks: [],
  taskViews: [],
  currentViewId: null,
  loading: false,
  error: null,

  fetchStats: async () => {
    set({ loading: true, error: null })
    try {
      const stats = await api.get<Stats>('/stats')
      set({ stats, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchMeetings: async (page = 1, pageSize = 10, search = '') => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (search) params.append('search', search)
      const result = await api.get<{ list: Meeting[]; total: number }>(`/meetings?${params}`)
      set({ meetings: result.list, meetingsTotal: result.total, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchMeetingDetail: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const meeting = await api.get<Meeting>(`/meetings/${id}`)
      set({ loading: false })
      return meeting
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      return null
    }
  },

  createMeeting: async (data: CreateMeetingRequest) => {
    set({ loading: true, error: null })
    try {
      const meeting = await api.post<Meeting>('/meetings', data)
      set({ loading: false })
      return meeting
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchTasks: async (department = 'all', status = 'all', page = 1, pageSize = 20, risk = '', filter?) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams({
        department,
        status,
        page: String(page),
        pageSize: String(pageSize),
      })
      if (risk) {
        params.set('risk', risk)
      }
      if (filter) {
        if (filter.department && filter.department !== 'all') {
          params.set('department', filter.department)
        }
        if (filter.status && filter.status !== 'all') {
          params.set('status', filter.status)
        }
        if (filter.search) {
          params.set('search', filter.search)
        }
        if (filter.startDate) {
          params.set('startDate', filter.startDate)
        }
        if (filter.endDate) {
          params.set('endDate', filter.endDate)
        }
        if (filter.overdueOnly) {
          params.set('overdueOnly', 'true')
        }
        if (filter.dueSoonOnly) {
          params.set('dueSoonOnly', 'true')
        }
        if (filter.supervisingOnly) {
          params.set('supervisingOnly', 'true')
        }
      }
      const result = await api.get<{ list: Task[]; total: number }>(`/tasks?${params}`)
      set({ tasks: result.list, tasksTotal: result.total, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchOverdueTasks: async () => {
    set({ loading: true, error: null })
    try {
      const tasks = await api.get<Task[]>('/tasks/overdue')
      set({ overdueTasks: tasks, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchThisWeekTasks: async () => {
    set({ loading: true, error: null })
    try {
      const tasks = await api.get<Task[]>('/tasks/this-week')
      set({ thisWeekTasks: tasks, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchCalendarTasks: async (year, month, department = 'all', filter?) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        department,
      })
      if (filter) {
        if (filter.search) {
          params.set('search', filter.search)
        }
        if (filter.supervisingOnly) {
          params.set('supervisingOnly', 'true')
        }
        if (filter.status && filter.status !== 'all') {
          params.set('status', filter.status)
        }
        if (filter.startDate) {
          params.set('startDate', filter.startDate)
        }
        if (filter.endDate) {
          params.set('endDate', filter.endDate)
        }
        if (filter.overdueOnly) {
          params.set('overdueOnly', 'true')
        }
        if (filter.dueSoonOnly) {
          params.set('dueSoonOnly', 'true')
        }
      }
      const data = await api.get<CalendarMonthData>(`/tasks/calendar?${params}`)
      set({ calendarData: data, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchDepartments: async () => {
    try {
      const deptList = await api.get<Department[]>('/departments/active')
      const departments = deptList.map((d) => d.name)
      set({ departments })
    } catch (error) {
      set({ error: getErrorMessage(error) })
    }
  },

  fetchAllDepartments: async () => {
    set({ loading: true, error: null })
    try {
      const deptList = await api.get<Department[]>('/departments')
      const departments = deptList.filter((d) => d.isActive).map((d) => d.name)
      set({ departmentList: deptList, departments, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchDepartmentTaskStats: async () => {
    try {
      const stats = await api.get<DepartmentStats[]>('/departments/stats/tasks')
      const allTaskDepartments = stats.map((s) => s.department)
      set({ departmentTaskStats: stats, allTaskDepartments })
    } catch (error) {
      set({ error: getErrorMessage(error) })
    }
  },

  fetchDepartmentRiskStats: async () => {
    try {
      const stats = await api.get<DepartmentRiskStats[]>('/departments/stats/risk')
      set({ departmentRiskStats: stats })
    } catch (error) {
      set({ error: getErrorMessage(error) })
    }
  },

  fetchDepartmentRiskDetail: async (department: string) => {
    set({ loading: true, error: null })
    try {
      const detail = await api.get<DepartmentRiskDetail>(`/tasks/risk/${encodeURIComponent(department)}`)
      set({ departmentRiskDetail: detail, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  createDepartment: async (data: CreateDepartmentRequest) => {
    set({ loading: true, error: null })
    try {
      const dept = await api.post<Department>('/departments', data)
      set((state) => {
        const newList = [...state.departmentList, dept].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
        )
        const newDeptNames = newList.filter((d) => d.isActive).map((d) => d.name)
        return { departmentList: newList, departments: newDeptNames, loading: false }
      })
      return dept
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateDepartment: async (id: number, data: UpdateDepartmentRequest) => {
    set({ loading: true, error: null })
    try {
      const dept = await api.put<Department>(`/departments/${id}`, data)
      set((state) => {
        const newList = state.departmentList
          .map((d) => (d.id === id ? dept : d))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        const newDeptNames = newList.filter((d) => d.isActive).map((d) => d.name)
        return { departmentList: newList, departments: newDeptNames, loading: false }
      })
      return dept
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  toggleDepartmentStatus: async (id: number) => {
    try {
      const dept = await api.patch<Department>(`/departments/${id}/toggle`, {})
      set((state) => {
        const newList = state.departmentList
          .map((d) => (d.id === id ? dept : d))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        const newDeptNames = newList.filter((d) => d.isActive).map((d) => d.name)
        return { departmentList: newList, departments: newDeptNames }
      })
      return dept
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  deleteDepartment: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/departments/${id}`)
      set((state) => {
        const newList = state.departmentList.filter((d) => d.id !== id)
        const newDeptNames = newList.filter((d) => d.isActive).map((d) => d.name)
        return { departmentList: newList, departments: newDeptNames, loading: false }
      })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateTask: async (id: number, data: UpdateTaskRequest) => {
    set({ loading: true, error: null })
    try {
      const task = await api.patch<Task>(`/tasks/${id}`, data)
      set({ loading: false })
      return task
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  batchUpdateTasks: async (updates: BatchUpdateTaskRequest) => {
    set({ loading: true, error: null })
    try {
      const result = await api.patch<BatchUpdateTaskResponse>('/tasks/batch/update', updates)
      set({ loading: false })

      if (result.successCount > 0) {
        const {
          fetchStats,
          fetchOverdueTasks,
          fetchThisWeekTasks,
          fetchDepartmentTaskStats,
          fetchDepartmentRiskStats,
          fetchTasks,
          fetchDepartmentWorkbench,
          fetchDepartmentRiskDetail,
          fetchReminders,
          fetchSupervisingTasks,
          departmentWorkbench,
          departmentRiskDetail,
          tasks,
        } = get()

        fetchStats()
        fetchOverdueTasks()
        fetchThisWeekTasks()
        fetchDepartmentTaskStats()
        fetchDepartmentRiskStats()
        fetchReminders()
        fetchSupervisingTasks()

        if (tasks.length > 0) {
          fetchTasks('all', 'all', 1, 50)
        }

        if (departmentWorkbench) {
          fetchDepartmentWorkbench(departmentWorkbench.department)
        }

        if (departmentRiskDetail) {
          fetchDepartmentRiskDetail(departmentRiskDetail.department)
        }
      }

      return result
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchDepartmentWorkbench: async (department: string) => {
    set({ loading: true, error: null })
    try {
      const data = await api.get<DepartmentWorkbenchData>(`/tasks/workbench/${encodeURIComponent(department)}`)
      set({ departmentWorkbench: data, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchTaskProgress: async (taskId: number) => {
    try {
      const progressList = await api.get<TaskProgress[]>(`/tasks/${taskId}/progress`)
      return progressList
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  fetchTaskSupervisions: async (taskId: number) => {
    try {
      const supervisions = await api.get<TaskSupervision[]>(`/supervisions/task/${taskId}`)
      return supervisions
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  createSupervision: async (data: CreateSupervisionRequest) => {
    set({ loading: true, error: null })
    try {
      const supervision = await api.post<TaskSupervision>('/supervisions', data)
      set({ loading: false })
      const { fetchSupervisingTasks } = get()
      fetchSupervisingTasks()
      return supervision
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  closeSupervision: async (id: number, sourcePage?: string) => {
    set({ loading: true, error: null })
    try {
      const supervision = await api.patch<TaskSupervision>(`/supervisions/${id}/close`, { sourcePage })
      set({ loading: false })
      const { fetchSupervisingTasks } = get()
      fetchSupervisingTasks()
      return supervision
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchSupervisionFollowUps: async (supervisionId: number) => {
    try {
      const followUps = await api.get<SupervisionFollowUp[]>(`/supervisions/${supervisionId}/follow-ups`)
      return followUps
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  addSupervisionFollowUp: async (supervisionId: number, data: CreateSupervisionFollowUpRequest) => {
    set({ loading: true, error: null })
    try {
      const followUp = await api.post<SupervisionFollowUp>(`/supervisions/${supervisionId}/follow-ups`, data)
      set({ loading: false })
      const { fetchSupervisingTasks } = get()
      fetchSupervisingTasks()
      return followUp
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchSupervisingTasks: async () => {
    set({ loading: true, error: null })
    try {
      const tasks = await api.get<Task[]>('/supervisions/active')
      set({ supervisingTasks: tasks, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchTemplates: async () => {
    set({ loading: true, error: null })
    try {
      const templates = await api.get<MeetingTemplate[]>('/templates')
      set({ templates, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchTemplateDetail: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const template = await api.get<MeetingTemplate>(`/templates/${id}`)
      set({ loading: false })
      return template
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      return null
    }
  },

  createTemplate: async (data: CreateTemplateRequest) => {
    set({ loading: true, error: null })
    try {
      const template = await api.post<MeetingTemplate>('/templates', data)
      set({ loading: false })
      return template
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  deleteTemplate: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/templates/${id}`)
      set({ loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateTemplate: async (id: number, data: UpdateTemplateRequest) => {
    set({ loading: true, error: null })
    try {
      const template = await api.put<MeetingTemplate>(`/templates/${id}`, data)
      set({ loading: false })
      return template
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchTemplateVersions: async (templateId: number) => {
    set({ loading: true, error: null })
    try {
      const versions = await api.get<TemplateVersion[]>(`/templates/${templateId}/versions`)
      set({ templateVersions: versions, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchTemplateVersionDetail: async (templateId: number, versionId: number) => {
    set({ loading: true, error: null })
    try {
      const version = await api.get<TemplateVersion>(`/templates/${templateId}/versions/${versionId}`)
      set({ loading: false })
      return version
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      return null
    }
  },

  restoreTemplateVersion: async (templateId: number, versionId: number) => {
    set({ loading: true, error: null })
    try {
      const template = await api.post<MeetingTemplate>(`/templates/${templateId}/versions/${versionId}/restore`, {})
      set({ loading: false })
      return template
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchReminders: async () => {
    set({ loading: true, error: null })
    try {
      const groups = await api.get<ReminderGroups>('/reminders')
      set({ reminderGroups: groups, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchMeetingReviewStats: async (page = 1, pageSize = 10, filter?) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (filter?.startDate) params.append('startDate', filter.startDate)
      if (filter?.endDate) params.append('endDate', filter.endDate)
      if (filter?.department) params.append('department', filter.department)
      if (filter?.status) params.append('status', filter.status)
      if (filter?.overdueOnly) params.append('overdueOnly', 'true')
      if (filter?.supervisingOnly) params.append('supervisingOnly', 'true')
      if (filter?.search) params.append('search', filter.search)
      const result = await api.get<{ list: MeetingReviewStats[]; total: number }>(
        `/meetings/review/stats?${params}`
      )
      set({ meetingReviewList: result.list, meetingReviewTotal: result.total, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  fetchMeetingReviewDetail: async (meetingId: number) => {
    set({ loading: true, error: null })
    try {
      const detail = await api.get<MeetingReviewDetail>(`/meetings/review/detail/${meetingId}`)
      set({ meetingReviewDetail: detail, loading: false })
      return detail
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      return null
    }
  },

  fetchMeetingReviewReport: async (filter?) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filter?.startDate) params.append('startDate', filter.startDate)
      if (filter?.endDate) params.append('endDate', filter.endDate)
      if (filter?.department) params.append('department', filter.department)
      if (filter?.status) params.append('status', filter.status)
      if (filter?.overdueOnly) params.append('overdueOnly', 'true')
      if (filter?.supervisingOnly) params.append('supervisingOnly', 'true')
      const report = await api.get<MeetingReviewReport>(
        `/meetings/review/report?${params.toString() ? params.toString() : ''}`
      )
      set({ meetingReviewReport: report, loading: false })
      return report
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      return null
    }
  },

  parseMeetingText: async (text: string) => {
    set({ loading: true, error: null })
    try {
      const result = await api.post<ParseMeetingResponse>('/meetings/parse', { text })
      set({ loading: false })
      return result
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  checkDuplicates: async (meetings) => {
    set({ loading: true, error: null })
    try {
      const result = await api.post<DuplicateCheckResponse>('/meetings/check-duplicates', { meetings })
      set({ loading: false })
      return result
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  appendTasksToMeeting: async (meetingId, tasks) => {
    set({ loading: true, error: null })
    try {
      const result = await api.post<{ meetingId: number; tasks: Task[] }>(
        `/meetings/${meetingId}/append-tasks`,
        { tasks }
      )
      set({ loading: false })
      return result.tasks
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  batchImportMeetings: async (request) => {
    set({ loading: true, error: null })
    try {
      const result = await api.post<BatchImportResponse>('/meetings/batch-import', request)
      set({ loading: false })
      const { fetchMeetings, fetchStats } = get()
      fetchMeetings(1, 10)
      fetchStats()
      return result
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  fetchTaskViews: async () => {
    set({ loading: true, error: null })
    try {
      const views = await api.get<TaskView[]>('/views')
      set({ taskViews: views, loading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
    }
  },

  createTaskView: async (data) => {
    set({ loading: true, error: null })
    try {
      const view = await api.post<TaskView>('/views', data)
      set((state) => {
        const newViews = [...state.taskViews, view].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
        )
        return { taskViews: newViews, loading: false }
      })
      return view
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  updateTaskView: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const view = await api.put<TaskView>(`/views/${id}`, data)
      set((state) => {
        const newViews = state.taskViews
          .map((v) => (v.id === id ? view : v))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        return { taskViews: newViews, loading: false }
      })
      return view
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  deleteTaskView: async (id) => {
    set({ loading: true, error: null })
    try {
      await api.delete(`/views/${id}`)
      set((state) => {
        const newViews = state.taskViews.filter((v) => v.id !== id)
        const newCurrentViewId = state.currentViewId === id ? null : state.currentViewId
        return { taskViews: newViews, currentViewId: newCurrentViewId, loading: false }
      })
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  reorderTaskViews: async (orders) => {
    set({ loading: true, error: null })
    try {
      await api.post('/views/reorder', { orders })
      set({ loading: false })
      const { fetchTaskViews } = get()
      fetchTaskViews()
    } catch (error) {
      set({ error: getErrorMessage(error), loading: false })
      throw error
    }
  },

  validateTaskView: async (id) => {
    try {
      const result = await api.get<TaskViewValidationResult>(`/views/${id}/validate`)
      return result
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  setCurrentViewId: (id) => {
    set({ currentViewId: id })
  },

  fetchTaskAuditLogs: async (taskId) => {
    try {
      const res = await api.get<AuditLog[]>(`/audit-logs/task/${taskId}`)
      return res
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  fetchMeetingAuditLogs: async (meetingId) => {
    try {
      const res = await api.get<AuditLog[]>(`/audit-logs/meeting/${meetingId}`)
      return res
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },

  fetchDepartmentAuditLogs: async (department, limit = 50, offset = 0) => {
    try {
      const res = await api.get<{ list: AuditLog[]; total: number; limit: number; offset: number }>(
        `/audit-logs/department/${encodeURIComponent(department)}?limit=${limit}&offset=${offset}`
      )
      return res
    } catch (error) {
      set({ error: getErrorMessage(error) })
      throw error
    }
  },
}))
