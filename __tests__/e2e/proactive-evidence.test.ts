import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { toLocalDateString } from '../../electron/main/companion/life/dates'

/** 背景：IPC 发送成功不证明 React 已呈现，也不能只靠替身验证每日限次。
 * 意图：隔离 profile 运行正式构建，离线播入明确 Moment 夹具，手动驱动真实 ticker 回调。
 * 约束：bootstrap 只捕获定时回调，不改业务函数；不增加生产测试入口，不调用模型。
 */
test('真实问候呈现回执、重复 tick 与重启保留名额', async ({}, info) => {
  test.setTimeout(120_000)
  const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-proactive-evidence-'))
  const bootstrap = path.join(root, 'bootstrap.cjs')
  let mainOutput = ''
  let presentationProbe: unknown
  let checkedRoleId = ''
  const entry = pathToFileURL(path.resolve('dist-electron/index.js')).href
  await writeFile(bootstrap, `const original = global.setInterval; global.setInterval = (fn,ms,...args) => { if (ms === 300000) global.__testLifeTick=fn; return original(fn,ms,...args) }; import(${JSON.stringify(entry)});`)
  const launch = async () => {
    const launched = await electron.launch({ args: [bootstrap, `--user-data-dir=${root}`, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', VITE_DEV_SERVER_URL: '', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
    launched.process().stdout?.on('data', data => { mainOutput = (mainOutput + String(data)).slice(-24000) })
    return launched
  }
  let app: ElectronApplication | undefined
  try {
    app = await launch()
    expect(path.resolve(await app.evaluate(({ app }) => app.getPath('userData')))).toBe(path.resolve(root))
    let page = await app.firstWindow()
    await expect(page.locator('#startup-splash')).toBeHidden()
    const roleId = await page.evaluate(async () => {
      const roleId = (await window.electronAPI.companion.getActive()).id
      for (const [key, value] of Object.entries({ developerMode: 'true', activeRoleId: roleId, companionProactiveGreetingEnabled: 'true', companionMomentTipsMuted: 'false', companionMomentTipsQuietStart: '0', companionMomentTipsQuietEnd: '0' })) await window.electronAPI.settings.set(key, value)
      return roleId
    })
    expect(roleId).toBe('luffy')
    checkedRoleId = roleId
    await app.close(); app = undefined
    const dbPath = path.join(root, 'my-agent.db')
    const require = createRequire(import.meta.url)
    const SQL = await initSqlJs({ locateFile: () => path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm') })
    const db = new SQL.Database(await readFile(dbPath))
    const now = Date.now()
    const day = toLocalDateString(now)
    db.run('INSERT INTO companion_day_scripts(id,role_id,date,payload_json,created_at) VALUES (?,?,?,?,?) ON CONFLICT(role_id,date) DO UPDATE SET payload_json=excluded.payload_json', ['proactive-fixture-day', roleId, day, JSON.stringify({ date: day, theme: '隔离回执验收', slots: [] }), now])
    db.run("UPDATE companion_events SET status='cancelled' WHERE role_id=? AND status='planned'", [roleId])
    db.run("INSERT INTO companion_events(id,role_id,scheduled_at,status,type,payload_json) VALUES (?,?,?,'published','moment',?)", ['proactive-fixture-event', roleId, now - 1000, JSON.stringify({ activity: '和伙伴整理航线', location: '千里阳光号 · 共享甲板', mood: '平静' })])
    db.run("INSERT INTO companion_moments(id,role_id,event_id,published_at,text,meta_json) VALUES (?,?,?,?,?,'{}')", ['proactive-fixture-moment', roleId, 'proactive-fixture-event', now, '在千里阳光号甲板上和伙伴整理航线'])
    db.run("UPDATE settings SET value='false' WHERE key='companionProactiveGreetingEnabled'")
    db.run('DELETE FROM companion_greeting_days WHERE role_id=?', [roleId])
    db.run('DELETE FROM companion_greeting_evidence WHERE role_id=?', [roleId])
    await writeFile(dbPath, Buffer.from(db.export())); db.close()

    app = await launch()
    page = await app.firstWindow()
    await expect(page.locator('#startup-splash')).toBeHidden()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-back').click()
    await page.evaluate(() => {
      window.electronAPI.companion.onProactiveGreeting(payload => {
        ;(window as unknown as { __testReceipt: { attemptId: string; receiptToken: string } }).__testReceipt = { attemptId: payload.attemptId, receiptToken: payload.receiptToken }
      })
    })
    const tick = async () => app!.evaluate(() => {
      const callback = (globalThis as unknown as { __testLifeTick?: () => void }).__testLifeTick
      if (!callback) throw new Error('未取得真实 ticker 回调')
      callback()
    })
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].hide() })
    await page.evaluate(() => window.electronAPI.settings.set('companionProactiveGreetingEnabled', 'true'))
    await tick()
    await expect.poll(async () => (await page.evaluate(roleId => window.electronAPI.companion.proactiveEvidenceQuery({ roleId }), roleId)).records.some(row => row.reason === 'no-window')).toBe(true)
    expect((await page.evaluate(roleId => window.electronAPI.companion.proactiveEvidenceQuery({ roleId }), roleId)).records.every(row => row.status === 'skipped')).toBe(true)
    const foreignPage = app.waitForEvent('window')
    const foreignWindow = await app.evaluate(async ({ BrowserWindow }, preloadPath) => {
      const main = BrowserWindow.getAllWindows()[0]
      const extra = new BrowserWindow({ show: true, webPreferences: { preload: preloadPath, contextIsolation: true, sandbox: true, nodeIntegration: false } })
      await extra.loadURL(main.webContents.getURL())
      main.show()
      return extra.id
    }, path.resolve('dist-electron/index.cjs'))
    const foreign = await foreignPage
    await expect.poll(() => foreign.evaluate(() => Boolean(window.electronAPI?.companion))).toBe(true)
    await foreign.evaluate(() => { (window as unknown as { __foreignReceived: number }).__foreignReceived = 0; window.electronAPI.companion.onProactiveGreeting(() => { (window as unknown as { __foreignReceived: number }).__foreignReceived++ }) })
    const mainWindow = await app.browserWindow(page)
    await mainWindow.evaluate(window => { window.show(); window.focus() })
    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible')
    await tick()
    await expect.poll(async () => {
      const result = await page.evaluate(roleId => window.electronAPI.companion.proactiveEvidenceQuery({ roleId }), roleId)
      presentationProbe = await page.evaluate(() => ({ visibility: document.visibilityState, focused: document.hasFocus(), received: Boolean((window as unknown as { __testReceipt?: unknown }).__testReceipt), statuses: [...document.querySelectorAll('[role="status"]')].map(node => ({ width: node.getBoundingClientRect().width, opacity: getComputedStyle(node).opacity, text: node.textContent?.slice(0, 100) })) }))
      return result.records.some(row => row.status === 'presented')
    }).toBe(true)
    const saved = (await page.evaluate(roleId => window.electronAPI.companion.proactiveEvidenceQuery({ roleId }), roleId)).records.find(row => row.status === 'presented')!
    expect(saved).toMatchObject({ sentCount: 1, recipientCount: 1, momentId: 'proactive-fixture-moment' })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    await page.getByTestId('dev-panel').getByRole('navigation').getByRole('button', { name: '主动消息证据', exact: true }).click()
    const reading = page.getByTestId('saved-evidence-proactive')
    await expect(reading.locator(`[data-record-id="${saved.id}"]`)).toBeVisible()
    await reading.locator(`[data-record-id="${saved.id}"] .debug-recent-title`).click()
    await expect(reading.getByRole('article', { name: '领域证据详情' })).toContainText('不证明用户看见或阅读')
    await page.screenshot({ path: info.outputPath('proactive-presented.png') })
    await reading.getByRole('button', { name: '查看来源动态', exact: true }).click()
    await expect(page.getByTestId('debug-evidence-moments').getByRole('article', { name: '领域证据详情' })).toContainText('千里阳光号甲板')
    await page.getByTestId('dev-panel').getByRole('button', { name: '返回运行证据', exact: true }).click()
    await expect(reading.getByRole('article', { name: '领域证据详情' })).toContainText('不证明用户看见或阅读')
    await reading.getByRole('button', { name: '返回全部记录', exact: true }).click()
    await expect(reading.locator(`[data-record-id="${saved.id}"]`)).toBeVisible()
    expect(await foreign.evaluate(() => (window as unknown as { __foreignReceived: number }).__foreignReceived)).toBe(0)
    expect((await foreign.evaluate(id => window.electronAPI.companion.acknowledgeProactiveGreeting({ attemptId: id, receiptToken: '11111111-1111-4111-8111-111111111111' }), saved.id)).accepted).toBe(false)
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id)?.destroy(), foreignWindow)

    const receipt = await page.evaluate(() => (window as unknown as { __testReceipt?: { attemptId: string; receiptToken: string } }).__testReceipt)
    if (receipt) expect((await page.evaluate(receipt => window.electronAPI.companion.acknowledgeProactiveGreeting(receipt), receipt)).accepted).toBe(false)
    await Promise.all([tick(), tick(), tick()])
    await expect.poll(async () => {
      const result = await page.evaluate(roleId => window.electronAPI.companion.proactiveEvidenceQuery({ roleId }), roleId)
      return result.records.some(row => row.reason === 'already-today')
    }).toBe(true)
    expect((await page.evaluate(roleId => window.electronAPI.companion.proactiveEvidenceQuery({ roleId }), roleId)).records.filter(row => row.status !== 'skipped')).toHaveLength(1)
    await app.close(); app = undefined
    app = await launch(); page = await app.firstWindow()
    await expect(page.locator('#startup-splash')).toBeHidden()
    await tick()
    const reopened = await page.evaluate(({ roleId, id }) => window.electronAPI.companion.proactiveEvidenceQuery({ roleId, recordId: id }), { roleId, id: saved.id })
    expect(reopened.records).toEqual([saved])
    const raw = JSON.stringify((await page.evaluate(roleId => window.electronAPI.companion.proactiveEvidenceQuery({ roleId }), roleId)).records)
    expect(raw).not.toContain('千里阳光号甲板')
    expect(raw).not.toContain('receiptToken')
  } finally {
    await writeFile(info.outputPath('presentation-probe.json'), JSON.stringify(presentationProbe ?? null, null, 2))
    if (app && checkedRoleId) {
      const snapshot = await (await app.firstWindow()).evaluate(async roleId => ({ visibility: document.visibilityState, evidence: await window.electronAPI.companion.proactiveEvidenceQuery({ roleId }) }), checkedRoleId).catch(() => null)
      const statePath = info.outputPath('proactive-state.json')
      await writeFile(statePath, JSON.stringify(snapshot, null, 2))
      await info.attach('proactive-state.json', { path: statePath, contentType: 'application/json' })
    }
    const logPath = info.outputPath('main-output.log')
    await writeFile(logPath, mainOutput)
    await info.attach('main-output.log', { path: logPath, contentType: 'text/plain' })
    await app?.close().catch(() => undefined)
    const resolved = path.resolve(root)
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('my-agent-proactive-evidence-')) throw new Error('拒绝清理测试目录外路径')
    await rm(resolved, { recursive: true, force: true })
  }
})
