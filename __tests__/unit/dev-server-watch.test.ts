import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer, loadConfigFromFile } from 'vite'
import { expect, it, vi } from 'vitest'

it('Vite 监听源码变更，但忽略验证 HTML 和 trace 产物', async () => {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'ui-e2e' }, path.resolve('vite.config.ts'))
  expect(loaded).not.toBeNull()
  const root = await mkdtemp(path.join(tmpdir(), 'my-agent-watch-'))
  const index = path.join(root, 'index.html')
  await writeFile(index, '<main>initial</main>')
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: {
    middlewareMode: true, watch: loaded!.config.server?.watch,
  } })
  const changes: string[] = []
  server.watcher.on('all', (_event, file) => changes.push(path.relative(root, file).replaceAll('\\', '/')))
  try {
    await delay(250)
    await writeFile(index, '<main>changed</main>')
    await vi.waitFor(() => expect(changes).toContain('index.html'))
    changes.length = 0
    for (const directory of ['var/verification/run/traces/resources', 'test-results/traces/resources']) {
      await mkdir(path.join(root, directory), { recursive: true })
      await writeFile(path.join(root, directory, 'snapshot.html'), '<main>artifact</main>')
    }
    await delay(300)
    expect(changes.filter((file) => file.endsWith('snapshot.html'))).toEqual([])
    await writeFile(index, '<main>source still works</main>')
    await vi.waitFor(() => expect(changes).toContain('index.html'))
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
}, 15000)
