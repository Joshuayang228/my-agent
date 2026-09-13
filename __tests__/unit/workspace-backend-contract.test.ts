import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const productionPanels = {
  files: 'src/components/FileBrowser.tsx',
  review: 'src/components/chat/right-dock/ReviewPanel.tsx',
  terminal: 'src/components/chat/right-dock/TerminalPanel.tsx',
  browser: 'src/components/chat/right-dock/BrowserPanel.tsx',
  sideChat: 'src/components/chat/right-dock/SideChatPanel.tsx',
} as const

describe('正式工作区后端调用链', () => {
  it('五个正式能力都绑定真实 IPC / Runtime 入口', () => {
    const source = Object.fromEntries(Object.entries(productionPanels).map(([key, path]) => [key, readFileSync(path, 'utf8')]))

    expect(source.files).toMatch(/electronAPI\.project\.listFiles/)
    expect(source.files).toMatch(/electronAPI\??\.project\??\.readFile/)
    expect(source.review).toMatch(/electronAPI\??\.session\??\.listFileChanges/)
    expect(source.review).toMatch(/electronAPI\??\.session\??\.getFileChangeDiff/)
    expect(source.terminal).toMatch(/electronAPI\??\.terminal\??\.run/)
    expect(source.terminal).toMatch(/electronAPI\??\.terminal\??\.kill/)
    expect(source.browser).toMatch(/electronAPI\??\.browser\??\.load/)
    expect(source.browser).toMatch(/electronAPI\??\.browser\??\.cancel/)
    expect(source.sideChat).toMatch(/electronAPI\??\.session\??\.createWorkspace/)
    expect(source.sideChat).toMatch(/electronAPI\??\.chat\??\.send/)
    expect(source.sideChat).toMatch(/electronAPI\??\.chat\??\.abort/)
  })

  it('正式面板不直接依赖 Playground fixture 或候选页面', () => {
    for (const path of Object.values(productionPanels)) {
      const source = readFileSync(path, 'utf8')
      expect(source).not.toMatch(/components\/playground|__tests__\/fixtures|WorkspaceExperienceCandidate/)
    }
  })
})


describe('受限浏览器请求生命周期', () => {
  it('preload、类型和主进程都保留 requestId/cancel 契约', () => {
    const preload = readFileSync('electron/preload/index.ts', 'utf8')
    const rendererTypes = readFileSync('src/vite-env.d.ts', 'utf8')
    const main = readFileSync('electron/main/ipc/browser.ts', 'utf8')
    expect(preload).toContain("ipcRenderer.invoke('browser:load', url, requestId)")
    expect(preload).toContain("ipcRenderer.invoke('browser:cancel', requestId)")
    expect(rendererTypes).toMatch(/load: \(url: string, requestId: string\)/)
    expect(rendererTypes).toMatch(/cancel: \(requestId: string\)/)
    expect(main).toContain("ipcMain.handle('browser:cancel'")
    expect(main).toContain('activeRequests')
  })
})
