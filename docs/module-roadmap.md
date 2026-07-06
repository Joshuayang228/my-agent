# 框架模块深啃路线图

> 以框架模块为核心，同心圆从内向外扩展。
> 每个模块标准化 5 步：**学 → 审 → 设计 → 改 → 沉淀**。
> 学习产出写入 `methodology/` 文件夹。

## 学习方法

| 步骤 | 做什么 | 产出 |
|------|--------|------|
| 1. 学 | 读三个参考源（方法论 + Alice 源码 + CC 源码） | 理解行业最佳实践 |
| 2. 审 | 对比我们的实现，列出差距清单（具体到代码行） | Gap 清单 |
| 3. 设计 | 写改进方案（技术方案文档） | 方案确认 |
| 4. 改 | 编码 + 测试 | 代码变更 |
| 5. 沉淀 | 用自己的话写 methodology/ 文档 | 知识固化 |

## 参考源路径

| 来源 | 路径 | 看什么 |
|------|------|--------|
| Alice 方法论 | `_reference/framework-harness/repos/alice-methodology/chapters/` | 设计理念和原则（21 章） |
| Alice 源码 | `_reference/framework-harness/repos/alice-source/` | 实际代码实现（解包格式化 JS） |
| Alice 源码（完整） | `D:\alice-extracted\out\` | 完整解包目录（main/ + renderer/） |
| CC 源码 | `_reference/framework-harness/repos/claude-code-sourcemap-main/.../restored-src/src/` | 生产级 TS 实现 |

---

## Phase 1：框架模块深啃（10 个模块）

| # | 模块 | Ring | 参考源 | 吸收的原任务 | 状态 |
|---|------|------|--------|-------------|------|
| M1 | [Agent Loop](#m1-agent-loop) | 1（心脏） | Alice Ch.03 × CC query.ts 状态机 | — | ✅ 全部完成 |
| M2 | [工具系统](#m2-工具系统) | 2（直接依赖） | Alice Ch.04 × CC Tool.ts + toolOrchestration.ts | 工具 description 四要素 | ✅ 全部完成 |
| M3 | [LLM 层](#m3-llm-层) | 2（直接依赖） | Alice Ch.11 × CC services/api/ | LLM 调用统一过路由层 | ✅ 全部完成 |
| M4 | [上下文与压缩](#m4-上下文与压缩) | 2（直接依赖） | Alice Ch.05 × CC compact/ | 413 紧急 collapse + 压缩摘要结构化 | ✅ 全部完成 |
| M5 | [记忆系统](#m5-记忆系统) | 3（支撑层） | Alice Ch.05 × CC SessionMemory/ + memdir/ | 记忆注入策略统一 + 大结果落盘 | ✅ 全部完成 |
| M6 | [权限与安全](#m6-权限与安全) | 3（支撑层） | Alice Ch.07+12 × CC utils/permissions/ | 权限拒绝追踪 | ✅ 全部完成 |
| M7 | [可观测性](#m7-可观测性) | 3（支撑层） | Alice Ch.13 × CC tracing/ | Trace 补全 | ✅ 全部完成 |
| M8 | [多 Agent 协作](#m8-多-agent-协作) | 4（上层建筑） | Alice Ch.06 × CC coordinator/ + tasks/ | — | ✅ 全部完成 |
| M9 | [人格引擎 + Prompt 工程](#m9-人格引擎--prompt-工程) | 4（上层建筑） | Alice Ch.14+16 × CC context.ts | 角色设定集 / PROTECTED 守卫 / MUTABLE 进化 | 🟡 一致性落地，成长性占位 |
| M10 | [自进化与 Skill](#m10-自进化与-skill) | 4（上层建筑） | Alice Ch.09+10 | Skill 微调闭环 / 代码级自进化 | 🟡 版本备份落地，自动改进占位 |

---

## Phase 2：产品功能参考

> 做的时候查阅 Alice 源码即可，不专门系统学习。

- Playground 实验环境（免上下文快速测试）
- 会话状态 Runtime 中心化（UI 不再承担会话读写）
- MCP 协议深入（Alice Ch.08 × CC services/mcp/）

## Phase 3：差异化特色

> 我们的人格化伙伴独有功能，自主创新。

- 具名角色设定集（Character Bible）
- 子 Agent 人设库（预设具名团队成员）
- 活人感设计

---

## 模块详情

### M1: Agent Loop

**Ring**: 1（心脏）— 一切的起点

**参考源**:
- Alice 方法论: `chapters/03-agent-loop.md`
- Alice 源码: `alice-source/main-index.js`（Agent Loop 核心）+ `alice-source/main-chunks/`（分块模块）
- CC 源码: `restored-src/src/query/`（状态机）+ `restored-src/src/tools/`

**要学的核心问题**:
- Agent Loop 的状态机设计（CC 有哪些状态？转换条件是什么？）
- 迭代控制（最大轮次、自动终止条件、用户中断处理）
- 错误恢复策略（LLM 失败 / 工具失败 / 超时后如何继续）
- 与上下文压缩的交互时机

**当前实现**: `electron/main/agent/loop.ts`

**5 步进度**:
- [x] 学（Alice Ch.03 + CC query.ts 对照阅读）
- [x] 审（7 项差距清单：LoopState / 413 / max_output / abort 补位 / 权限追踪 / done reason / maxIterations）
- [x] 设计（6 点改进方案，用户确认）
- [x] 改（编码 + 106 个测试全通过 + tsc 零错误）
- [x] 沉淀（methodology/m01-agent-loop.md — 12 节 + 2 附录，全景图 / 权衡分析 / 为什么不）

---

### M2: 工具系统

**Ring**: 2（直接依赖）

**参考源**:
- Alice: Ch.04
- CC: Tool.ts + toolOrchestration.ts

**要学的核心问题**:
- 工具注册与发现机制
- 工具 description 最佳实践（四要素：用途 / 参数 / 何时用 / 何时不用）
- 工具结果处理（大结果截断 / 错误格式化）
- 中间件管道设计

**吸收任务**: 工具 description 四要素

**当前实现**: `electron/main/tools/`

**5 步进度**:
- [x] 学（Alice Ch.04 + CC Tool.ts/toolOrchestration.ts 对照阅读）
- [x] 审（7 项差距清单：description 四要素 / 大结果落盘 / 元数据函数化 / buildTool 工厂 / 并发上限 / 工具别名 / ToolContext 扩展）
- [x] 设计（分 Phase A/B/C 三批，用户确认）
- [x] 改（Phase A：5 工具 description + 落盘中间件；Phase B：buildTool 工厂 + 20 工具迁移；106 测试全过 + tsc 零错误）
- [x] 沉淀（methodology/m02-tool-system.md — 认知框架 6 节 + 实战记录）

> 暂缓项（按需再做）：元数据函数化 / 并发数上限 / 工具别名

---

### M3: LLM 层

**Ring**: 2（直接依赖）

**参考源**:
- Alice: Ch.11
- CC: services/api/

**要学的核心问题**:
- 多 Provider 统一抽象层设计
- 流式解析的边界情况处理
- 重试 / Failover 策略
- Token 计数与预算管理

**吸收任务**: LLM 调用统一过路由层（压缩/画像/标题不再直接 fetch）

**当前实现**: `electron/main/llm/`

**5 步进度**:
- [x] 学（Alice Ch.11 + CC services/api/ 对照阅读）
- [x] 审（5 项差距清单：G1 辅助调用统一 / G2 usage guard / G3 retry-after / G4 评估关闭 / G5 caller 归因）
- [x] 设计（两批次方案，用户确认）
- [x] 改（chatComplete 统一 + usage 正确性 + retry-after 遵从 + caller 打标；113 测试全过 + tsc 零错误）
- [x] 沉淀（methodology/m03-llm-routing.md + m03-llm-routing-code.md）

---

### M4: 上下文与压缩

**Ring**: 2（直接依赖）

**参考源**:
- Alice: Ch.05
- CC: compact/

**要学的核心问题**:
- 压缩策略分级（何时触发哪一级）
- 摘要质量（结构化框架 vs 自由文本）
- 413 错误的紧急处理流程
- 压缩与记忆的交互（压缩后重要信息不丢失）

**吸收任务**: ~~413 紧急 collapse~~ ✅ 已在 M1 实现 + 压缩摘要结构化

**当前实现**: `electron/main/agent/context-manager.ts`

**5 步进度**:
- [x] 学（Alice Ch.05 + CC compact/ 源码，三 subagent 并行深挖）
- [x] 审（13 项 Gap：P0 正确性 3 / P1 体验 6 / P2 优化 4，见 methodology/m04-context-compression.md）
- [x] 设计（分 Phase A/B/C 三批）
- [x] 改（A：保护任务说明/文件恢复/熔断降级；B：结构化摘要/boundary marker；C：PTL 逃生舱/动态阈值；127 测试全过 + tsc 零错误）
- [x] 沉淀（methodology/m04-context-compression.md + m04-context-compression-code.md）

> 暂缓项（按需再做）：G6 L4 独立会话隔离 / G2 L2 去重优化 / G5 image 剥离 / G8 prompt cache 复用 / G9 hooks / G13 token 估算精度

---

### M5: 记忆系统

**Ring**: 3（支撑层）

**参考源**:
- Alice: Ch.05
- CC: SessionMemory/ + memdir/

**要学的核心问题**:
- 记忆的分类与注入策略（全量 vs 语义检索 vs 按需）
- 记忆的生命周期管理（创建 / 更新 / 过期 / 遗忘）
- 大结果处理（超过阈值写临时文件 + 返回路径）
- 向量检索的质量调优

**吸收任务**: 记忆注入策略统一 + 大结果落盘

**当前实现**: `electron/main/memory/` + `electron/main/storage/`

**5 步进度**:
- [x] 学（Alice Ch.05 记忆部分 + CC memdir/SessionMemory/extractMemories 三方对照）
- [x] 审（8 项 Gap：P0 自我强化循环/老化防漂移 · P1 生命周期/提取判据/双重注入 · P2 语义去重/recall一致/死代码）
- [x] 设计（4 项落地 G1/G2/G4/G5，不动存储架构；G3/G6/G7/G8 暂缓，用户确认）
- [x] 改（G1 召回过滤 / G2 老化告警 / G4 提取判据 / G5 去重；139 测试全过 + tsc 零错误）
- [x] 沉淀（methodology/m05-memory-system.md + m05-memory-system-code.md）

> 吸收任务对照：「记忆注入策略统一」→ G1+G5；「大结果落盘」→ 已在 M2 工具系统实现（result-persistence 中间件 + maxResultSizeChars）

---

### M6: 权限与安全

**Ring**: 3（支撑层）

**参考源**:
- Alice: Ch.07 + Ch.12
- CC: utils/permissions/

**要学的核心问题**:
- 权限拒绝的追踪与反馈（拒绝列表持久化 + 注入 Prompt）
- 沙箱边界的精确控制
- 安全审计日志

**当前实现**: `electron/main/sandbox/`

**5 步进度**:
- ✅ 学：Alice Ch.07(权限模式) + Ch.12(沙箱边界) + CC utils/permissions/ 五层责任链
- ✅ 审：识别 4 项 Gap（bypass-immune / DecisionType / deniedCommands / persistent 审批）
- ✅ 设计：保持五层责任链，修正安全缺口 + 增强可观测性
- ✅ 改：G1/G2/G4/G3 全部落地，140 测试全过
- ✅ 沉淀：`methodology/m06-permission-security.md`（第一性原理：可配置的平衡点 → 三组推论）

> 吸收任务对照：「权限拒绝追踪」→ M1 已有 deniedTools，M6 补全 deniedCommands（G2）

---

### M7: 可观测性

**Ring**: 3（支撑层）

**参考源**:
- Alice: Ch.13
- CC: tracing/

**要学的核心问题**:
- Span 类型覆盖（llm_request / tool_execution / compress / subagent）
- 用户阻塞分离（blocked_on_user 独立计时）
- 日志分级与结构化
- 性能监控指标

**吸收任务**: Trace 补全

**当前实现**: `electron/main/utils/tracer.ts`

**5 步进度**:
- ✅ 学：Alice Ch.13（OTel 三信号 + blocked_on_user + startup marks）+ CC sessionTracing.ts（五种 SpanType + cost-tracker）
- ✅ 审：发现关键断点：tracer 基础设施已完整，但 interactionSpanId 未从 runtime 传入 loop，调用链树无法形成
- ✅ 设计：补完三处接线（types.ts / runtime.ts / loop.ts），不引入 OTel SDK，保持轻量实现
- ✅ 改：接线 + tracer.ts 修复 duration=0 bug + 新增 tracer.test.ts（21 个测试）；161 测试全过
- ✅ 沉淀：`methodology/m07-observability.md` + `m07-observability-code.md`

> 暂缓：G4 日志文件落盘 / G5 DevPanel 树状视图（数据模型已完备，只差前端渲染）

---

### M8: 多 Agent 协作

**Ring**: 4（上层建筑）

**参考源**:
- Alice: Ch.06
- CC: coordinator/ + tasks/

**要学的核心问题**:
- 任务分解与分配策略
- 子 Agent 间通信机制
- 结果聚合与冲突解决
- 递归防护与资源限制

**当前实现**: `electron/main/agent/subagent.ts`

**5 步进度**:
- [x] 学：Alice Ch.06（三种模式：父子/Coordinator/Swarm + isReadOnly 并发）× CC coordinatorMode.ts（Coordinator 系统提示原则）
- [x] 审：发现 P0 破损 bug（delegate_task 完全不可用）+ G1 span 无父 ID + G2 未用辅助模型 + G3 description 无判据
- [x] 设计：修复 registry 取法 + ToolContext 扩展（registry/parentSpanId）+ auxModel 优先 + description 重写
- [x] 改：types.ts/runtime.ts/delegate-task.ts/subagent.ts 四处改动，tsc 通过，测试 161 个全过
- [x] 沉淀：methodology/m08-multi-agent.md（信息积累型 vs 并发执行型判据 + 三种模式 + 隔离机制 + 信息流）

---

### M9: 人格引擎 + Prompt 工程

**Ring**: 4（上层建筑）

**参考源**:
- Alice: Ch.14 + Ch.16
- CC: context.ts

**要学的核心问题**:
- 人格的代码级守卫（PROTECTED 区域防注入修改）
- 可变人格进化（MUTABLE 区域低频更新 + 持久化）
- System Prompt 的 KV Cache 优化
- 具名角色设定集（从抽象模板到具体人物）

**吸收任务**: 角色设定集 / PROTECTED 守卫 / MUTABLE 进化

**当前实现**: `electron/main/agent/prompt-builder.ts`

**5 步进度**:
- [x] 学：Alice Ch.14（人格三层次 / PROTECTED-MUTABLE / 防漂移）+ Ch.16（五层结构 / KV Cache / 防注入）
- [x] 审：5 项 Gap（G1 结尾锚点 / G2 防注入声明 / G3 MUTABLE 动态演化 / G4 定期重申 / G5 具名角色）
- [x] 设计：一致性防护先落地（G1/G2），成长性+差异化占位（G3/G5 核心待做）
- [x] 改：G1 结尾人格锚点 + G2 防注入声明，163 测试全过，tsc 零错误
- [x] 沉淀：`methodology/m09-persona-engine.md` + `-code.md`（第一性原理：一致性 × 成长性 的张力）

> **占位待做（核心中的核心）**：G3 MUTABLE 动态演化（当前静态模板，真成长性缺失）、G5 具名角色设定集（Character Bible，差异化塔尖）。认知框架已在方法论写全，下次直接从认知地图接着做。

---

### M10: 自进化与 Skill

**Ring**: 4（上层建筑）

**参考源**:
- Alice: Ch.09 + Ch.10
- CC: 无此模块（Alice 独有）

**要学的核心问题**:
- Skill 效果评估与自动微调
- 代码级自进化（Widget 生成 / SecurityScanner / UndoStack）
- 版本管理与回滚

**吸收任务**: Skill 微调闭环 / 代码级自进化

**当前实现**: `electron/main/skills/`

**5 步进度**:
- [x] 学：Alice Ch.9（Skill 系统：when_to_use / 按需激活 / 最小权限）+ Ch.10（自进化：L0-L2 分层 / 沙盒 / 撤销栈）+ Hermes 对比
- [x] 审：5 项 Gap（G1 版本备份回滚 / G2 自动改进闭环 / G3 代码级自进化 / G4 主动提案 / G5 撤销栈）
- [x] 设计：先做 G1（自进化安全地基），G2-G5 占位（依赖 G1 + 需求明确）
- [x] 改：Skill 版本备份/回滚（backupSkillVersion + rollbackSkill + IPC 三处同步），171 测试全过
- [x] 沉淀：`methodology/m10-self-evolution.md` + `-code.md`（第一性原理：用户可控范围内的系统自我改善）

> **占位待做（自进化核心）**：G2 Skill 自动改进闭环、G3 代码级自进化（Widget + 沙盒 + SecurityScanner）、G4 主动提案、G5 撤销栈。认知框架已在方法论写全。

---

## 更新记录

| 日期 | 变更 |
|------|------|
| 2026-06-20 | 初始创建，从 progress.md 迁移并重组为 Phase 1/2/3 三阶段 |
| 2026-06-20 | M1 Agent Loop 5 步全部完成（学/审/设计/改/沉淀） |
| 2026-07-01 | M3 LLM 层 5 步完成（chatComplete/usage/retry-after/caller） |
| 2026-07-02 | M4 上下文压缩 5 步完成（Phase A/B/C，127 测试，m04 沉淀） |
