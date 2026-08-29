/**
 * 内置模型 Provider 入口唯一注册表。
 *
 * 背景：Provider 预设曾把“供应商、端点、具体模型”捆成一张卡，模型名称很快过时，
 * 也让 Settings 看起来像在替用户决定模型。
 * 设计意图：注册表只描述稳定的 Provider 入口；模型由用户按账户实际开放列表填写，
 * Chat / Settings / Debug 都从同一份 Provider 入口派生。
 * 关键约束：不包含 API Key、模型白名单或厂商能力保证；quickAccess 只决定是否进入
 * Chat 的 Provider 快切，不代表默认模型。
 */

export interface ProviderPreset {
  /** Provider 在 Alice 清单中的稳定身份；多个协议入口可以拥有不同身份。 */
  providerId: string
  /** Provider 级资产 key；不包含模型名，避免模型更新造成入口身份漂移。 */
  key: string
  group: '海外直连' | '国内服务商' | '聚合与代理' | '编程套餐' | '本地 / 自定义'
  label: string
  baseUrl: string
  quickAccess: boolean
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  // 海外直连：只登记稳定 Provider 与端点，模型由用户账户决定。
  {
    providerId: 'openai',
    key: 'provider-preset:openai',
    group: '海外直连',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    quickAccess: true,
  },
  {
    providerId: 'anthropic',
    key: 'provider-preset:anthropic',
    group: '海外直连',
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    quickAccess: false,
  },
  {
    providerId: 'google',
    key: 'provider-preset:google',
    group: '海外直连',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    quickAccess: false,
  },
  {
    providerId: 'xai',
    key: 'provider-preset:xai',
    group: '海外直连',
    label: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    quickAccess: false,
  },

  // 国内服务商：端点来自 Alice 当前 Provider 清单，不内置具体模型名。
  {
    providerId: 'deepseek',
    key: 'provider-preset:deepseek',
    group: '国内服务商',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    quickAccess: true,
  },
  {
    providerId: 'dashscope',
    key: 'provider-preset:dashscope',
    group: '国内服务商',
    label: '阿里云百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    quickAccess: false,
  },
  {
    providerId: 'moonshot',
    key: 'provider-preset:moonshot',
    group: '国内服务商',
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    quickAccess: false,
  },
  {
    providerId: 'minimax',
    key: 'provider-preset:minimax',
    group: '国内服务商',
    label: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    quickAccess: false,
  },
  {
    providerId: 'zhipu',
    key: 'provider-preset:zhipu',
    group: '国内服务商',
    label: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    quickAccess: false,
  },
  {
    providerId: 'siliconflow',
    key: 'provider-preset:siliconflow',
    group: '国内服务商',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    quickAccess: false,
  },
  {
    providerId: 'xiaomi',
    key: 'provider-preset:xiaomi',
    group: '国内服务商',
    label: '小米 MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    quickAccess: false,
  },
  {
    providerId: 'volces',
    key: 'provider-preset:volces',
    group: '国内服务商',
    label: '火山引擎 Ark',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    quickAccess: false,
  },

  // 编程套餐：独立展示计费 / 能力入口；模型仍由套餐账户返回或由用户填写。
  {
    providerId: 'kimi_coding',
    key: 'provider-preset:kimi-coding',
    group: '编程套餐',
    label: 'Kimi Code Plan',
    baseUrl: 'https://api.kimi.com/coding/v1',
    quickAccess: false,
  },
  {
    providerId: 'aliyun_coding',
    key: 'provider-preset:aliyun-coding',
    group: '编程套餐',
    label: '阿里云 Coding Plan',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    quickAccess: false,
  },
  {
    providerId: 'minimax_coding',
    key: 'provider-preset:minimax-coding',
    group: '编程套餐',
    label: 'MiniMax Token Plan',
    baseUrl: 'https://api.minimaxi.com/anthropic/v1',
    quickAccess: false,
  },
  {
    providerId: 'zhipu_coding',
    key: 'provider-preset:zhipu-coding',
    group: '编程套餐',
    label: '智谱 GLM Coding Plan',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    quickAccess: false,
  },
  {
    providerId: 'volces_coding',
    key: 'provider-preset:volces-coding',
    group: '编程套餐',
    label: '火山方舟 Coding Plan',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
    quickAccess: false,
  },
  {
    providerId: 'xiaomi_coding',
    key: 'provider-preset:xiaomi-coding',
    group: '编程套餐',
    label: '小米 MiMo Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    quickAccess: false,
  },

  // 聚合与代理：明确标注入口性质，不把聚合后的模型冒充成 Provider 自有模型。
  {
    providerId: 'openrouter',
    key: 'provider-preset:openrouter',
    group: '聚合与代理',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    quickAccess: false,
  },
  {
    providerId: 'pipellm_claude',
    key: 'provider-preset:pipellm',
    group: '聚合与代理',
    label: 'PipeLLM',
    baseUrl: 'https://api.pipellm.ai/openai/v1',
    quickAccess: false,
  },
  {
    providerId: 'miyang',
    key: 'provider-preset:miyang',
    group: '聚合与代理',
    label: '米羊',
    baseUrl: 'https://miyang.cn/api/v1',
    quickAccess: false,
  },
  {
    providerId: 'tokendance',
    key: 'provider-preset:tokendance',
    group: '聚合与代理',
    label: '观猹 / 词元跳动',
    baseUrl: 'https://tokendance.space/gateway/v1',
    quickAccess: false,
  },

  // 本地：不把 Alice 固定的本地 API Key 带进注册表。
  {
    providerId: 'ollama',
    key: 'provider-preset:local:ollama',
    group: '本地 / 自定义',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    quickAccess: false,
  },
  {
    providerId: 'lmstudio',
    key: 'provider-preset:local:lm-studio',
    group: '本地 / 自定义',
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
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

export const QUICK_PROVIDER_ENTRIES = PROVIDER_PRESETS.filter((preset) => preset.quickAccess)
