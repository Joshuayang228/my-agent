import { safeStorage } from 'electron'
import { getDatabase, persist } from './database'
import { createLogger } from '../utils/logger'

const log = createLogger('SettingsStore')

const ENCRYPTED_KEYS = new Set<keyof AppSettings>(['llmApiKey'])

function encrypt(value: string): string {
  if (!value || !safeStorage.isEncryptionAvailable()) return value
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(encoded: string): string {
  if (!encoded || !safeStorage.isEncryptionAvailable()) return encoded
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  } catch {
    return encoded
  }
}

export interface AppSettings {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmTemperature: string
  llmTopP: string
  llmMaxTokens: string
  systemPrompt: string
  personaId: string
  /** JSON string — McpServerConfig[] */
  mcpServers: string
}

function getDefaults(): AppSettings {
  return {
    llmApiKey: process.env.LLM_API_KEY || '',
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: process.env.LLM_MODEL || 'gpt-4o',
    llmTemperature: '0.7',
    llmTopP: '1',
    llmMaxTokens: '4096',
    systemPrompt: '',
    personaId: 'warm-partner',
    mcpServers: '[]',
  }
}

async function ensureTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  stmt.bind([key])

  if (stmt.step()) {
    const row = stmt.getAsObject() as { value: string }
    stmt.free()
    let val = row.value
    if (val && ENCRYPTED_KEYS.has(key)) val = decrypt(val)
    const defaults = getDefaults()
    return (val !== '' ? val : defaults[key]) as AppSettings[K]
  }

  stmt.free()
  return getDefaults()[key]
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await ensureTable()
  const db = await getDatabase()

  const existing = db.prepare('SELECT 1 FROM settings WHERE key = ?')
  existing.bind([key])
  const exists = existing.step()
  existing.free()

  let stored = String(value)
  if (ENCRYPTED_KEYS.has(key) && stored) stored = encrypt(stored)

  if (exists) {
    db.run('UPDATE settings SET value = ? WHERE key = ?', [stored, key])
  } else {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, stored])
  }

  persist()
  log.info(`Setting updated: ${key}`)
}

export async function getAllSettings(): Promise<AppSettings> {
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT key, value FROM settings')

  const result = { ...getDefaults() }
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string }
    if (row.key in result && row.value !== '') {
      let val = row.value
      if (ENCRYPTED_KEYS.has(row.key as keyof AppSettings)) val = decrypt(val)
      ;(result as Record<string, string>)[row.key] = val
    }
  }
  stmt.free()
  return result
}
