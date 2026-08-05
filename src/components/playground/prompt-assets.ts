/**
 * Prompt 资产目录（对齐 Alice prompts tab / Yk）。
 * 摊开路径与用途；试跑请进「对话试验」，禁止默认写 settings。
 */

import type { PromptAsset } from './catalog'

export const PROMPT_ASSETS: readonly PromptAsset[] = [
  {
    id: 'system-layers',
    name: 'System Prompt 四层实装（L1–L4）',
    desc: '生产路径 Assemble 结果。点「对话试验 → 载入当前实装」查看全文；此处只登记资产。',
    sourcePath: 'electron/main/agent/prompt-builder.ts',
    preview: 'L1 PROTECTED+MUTABLE · L2 能力/工具 · L3 记忆与世界 · L4 会话动态',
  },
  {
    id: 'loop-default',
    name: 'Loop 默认 System（无人格时）',
    desc: 'Agent Loop 未注入自定义 system 时的兜底英文指令。',
    sourcePath: 'electron/main/agent/loop.ts',
    preview:
      'You are a helpful AI assistant. You have access to tools… Always respond in the same language as the user.',
  },
  {
    id: 'playground-default',
    name: 'Playground 默认试验指令',
    desc: '对话试验 System 为空时使用；无工具、免伴侣 Assemble。',
    sourcePath: 'electron/main/agent/playground.ts',
    preview:
      'You are a helpful assistant in a developer playground. Keep replies concise. No tools.',
  },
  {
    id: 'l3-collapse',
    name: 'L3 Collapse 摘要指令',
    desc: '上下文中段 LLM 摘要框架（结构化节）。',
    sourcePath: 'electron/main/agent/context-manager.ts',
    preview: '你正在为一个持续进行的对话生成压缩摘要。摘要将替换早期对话历史…',
  },
  {
    id: 'l4-autocompact',
    name: 'L4 AutoCompact 全量摘要',
    desc: '紧急全量重写路径；与 L3 共用摘要管线意图。',
    sourcePath: 'electron/main/agent/context-manager.ts',
    preview: '见 context-manager L4 AutoCompact / summarizeConversation',
  },
  {
    id: 'permission-confirm-ui',
    name: '权限确认弹窗文案',
    desc: '主聊天确认框：标题「操作确认」· 允许 / 拒绝。',
    sourcePath: 'src/App.tsx（确认队列 UI）',
    preview: 'AI 请求执行以下操作：… [拒绝] [允许执行]',
  },
  {
    id: 'denied-summary',
    name: '连续权限拒绝停轮文案',
    desc: 'Loop 累计拒绝后停止本轮时的用户可见消息。',
    sourcePath: 'electron/main/agent/loop.ts',
    preview: '连续多次操作被拒绝或需要授权，已停止本轮处理…',
  },
] as const
