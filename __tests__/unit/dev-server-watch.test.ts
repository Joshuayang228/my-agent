import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer, loadConfigFromFile } from 'vite'
import { expect, it, vi } from 'vitest'

it('Vite 监听源码变更，但忽略项目文档、协作规则和验收产物', async () => {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'ui-e2e' }, path.resolve('vite.config.ts'))
  expect(loaded).not.toBeNull()
  const root = await mkdtemp(path.join(tmpdir(), 'my-agent-watch-'))
  const index = path.join(root, 'index.html')
  await writeFile(index, '<main>initial</main>')
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: {
    middlewareMode: true, watch: loaded!.config.server?.watch,
  } })
  const changes: string[] = []
  const send = vi.spyOn(server.ws, 'send')
  server.watcher.on('all', (_event, file) => changes.push(path.relative(root, file).replaceAll('\\', '/')))
  try {
    await delay(250)
    await writeFile(index, '<main>changed</main>')
    await vi.waitFor(() => expect(changes).toContain('index.html'))
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' })))
    send.mockClear()
    changes.length = 0
    for (const directory of ['var/verification/run/traces/resources', 'test-results/traces/resources', 'docs/requirements', 'methodology', 'agent-skills', '.agents/skills/example']) {
      await mkdir(path.join(root, directory), { recursive: true })
      await writeFile(path.join(root, directory, 'snapshot.html'), '<main>artifact</main>')
      await writeFile(path.join(root, directory, 'notes.md'), '# Documentation')
    }
    await delay(300)
    expect(changes.filter((file) => file.endsWith('snapshot.html'))).toEqual([])
    expect(changes.filter((file) => file.endsWith('notes.md'))).toEqual([])
    expect(send).not.toHaveBeenCalled()
    await writeFile(index, '<main>source still works</main>')
    await vi.waitFor(() => expect(changes).toContain('index.html'))
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' })))
    await mkdir(path.join(root, 'src/content'), { recursive: true })
    await writeFile(path.join(root, 'src/content/prompt.md'), '# Runtime asset')
    await vi.waitFor(() => expect(changes).toContain('src/content/prompt.md'))
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
}, 15000)
