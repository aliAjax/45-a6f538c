import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MeetingList from './pages/MeetingList'
import MeetingNew from './pages/MeetingNew'
import MeetingDetail from './pages/MeetingDetail'
import TaskList from './pages/TaskList'
import TemplateList from './pages/TemplateList'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/meetings" element={<MeetingList />} />
          <Route path="/meetings/new" element={<MeetingNew />} />
          <Route path="/meetings/:id" element={<MeetingDetail />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/templates" element={<TemplateList />} />
        </Routes>
      </Layout>
    </Router>
  )
}
