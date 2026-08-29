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
- 相关单测：`memory-tools`；语义去重相关测试（若有）；后台向量任务 teardown drain
- 手动：MemoryPanel CRUD 与对话注入可感知

## 已落地能力

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| 结构化记忆（画像 / 偏好 / 事实） | 已落地 | `memory-store` · MemoryPanel · `memory:*` IPC |
| remember / recall / forget 工具 | 已落地 | `tools/builtins/memory-manage.ts` |
| 向量语义召回注入 L3 | 已落地 | `vector-store` · `runtime.safeVectorSearch` |
| 对话后索引用户消息 | 已落地 | `vector-index-user`（不索引 assistant 原文） |
| 后台画像提取 | 已落地 | `profile-extractor` · task `profile-extract` |
| 语义去重（记忆写入） | 已落地 | M08 G6 |
| 记忆后台向量任务生命周期 | 已落地 | `drainMemoryBackgroundTasks`；保留非阻塞写入，同时为测试 teardown / 应用退出提供 drain 边界 |
| 本轮引用芯片（M29-G1） | 已落地 | `memory_citations` · `MemoryCitationChips`（Chat + Playground） |
| 对话内纠错（M29-G2） | 已落地 | `correctCitedMemory` |
| 敏感高亮与采集提示（M29-G3） | 已落地 | `sensitive-memory`；自动画像跳过敏感类别，凭据内容在存储/导入/向量召回层硬拒绝 |
| MemoryPanel 页面基线 | 已落地 | Playground 静态只读夹具：列表 / 空态 / 敏感项 / 编辑态；分类图标、名称与数量在窄宽下保持同行 |
| 记忆分类语义色 | 已落地 | `MemoryPanel` 使用 accent / warm / success / muted；颜色只表达分类，不改变存储与 IPC |
| 记忆策略生产资产目录 | 已落地 | 全局 Debug「提示词管理器 → 记忆策略」；提取 / 去重 / 分桶 / 召回 / 生命周期 / 纠错策略有稳定 key、来源、版本、指纹和依赖；不再从 Chat 右侧调试半屏进入；记忆管理入口位于 Settings |
| 项目文档 RAG | 不做（本模块） | 见 `rag/` |

## 相关决策

- `DEC-004`：SQLite + 向量数据库的双层存储选择。
- `DEC-007`：Vectra 作为本地向量检索层。
- `DEC-009`：Embedding 复用 LLM API，不内置本地模型。

## 现状 / 缺口

**现状**：SQLite + Vectra；工具三件套；画像提取；敏感信息 fail-closed；凭据不进入长期记忆或 Prompt；语义去重；M29 芯片/纠错/敏感；体验契约见 `methodology/m29-asymmetric-memory.md`。
**缺口**：见上表；项目 RAG 不归本模块。
