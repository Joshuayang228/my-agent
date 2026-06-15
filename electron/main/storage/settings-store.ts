import { getDatabase, persist } from './database'
import { createLogger } from '../utils/logger'

const log = createLogger('SettingsStore')

export interface AppSettings {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  systemPrompt: string
  personaId: string
  /** JSON string — McpServerConfig[] */
  mcpServers: string
}

const DEFAULTS: AppSettings = {
  llmApiKey: '',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModel: 'gpt-4o',
  systemPrompt: '',
  personaId: 'warm-partner',
  mcpServers: '[]',
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
    return row.value as AppSettings[K]
  }

  stmt.free()
  return DEFAULTS[key]
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

  if (exists) {
    db.run('UPDATE settings SET value = ? WHERE key = ?', [String(value), key])
  } else {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)])
  }

  persist()
  log.info(`Setting updated: ${key}`)
}

export async function getAllSettings(): Promise<AppSettings> {
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT key, value FROM settings')

  const result = { ...DEFAULTS }
  while (stmt.step()) {
    const row = stmt.getAsObject() as { key: string; value: string }
    if (row.key in result) {
      (result as Record<string, string>)[row.key] = row.value
    }
  }
  stmt.free()
  return result
}
