import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer, loadConfigFromFile } from 'vite'
import { expect, it, vi } from 'vitest'

it.each([false, true])('Vite 忽略文档和产物，保留源码刷新（交叠源码事件：%s）', async (overlapSourceChange) => {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'ui-e2e' }, path.resolve('vite.config.ts'))
  expect(loaded).not.toBeNull()
  const root = await mkdtemp(path.join(tmpdir(), 'my-agent-watch-'))
  const index = path.join(root, 'index.html')
  await writeFile(index, '<main>initial</main>')
  const server = await createServer({ root, configFile: false, logLevel: 'silent', server: {
    host: '127.0.0.1', port: 0, strictPort: true, watch: loaded!.config.server?.watch,
  } })
  const changes: string[] = []
  const send = vi.spyOn(server.ws, 'send')
  server.watcher.on('all', (_event, file) => changes.push(path.relative(root, file).replaceAll('\\', '/')))
  try {
    await server.listen()
    await delay(250)
    await writeFile(index, '<main>changed</main>')
    await vi.waitFor(() => expect(changes).toContain('index.html'))
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '/index.html' }))
    for (const directory of ['var/verification/run/traces/resources', 'test-results/traces/resources', 'docs/requirements', 'methodology', 'agent-skills', '.agents/skills/example']) {
      await mkdir(path.join(root, directory), { recursive: true })
      await writeFile(path.join(root, directory, 'snapshot.html'), '<main>artifact</main>')
      await writeFile(path.join(root, directory, 'notes.md'), '# Documentation')
    }
    if (overlapSourceChange) {
      await writeFile(path.join(root, 'source-during.html'), '<main>overlapping source change</main>')
      await vi.waitFor(() => expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '/source-during.html' }))
    }
    await delay(300)
    expect(changes.filter((file) => file.endsWith('snapshot.html'))).toEqual([])
    expect(changes.filter((file) => file.endsWith('notes.md'))).toEqual([])
    // Windows 一次源码写入可能产生迟到事件；按真实刷新路径归因，而非清空记录后猜测来源。
    // 只允许本测试实际写入的源码路径，文档、产物及其他消息仍必须使断言失败。
    const sourceReloads = ['/index.html', ...(overlapSourceChange ? ['/source-during.html'] : [])]
      .map((source) => [{ type: 'full-reload', path: source }])
    for (const call of send.mock.calls) expect(sourceReloads).toContainEqual(call)
    await writeFile(path.join(root, 'source-after.html'), '<main>source still works</main>')
    await vi.waitFor(() => expect(changes).toContain('source-after.html'))
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '/source-after.html' }))
    await mkdir(path.join(root, 'src/content'), { recursive: true })
    await writeFile(path.join(root, 'src/content/prompt.md'), '# Runtime asset')
    await vi.waitFor(() => expect(changes).toContain('src/content/prompt.md'))
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
}, 15000)
