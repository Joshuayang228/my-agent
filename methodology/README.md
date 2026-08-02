# 方法论

本文件夹记录我们在构建人格化 AI Agent 过程中的设计哲学和独立思考。

**写作原则**：
- 每个观点都是我们自己的思考，不搬运外部资料
- 每条内容经过讨论对齐后才写入
- 记录真实的取舍过程，包括走过的弯路

---

## 章节架构设计决策

### 为什么分六个部分

M01–M31 按**依赖层级**从底向上排列：底层基础设施决定上层能做什么，读者应先理解当前章节所依赖的那一层。

**Part I 核心运行时** 最先，因为 Streaming 和错误体系是 Agent Loop 本身运行的基础——不理解流式传输如何传播，就无法真正理解 Loop 为何如此设计。错误体系放在工具系统之前，因为错误处理贯穿整个运行时，不是某个模块的附属。

**Part II 上下文与记忆** 把 System Prompt 放在 Memory 之前：Memory 召回的最终产出是注入 System Prompt，读者必须先知道 System Prompt 是什么结构，才能理解记忆去了哪里、怎么用的。后台任务（原 M11）从末尾移入这组，因为它的三个任务类型全部服务于记忆系统，逻辑上属于这里。

**Part III 安全与扩展** 把三个控制面放在一起：权限系统定义"谁能做什么"，Hook 系统定义"框架如何被扩展"，IPC 定义"主进程与渲染进程如何协作"。MCP 占位在这里，因为它本质上是扩展机制的标准化协议。

**Part IV 可观测与质量** 把 Eval 放在测试架构和状态机之后：状态机设计和并发模型是理解 Eval 场景设计的前提（很多 Eval 场景就是在验证状态机是否正确转移）。

**Part V 智能与进化** 只保留多 Agent 和自进化两章——这两块是通用 Agent 能力，与产品类型无关。

**Part VI 伙伴与生活世界**（2026-08-01 重排）：终局对齐「有人设、有成长、有每日生活、有朋友圈/衣柜/交际圈」。结构为 **Identity → Growth → World → 体验横切 → 在场**。旧体验向占位归档至 `_archive/methodology-companion-legacy/`。

**与四维文档对齐**（不必再改章号）：

| 写什么 | 落点 |
|--------|------|
| 产品契约 / W 批次 | `docs/requirements/companion-world-framework.md` |
| 模块架构详设 | `docs/requirements/companion-architecture.md` |
| 全局技术指针 | `docs/architecture.md` §5.1 |
| 深 Why / 自洽 | **本目录 M21–M31**（随 W 沉淀，不当施工图） |

**运行时硬约束（写入各章时勿违背）**：同团多主角可切换；**同时只启用一个**；会话中禁止换角；非活跃暂停；切换 Catch-up **细补 ≤7 天**。

**施工与沉淀**：工程只认 W0–W6；方法论按问题域编号，**不按 M 号顺序施工**。

### 文件命名

`mNN-主题.md`（+ 可选 `-code.md`），与章节编号一一对应。

---

## 完整章节目录

### Part I：核心运行时

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M01 | Agent Loop | `m01-agent-loop.md` + `m01-agent-loop-code.md` | ✅ |
| M02 | Streaming 设计范式 | `m02-streaming-design.md` + `m02-streaming-design-code.md` | ✅ |
| M03 | 错误体系设计 | `m03-error-system.md` + `m03-error-system-code.md` | ✅ |
| M04 | 工具系统 | `m04-tool-system.md` + `m04-tool-system-code.md` | ✅ |
| M05 | LLM 路由与适配 | `m05-llm-routing.md` + `m05-llm-routing-code.md` | ✅ |

### Part II：上下文与记忆

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M06 | System Prompt 工程化 | `m06-system-prompt-engineering.md` + `m06-system-prompt-engineering-code.md` | ✅ |
| M07 | 上下文压缩 | `m07-context-compression.md` + `m07-context-compression-code.md` | ✅ |
| M08 | 记忆系统 | `m08-memory-system.md` + `m08-memory-system-code.md` | ✅ |
| M09 | 后台任务生命周期 | `m09-task-lifecycle.md` + `m09-task-lifecycle-code.md` | ✅ |

### Part III：安全与扩展

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M10 | 权限与安全 | `m10-permission-security.md` + `m10-permission-security-code.md` | ✅ |
| M11 | Hook / 扩展点架构 | `m11-hook-extension-architecture.md` + `m11-hook-extension-architecture-code.md` | ✅ |
| M12 | IPC 架构 | `m12-ipc-architecture.md` + `m12-ipc-architecture-code.md` | ✅ |
| M13 | MCP 集成 | `m13-mcp-integration.md` + `m13-mcp-integration-code.md` | ✅ |

