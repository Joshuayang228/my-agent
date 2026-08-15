# Model Config

## 使用场景

调用 AI 模型、新增 Provider、修改 LLM 适配器、改上下文压缩或 token 预算逻辑时参考本文档。

## 架构

```text
用户请求 -> AgentRuntime -> Provider Router -> streamChat / streamChatAnthropic
                                |
                                v
                         detectProvider(config)
                         - openai: OpenAI 兼容 SSE
                         - anthropic: Anthropic Messages API
                         - gemini: Gemini API
```

OpenAI 兼容路径覆盖 DeepSeek、Groq、OpenRouter 等。

## 关键文件

| 文件 | 职责 |
|------|------|
| `llm/index.ts` | `streamChat` 统一入口，执行 Provider 路由、重试与顺序 Failover |
| `llm/provider-router.ts` | Provider 检测规则、Anthropic / Gemini 请求构造器 |
| `llm/request-builders.ts` | OpenAI Compatible 消息、工具与请求纯构造器 |
| `llm/thinking.ts` · `llm/vision.ts` · `llm/failover.ts` | Thinking、Vision 降级与 Failover 生产策略事实 |
| `agent/model-context-window.ts` | Context Window 家族启发式与输出预留 |
| `llm/provider-asset-registry.ts` | Debug 只读 Provider 能力 / 策略 / 预设资产 |
| `src/shared/provider-presets.ts` | Settings 与 Chat 共用的内置模型预设唯一注册表 |
| `shared/types.ts` | `LLMConfig` / `LLMProvider` 类型定义 |
| `storage/settings-store.ts` | `AppSettings` 中的 LLM 相关字段 |

## Provider 检测规则

`detectProvider(config)` 优先级：

1. `config.provider` 显式指定且不是 `auto`，直接使用。
2. `baseUrl` 命中 `PROVIDER_DETECTION_RULES` 的 Anthropic 规则，使用 `anthropic`。
3. `baseUrl` 命中 Gemini 规则，使用 `gemini`。
4. 未知端点兜底使用 OpenAI Compatible。

运行时检测与 Debug Provider 目录必须共用 `PROVIDER_DETECTION_RULES` / `detectProviderFromBaseUrl`，禁止在展示层复制正则。

## 双模型配置

| 字段 | 用途 | 默认值 |
|------|------|--------|
| `llmModel` | 主对话模型 | `gpt-4o` |
| `auxModel` | 辅助任务模型，标题、画像、压缩摘要 | 留空时沿用主模型 |

Runtime 通过 `getLLMConfig()` / `getAuxLLMConfig()` 分别获取。二者必须委托 `llm/aux-config.ts` 的 `loadMainLLMConfig` / `loadAuxLLMConfig`——**禁止**在 ipc / storage / tools / playground 手拼 `apiKey`+`baseUrl`+`model`。`loadAuxLLMConfig` 会按能力缓存或启发式挂上 `thinking: { type: 'disabled' }`（DeepSeek / Moonshot 等）。

## Thinking / reasoning

- OpenAI 兼容请求可带 `LLMConfig.thinking = { type: 'enabled' | 'disabled' }`（对照 Alice provider `extraParams.thinking`）。
- DeepSeek V4 默认开 thinking，**reasoning 与 content 共用 `max_tokens`**；辅助调用（title/profile）若预算过小会只吐 reasoning。
- Playground「模型测试」可烟测连通，并探测 `thinking.disabled` 是否生效；结果写入 settings `llmCapabilityCache`。
- 探测优先级：`supported` → 辅助关 thinking；`unsupported` → 不传；`unknown` → 按 baseUrl/model 启发式。

## LLM 调用规范

- 每次调用必须标记来源 `caller`，例如 `main`、`compact`、`memory`、`title`、`subagent`。
- 流式返回使用 `AsyncGenerator<AgentStreamEvent>`。
- 重试策略：网络错误、429、5xx 最多 2 次，指数退避。
- Token 消耗记录到 `session.total_prompt_tokens` / `total_completion_tokens`。
- Token 预算检查在每轮 loop 开始前执行。

## 上下文压缩

四层分级压缩：

| 层级 | 触发阈值 | 策略 | querySource |
|------|----------|------|-------------|
| L1 Snip | 60% | 删除最早工具调用轮次 | - |
| L2 MicroCompact | 75% | 去重相同工具调用 | - |
| L3 Collapse | 90% | LLM 摘要，降级为规则占位符 | compact |
| L4 AutoCompact | 95% | 全量重写 | compact |

`querySource` 互斥守卫：compact、memory、title 来源调用自动跳过 LLM 摘要，防递归。模型窗口与输出预留只从 `agent/model-context-window.ts` 读取；这些值是本项目压缩策略的保守事实，不代表厂商实时规格。

## Provider 生产资产

- `llm/provider-asset-registry.ts` 只登记当前代码真实实现的 OpenAI Compatible、Anthropic、Gemini 协议能力，以及自动检测、辅助 Thinking、Context Window、Vision 降级和顺序 Failover 策略。
- 能力摘要通过脱敏合成配置调用真实请求构造器，只保留 endpoint、header 名、query 参数名和 body key；不得保存认证值。
- 具体模型是否支持 Tool、Vision、Thinking 等能力，仍需连接测试或 Playground 探测；适配器能构造字段不等于型号能力保证。
- `llmCapabilityCache`、Vision deny cache、用户自定义 Base URL / Model / Fallback 和 API Key 属于运行时或用户配置，不进入静态生产资产目录。

## 预设模型

- 所有内置预设统一登记在 `src/shared/provider-presets.ts`，禁止在 `SettingsPanel.tsx`、`App.tsx` 或 Debug 中复制数组。
- Settings 展示全部 9 个预设；Chat 顶栏只过滤 `quickAccess: true` 的 4 个预设。
- 预设只是填表模板，不是对应模型的能力或可用性承诺。
