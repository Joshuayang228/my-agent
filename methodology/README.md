# 方法论

本文件夹记录我们在构建人格化 AI Agent 过程中的设计哲学和独立思考。

**写作原则**：
- 每个观点都是我们自己的思考，不搬运外部资料
- 每条内容经过讨论对齐后才写入
- 记录真实的取舍过程，包括走过的弯路

---

## 章节架构设计决策

### 为什么分六个部分

M01–M27 按**依赖层级**从底向上排列：底层基础设施决定上层能做什么，读者应先理解当前章节所依赖的那一层。

**Part I 核心运行时** 最先，因为 Streaming 和错误体系是 Agent Loop 本身运行的基础——不理解流式传输如何传播，就无法真正理解 Loop 为何如此设计。错误体系放在工具系统之前，因为错误处理贯穿整个运行时，不是某个模块的附属。

**Part II 上下文与记忆** 把 System Prompt 放在 Memory 之前：Memory 召回的最终产出是注入 System Prompt，读者必须先知道 System Prompt 是什么结构，才能理解记忆去了哪里、怎么用的。后台任务（原 M11）从末尾移入这组，因为它的三个任务类型全部服务于记忆系统，逻辑上属于这里。

**Part III 安全与扩展** 把三个控制面放在一起：权限系统定义"谁能做什么"，Hook 系统定义"框架如何被扩展"，IPC 定义"主进程与渲染进程如何协作"。MCP 占位在这里，因为它本质上是扩展机制的标准化协议。

**Part IV 可观测与质量** 把 Eval 放在测试架构和状态机之后：状态机设计和并发模型是理解 Eval 场景设计的前提（很多 Eval 场景就是在验证状态机是否正确转移）。

**Part V 智能与进化** 只保留多 Agent 和自进化两章——这两块是通用 Agent 能力，与产品类型无关。

**Part VI 伙伴类 Agent** 以人格引擎为起点：伙伴章节首先要回答"她是谁"，然后才能讨论关系如何建立、如何说话、如何深化。人格引擎（原 M09）从工程章节移入这组，原因是它是伙伴类产品的核心差异化能力——工具型 Agent 不需要人格引擎，CC 的"身份"是静态 system prompt，不是动态引擎。

### 文件命名过渡说明

现有章节文件保持原有命名（m01–m12），新增占位章节使用描述性名称。全部文件将在内容基本就绪后做一次批量重命名，对齐到最终编号（mNN-主题.md）。

---

## 完整章节目录

### Part I：核心运行时

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M01 | Agent Loop | `m01-agent-loop.md` + `m01-agent-loop-code.md` | ✅ |
| M02 | Streaming 设计范式 | `streaming-design.md` | 📋 占位 |
| M03 | 错误体系设计 | `error-system.md` | 📋 占位 |
| M04 | 工具系统 | `m02-tool-system.md` + `m02-tool-system-code.md` | ✅ |
| M05 | LLM 路由与适配 | `m03-llm-routing.md` + `m03-llm-routing-code.md` | ✅ |

### Part II：上下文与记忆

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M06 | System Prompt 工程化 | `system-prompt-engineering.md` | 📋 占位 |
| M07 | 上下文压缩 | `m04-context-compression.md` + `m04-context-compression-code.md` | ✅ |
| M08 | 记忆系统 | `m05-memory-system.md` + `m05-memory-system-code.md` | ✅ |
| M09 | 后台任务生命周期 | `m11-task-lifecycle.md` + `m11-task-lifecycle-code.md` | ✅ |

### Part III：安全与扩展

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M10 | 权限与安全 | `m06-permission-security.md` + `m06-permission-security-code.md` | ✅ |
| M11 | Hook / 扩展点架构 | `hook-extension-architecture.md` | 📋 占位 |
| M12 | IPC 架构 | `ipc-architecture.md` | 📋 占位 |
| M13 | MCP 集成 | `mcp-integration.md` | 📋 占位 |

### Part IV：可观测与质量

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M14 | 可观测性 | `m07-observability.md` + `m07-observability-code.md` | ✅ |
| M15 | 状态机设计 | `state-machine-design.md` | 📋 占位 |
| M16 | 并发与数据架构 | `concurrency-data-architecture.md` | 📋 占位 |
| M17 | 测试架构 | `testing-architecture.md` | 📋 占位 |
| M18 | Eval 体系（上下两章） | `m12-eval.md` + `m12-eval-persona.md` + `m12-eval-code.md` | ✅ |

### Part V：智能与进化

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M19 | 多 Agent 协作 | `m08-multi-agent.md` + `m08-multi-agent-code.md` | ✅ |
| M20 | 自进化架构 | `m10-self-evolution.md` + `m10-self-evolution-code.md` | ✅ |

### Part VI：伙伴类 Agent

| 编号 | 章节 | 文件 | 状态 |
|------|------|------|------|
| M21 | 人格引擎 | `m09-persona-engine.md` + `m09-persona-engine-code.md` | ✅ |
| M22 | 信息不对称设计 | `companion-asymmetric-info.md` | 📋 占位 |
| M23 | 冷启动与关系建立 | `companion-cold-start.md` | 📋 占位 |
| M24 | 对话行为规范 | `companion-conversation-norms.md` | 📋 占位 |
| M25 | 能力边界表达 | `companion-capability-expression.md` | 📋 占位 |
| M26 | 叙事连贯性 | `companion-narrative-coherence.md` | 📋 占位 |
| M27 | 主动在场设计 | `companion-proactive-presence.md` | 📋 占位 |

---

## 独立主题（不占 mNN 编号）

| 文件 | 主题 | 状态 |
|------|------|------|
| `rule-system-evolution.md` | 规则体系的进化 | ✅ |
| `gap-audit-2026-07.md` | 方法论缺口审计（三源对照：CC / Alice / feiche）| 📋 对照+todo |

---

## 写作约定

- **触发写作**：告诉 AI「写方法论」或「沉淀一下 XX 的思考」
- **写作规范**：参考 `docs/agent-skills/methodology-writing.md`
- **配对结构**：每章通常包含理念章（`.md`）和代码走读章（`-code.md`）；占位章节先建理念章，代码走读视实现情况补充
- **参考源**：Alice 方法论（`_reference/framework-harness/repos/alice-methodology/`）、CC 源码（`_reference/framework-harness/repos/claude-code-sourcemap-main/`）、feiche（`_reference/framework-harness/repos/wps-cowork/`）
