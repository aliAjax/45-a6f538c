import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import {
  createDatabaseInstance,
  setActiveDatabase,
  restoreDefaultDatabase,
  getDefaultDbPath,
  ensureDataDir,
} from '../api/db.js'

describe('数据库隔离性验证', () => {
  const testDbPath1 = path.join(os.tmpdir(), `isolation-test-1-${Date.now()}.db`)
  const testDbPath2 = path.join(os.tmpdir(), `isolation-test-2-${Date.now()}.db`)

  beforeAll(() => {
    ensureDataDir()
  })

  afterAll(() => {
    restoreDefaultDatabase()
    ;[testDbPath1, testDbPath2].forEach((p) => {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p)
        } catch {
          // ignore
        }
      }
    })
  })

  it('真实数据库在测试过程中数据量不变', () => {
    const defaultPath = getDefaultDbPath()
    expect(fs.existsSync(defaultPath)).toBe(true)

    const dbBefore = new Database(defaultPath)
    const beforeCount = (dbBefore.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count
    dbBefore.close()

    const testInstance = createDatabaseInstance(testDbPath1, { seed: false })
    setActiveDatabase(testInstance)

    testInstance.db
      .prepare(`INSERT INTO meetings (title, departments, meeting_date) VALUES (?, ?, ?)`)
      .run('隔离测试会议', '测试部门', '2025-01-01')

    testInstance.db
      .prepare(`INSERT INTO tasks (meeting_id, content, department, deadline) VALUES (?, ?, ?, ?)`)
      .run(1, '隔离测试任务', '测试部门', '2025-02-01')

    restoreDefaultDatabase()
    testInstance.db.close()

    const dbAfter = new Database(defaultPath)
    const afterCount = (dbAfter.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count
    dbAfter.close()

    expect(afterCount).toBe(beforeCount)
  })

  it('测试数据库独立存在且可正常操作', () => {
    const testInstance = createDatabaseInstance(testDbPath2, { seed: false })
    setActiveDatabase(testInstance)

    testInstance.db
      .prepare(`INSERT INTO meetings (title, departments, meeting_date) VALUES (?, ?, ?)`)
      .run('独立测试会议', '独立部门', '2025-03-01')

    const count = testInstance.db.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }
    expect(count.count).toBe(1)

    const taskCount = testInstance.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
    expect(taskCount.count).toBe(0)

    restoreDefaultDatabase()
    testInstance.db.close()

    expect(fs.existsSync(testDbPath2)).toBe(true)
  })

  it('不同测试数据库之间互不影响', () => {
    const dbPathA = path.join(os.tmpdir(), `isolation-a-${Date.now()}.db`)
    const dbPathB = path.join(os.tmpdir(), `isolation-b-${Date.now()}.db`)

    try {
      const instanceA = createDatabaseInstance(dbPathA, { seed: false })
      const instanceB = createDatabaseInstance(dbPathB, { seed: false })

      instanceA.db
        .prepare(`INSERT INTO meetings (title, departments, meeting_date) VALUES (?, ?, ?)`)
        .run('A会议', 'A部门', '2025-01-01')

      instanceB.db
        .prepare(`INSERT INTO meetings (title, departments, meeting_date) VALUES (?, ?, ?)`)
        .run('B会议', 'B部门', '2025-01-01')
      instanceB.db
        .prepare(`INSERT INTO meetings (title, departments, meeting_date) VALUES (?, ?, ?)`)
        .run('B会议2', 'B部门', '2025-01-02')

      const countA = instanceA.db.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }
      const countB = instanceB.db.prepare('SELECT COUNT(*) as count FROM meetings').get() as { count: number }

      expect(countA.count).toBe(1)
      expect(countB.count).toBe(2)

      instanceA.db.close()
      instanceB.db.close()
    } finally {
      ;[dbPathA, dbPathB].forEach((p) => {
        if (fs.existsSync(p)) {
          try {
            fs.unlinkSync(p)
          } catch {
            // ignore
          }
        }
      })
    }
  })
})