### Part IV：可观测与质量

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M14 | 可观测性 | `m14-observability.md` + `m14-observability-code.md` | ✅ |
| M15 | 状态机设计 | `m15-state-machine-design.md` + `m15-state-machine-design-code.md` | ✅ |
| M16 | 并发与数据架构 | `m16-concurrency-data-architecture.md` + `m16-concurrency-data-architecture-code.md` | ✅ |
| M17 | 测试架构 | `m17-testing-architecture.md` + `m17-testing-architecture-code.md` | ✅ |
| M18 | Eval 体系（上下两章） | `m18-eval.md` + `m18-eval-persona.md` + `m18-eval-code.md` | ✅ |

### Part V：智能与进化

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M19 | 多 Agent 协作 | `m19-multi-agent.md` + `m19-multi-agent-code.md` | ✅ |
| M20 | 自进化架构 | `m20-self-evolution.md` + `m20-self-evolution-code.md` | ✅ |

### Part VI：伙伴与生活世界

> 技术框架与 W 批次：`docs/requirements/companion-world-framework.md`

| 编号 | 章节 | 文件 | 层 | 主 W | 状态 |
|------|------|------|----|------|------|
| M21 | 人格引擎与设定集 | `m21-persona-engine.md` + `-code.md` | Identity | W0 | ✅（G3/G5 见 M22/W0） |
| M22 | 成长核：MUTABLE 与反思 | `m22-growth-mutable.md` + `-code.md` | Growth | W1 | ✅ |
| M23 | 生活世界架构 | `m23-world-architecture.md` + `-code.md` | World | W2 | ✅ |
| M24 | 朋友圈与事件层 | `m24-moments-event-layer.md` + `-code.md` | World | W3 | ✅ |
| M25 | 资产层（衣柜等） | `m25-assets-wardrobe.md` | World | W4 | 📋 |
| M26 | 交际圈与卡司 | `m26-social-cast.md` | World | W5 | 📋 |
| M27 | 对话行为与两空间 | `m27-conversation-two-spaces.md` | 体验 | W0/W6 | 📋 |
| M28 | 冷启动与关系阶段 | `m28-cold-start-relationship.md` | 体验 | W1 | 📋 |
| M29 | 信息不对称与记忆透明 | `m29-asymmetric-memory.md` | 体验 | W1+ | 📋 |
| M30 | 叙事连贯与能力边界 | `m30-narrative-capability.md` | 体验 | W2–W4 | 📋 |
| M31 | 主动在场设计 | `m31-proactive-presence.md` | Surfaces | W3+W6 | 📋 |

旧文件归档：`_archive/methodology-companion-legacy/`。

---

## 独立主题（不占 mNN 编号）

| 文件 | 主题 | 状态 |
|------|------|------|
| `rule-system-evolution.md` | 规则体系的进化 | ✅ |
| `gap-audit-2026-07.md` | 方法论缺口审计（三源对照：CC / Alice / feiche）| 📋 对照+todo |

---

## 待补队列

> 完整流程见 `agent-skills/methodology-writing.md`。  
> **工程施工**认 W0–W6（主线已收齐，见 `docs/progress.md`）；**本章目录**只认沉淀状态。  
> 「有什么能力」见 `docs/modules/capability-catalog.md`，不在本 README 列功能清单。

| 优先级 | 项 | 说明 |
|--------|-----|------|
| 沉淀下一步 | **M25** | 资产层/衣柜（代码已通；先对齐观点再写） |
| 沉淀随后 | **M26→M31** | 随深啃推进；勿按编号盲目开写，先对齐观点 |
| 工程可选 | Pack 内容打磨 | 三槽薄 Pack 加厚（非方法论阻塞） |
| 增量 | 已写章节暂缓 Gap | `docs/wishlist.md` + 各章实战记录 |

## 写作约定

- **触发写作**：告诉 AI「写方法论」或「沉淀一下 XX 的思考」
- **写作规范 / 深啃五步**：`agent-skills/methodology-writing.md`（原 `docs/module-roadmap.md` 已并入此 skill）
- **配对结构**：每章通常包含理念章（`.md`）和代码走读章（`-code.md`）；占位章节先建理念章，代码走读视实现情况补充
- **参考源**：Alice 方法论（`_reference/framework-harness/repos/alice-methodology/`）、CC 源码（`_reference/framework-harness/repos/claude-code-sourcemap-main/`）、feiche（`_reference/feiche/`）
- **进度时间线**：`docs/progress.md`（本 README 只维护章节状态，不写实施流水账）
