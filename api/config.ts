import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const defaultLocalDbPath = path.join(projectRoot, 'data', 'meeting.db')

export interface RuntimeConfig {
  apiPort: number
  apiBase: string
  databasePath: string
  seedData: boolean
  nodeEnv: string
  vercelEnv: string
  isVercel: boolean
  isProductionLike: boolean
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function normalizeApiBase(value: string | undefined): string {
  const base = value?.trim() || '/api'
  if (base === '/') {
    return ''
  }
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function resolveProjectPath(value: string | undefined): string {
  if (!value || value.trim() === '') {
    return defaultLocalDbPath
  }

  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value)
}

function isInsideProjectData(dbPath: string): boolean {
  const dataDir = path.join(projectRoot, 'data')
  const relative = path.relative(dataDir, dbPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function getConfig(): RuntimeConfig {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const vercelEnv = process.env.VERCEL_ENV || ''
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true'
  const isProductionLike =
    nodeEnv === 'production' || vercelEnv === 'production' || vercelEnv === 'preview'
  const portText = process.env.API_PORT || process.env.PORT || '3001'
  const apiPort = Number.parseInt(portText, 10)

  return {
    apiPort: Number.isFinite(apiPort) ? apiPort : 3001,
    apiBase: normalizeApiBase(process.env.VITE_API_BASE),
    databasePath: resolveProjectPath(process.env.DATABASE_PATH || process.env.SQLITE_DB_PATH),
    seedData: readBoolean(process.env.SEED_DATA, !isProductionLike),
    nodeEnv,
    vercelEnv,
    isVercel,
    isProductionLike: isProductionLike || isVercel,
  }
}

export function assertRuntimeConfig(config: RuntimeConfig = getConfig()): void {
  if (config.apiPort < 1 || config.apiPort > 65535) {
    throw new Error(`Invalid API port: ${config.apiPort}`)
  }

  if (config.isProductionLike && isInsideProjectData(config.databasePath)) {
    throw new Error(
      'Production or Vercel preview environments must not use the local data/meeting.db SQLite path. Set DATABASE_PATH to a persistent external path or disable the API deployment.',
    )
  }

  if (config.isProductionLike && config.seedData) {
    throw new Error('SEED_DATA must be false in production or Vercel preview environments.')
  }
}

export function printConfigSummary(config: RuntimeConfig = getConfig()): void {
  console.log('[env] API_PORT=%s', config.apiPort)
  console.log('[env] VITE_API_BASE=%s', config.apiBase || '/')
  console.log('[env] DATABASE_PATH=%s', config.databasePath)
  console.log('[env] SEED_DATA=%s', config.seedData)
  console.log('[env] NODE_ENV=%s', config.nodeEnv)
  console.log('[env] VERCEL_ENV=%s', config.vercelEnv || '-')
  console.log('[env] VERCEL=%s', config.isVercel ? 'true' : 'false')
}
