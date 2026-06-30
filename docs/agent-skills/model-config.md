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
| `llm/index.ts` | `streamChat` 入口，路由到对应 Provider |
| `llm/provider-router.ts` | `detectProvider` / `buildAnthropicBody` / `buildGeminiBody` |
| `shared/types.ts` | `LLMConfig` / `LLMProvider` 类型定义 |
| `storage/settings-store.ts` | `AppSettings` 中的 LLM 相关字段 |

## Provider 检测规则

`detectProvider(config)` 优先级：

1. `config.provider` 显式指定且不是 `auto`，直接使用。
2. `baseUrl` 包含 `anthropic`，使用 `anthropic`。
3. `baseUrl` 包含 `generativelanguage.googleapis`，使用 `gemini`。
4. 兜底使用 `openai`。

## 双模型配置

| 字段 | 用途 | 默认值 |
|------|------|--------|
| `llmModel` | 主对话模型 | `gpt-4o` |
| `auxModel` | 辅助任务模型，标题、画像、压缩摘要 | 留空时沿用主模型 |

Runtime 通过 `getLLMConfig()` / `getAuxLLMConfig()` 分别获取。

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

`querySource` 互斥守卫：compact、memory、title 来源调用自动跳过 LLM 摘要，防递归。

## 预设模型

UI 顶栏快切提供预设模型，位置通常在 `SettingsPanel.tsx` 的 `PRESETS` 数组，可按实际实现扩展。
