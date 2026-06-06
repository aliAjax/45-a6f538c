export interface Meeting {
  id: number
  title: string
  departments: string
  meetingDate: string
  createdAt: string
  updatedAt: string
  tasks?: Task[]
}

export interface Task {
  id: number
  meetingId: number
  content: string
  department: string
  deadline: string
  status: 'pending' | 'in_progress' | 'completed'
  progress: string
  createdAt: string
  updatedAt: string
  meetingTitle?: string
}

export interface Stats {
  totalMeetings: number
  totalTasks: number
  overdueTasks: number
  dueThisWeekTasks: number
  completedTasks: number
}

export interface CreateMeetingRequest {
  title: string
  departments: string
  meetingDate: string
  tasks: Array<{
    content: string
    department: string
    deadline: string
  }>
}

export interface UpdateTaskRequest {
  status?: 'pending' | 'in_progress' | 'completed'
  progress?: string
}

export interface MeetingTemplate {
  id: number
  name: string
  title: string
  departments: string
  createdAt: string
  updatedAt: string
  tasks?: TemplateTask[]
  taskCount?: number
}

export interface TemplateTask {
  id: number
  templateId: number
  content: string
  department: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateTemplateRequest {
  name: string
  title: string
  departments: string
  tasks: Array<{
    content: string
    department: string
  }>
}

export interface Department {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateDepartmentRequest {
  name: string
  sortOrder?: number
}

export interface UpdateDepartmentRequest {
  name?: string
  sortOrder?: number
  isActive?: boolean
}

export interface DepartmentStats {
  department: string
  total: number
  pending: number
  inProgress: number
  completed: number
  overdue: number
}

export interface CalendarDayTasks {
  date: string
  tasks: Task[]
}

export interface CalendarMonthData {
  year: number
  month: number
  days: CalendarDayTasks[]
}
