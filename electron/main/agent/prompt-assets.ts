/**
 * Prompt 资产目录的唯一运行时来源。
 *
 * 目录项与实际 Prompt 实现同处主进程：静态 Prompt 直接引用生产常量，
 * 角色/场景 Prompt 从现有 Role Pack 读取，动态 Prompt 标记为 dynamic，
 * 不在前端复制一份文案。
 */

import type { PromptAsset } from '../../../src/shared/types'
import { DEFAULT_SYSTEM_PROMPT } from './loop'
import { DEFAULT_PLAYGROUND_SYSTEM } from './playground'
import { EXTRACTION_PROMPT } from './profile-extractor'
import { loadUniverseManifest, tryReadRoleText } from '../companion/identity/loader'

function clip(text: string, max = 420): string {
  const normalized = text.trim()
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function staticAsset(
  asset: Omit<PromptAsset, 'preview'> & { content: string },
): PromptAsset & { content: string } {
  return { ...asset, preview: clip(asset.content) }
}

const CORE_PROMPT_ASSETS: readonly (PromptAsset & { content?: string })[] = [
  {
    id: 'system-layers',
    name: 'System Prompt 四层实装（L1–L4）',
    category: 'system',
    desc: '主对话由 buildSystemPrompt 组装；具体一轮结果请在 Debug 或「载入当前实装」查看。',
    sourcePath: 'electron/main/agent/prompt-builder.ts',
    preview: 'L1 人格 · L2 能力/行为 · L3 记忆与世界 · L4 动态',
    dynamic: true,
  },
  staticAsset({
    id: 'loop-default',
    name: 'Loop 默认 System（无人格时）',
    category: 'system',
    desc: 'Agent Loop 未注入自定义 system 时的兜底指令。',
    sourcePath: 'electron/main/agent/loop.ts',
    content: DEFAULT_SYSTEM_PROMPT,
  }),
  staticAsset({
    id: 'playground-default',
    name: 'Playground 默认试验指令',
    category: 'system',
    desc: '对话试验 System 为空时使用；免伴侣上下文与工具。',
    sourcePath: 'electron/main/agent/playground.ts',
    content: DEFAULT_PLAYGROUND_SYSTEM,
  }),
  {
    id: 'l3-collapse',
    name: 'L3 Collapse 摘要指令',
    category: 'context',
    desc: '上下文中段压缩时动态生成的结构化摘要指令。',
    sourcePath: 'electron/main/agent/context-manager.ts',
    preview: '当前任务 · 已完成步骤 · 当前状态 · 下一步计划 · 关键上下文',
    dynamic: true,
  },
  {
    id: 'l4-autocompact',
    name: 'L4 AutoCompact 全量摘要',
    category: 'context',
    desc: '超长上下文的紧急全量摘要路径，与 L3 共用摘要管线。',
    sourcePath: 'electron/main/agent/context-manager.ts',
    preview: '综合摘要模式；字数上限和上下文范围随运行状态变化。',
    dynamic: true,
  },
  staticAsset({
    id: 'profile-extraction',
    name: '用户画像提取',
    category: 'context',
    desc: '后台从近期对话提取可长期复用的用户信息。',
    sourcePath: 'electron/main/agent/profile-extractor.ts',
    content: EXTRACTION_PROMPT,
  }),
  {
    id: 'reply-stance',
    name: '回复立场提示',
    category: 'system',
    desc: '按用户本轮意图选择问 / 做 / 安慰 / 推回的回复立场。',
    sourcePath: 'electron/main/agent/reply-stance.ts',
    preview: '每轮按用户消息启发式生成；不是固定 System 文案。',
    dynamic: true,
  },
  {
    id: 'tone-control',
    name: '语气收放提示',
    category: 'system',
    desc: '按立场、执行模式和会话种别调整语气与 aside 策略。',
    sourcePath: 'electron/main/agent/tone-control.ts',
    preview: '紧 / 软 / 中性 + aside 策略；不改变角色身份。',
    dynamic: true,
  },
  {
    id: 'relationship-stage',
    name: '关系阶段提示',
    category: 'companion',
    desc: '按角色关系代理指标注入陌生 / 熟悉 / 默契阶段边界。',
    sourcePath: 'electron/main/companion/growth/relationship-stage.ts',
    preview: '阶段动态计算，召唤会话强制按陌生客人处理。',
    dynamic: true,
  },
  {
    id: 'relationship-milestones',
    name: '关系里程碑提示',
    category: 'companion',
    desc: '偶尔把已达成的关系里程碑作为薄提示带入主会话。',
    sourcePath: 'electron/main/companion/growth/milestones.ts',
    preview: '最多注入少量提示，避免变成成就系统。',
    dynamic: true,
  },
  {
    id: 'expertise-level',
    name: '专家度 / 解释粒度提示',
    category: 'system',
    desc: '根据用户画像和近期消息调整解释密度，不改变工具权限。',
    sourcePath: 'electron/main/agent/expertise-level.ts',
    preview: '只调讲解密度，不把专家度标签直接称呼用户。',
    dynamic: true,
  },
  {
    id: 'skill-context',
    name: 'Skill 上下文提示',
    category: 'system',
    desc: '列出可用 Skill，并在 Skill 激活时注入对应操作指南。',
    sourcePath: 'electron/main/skills/registry.ts',
    preview: '可用 Skill 摘要 + 当前激活 Skill 正文。',
    dynamic: true,
  },
  {
    id: 'companion-context',
    name: '伙伴世界上下文片段',
    category: 'companion',
    desc: 'Catch-up、世界状态、近 Moment、书架、名册和召唤场景按角色/会话注入。',
    sourcePath: 'electron/main/companion/orchestrator.ts',
    preview: '世界态和生活切片只注入需要它们的主会话；召唤会话有独立场景块。',
    dynamic: true,
  },
  {
    id: 'companion-background-tasks',
    name: '伙伴后台任务 Prompt',
    category: 'companion',
    desc: 'Catch-up、反思、Moment 润色和剧本生成等辅助 LLM 调用。',
    sourcePath: 'electron/main/companion/life/ + electron/main/companion/growth/',
    preview: '每个辅助任务在自身服务文件中组装，不复用主对话 System Prompt。',
    dynamic: true,
  },
  {
    id: 'subagent-system',
    name: '子 Agent System Prompt',
    category: 'subagent',
    desc: '研究、编码、分析等子任务角色描述与边界。',
    sourcePath: 'electron/main/agent/subagent.ts',
    preview: '角色预设会结合任务配置、工具集和只读性动态组装。',
    dynamic: true,
  },
  {
    id: 'permission-denial',
    name: '权限拒绝后的继续策略',
    category: 'system',
    desc: '工具或命令被拒绝后注入 Loop 的替代方案提示，并在连续拒绝时停止本轮。',
    sourcePath: 'electron/main/agent/loop.ts',
    preview: '不要重试同一动作；换个方式或询问用户如何继续。',
    dynamic: true,
  },
]

const ROLE_PROMPT_FILES = [
  { suffix: 'protected.md', label: 'PROTECTED 人格正文' },
  { suffix: 'mutable.default.md', label: 'MUTABLE 默认状态' },
  { suffix: 'voice.md', label: '语气补充' },
  { suffix: 'scenes/display.md', label: '展示场景' },
  { suffix: 'scenes/interact.md', label: '互动场景' },
  { suffix: 'scenes/execute.md', label: '执行场景' },
] as const

function loadRoleAssets(): Array<PromptAsset & { content: string }> {
  try {
    const manifest = loadUniverseManifest()
    const assets: Array<PromptAsset & { content: string }> = []
    for (const roleId of manifest.protagonistIds) {
      for (const file of ROLE_PROMPT_FILES) {
        const content = tryReadRoleText(roleId, file.suffix)
        if (!content?.trim()) continue
        assets.push(staticAsset({
          id: `role-${roleId}-${file.suffix.replace(/[^a-z0-9]+/gi, '-')}`,
          name: `${roleId} · ${file.label}`,
          category: 'companion',
          desc: `角色 Pack 的 ${file.label}，由 Identity loader 读取。`,
          sourcePath: `electron/main/companion/universes/default/roles/${roleId}/${file.suffix}`,
          content,
        }))
      }
    }
    return assets
  } catch {
    return []
  }
}

export function getPromptAssets(): Array<PromptAsset & { content?: string }> {
  return [...CORE_PROMPT_ASSETS, ...loadRoleAssets()]
}
