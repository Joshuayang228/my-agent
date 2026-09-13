import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const productionSurfaces = [
  'src/components/chat/right-dock/BrowserPanel.tsx',
  'src/components/chat/right-dock/ReviewPanel.tsx',
  'src/components/chat/right-dock/SideChatPanel.tsx',
  'src/components/chat/right-dock/TerminalPanel.tsx',
  'src/components/chat/right-dock/WorkspaceFilesPanel.tsx',
  'src/components/FileBrowser.tsx',
  'src/components/MarkdownRenderer.tsx',
] as const

describe('正式工作区 Foundation 控件门禁', () => {
  it('不重新引入 Playground/Settings 的局部按钮皮肤', () => {
    for (const file of productionSurfaces) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toContain('settings-option')
      expect(source, file).not.toContain('components/playground')
    }
  })

  it('固定操作和文字恢复动作分别绑定 Foundation 实现', () => {
    const iconConsumers = [
      'src/components/chat/right-dock/BrowserPanel.tsx',
      'src/components/chat/right-dock/ReviewPanel.tsx',
      'src/components/chat/right-dock/TerminalPanel.tsx',
      'src/components/chat/right-dock/SideChatPanel.tsx',
      'src/components/FileBrowser.tsx',
      'src/components/MarkdownRenderer.tsx',
    ]
    for (const file of iconConsumers) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).toContain('IconButton')
    }
    for (const file of ['src/components/chat/right-dock/BrowserPanel.tsx', 'src/components/chat/right-dock/ReviewPanel.tsx', 'src/components/chat/right-dock/SideChatPanel.tsx', 'src/components/FileBrowser.tsx']) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).toContain('ActionButton')
    }
  })
})
