import { afterEach, describe, expect, it, vi } from 'vitest'
import path from 'path'
import { assertRuntimeConfig, getConfig } from '../api/config.js'

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.API_PORT
  delete process.env.PORT
  delete process.env.VITE_API_BASE
  delete process.env.DATABASE_PATH
  delete process.env.SQLITE_DB_PATH
  delete process.env.SEED_DATA
  delete process.env.NODE_ENV
  delete process.env.VERCEL
  delete process.env.VERCEL_ENV
}

describe('运行时配置防护', () => {
  afterEach(() => {
    resetEnv()
    vi.unstubAllEnvs()
  })

  it('开发环境默认使用本地SQLite并允许示例数据', () => {
    resetEnv()

    const config = getConfig()

    expect(config.apiPort).toBe(3001)
    expect(config.apiBase).toBe('/api')
    expect(config.databasePath).toContain(path.join('data', 'meeting.db'))
    expect(config.seedData).toBe(true)
    expect(() => assertRuntimeConfig(config)).not.toThrow()
  })

  it('生产环境禁止使用项目data目录下的SQLite', () => {
    resetEnv()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('DATABASE_PATH', 'data/meeting.db')
    vi.stubEnv('SEED_DATA', 'false')

    expect(() => assertRuntimeConfig(getConfig())).toThrow(/local data\/meeting\.db SQLite path/)
  })

  it('Vercel预览环境禁止开启示例数据', () => {
    resetEnv()
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DATABASE_PATH', '/tmp/meeting.db')
    vi.stubEnv('SEED_DATA', 'true')

    expect(() => assertRuntimeConfig(getConfig())).toThrow(/SEED_DATA must be false/)
  })

  it('生产类环境允许外部数据库路径并关闭示例数据', () => {
    resetEnv()
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DATABASE_PATH', '/tmp/meeting-prod.db')
    vi.stubEnv('SEED_DATA', 'false')

    expect(() => assertRuntimeConfig(getConfig())).not.toThrow()
  })
})
