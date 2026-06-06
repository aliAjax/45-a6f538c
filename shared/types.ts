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
