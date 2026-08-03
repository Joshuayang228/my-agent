# M30 叙事连贯与能力边界代码走读

> 对应 `m30-narrative-capability.md`（加厚修订版）。  
> 理念章讲为什么；本章按推论节号展示「代码如何体现」。无 CC 独章对照时，以我们的实现 + 设计决策为主。

---

## §二 对照：三条叙事线的落点

| 叙事线 | 主要代码 | 说明 |
|--------|----------|------|
| 关系线 | `memory-store` / `profile-extractor` / `mutable-store` / 会话 messages | 持久；压缩不直接删这些表 |
| 日子线 | `life/engine` · `moments` · `assets` · `catchup` | UI 截面 + Catch-up 摘要进 Prompt |
| 干活线 | `loop` · `ToolRegistry` · `permission-engine` | 工具轨迹；失败/确认可见 |

**发现**：三条线分属不同模块，没有「NarrativeCoordinator」——一致性靠纪律与组装，不靠中心裁判（M24-G1 / 本章 Gap 相关）。

**方法论对照**：→ `m30-narrative-capability.md` §二

---

## §三 对照：压缩 vs 持久关系

### 我们的实现

- 压缩：`context-manager` 处理 **messages** 轮次  
- 关系要点若只存在 assistant 口头承诺 → 可被 Snip  
- 正确姿势：`remember` / profile-extract → SQLite；默契 → `setMutable`

```text
危险：约定只活在 chat 气泡里
安全：约定进 memory 或 MUTABLE 后，压缩删气泡也不丢「我们是谁」
```

**发现**：M30-G2「压缩白名单」尚未做；工程上用「提前入库」补救，而不是改压缩器特例。

**方法论对照**：→ §三

---

## §五 对照：组装时注入的叙事薄片

### 我们的实现（`runtime` → `buildSystemPrompt`）

| 注入 | 来源 | 叙事作用 |
|------|------|----------|
| userProfile | memory | 关系线 |
| memories（向量） | vector-store | 关系线召回 |
| catchupSummary | catchup | 日子线（换角后） |
| rosterLines | cast/roster | 圈子浅层 |
| summon 声明 | runtime 字符串 | 番外边界，防日子线偷跑 |

召唤：`session_kind=summon` 时跳过 catchup 注入与反思调度。

**方法论对照**：→ §五

---

## §六–八 对照：能力边界声明（L2）

### 我们的实现（`prompt-builder.ts`）

```text
## Capabilities
- 枚举当前 toolNames（动态，随注册变化）
- 破坏性操作将确认
- 跟随用户语言

## Working method
- plan-first / confirm-all 分支文案
- task_plan + 收尾自检
- remember/recall/forget
```

文末身份锚（近因效应）服务**叙事身份**，不是能力清单：

```text
Remember: you are {name}. Stay in this identity...
```

| 能力相关 | 落点 | 是否 L2 |
|----------|------|---------|
| 有没有某工具 | ToolRegistry → toolNames | 是 |
| 能不能硬干 | permission-engine | 运行时，非 Prompt |
| 会不会装懂 | 模型 + M29 规范 | 无强制拦截器 |

**发现**：把「不会生图朋友圈」写进 PROTECTED 会腐化人设文件；保持「工具列表说了算」更干净。

**方法论对照**：→ §六 §七 §八

---

## §九 对照：干活时丢掉陪伴废话

### 我们的实现（`loop.ts`）

有 `tool_calls` 时，写入历史的 assistant `content` 置空（Alice strategy 日志：`Discarding companion text`）。

**发现**：这是叙事让位于干活线的硬措施——防止工具链上下文被小剧场污染。

**方法论对照**：→ §九

---

## §十 对照：Eval

- `evals/scenarios/b01-persona-tone.ts`：像人，不考核万能  
- `c01-companion.ts`：名册浅注入契约（防串味，服务叙事身份）

**方法论对照**：→ §十

---

## 已知简化（与理念 Gap 对齐）

| Gap | 代码现状 |
|-----|----------|
| M30-G1 里程碑 | ✅ `milestones.ts`；换角/反思/rapport；list + toast |
| M30-G2 压缩白名单 | ✅ `relationship-minset` → compact instruction + merge |
| M30-G3 专家度 | 无用户模型字段 |

---

## §三 / M30-G2 对照：关系最小集

```text
RELATIONSHIP_MINSET_WHITELIST
extractRelationshipMinSet(middleMessages)
→ generateLLMSummary instruction 含白名单节
→ mergeMinSetIntoSummary（LLM 与规则路径）
```

**方法论对照**：→ §三 · M30-G2

---

## §四 / M30-G1 对照：里程碑

```text
tryRecordMilestone(roleId, kind)  // settings companionMilestonesByRole
  first_role_switch ← requestSwitch
  first_reflection  ← reflection 写入成功
  first_rapport     ← stage===rapport（主会话）
→ broadcast companion:milestone + Assemble ## Relationship milestones
```

**方法论对照**：→ §四 · M30-G1
