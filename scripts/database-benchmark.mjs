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
console.log(JSON.stringify({ rows, databaseBytes: bytes.byteLength, insertMs: Number(insertMs.toFixed(2)), exportMs: Number(exportMs.toFixed(2)) }, null, 2))
