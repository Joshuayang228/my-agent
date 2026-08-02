# M29 信息不对称与记忆透明代码走读

> 对应 `m29-asymmetric-memory.md`。工程细节以 M08 为准；本章只钉体验相关路径。

---

## 一、模块地图

```
storage/memory-store.ts          # 结构化记忆 CRUD
memory/vector-store.ts           # 向量召回 / 双写删除
tools/builtins/memory-manage.ts  # remember / recall / forget
agent/profile-extractor.ts       # 后台提炼（非原始 assistant 入库）
agent/runtime.ts                 # buildUserProfile + safeVectorSearch
ipc/memory.ts + MemoryPanel.tsx  # 用户可见治理面
```

---

## 二、透明主路径（用户侧）

```
MemoryPanel
  → memory:list / add / update / delete
  → store + vector 联动
```

工具路径：模型可 `remember` / `forget`；应与面板最终一致。

---

## 三、不对称能力路径（注入）

```
chat 组装
  → memory.buildUserProfile()     # 结构化
  → safeVectorSearch(lastUser)  # topK/minScore → formatRecallForInjection
  → buildSystemPrompt L3
```

**无**：把「本轮 hit 的 memory id」yield 给 UI（M29-G1）。

---

## 四、纠错路径

```
forget(id) / Panel delete
  → SQLite 删
  → 向量侧同步删（双写纪律）
```

对话内「记错了」无专用快捷 IPC（M29-G2）；依赖模型调 forget 或用户打开面板。

---

## 五、约束速查

| 约束 | 落点 |
|------|------|
| 用户可看见条目 | MemoryPanel |
| 删要双清 | memory 工具 + store |
| 不索引 assistant 原文 | runtime enqueuePostTasks |
| 引用标注 | 未做 → M29-G1 |

---

## 六、已知简化

- 无本轮引用芯片（M29-G1）  
- 无对话内一键纠错（M29-G2）  
- 无敏感类高亮（M29-G3）  
