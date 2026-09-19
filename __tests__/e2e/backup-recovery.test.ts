import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

for (const phase of ['before', 'after'] as const) {
  test(`正式备份在数据库替换 ${phase} 强制退出后恢复一致状态`, async ({}, testInfo) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-backup-crash-'))
    const backupPath = path.join(root, 'backup.json')
    const bytes = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#31876d' } }).png().toBuffer()
    const id = createHash('sha256').update(bytes).digest('hex')
    const metadata = { id, mimeType: 'image/png', byteLength: bytes.length, width: 4, height: 3 }
    await writeFile(backupPath, JSON.stringify({ version: 1, exportedAt: 1,
      sessions: [{ id: 'crash-import', title: '崩溃恢复验证', createdAt: 1, updatedAt: 1, messages: [
        { id: 'crash-assistant', role: 'assistant', content: '', timestamp: 1, toolCalls: [{ id: 'crash-call', name: 'image_generate', arguments: '{}' }] },
        { id: 'crash-result', role: 'tool', content: '恢复图片', timestamp: 2, toolCallId: 'crash-call', generatedImages: [{ ...metadata, fileName: 'restored.png' }] },
      ] }],
      memories: [{ id: 'crash-memory', category: 'fact', content: '崩溃恢复记忆样本', createdAt: 1, updatedAt: 1 }],
      settings: { companionResponseNote: '恢复后的相处说明' },
      generatedImageMedia: [{ ...metadata, data: bytes.toString('base64') }],
    }))
    let app: ElectronApplication | undefined
    let closed = false
    const launch = () => electron.launch({
      args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), `--user-data-dir=${root}`, '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' },
    })
    try {
      app = await launch()
      app.on('close', () => { closed = true })
      let page = await app.firstWindow()
      await expect(page.getByTestId('settings-panel')).toBeVisible()
      await page.getByTestId('settings-nav-data').click()
      await app.evaluate(async ({ dialog }, config) => {
        const fs = process.getBuiltinModule('fs')
        const rename = fs.renameSync
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [config.backupPath] })
        fs.renameSync = (source, target) => {
          if (String(target).endsWith('my-agent.db') && fs.readdirSync(config.root).some(name => name.startsWith('restored-images-'))) {
            if (config.phase === 'after') rename(source, target)
            fs.writeFileSync(config.root + '/forced-exit.json', JSON.stringify({ phase: config.phase, signal: 'SIGKILL' }))
            process.kill(process.pid, 'SIGKILL')
          }
          return rename(source, target)
        }
      }, { root, backupPath, phase })
      await page.getByTestId('section-data').getByTestId('import').click().catch(error => {
        if (!String(error).includes('closed')) throw error
      })
      await expect.poll(() => closed).toBe(true)
      expect(JSON.parse(await readFile(path.join(root, 'forced-exit.json'), 'utf8'))).toEqual({ phase, signal: 'SIGKILL' })
      const directories = (await readdir(root)).filter(name => name.startsWith('restored-images-'))
      expect(directories).toHaveLength(1)
      expect(await readFile(path.join(root, directories[0], '.my-agent-pending-import'), 'utf8')).toContain('my-agent-backup-media-v1')
      app = await launch()
      closed = false
      app.on('close', () => { closed = true })
      page = await app.firstWindow()
      await expect(page.getByTestId('settings-panel')).toBeVisible()
      const restored = await page.evaluate(async () => ({
        session: await window.electronAPI.session.get('crash-import'),
        memories: await window.electronAPI.memory.list(), settings: await window.electronAPI.settings.get(),
      }))
      if (phase === 'before') {
        expect(restored.session).toBeNull()
        expect(restored.memories.some(memory => memory.content === '崩溃恢复记忆样本')).toBe(false)
        expect(restored.settings.companionResponseNote).toBe('')
        expect((await readdir(root)).filter(name => name.startsWith('restored-images-'))).toEqual([])
      } else {
        expect(restored.session?.messages).toHaveLength(2)
        expect(restored.memories.some(memory => memory.content === '崩溃恢复记忆样本')).toBe(true)
        expect(restored.settings.companionResponseNote).toBe('恢复后的相处说明')
        const image = restored.session!.messages[1].generatedImages![0]
        expect(await sharp(await readFile(image.path)).metadata()).toMatchObject({ width: 4, height: 3 })
        await expect(readFile(path.join(root, directories[0], '.my-agent-pending-import'))).rejects.toMatchObject({ code: 'ENOENT' })
      }
      await testInfo.attach('crash-recovery', { contentType: 'application/json', body: JSON.stringify({ phase, signal: 'SIGKILL', restoredSession: Boolean(restored.session) }) })
    } finally {
      if (app && !closed) await app.close()
      await rm(root, { recursive: true, force: true })
    }
  })
}
