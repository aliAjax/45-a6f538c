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
  hasActiveSupervision?: boolean
  activeSupervision?: TaskSupervision | null
}

export interface TaskSupervision {
  id: number
  taskId: number
  note: string
  nextFollowUpDate: string | null
  status: 'active' | 'closed'
  closedAt: string | null
  createdAt: string
  updatedAt: string
  latestFollowUp?: SupervisionFollowUp | null
  followUpCount?: number
}

export interface SupervisionFollowUp {
  id: number
  supervisionId: number
  content: string
  nextFollowUpDate: string | null
  createdAt: string
}

export interface CreateSupervisionRequest {
  taskId: number
  note: string
  nextFollowUpDate?: string
}

export interface CloseSupervisionRequest {
  note?: string
}

export interface CreateSupervisionFollowUpRequest {
  content: string
  nextFollowUpDate?: string
}

export interface TaskProgress {
  id: number
  taskId: number
  status: 'pending' | 'in_progress' | 'completed'
  progress: string
  createdAt: string
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

export type RiskLevel = 'high' | 'medium' | 'low'

export interface DepartmentRiskStats {
  department: string
  isActive: boolean
  total: number
  completed: number
  completionRate: number
  overdueCount: number
  maxOverdueDays: number
  avgOverdueDays: number
  dueSoonCount: number
  supervisingCount: number
  longNoUpdateCount: number
  riskLevel: RiskLevel
  riskScore: number
  riskFactors: string[]
}

export interface DepartmentRiskDetail {
  department: string
  stats: DepartmentRiskStats
  overdueTasks: Task[]
  dueSoonTasks: Task[]
  supervisingTasks: Task[]
  longNoUpdateTasks: Task[]
  riskTasks: Task[]
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

export interface ReminderGroups {
  overdue: Task[]
  today: Task[]
  nextThreeDays: Task[]
}

export interface MeetingReviewStats {
  meetingId: number
  meetingTitle: string
  meetingDate: string
  departments: string
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  inProgressTasks: number
  overdueTasks: number
  completionRate: number
}

export interface ParsedTask {
  content: string
  department: string
  deadline: string
}

export interface ParsedMeeting {
  title: string
  departments: string
  meetingDate: string
  tasks: ParsedTask[]
  warnings: string[]
}

export interface ParseMeetingRequest {
  text: string
}

export interface ParseMeetingResponse {
  meetings: ParsedMeeting[]
  warnings: string[]
}

export interface BatchUpdateTaskItem {
  id: number
  status?: 'pending' | 'in_progress' | 'completed'
  progress?: string
}

export interface BatchUpdateTaskRequest {
  updates: BatchUpdateTaskItem[]
}

export interface BatchUpdateTaskResult {
  id: number
  success: boolean
  task?: Task
  error?: string
}

export interface BatchUpdateTaskResponse {
  total: number
  successCount: number
  failCount: number
  results: BatchUpdateTaskResult[]
}

export interface DepartmentWorkbenchData {
  department: string
  pending: Task[]
  overdue: Task[]
  dueThisWeek: Task[]
  completed: Task[]
  stats: {
    total: number
    pending: number
    overdue: number
    dueThisWeek: number
    completed: number
  }
}

export type DuplicateAction = 'create' | 'skip' | 'append'

export interface DuplicateTaskMatch {
  taskId: number
  content: string
  department: string
  deadline: string
  similarity: number
}

export interface DuplicateMeetingMatch {
  meetingId: number
  title: string
  meetingDate: string
  departments: string
  taskCount: number
  titleSimilarity: number
  dateMatch: boolean
  deptOverlap: number
  matchingTasks: DuplicateTaskMatch[]
}

export interface DuplicateCheckItem {
  index: number
  title: string
  meetingDate: string
  departments: string
  tasks: ParsedTask[]
  suspectedDuplicates: DuplicateMeetingMatch[]
  hasDuplicate: boolean
}

export interface DuplicateCheckRequest {
  meetings: Array<{
    title: string
    meetingDate: string
    departments: string
    tasks: ParsedTask[]
  }>
}

export interface DuplicateCheckResponse {
  results: DuplicateCheckItem[]
}

export interface AppendTasksRequest {
  tasks: Array<{
    content: string
    department: string
    deadline: string
  }>
}

export interface ImportMeetingDecision {
  action: DuplicateAction
  targetMeetingId?: number
}

export interface BatchImportRequest {
  items: Array<{
    meeting: {
      title: string
      departments: string
      meetingDate: string
      tasks: ParsedTask[]
    }
    decision: ImportMeetingDecision
  }>
}

export interface BatchImportResultItem {
  success: boolean
  action: DuplicateAction
  title: string
  meetingId?: number
  error?: string
}

export interface BatchImportResponse {
  total: number
  successCount: number
  failCount: number
  results: BatchImportResultItem[]
}
