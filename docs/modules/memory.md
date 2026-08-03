# 记忆（memory）

## 一句话

跨会话持久化用户信息，并在对话前检索注入 Prompt，使 Agent「越用越懂你」。

## 边界

**做**：结构化记忆（画像/偏好/事实）、向量语义召回、remember/recall/forget 工具、MemoryPanel、对话索引、注入 L3。  
**不做**：项目文档 RAG 库（见 rag）；Skill 手册；会话内短期上下文压缩（见 context-manager，属运行时）。

## 短 Why

没有记忆的人格是失忆演员。记忆必须可写、可召回、可遗忘，并与 Prompt 组装联动。

## 主入口

| 类型 | 位置 |
|------|------|
| UI | `MemoryPanel` |
| IPC | `ipc/memory.ts` |
| 工具 | `remember` / `recall` / `forget` |
| Prompt | L3（画像 + 检索片段） |
| 后台 | profile 提取、对话向量索引 |

## 依赖

- **依赖**：storage（SQLite）、memory/vector-store + embeddings、prompt-builder、llm（提取/嵌入）  
- **被依赖**：chat 发送路径、companion 反思（用户消息/反馈信号）、DevPanel 可观测

## 不变量

- 结构化记忆与向量库**双写一致**（增删改联动）  
- Prompt 不得重复堆叠同一段画像（避免双重注入）  
- 对外错误不暴露内部路径 / SQL

## 必读文件

- `electron/main/storage/memory-store.ts`
- `electron/main/memory/vector-store.ts`
- `electron/main/memory/embeddings.ts`
- `electron/main/tools/builtins/memory-manage.ts`
- `electron/main/agent/profile-extractor.ts`
- `electron/main/agent/prompt-builder.ts`
- `src/components/MemoryPanel.tsx`
- `electron/main/ipc/memory.ts`

## 必测点

- remember 后 recall 能命中；forget 后两侧干净  
- 相关单测：`memory-tools`；语义去重相关测试（若有）  
- 手动：MemoryPanel CRUD 与对话注入可感知

## 现状 / 缺口

**现状**：SQLite + Vectra；工具三件套；画像提取；语义去重；体验契约见 `methodology/m29-asymmetric-memory.md`。  
**缺口**：敏感类高亮（M29-G3）。  
**已落地**：本轮引用芯片（M29-G1）；对话内「记错了/改正」（M29-G2：`memory:correct-citation`）。
