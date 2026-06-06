import { create } from 'zustand'
import type { Meeting, Task, Stats } from '../../shared/types'
import api from '../utils/api'

interface AppState {
  stats: Stats | null
  meetings: Meeting[]
  meetingsTotal: number
  tasks: Task[]
  tasksTotal: number
  overdueTasks: Task[]
  thisWeekTasks: Task[]
  departments: string[]
  loading: boolean
  error: string | null

  fetchStats: () => Promise<void>
  fetchMeetings: (page?: number, pageSize?: number, search?: string) => Promise<void>
  fetchMeetingDetail: (id: number) => Promise<Meeting | null>
  createMeeting: (data: any) => Promise<Meeting>
  fetchTasks: (department?: string, status?: string, page?: number, pageSize?: number) => Promise<void>
  fetchOverdueTasks: () => Promise<void>
  fetchThisWeekTasks: () => Promise<void>
  fetchDepartments: () => Promise<void>
  updateTask: (id: number, data: any) => Promise<Task>
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
  loading: false,
  error: null,

  fetchStats: async () => {
    set({ loading: true, error: null })
    try {
      const stats = await api.get<Stats>('/stats')
      set({ stats, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
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
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },

  fetchMeetingDetail: async (id: number) => {
    set({ loading: true, error: null })
    try {
      const meeting = await api.get<Meeting>(`/meetings/${id}`)
      set({ loading: false })
      return meeting
    } catch (error: any) {
      set({ error: error.message, loading: false })
      return null
    }
  },

  createMeeting: async (data: any) => {
    set({ loading: true, error: null })
    try {
      const meeting = await api.post<Meeting>('/meetings', data)
      set({ loading: false })
      return meeting
    } catch (error: any) {
      set({ error: error.message, loading: false })
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
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },

  fetchOverdueTasks: async () => {
    set({ loading: true, error: null })
    try {
      const tasks = await api.get<Task[]>('/tasks/overdue')
      set({ overdueTasks: tasks, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },

  fetchThisWeekTasks: async () => {
    set({ loading: true, error: null })
    try {
      const tasks = await api.get<Task[]>('/tasks/this-week')
      set({ thisWeekTasks: tasks, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },

  fetchDepartments: async () => {
    try {
      const departments = await api.get<string[]>('/departments')
      set({ departments })
    } catch (error: any) {
      set({ error: error.message })
    }
  },

  updateTask: async (id: number, data: any) => {
    set({ loading: true, error: null })
    try {
      const task = await api.patch<Task>(`/tasks/${id}`, data)
      set({ loading: false })
      return task
    } catch (error: any) {
      set({ error: error.message, loading: false })
      throw error
    }
  },
}))
