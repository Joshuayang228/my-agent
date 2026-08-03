# M27 对话行为与两空间代码走读

> 对应 `m27-conversation-two-spaces.md`（加厚修订版）。

---

## §二–§三 对照：aside 协议与渲染

### 我们的实现

**Prompt（`prompt-builder.ts`）**：

```text
## Response format
1. main — professional, helpful, focused
2. optional <aside>...</aside> — {aside_style}, one sentence, not every turn
```

`aside_style` ← `rolePackToPromptParts` ← Pack `asideStyle`。

**UI（`MarkdownRenderer.tsx`）**：

```text
splitAside(raw) → { main, asides[] }
ReactMarkdown(main)
asides → text-[11px] italic muted
```

| 设计点 | 选择 | 原因 |
|--------|------|------|
| 标签名 | `<aside>` | 与 HTML 语义接近、少碰撞 |
| 多 aside | 数组全渲染 | 容错；规范仍要求一句 |
| 剥离失败标签 | regex 清残留 | 防半截标签进正文 |

**方法论对照**：→ §二 §三

---

## §四 对照：工具轮丢弃正文

### 我们的实现（`loop.ts`）

```text
if (toolCalls.length > 0) {
  log.debug('Discarding companion text (Alice strategy)', { discardedLength })
  messages.push({ content: '', toolCalls })
  yield tool_calls
} else {
  messages.push({ content })
  yield done
}
```

| 层 | 是否保留陪伴字 |
|----|----------------|
| 流式 UI 瞬时 | 可能闪过 |
| messages 持久 | 否（工具轮） |
| 下一轮模型输入 | 见持久历史 |

**发现**：这是行为纪律的硬闸，不依赖模型「自觉少说话」。

**方法论对照**：→ §四

---

## §五 / §十 对照：executionMode 文案

```text
plan-first → 必须先明文计划再工具
confirm-all → 提示每步需批
（另）task_plan + 收尾自检段落
```

无独立「行为状态机」对象；旋钮在 settings → Prompt。

**方法论对照**：→ §五 §八 §十

---

## §十 对照：召唤声明

`runtime` 组装召唤会话时追加短声明：单独短聊、不推进对方生活世界。  
与 `scheduleReflectionAfterChat` 的 summon 短接配合。

**方法论对照**：→ §十

---

## §五 / M27-G1 对照：回复立场

```text
runtime: detectReplyStance(lastUserText, executionMode)
  → formatReplyStanceForPrompt
  → buildSystemPrompt.replyStanceHint
     ## Reply stance (this turn)
```

启发式优先级：推回 > 危险偏问 > 安慰 > 催办即做 > 不清则问 > 均衡。  
不拦 Loop；高风险以 ask/pushback hint 引导。

**方法论对照**：→ §五 · M27-G1

---

## 已知简化

| Gap | 代码 |
|-----|------|
| M27-G2 | 无 aside Eval 场景 |
| M27-G3 | 无情绪特征输入；安慰仅靠关键词 |
