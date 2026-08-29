/**
 * 内置模型 Provider 预设唯一注册表。
 *
 * 背景：Settings 与 Chat 快切曾分别维护预设数组，数量和内容已经分叉；Alice 参考实现
 * 也证明 Provider 需要按「直连 / 国内服务商 / 聚合与代理 / 编程套餐 / 本地」组织，
 * 而不是把所有端点混成一组。
 * 设计意图：所有 UI 只消费同一份纯数据；quickAccess 只决定是否进入 Chat 快切。
 * 关键约束：预设不包含 API Key，不宣称厂商全部模型能力；Base URL 必须是本项目
 * 当前适配器能够直接拼接请求的地址。Coding Plan 的模型是可编辑起始值，最终以账户开放模型为准。
 */

export interface ProviderPreset {
  key: string
  group: '海外直连' | '国内服务商' | '聚合与代理' | '编程套餐' | '本地 / 自定义'
  label: string
  baseUrl: string
  model: string
  quickAccess: boolean
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  // 海外直连：保留既有稳定 key，同时补上 Alice 清单中的当前入口。
  {
    key: 'provider-preset:openai:gpt-4o',
    group: '海外直连',
    label: 'OpenAI · GPT-4o',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    quickAccess: true,
  },
  {
    key: 'provider-preset:openai:gpt-4o-mini',
    group: '海外直连',
    label: 'OpenAI · GPT-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    quickAccess: true,
  },
  {
    key: 'provider-preset:openai:gpt-5.5',
    group: '海外直连',
    label: 'OpenAI · GPT-5.5',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.5',
    quickAccess: false,
  },
  {
    key: 'provider-preset:anthropic:claude-sonnet',
    group: '海外直连',
    label: 'Anthropic · Claude Sonnet',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    quickAccess: false,
  },
  {
    key: 'provider-preset:anthropic:claude-sonnet-4-6',
    group: '海外直连',
    label: 'Anthropic · Claude Sonnet 4.6',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    quickAccess: false,
  },
  {
    key: 'provider-preset:google:gemini-3.1-flash-preview',
    group: '海外直连',
    label: 'Google · Gemini 3.1 Flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.1-flash-preview',
    quickAccess: false,
  },
  {
    key: 'provider-preset:xai:grok-4',
    group: '海外直连',
    label: 'xAI · Grok 4',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4',
    quickAccess: false,
  },

  // 国内服务商：使用 Alice 当前清单中的公开 OpenAI Compatible 端点。
  {
    key: 'provider-preset:deepseek:v3',
    group: '国内服务商',
    label: 'DeepSeek V3',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    quickAccess: true,
  },
  {
    key: 'provider-preset:deepseek:v4-flash',
    group: '国内服务商',
    label: 'DeepSeek V4 Flash',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    quickAccess: true,
  },
  {
    key: 'provider-preset:deepseek:reasoner',
    group: '国内服务商',
    label: 'DeepSeek · Reasoner',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    quickAccess: false,
  },
  {
    key: 'provider-preset:qwen:max',
    group: '国内服务商',
    label: '通义千问 Max',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-max',
    quickAccess: false,
  },
  {
    key: 'provider-preset:moonshot:kimi-k2',
    group: '国内服务商',
    label: 'Kimi K2',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2',
    quickAccess: false,
  },
  {
    key: 'provider-preset:moonshot:kimi-k2.6',
    group: '国内服务商',
    label: 'Kimi · K2.6',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2.6',
    quickAccess: false,
  },
  {
    key: 'provider-preset:minimax:m2.5',
    group: '国内服务商',
    label: 'MiniMax · M2.5',
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-M2.5',
    quickAccess: false,
  },
  {
    key: 'provider-preset:zhipu:glm-4.5',
    group: '国内服务商',
    label: '智谱 AI · GLM-4.5',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.5',
    quickAccess: false,
  },
  {
    key: 'provider-preset:siliconflow:qwen3-235b',
    group: '国内服务商',
    label: '硅基流动 · Qwen3 235B',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen3-235B-A22B',
    quickAccess: false,
  },
  {
    key: 'provider-preset:xiaomi:mimo-v2.5-pro',
    group: '国内服务商',
    label: '小米 MiMo · V2.5 Pro',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    quickAccess: false,
  },
  {
    key: 'provider-preset:volces:doubao-seed-2-pro',
    group: '国内服务商',
    label: '火山引擎 · Doubao Seed 2.0 Pro',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-2-0-pro-260215',
    quickAccess: false,
  },

