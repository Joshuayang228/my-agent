# 产品模块（`docs/modules/`）

> 本夹 **README**：产品维导览（原 `product-module-map.md`）。  
> **产品维入口**：任务落到某能力时，先读对应模块卡，再改代码。  
> 技术总图见 [`../architecture.md`](../architecture.md)；质量总控见 [`../quality.md`](../quality.md)。  
> **已落地能力表**见 [`capability-catalog.md`](./capability-catalog.md)（替代已归档的 `features.md`）。  
> 需求合同索引：[`../requirements/README.md`](../requirements/README.md)。  
> 文档体系：[`../docs-system.md`](../docs-system.md)

## 为什么需要模块卡

代码按**技术层**组织（ipc / agent / tools / storage…）。  
产品能力是**横切**这些层的一刀——从目录看不出「记忆」「人格」的完整边界。  
模块卡画出横切范围，供人和 AI 做任务入口与范围控制。  
「有哪些具体能力」不堆在卡上 → 见能力目录。

## 模块一览

| 模块 | 一句话 | 卡 | 状态 |
|------|--------|----|------|
| 伙伴世界 | 单活跃主角 + 生活世界 + 截面（含原「人格」） | [companion.md](./companion.md) | W0–W6 + 召唤/反思 |
| 记忆 | 跨会话记住并召回用户信息 | [memory.md](./memory.md) | 试点 |
| 权限 | 工具/命令能否执行、是否要问用户 | [permission.md](./permission.md) | 试点 |
| Agent 运行时 | Loop / Prompt / 压缩 / 任务队列 | （暂无独立卡） | 见 [capability-catalog §4](./capability-catalog.md) |

后续候选模块卡：MCP、Skill、RAG、项目工作区。设计入口见 `companion-architecture` / 各 methodology。

## 模块卡字段（封顶）

1. 一句话  
2. 边界（做 / 不做）  
3. 短 Why  
4. 主入口（UI / IPC / 工具 / Prompt）  
5. 依赖 / 被依赖  
6. 不变量  
7. 必读文件（3～8 个）  
8. 必测点  
9. 现状 / 缺口  

禁止：函数清单、与 architecture 重复的分层科普、把愿望写进「现状」、**仅重定向/占位的空壳卡**（合并后直接改导览指向存活卡，不留 `xxx → 请读 yyy` 文件）。

## 易混词（薄 glossary）

| 词 | 含义 |
|----|------|
| 工具 Tool | AI 可见、可调用、进对话历史 |
| 服务 Service | 框架内部逻辑，不直接暴露给 LLM |
| PROTECTED | 人格中不可被对话改写的身份核 |
| MUTABLE | 可随交往演化的行为层（自动反思可写版本） |
| 模块卡 | 产品横切入口文档，不是技术目录说明书 |
| 能力目录 | 已落地能力表；回答「有什么」，不替代模块卡边界 |

## 维护

- 改了某模块的边界 / 入口 / 不变量 / 必测 → **同轮更新该卡**  
- 新增大产品能力且会反复改 → 在本表加一行并新建卡  
- 细节以代码为准；卡只导航
