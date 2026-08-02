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

**无**：把 hit 的 memory id yield 给渲染进程（M29-G1）。

**方法论对照**：→ §二 §四

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
| 一键按钮 | 无（M29-G2） |
| 指认本轮引用 | 无芯片（M29-G1） |
| 面板手删 | ✅ |

**方法论对照**：→ §六

---

## §十 对照：跨角色

- 画像：全局 memory 表（无 role 强制隔离）  
- MUTABLE / 生活：按 roleId  
- 反思 feedback：`listFeedbackForRole(roleId)`（M22-G2 已收）

**方法论对照**：→ §十

---

## 已知简化

与理念 Gap M29-G1–G3 一致；工程细节见 `m08-memory-system*.md`。
