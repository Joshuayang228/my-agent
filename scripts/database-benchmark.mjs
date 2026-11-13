import initSqlJs from 'sql.js'
import { performance } from 'node:perf_hooks'

const SQL = await initSqlJs()
const db = new SQL.Database()
db.run('CREATE TABLE benchmark_events (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)')
const rows = Number(process.argv[2] ?? 1000)
const payload = JSON.stringify({ roleId: 'benchmark', content: 'x'.repeat(240) })
const insertStart = performance.now()
const statement = db.prepare('INSERT INTO benchmark_events (payload) VALUES (?)')
for (let index = 0; index < rows; index += 1) statement.run([payload])
statement.free()
const insertMs = performance.now() - insertStart
const exportStart = performance.now()
const bytes = db.export()
const exportMs = performance.now() - exportStart
const reloadStart = performance.now()
const restored = new SQL.Database(bytes)
const reloadMs = performance.now() - reloadStart
const outboxStart = performance.now()
restored.run('CREATE TABLE benchmark_outbox (id INTEGER PRIMARY KEY, status TEXT NOT NULL, created_at INTEGER NOT NULL)')
const outboxStatement = restored.prepare('INSERT INTO benchmark_outbox (status, created_at) VALUES (?, ?)')
for (let index = 0; index < rows; index += 1) outboxStatement.run([index % 2 === 0 ? 'pending' : 'delivered', index])
outboxStatement.free()
restored.exec("SELECT id FROM benchmark_outbox WHERE status = 'pending' ORDER BY created_at LIMIT 50")
const outboxBatchMs = performance.now() - outboxStart
restored.close()
console.log(JSON.stringify({ rows, databaseBytes: bytes.byteLength, insertMs: Number(insertMs.toFixed(2)), exportMs: Number(exportMs.toFixed(2)), reloadMs: Number(reloadMs.toFixed(2)), outboxBatchMs: Number(outboxBatchMs.toFixed(2)) }, null, 2))
