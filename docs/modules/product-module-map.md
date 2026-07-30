# 产品模块地图

> 文件名：`product-module-map.md`（Product Module Map）。  
> **产品维入口**：任务落到某能力时，先读对应模块卡，再改代码。  
> 技术总图见 [`../architecture.md`](../architecture.md)；质量总控见 [`../quality.md`](../quality.md)。  
> 方案：[`../requirements/docs-system-restructure.md`](../requirements/docs-system-restructure.md)

## 为什么需要模块卡

代码按**技术层**组织（ipc / agent / tools / storage…）。  
产品能力是**横切**这些层的一刀——从目录看不出「记忆」「人格」的完整边界。  
模块卡画出横切范围，供人和 AI 做任务入口与范围控制。

## 模块一览

| 模块 | 一句话 | 卡 | 状态 |
|------|--------|----|------|
| 人格 | 一致身份与风格，防止漂移 | [persona.md](./persona.md) | 试点 |
| 记忆 | 跨会话记住并召回用户信息 | [memory.md](./memory.md) | 试点 |
| 权限 | 工具/命令能否执行、是否要问用户 | [permission.md](./permission.md) | 试点 |

后续候选（有横切痛再开卡）：会话 Runtime、MCP 扩展、Skill、RAG、项目工作区。

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

禁止：函数清单、与 architecture 重复的分层科普、把愿望写进「现状」。

## 易混词（薄 glossary）

| 词 | 含义 |
|----|------|
| 工具 Tool | AI 可见、可调用、进对话历史 |
| 服务 Service | 框架内部逻辑，不直接暴露给 LLM |
| PROTECTED | 人格中不可被对话改写的身份核 |
| MUTABLE | 可随交往演化的行为层（成长，待加强） |
| 模块卡 | 产品横切入口文档，不是技术目录说明书 |

## 维护

- 改了某模块的边界 / 入口 / 不变量 / 必测 → **同轮更新该卡**  
- 新增大产品能力且会反复改 → 在本表加一行并新建卡  
- 细节以代码为准；卡只导航
