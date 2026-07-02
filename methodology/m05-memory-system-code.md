# M5：记忆系统 — 代码走读

> 配套 [m05-memory-system.md](m05-memory-system.md) 的认知框架，这里记录具体代码改动。
> 涉及文件：`electron/main/agent/runtime.ts`、`electron/main/memory/vector-store.ts`、`electron/main/agent/profile-extractor.ts`

---

## §1 自我强化循环修复（G1）

### 改造前：assistant 回复被写进召回库

```ts
// runtime.ts enqueuePostTasks
if (assistantContent.length > 50) {
  this.backgroundQueue.push({
    name: 'vector-index-assistant',
    fn: () => addToVectorStore({
      id: `conv-assistant-${now}`,
      text: assistantContent.slice(0, 500),
      category: 'conversation',   // ← 下一轮会被 safeVectorSearch 当记忆召回
      sessionId, timestamp: now,
    }, llmConfig),
  })
}
```

问题：AI 自己的话被无差别写入，下一轮检索捞回来喂给自己 → 自我强化。

### 改造后：只索引用户消息

删掉整个 `vector-index-assistant` 分支，保留 `vector-index-user`。assistant 输出的价值改由 profile-extractor 提炼成结构化记忆（走 SQLite），不再原始堆积进向量库。

判据（认知框架第二节）：召回库只存"关于用户"和"用户说过的"，不存"AI 说过的"。

---

## §2 老化告警（G2）

### 相对时间格式化

```ts
// vector-store.ts
export function formatMemoryAge(timestamp: number, now: number = Date.now()): string {
  const days = Math.max(0, Math.floor((now - timestamp) / (24 * 60 * 60 * 1000)))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

export const MEMORY_STALE_THRESHOLD_DAYS = 7
```

`Math.max(0, ...)` clamp 防时钟偏移把未来时间戳算成负数（对照 CC memoryAge 同款处理）。

用相对时间而非 ISO 时间戳——LLM 对"47 天前"能推理陈旧性，对 `2026-05-17T...` 不能（认知框架第三节）。

---

## §3 召回加工：去重 + 老化（G5 + G2）

抽成纯函数便于测试（见坑：可测性倒逼抽离）：

```ts
// vector-store.ts
export function formatRecallForInjection(
  results: VectorSearchResult[],
  now: number = Date.now(),
): string | null {
  // G5：排除 mem- 前缀（SQLite 记忆已由 buildUserProfile 全量注入，避免双重注入）
  const deduped = results.filter(r => !r.id.startsWith('mem-'))
  if (deduped.length === 0) return null

  // G2：每条加相对时间，超阈值标记 hasStale
  let hasStale = false
  const lines = deduped.map(r => {
    const age = formatMemoryAge(r.timestamp, now)
    const ageDays = Math.floor((now - r.timestamp) / (24 * 60 * 60 * 1000))
    if (ageDays > MEMORY_STALE_THRESHOLD_DAYS) hasStale = true
    return `- [${r.category}·${age}] ${r.text}`
  })

  let output = lines.join('\n')
  if (hasStale) {
    output += '\n\n（部分记忆记录较早，如与当前对话不符，请以用户当前表述为准。）'
  }
  return output
}
```

### runtime 侧只做编排

```ts
private async safeVectorSearch(query, llmConfig): Promise<string | undefined> {
  if (!query) return undefined
  try {
    const results = await searchVectorStore(query, llmConfig, { topK: 5, minScore: 0.6 })
    const output = formatRecallForInjection(results)   // 纯逻辑抽出
    if (output) {
      log.info('Vector recall', { query: query.slice(0, 50), resultCount: results.length })
      return output
    }
  } catch (err) {
    log.warn('Vector search skipped', { error: String(err) })
  }
  return undefined
}
```

**G5 去重的 id 约定**：SQLite 记忆双写进向量库时 id 是 `mem-{ts}-{rand}`，对话片段是 `conv-user-{ts}`。按 `mem-` 前缀过滤即可区分"已全量注入的"和"仅检索召回的"。

---

## §4 提取判据强化（G4）

`profile-extractor.ts` 的 `EXTRACTION_PROMPT` 加入"该存/不该存"清单：

```
DO save (durable knowledge):
- Stable preferences and habits
- Identity facts (role, expertise, tech stack, location)
- Explicit corrections about how they want you to work

Do NOT save:
- Transient task state ("currently debugging", "on step 3")
- Anything derivable from the current conversation
- The assistant's own instructions, persona, or behavior rules
- Overly generic statements
- One-off facts that won't matter next conversation
```

核心测试：a memory should "stay useful once added" — not a log of what happened（认知框架第一节判据）。

---

## 测试清单（M5 新增 12 个）

| 测试 | 覆盖 | 文件 |
|------|------|------|
| G2 formatMemoryAge ×6 | 今天/昨天/N天前/未来clamp/阈值常量/陈旧判定 | memory-aging.test.ts |
| G5 去重 ×3 | 排除 mem- / 全 mem- 返回 null / 空返回 null | memory-aging.test.ts |
| G2 召回加工 ×3 | 带时间感 / 超阈值加提示 / 新记忆不加提示 | memory-aging.test.ts |

单测 127 → 139。全程 tsc 零错误。

G1（删除行为）、G4（prompt 文本）无独立单测——G1 是行为删除，由"assistant 内容不再出现在召回"隐式覆盖；G4 是 prompt 措辞，效果需真实 LLM 验证，不做 mock 断言。
