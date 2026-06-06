import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT department 
      FROM tasks 
      ORDER BY department ASC
    `).all() as { department: string }[]

    const departments = rows.map(row => row.department)

    res.json({ success: true, data: departments })
  } catch (error) {
    console.error('Get departments error:', error)
    res.status(500).json({ success: false, error: '获取科室列表失败' })
  }
})

export default router
