import { getDatabase, persist } from './database'
import { ensureTable } from './settings-store'

const KEY = 'skillDisabledNames'

/**
 * 背景：启停是用户本机状态，不应修改内置 SKILL.md 或生产资产指纹。
 * 设计意图：复用 settings 表存储独立键，不引入第二套数据库或旧数据迁移。
 * 关键约束：损坏状态拒绝加载；不能把解析失败解释为全部启用。
 */
export async function loadDisabledSkills(): Promise<Set<string>> {
  await ensureTable()
  const db = await getDatabase()
  const value = db.exec('SELECT value FROM settings WHERE key = ?', [KEY])[0]?.values[0]?.[0]
  if (value === undefined) return new Set()
  const parsed: unknown = JSON.parse(String(value))
  if (!Array.isArray(parsed) || parsed.length > 10000 || parsed.some((name) => typeof name !== 'string' || name.length > 64)) {
    throw new Error('Skill 启停状态无效，请检查本机数据。')
  }
  return new Set(parsed)
}

/**
 * 背景：磁盘写入失败时内存数据库不能留下“已停用”的假状态。
 * 设计意图：同一同步段更新并持久化，失败恢复旧值，调用方仅在成功后发布运行态。
 * 关键约束：参数由 Skill registry 串行提交；SQL 参数化且恢复不跨 await。
 */
export async function saveDisabledSkills(names: ReadonlySet<string>): Promise<void> {
  await ensureTable()
  const db = await getDatabase()
  const previous = db.exec('SELECT value FROM settings WHERE key = ?', [KEY])[0]?.values[0]?.[0]
  try {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [KEY, JSON.stringify([...names])])
    persist()
  } catch (error) {
    if (previous === undefined) db.run('DELETE FROM settings WHERE key = ?', [KEY])
    else db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [KEY, previous])
    throw error
  }
}
