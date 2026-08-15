# M29 信息不对称与记忆透明代码走读

> 对应 `m29-asymmetric-memory.md`（加厚修订版）。

---

## §二 / §四 对照：不对称能力（注入）

```text
runtime 组装
  → memory.buildUserProfile()
  → safeVectorSearch(lastUser) → formatRecallForInjection
  → buildSystemPrompt L3
```

**已落地（M29-G1）**：

```text
extractMemoryCitations(results)  // 与 formatRecall 同去重
→ yield { type: 'memory_citations', items }
→ Chat 挂 memoryCitations 芯片（hover 见 id）
```

**方法论对照**：→ §二 §四

---

## §六 / M29-G1 对照：指认

| 步骤 | 现状 |
|------|------|
| 本轮 hit → UI | ✅ `memory_citations` |
| 一键纠错 | ✅ `correctCitedMemory` + 芯片按钮 |

```text
memory:correct-citation(id, replacement?)
  planCitationCorrection(hasSqlite, replacement)
  → deleteMemory | removeFromVectorStore | updateMemory | addMemory(fact)
```

---

## §五 对照：治理面

| 入口 | 路径 |
|------|------|
| UI | MemoryPanel → `memory:list/add/update/delete` |
| 工具 | `memory-manage.ts` remember/recall/forget |
| 人格默契 | **不**走 Panel → `companion:*mutable*` |

**方法论对照**：→ §五 §九

---

## §七 对照：双写删除

forget / Panel delete：SQLite 删除后必须联动向量删除（M08 纪律）。  
写入：用户消息可索引；assistant 原文不进向量（防自我强化）。

**方法论对照**：→ §七

---

## §六 对照：纠错闭环缺口

| 步骤 | 现状 |
|------|------|
| 用户口头纠正 | 依赖模型调 forget |
| 一键按钮 | ✅ 芯片「记错了/改正」 |
| 指认本轮引用 | ✅ 芯片（M29-G1） |
| 面板手删 | ✅ |

**方法论对照**：→ §六

---

## §十 对照：跨角色

- 画像：全局 memory 表（无 role 强制隔离）  
- MUTABLE / 生活：按 roleId  
- 反思 feedback：`listFeedbackForRole(roleId)`（M22-G2 已收）

**方法论对照**：→ §十

---

## §八 / M29-G3 对照：敏感采集与高亮

```text
src/shared/sensitive-memory.ts → detectSensitiveKinds
MemoryPanel：列表暖色高亮 + 入库 confirm
remember 工具：返回附注
prompt-builder：勿存密钥 / 敏感先问
```

**方法论对照**：→ §八

---

## 已知简化

| Gap | 代码 |
|-----|------|
| M29-G1 | ✅ 芯片（未持久进 session 库） |
| M29-G2 | ✅ correct-citation |
| M29-G3 | ✅ 启发式五类；误标可忽略，非分类器 |

工程细节亦见 `m08-memory-system*.md`。

## 2026-08 当前实现校准

信息不对称的真实边界在 `memory-store.ts`、`ipc/memory.ts` 和 `agent/runtime.ts`：用户可管理的记忆、Agent 可用的召回和 Debug 可见的结构证据是三种视图；敏感记忆不会因 Debug 或普通召回自动泄露。测试见 `citation-correct.test.ts`、`sensitive-memory.test.ts`、`memory-feedback-role.test.ts`。
