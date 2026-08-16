# M07 上下文压缩 — 代码走读

> 理念章：[`m07-context-compression.md`](./m07-context-compression.md)
> 最近核对：2026-08-16
> 事实源：`electron/main/agent/context-manager.ts`、`model-context-window.ts`、`relationship-minset.ts`、`loop.ts`

---

## 一、入口与模型窗口

`compressContext(messages, options)` 的窗口优先级：

```text
显式 maxTokens
→ 根据 llmConfig.model 匹配 MODEL_CONTEXT_WINDOWS
→ DEFAULT_MAX_TOKENS
```

模型窗口会减去 OUTPUT_RESERVE_TOKENS，并保证不低于 MIN_EFFECTIVE_CONTEXT_TOKENS。上一轮 API 返回的 `lastActualPromptTokens` 优先于启发式估算；没有真实 usage 时才按中英字符、工具参数和图片占位估算。

## 二、四层阈值

```text
L1 Snip          60%
L2 MicroCompact  75%
L3 Collapse      90%
L4 AutoCompact   95%
```

每层执行后重新估算，达到目标就停止。阈值相对于有效模型窗口，不写死一个 128K/400K 数字。

## 三、图片先剥离

`stripImagesForCompression()` 把图片载荷移除，只保留“已移除 N 张图片”的文本占位。图片 token 估算不应迫使文本摘要携带 base64，也不能把旧图片继续塞进压缩 LLM。

## 四、Preamble 与最近消息

`getPreambleEndIndex()` 保护开头连续 system/developer 组，不再只保护 messages[0]。最近 `RECENT_KEEP_COUNT=6` 条消息保持原样；中段才进入 Snip、MicroCompact 或摘要。

工具消息清理会移除孤立 tool result，保证 assistant toolCall 与 tool message 结构合法。

## 五、L1 Snip

Snip 最多处理 5 条中段大消息，将长工具结果/文本替换成带类型和长度的短说明。它零 LLM 成本，不改变 preamble 和最近消息。

## 六、L2 MicroCompact

MicroCompact 用规则合并连续同角色消息、压缩冗余工具输出并保持调用配对。它仍不调用模型，适合在 75% 左右先回收结构浪费。

## 七、文件读取快照

压缩入口先从原始消息历史提取最近 `file_read`：

- 通过 assistant toolCall 的 path 关联 tool result；
- 同一路径只保留最近一次；
- 最多 5 个文件；
- 单文件最多 5,000 token；
- 总计最多 50,000 token；
- 错误结果不恢复。

Collapse/AutoCompact 后把快照作为独立恢复消息注入，避免模型因摘要丢失文件内容而重复读取。

## 八、L3 Collapse

Collapse 保留 preamble，摘要中段，再附文件恢复消息。`querySource='main'` 且有 llmConfig 时调用 `chatComplete`；其他来源使用规则摘要，防止“为了压缩而调用 LLM，LLM 又触发压缩”的递归。

当前 QuerySource：

```text
main / compact / memory / title / classifier
```

摘要 Prompt 使用注册资产，并要求固定章节：当前任务、已完成步骤、当前状态、下一步计划、关键上下文、关系最小集。

## 九、关系最小集

`relationship-minset.ts` 从待压缩消息中启发式提取：

- 称呼与沟通偏好；
- 进行中的共同约定；
- 用户要求暂时别提/别问的情感锚点。

结果并入摘要；没有命中也写“无”，禁止模型编造关系事实。它补充长期记忆，但不替代记忆系统。

## 十、L4 AutoCompact

L4 对更大范围做 LLM 摘要，保留 preamble、摘要、文件恢复和最近消息。只允许 main source 进入 LLM 路径。摘要消息带 `compactMetadata`：level、pre/post token、pre/post message 等结构信息；事件流只传 metadata，不把摘要正文广播到 Renderer。

## 十一、Reactive Compact 与应急截断

Provider 返回 413/上下文过长时，Loop 先尝试 reactive compact；如果压缩没有减少消息或连续失败，`emergencyTruncate()` 使用纯规则删除中段并保持 preamble、最近消息和工具配对。再次失败则以 `prompt_too_long` 终止，不无限重试。

## 十二、测试证据

- `context-manager.test.ts`：四层、阈值、图片、preamble、file restore、应急截断；
- `context-structured-summary.test.ts`：结构化摘要与关系最小集；
- `context-estimate.test.ts`：token 估算；
- `relationship-minset.test.ts`：抽取与合并；
- `agent-loop.test.ts`：413 reactive compact 和熔断。

## 十三、当前缺口

- token 估算仍是启发式，跨 Provider 精度依赖 API usage；
- 文件恢复快照只覆盖 `file_read`，不覆盖任意 MCP 文件工具；
- 压缩摘要没有独立可编辑 Session Memory；
- 更强的语义保真仍依赖摘要模型质量。
