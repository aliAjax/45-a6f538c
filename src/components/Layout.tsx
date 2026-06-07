import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Users,
  Bell,
  LayoutTemplate,
  Building2,
  Calendar as CalendarIcon,
  BarChart3,
  Layers,
  Settings,
} from 'lucide-react'
import { cn } from '../lib/utils'
import ReminderPanel from './ReminderPanel'
import { useAppStore } from '../store/useAppStore'

const navItems = [
  { path: '/', label: '首页概览', icon: LayoutDashboard },
  { path: '/meetings', label: '会议纪要', icon: FileText },
  { path: '/tasks', label: '待办事项', icon: CheckSquare },
  { path: '/workbench', label: '科室工作台', icon: Layers },
  { path: '/review', label: '会议复盘', icon: BarChart3 },
  { path: '/calendar', label: '任务日历', icon: CalendarIcon },
  { path: '/templates', label: '模板库', icon: LayoutTemplate },
  { path: '/departments', label: '科室管理', icon: Building2 },
  { path: '/reminder-rules', label: '提醒规则', icon: Settings },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const reminderGroups = useAppStore((state) => state.reminderGroups)
  const fetchReminders = useAppStore((state) => state.fetchReminders)

  useEffect(() => {
    fetchReminders()
  }, [fetchReminders])

  const totalReminders = reminderGroups
    ? reminderGroups.overdue.length +
      reminderGroups.today.length +
      reminderGroups.upcoming.length
    : 0

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col fixed h-full z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center shadow-lg shadow-primary-200">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-base">会议纪要系统</h1>
              <p className="text-xs text-slate-500">Meeting Minutes</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                {item.label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600" />
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">管理员</p>
                <p className="text-xs text-slate-500 truncate">admin@company.com</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-800 md:hidden">
              会议纪要系统
            </h1>
            <span className="hidden md:inline text-sm text-slate-500">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative">
              <button
                onClick={togglePanel}
                className={cn(
                  'relative p-2 rounded-lg transition-colors',
                  isPanelOpen
                    ? 'bg-primary-50 text-primary-600'
                    : 'hover:bg-slate-100 text-slate-600'
                )}
              >
                <Bell className="w-5 h-5" />
                {totalReminders > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {totalReminders > 99 ? '99+' : totalReminders}
                  </span>
                )}
              </button>
              <ReminderPanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20 px-2 py-2">
          <div className="flex items-center justify-around">
            {navItems.slice(0, 5).map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200 min-w-[60px]',
                    isActive
                      ? 'text-primary-600'
                      : 'text-slate-500'
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