  // 编程套餐：与普通聊天端点分开，避免用户误以为它们是同一种计费 / 能力入口。
  // Alice 对部分套餐不预置模型，因此这里提供可编辑的常用起始值。
  {
    key: 'provider-preset:kimi-coding:kimi-for-coding',
    group: '编程套餐',
    label: 'Kimi Code Plan',
    baseUrl: 'https://api.kimi.com/coding/v1',
    model: 'kimi-for-coding',
    quickAccess: false,
  },
  {
    key: 'provider-preset:aliyun-coding:qwen3-coder',
    group: '编程套餐',
    label: '阿里云 Coding Plan',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    model: 'qwen3-coder',
    quickAccess: false,
  },
  {
    key: 'provider-preset:minimax-coding:m2.5',
    group: '编程套餐',
    label: 'MiniMax Token Plan',
    baseUrl: 'https://api.minimaxi.com/anthropic/v1',
    model: 'MiniMax-M2.5',
    quickAccess: false,
  },
  {
    key: 'provider-preset:zhipu-coding:glm-4.5',
    group: '编程套餐',
    label: '智谱 GLM Coding Plan',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    model: 'glm-4.5',
    quickAccess: false,
  },
  {
    key: 'provider-preset:volces-coding:doubao-seed-2-pro',
    group: '编程套餐',
    label: '火山方舟 Coding Plan',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
    model: 'doubao-seed-2-0-pro-260215',
    quickAccess: false,
  },
  {
    key: 'provider-preset:xiaomi-coding:mimo-v2-pro',
    group: '编程套餐',
    label: '小米 MiMo Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2-pro',
    quickAccess: false,
  },

  // 聚合与代理：这是 Alice 支持的入口，但不冒充底层厂商直连。
  {
    key: 'provider-preset:openrouter:gpt-4.1',
    group: '聚合与代理',
    label: 'OpenRouter · GPT-4.1',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4.1',
    quickAccess: false,
  },
  {
    key: 'provider-preset:pipellm:claude-sonnet-4-6',
    group: '聚合与代理',
    label: 'PipeLLM · Claude Sonnet 4.6',
    baseUrl: 'https://api.pipellm.ai/openai/v1',
    model: 'claude-sonnet-4-6',
    quickAccess: false,
  },
  {
    key: 'provider-preset:miyang:gemini-3-flash',
    group: '聚合与代理',
    label: '米羊 · Gemini 3 Flash',
    baseUrl: 'https://miyang.cn/api/v1',
    model: 'openrouter/google/gemini-3-flash-preview',
    quickAccess: false,
  },
  {
    key: 'provider-preset:tokendance:glm-5.1',
    group: '聚合与代理',
    label: '观猹 · GLM-5.1',
    baseUrl: 'https://tokendance.space/gateway/v1',
    model: 'glm-5.1',
    quickAccess: false,
  },

  // 本地：无需把 Alice 的固定本地 API Key 写入注册表；用户仍可手动配置。
  {
    key: 'provider-preset:local:ollama',
    group: '本地 / 自定义',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1',
    quickAccess: false,
  },
  {
    key: 'provider-preset:local:lm-studio',
    group: '本地 / 自定义',
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    quickAccess: false,
  },
]

export const PROVIDER_PRESET_GROUPS = [
  '海外直连',
  '国内服务商',
  '编程套餐',
  '聚合与代理',
  '本地 / 自定义',
].map((group) => ({
  group,
  items: PROVIDER_PRESETS.filter((preset) => preset.group === group),
}))

export const QUICK_PROVIDER_PRESETS = PROVIDER_PRESETS.filter((preset) => preset.quickAccess)
