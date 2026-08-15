/**
 * 内置模型 Provider 预设唯一注册表。
 *
 * 背景：Settings 与 Chat 快切曾分别维护预设数组，数量和内容已经分叉。
 * 设计意图：所有 UI 只消费同一份纯数据；quickAccess 只决定是否进入 Chat 快切。
 * 关键约束：预设不包含 API Key，也不代表对应模型一定支持适配器的全部能力。
 */

export interface ProviderPreset {
  key: string
  group: '海外直连' | '国内服务商' | '本地 / 自定义'
  label: string
  baseUrl: string
  model: string
  quickAccess: boolean
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    key: 'provider-preset:openai:gpt-4o',
    group: '海外直连',
    label: 'GPT-4o',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    quickAccess: true,
  },
  {
    key: 'provider-preset:openai:gpt-4o-mini',
    group: '海外直连',
    label: 'GPT-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    quickAccess: true,
  },
  {
    key: 'provider-preset:anthropic:claude-sonnet',
    group: '海外直连',
    label: 'Claude Sonnet',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    quickAccess: false,
  },
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
  '本地 / 自定义',
].map((group) => ({
  group,
  items: PROVIDER_PRESETS.filter((preset) => preset.group === group),
}))

export const QUICK_PROVIDER_PRESETS = PROVIDER_PRESETS.filter((preset) => preset.quickAccess)
