import { describe, expect, it, vi } from 'vitest'
import type { PromptAsset, SkillDefinition, ToolDefinition } from '../../src/shared/types'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/my-agent-test' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const { buildModelContextAssets } = await import('../../electron/main/debug/model-context-assets')
const { getPromptAssets } = await import('../../electron/main/prompts/registry')

function makeTool(name: string, description: string): ToolDefinition {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '查询内容' } },
    },
    metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
    inputExamples: [{ query: '示例' }],
    execute: async () => 'ok',
  }
}

const userSkill: SkillDefinition = {
  meta: {
    name: 'review-helper',
    description: '帮助审阅代码',
    when_to_use: '用户要求代码审阅时',
    allowed_tools: ['file_read'],
    version: '2.1.0',
  },
  body: '先读取代码，再按严重程度输出问题。',
  filePath: 'C:/Users/test/skills/review-helper/SKILL.md',
  source: 'user',
}

describe('模型可见文本统一目录', () => {
  it('聚合 Prompt、内置工具、用户 Skill 和 MCP schema，并标记所有权与指纹', () => {
    const promptAssets = getPromptAssets()
    const assets = buildModelContextAssets({
      promptAssets,
      tools: [
        makeTool('remember', '记住一条长期信息'),
        makeTool('skill_invoke_review-helper', '激活代码审阅 Skill'),
        makeTool('mcp__docs__search', '[Docs] 搜索外部文档'),
      ],
      skills: [userSkill],
      systemPrompt: '回答时先给结论，再给证据。',
    })

    expect(assets.find((asset) => asset.key === 'profile-extraction')).toMatchObject({
      assetType: 'prompt',
      ownership: 'builtin',
      fingerprintKind: 'content',
    })
    expect(assets.find((asset) => asset.key === 'tool:remember')).toMatchObject({
      category: 'tool',
      assetType: 'tool-schema',
      ownership: 'builtin',
      source: 'electron/main/tools/builtins/memory-manage.ts',
      contentKind: 'schema',
    })
    expect(assets.find((asset) => asset.key === 'tool:mcp__docs__search')).toMatchObject({
      category: 'external',
      ownership: 'external',
      source: 'mcp://docs/search',
    })
    expect(assets.find((asset) => asset.key === 'skill:review-helper')).toMatchObject({
      category: 'skill',
      ownership: 'user',
      version: '2.1.0',
    })
    expect(assets.find((asset) => asset.key === 'settings-system-prompt')).toMatchObject({
      ownership: 'user',
      content: '回答时先给结论，再给证据。',
      fingerprintKind: 'content',
    })
    expect(assets.find((asset) => asset.key === 'eval-judge')).toMatchObject({
      category: 'eval',
      assetType: 'eval-judge',
      contentKind: 'template',
    })
    expect(assets.find((asset) => asset.key === 'companion:default:hang:profile')).toMatchObject({
      category: 'companion',
      assetType: 'companion-profile',
      ownership: 'role-pack',
      status: 'active',
    })
    expect(assets.find((asset) => asset.key === 'companion:default:hang:world-default')).toMatchObject({
      assetType: 'companion-world',
      contentKind: 'data',
    })
    expect(new Set(assets.map((asset) => asset.key)).size).toBe(assets.length)
    for (const asset of assets) {
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
      expect(asset.content || asset.locales[asset.locale]?.template || asset.preview).toBeTruthy()
    }
  })

  it('Tool schema 展示 Provider 实际可见的中文输入示例', () => {
    const tool = makeTool('remember', '记住一条长期信息')
    const [asset] = buildModelContextAssets({
      promptAssets: [] as PromptAsset[],
      tools: [tool],
      skills: [],
      systemPrompt: '',
    })
    expect(asset.content).toContain('输入示例')
    expect(asset.content).toContain('示例 1')
    expect(asset.content).toContain('查询内容')
  })
})
