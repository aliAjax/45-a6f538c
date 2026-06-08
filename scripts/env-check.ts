import { assertRuntimeConfig, getConfig, printConfigSummary } from '../api/config.js'

try {
  const config = getConfig()
  assertRuntimeConfig(config)
  printConfigSummary(config)
  console.log('[env] configuration check passed')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[env] configuration check failed: ${message}`)
  process.exit(1)
}
