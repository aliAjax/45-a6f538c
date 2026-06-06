import { create } from 'zustand'
import type {
  Meeting,
  Task,
  Stats,
  CreateMeetingRequest,
  UpdateTaskRequest,
  MeetingTemplate,
  CreateTemplateRequest,
  Department,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
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
  templates: MeetingTemplate[]
  loading: boolean
  error: string | null

  fetchStats: () => Promise<void>
  fetchMeetings: (page?: number, pageSize?: number, search?: string) => Promise<void>
  fetchMeetingDetail: (id: number) => Promise<Meeting | null>
  createMeeting: (data: CreateMeetingRequest) => Promise<Meeting>
  fetchTasks: (department?: string, status?: string, page?: number, pageSize?: number) => Promise<void>
  fetchOverdueTasks: () => Promise<void>
  fetchThisWeekTasks: () => Promise<void>
  fetchDepartments: () => Promise<void>
  fetchAllDepartments: () => Promise<void>
  createDepartment: (data: CreateDepartmentRequest) => Promise<Department>
  updateDepartment: (id: number, data: UpdateDepartmentRequest) => Promise<Department>
  toggleDepartmentStatus: (id: number) => Promise<Department>
  deleteDepartment: (id: number) => Promise<void>
  updateTask: (id: number, data: UpdateTaskRequest) => Promise<Task>
  fetchTemplates: () => Promise<void>
  fetchTemplateDetail: (id: number) => Promise<MeetingTemplate | null>
  createTemplate: (data: CreateTemplateRequest) => Promise<MeetingTemplate>
  deleteTemplate: (id: number) => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  stats: null,
  meetings: [],
  meetingsTotal: 0,
  tasks: [],
  tasksTotal: 0,
  overdueTasks: [],
  thisWeekTasks: [],
  departments: [],
  departmentList: [],
  templates: [],
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

  fetchTasks: async (department = 'all', status = 'all', page = 1, pageSize = 20) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams({
        department,
        status,
        page: String(page),
        pageSize: String(pageSize),
      })
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
      const dept = await api.patch<Department>(`/departments/${id}/toggle`)
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
}))
