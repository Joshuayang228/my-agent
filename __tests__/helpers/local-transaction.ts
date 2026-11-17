import type { Database } from 'sql.js'
import { AsyncLocalStorage } from 'node:async_hooks'

const owners = new AsyncLocalStorage<Database>()
const queues = new WeakMap<Database, Promise<void>>()

/** 内存 SQLite 夹具保留真实 BEGIN / COMMIT / ROLLBACK，避免生产事务为测试退化为直接调用。 */
export async function runLocalTransaction<T>(database: Database, work: (database: Database) => Promise<T>): Promise<T> {
  if (owners.getStore() === database) return work(database)
  const previous = queues.get(database) ?? Promise.resolve()
  let release!: () => void
  queues.set(database, new Promise<void>(resolve => { release = resolve }))
  await previous
  return owners.run(database, async () => {
    database.run('BEGIN')
    try {
      const result = await work(database)
      database.run('COMMIT')
      return result
    } catch (error) {
      database.run('ROLLBACK')
      throw error
    } finally { release() }
  })
}
