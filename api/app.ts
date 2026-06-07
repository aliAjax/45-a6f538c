/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type ErrorRequestHandler,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import meetingsRoutes from './routes/meetings.js'
import tasksRoutes from './routes/tasks.js'
import statsRoutes from './routes/stats.js'
import departmentsRoutes from './routes/departments.js'
import templatesRoutes from './routes/templates.js'
import remindersRoutes from './routes/reminders.js'
import supervisionsRoutes from './routes/supervisions.js'
import './db.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/meetings', meetingsRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/departments', departmentsRoutes)
app.use('/api/templates', templatesRoutes)
app.use('/api/reminders', remindersRoutes)
app.use('/api/supervisions', supervisionsRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
}
app.use(errorHandler)

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
