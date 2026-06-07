import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MeetingList from './pages/MeetingList'
import MeetingNew from './pages/MeetingNew'
import MeetingDetail from './pages/MeetingDetail'
import MeetingPrint from './pages/MeetingPrint'
import MeetingReview from './pages/MeetingReview'
import MeetingReviewReport from './pages/MeetingReviewReport'
import MeetingImport from './pages/MeetingImport'
import MeetingImportPreview from './pages/MeetingImportPreview'
import TaskList from './pages/TaskList'
import TaskCalendar from './pages/TaskCalendar'
import TemplateList from './pages/TemplateList'
import DepartmentList from './pages/DepartmentList'
import DepartmentWorkbench from './pages/DepartmentWorkbench'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/meetings/:id/print" element={<MeetingPrint />} />
        <Route path="/review/report" element={<MeetingReviewReport />} />
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/meetings" element={<MeetingList />} />
                <Route path="/meetings/new" element={<MeetingNew />} />
                <Route path="/meetings/import" element={<MeetingImport />} />
                <Route path="/meetings/import/preview" element={<MeetingImportPreview />} />
                <Route path="/meetings/:id" element={<MeetingDetail />} />
                <Route path="/review" element={<MeetingReview />} />
                <Route path="/tasks" element={<TaskList />} />
                <Route path="/workbench" element={<DepartmentWorkbench />} />
                <Route path="/calendar" element={<TaskCalendar />} />
                <Route path="/templates" element={<TemplateList />} />
                <Route path="/departments" element={<DepartmentList />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </Router>
  )
}
