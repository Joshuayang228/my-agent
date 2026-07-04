# M7：可观测性工程化方法论

> 这份文档沉淀我们对 Agent 可观测性系统的设计思考。
> 前半部分是**认知框架**——可观测性系统该怎么设计、为什么。
> 后半部分是**实战记录**——我们做了什么改动、踩了什么坑。
>
> 对照源：Alice Ch.13（OTel 三信号 + blocked_on_user + 启动 marks）× CC sessionTracing.ts（五种 SpanType + cost-tracker）× 我们的 tracer.ts 实现
> 沉淀时间：2026-07-04

---

# 第一部分：认知框架

## 一、第一性原理：可观测性是「让系统可以解释自己」

Agent 系统最难 debug 的不是崩溃，而是「跑完了但结果不对」——LLM 调用慢了？哪个工具最耗时？用户等待时间是在等 LLM 还是在等用户自己确认？这些问题在没有可观测性时完全是黑盒。

可观测性的第一性原理：**系统应该能解释自己。不只是"有没有出错"，而是"每一步做了什么、花了多少时间、消耗了多少资源"。**

一旦接受这个认知，可观测性系统的所有设计都变成一个问题的展开——**"怎么让 Agent 的每一步都有可查询、可追溯、可对比的记录"**：

```
第一性原理：可观测性 = 系统可以解释自己（每步可查 / 可追溯 / 可对比）

├─ 推论组 A：怎么划分「一步」
│     §二 OTel 三信号 · §三 SpanType 分类 · §四 父子嵌套（调用链树）
│
├─ 推论组 B：哪些时间维度必须分离计量
│     §五 blocked_on_user vs execution · §六 caller 分类 · §七 启动性能 marks
│
└─ 推论组 C：可观测性的边界与代价
      §八 隐私默认保守 · §九 不引入完整 OTel SDK · §十 暂未实现项
```

> **一个前置边界**：可观测性（记录发生了什么）和日志（记录诊断信息）是两个不同的问题，解法也不同。前者靠结构化 Span，后者靠文本日志。M7 只做 Trace（Span），日志文件落盘是独立问题（G4，暂缓）。

---

# 推论组 A：怎么划分「一步」

> 第一性原理说"每步可查"，但 Agent 的一次交互由成百上千个操作组成——怎么把这个连续的流切成可查询的"步"？这一组解决"步的粒度和组织方式"。

## 二、OTel 三信号：Traces / Metrics / Logs，各有适用场景

OTel（OpenTelemetry）把可观测性分为三个信号：

| 信号 | 回答的问题 | 适用场景 |
|------|-----------|---------|
| **Traces**（调用链）| 发生了什么、在哪发生、花了多久 | 性能分析、问题定位 |
| **Metrics**（指标）| 某个量现在是多少、趋势是什么 | 监控告警、容量规划 |
| **Logs**（日志）| 发生了一个事件，细节是什么 | 调试、审计 |

**三者不互斥，互为补充**：Traces 给骨架（调用链结构），Logs 给细节（每步的参数），Metrics 给趋势（汇总指标）。

**我们的实现**：主要做 Traces（SpanType 分类 + 父子嵌套），轻度覆盖 Metrics（getCallerStats 按 caller 聚合耗时和 token）。Logs 已有（createLogger），但没有落盘（G4 暂缓）。

## 三、SpanType 分类：不是所有操作都值得同等追踪

Agent 的操作种类很多，但它们的可观测价值不同：

| SpanType | 追踪什么 | 为什么重要 |
|---------|---------|-----------|
| `interaction` | 一次完整对话 | 总耗时、总 token 的顶级容器 |
| `llm_request` | 单次 LLM API 调用 | 最贵的操作，需要精确计时和 token 归因 |
| `tool` | 一次工具调用 | 工具成功/失败率，影响任务完成质量 |
| `tool_blocked` | 等待用户确认 | 纯等待时间，不应计入"Agent 工作时间" |
| `tool_execution` | 工具实际执行 | Agent 实际消耗时间 |
| `compress` | 上下文压缩 | 压缩效率，触发频率异常说明任务过长 |
| `subagent` | 子 Agent 执行 | 子任务耗时，递归调用链追踪 |

**关键判据**：SpanType 的粒度要能回答"这个操作的性能问题从哪里来"。太粗（一个"chat" span 包含所有）看不出瓶颈；太细（每行代码一个 span）噪音太多。

## 四、父子嵌套：调用链树，不是扁平列表

单个 Span 只记录一个操作。但 Agent 的操作是嵌套的：一次对话包含多次 LLM 调用，一次 LLM 调用包含等待和解析，一次工具调用包含确认等待和实际执行。

**关键设计**：每个 Span 携带 `parentId`，指向上一层的 Span。查询时按 `parentId` 还原树形结构：

```
interaction（顶层）
├── llm_request（第1轮）
├── tool_blocked（用户确认 shell_exec）
├── tool（shell_exec 工具调用）
│   └── tool_execution（实际执行）
├── llm_request（第2轮）
└── compress（触发了 L3 压缩）
```

**我们的实现**：`interactionSpanId` 从 runtime.ts 传入 agentLoop（`options.interactionSpanId`），loop 内所有子 span 都以此为 parentId。这是 M7 之前唯一缺失的一根线——tracer 有实现，loop 有调用，但 runtime 没有把 interaction span 的 ID 传进来。

---

# 推论组 B：哪些时间维度必须分离计量

> 第一性原理说"可对比"——但不同性质的时间混在一起，对比就失去意义。这一组解决"哪些时间维度不能混"。

## 五、blocked_on_user vs execution：两种等待，性质完全不同

Alice Ch.13 最核心的一条原则：**工具等待用户确认的时间（`tool_blocked`）和工具实际执行的时间（`tool_execution`）必须分开计时。**

原因：
- `tool_blocked` 是**人的时间**——用户看到确认框没点，这段时间不反映 Agent 的能力
- `tool_execution` 是**机器的时间**——这才是"工具性能"

如果两者混在一起，分析"为什么这次任务这么慢"时会得出错误结论：
- "每次工具调用平均 30 秒" → 实际可能是"5 秒执行 + 25 秒用户没看到弹窗"

**我们的实现**：loop.ts 在 `confirmTool` 前后各开一个 span：
- `tool_blocked` span：从弹出确认框到用户点击
- `tool_execution` span：实际 `registry.executeAll()` 的耗时

## 六、caller 分类：每次 LLM 调用都要打来源标记

Agent 会多次调用 LLM：主对话（`main`）、上下文压缩（`compact`）、画像提取（`profile`）、标题生成（`title`）、子 Agent（`subagent`）。

如果不区分来源，"总 LLM 调用耗时 500 秒"这个数字毫无意义——你不知道是主对话慢还是压缩慢。

**caller 分类的两个用途**：
1. **性能归因**：哪类调用最耗时（`getCallerStats()` 按 caller 聚合耗时）
2. **token 归因**：哪类调用最费 token（`getCallerStats()` 按 caller 聚合 inputTokens/outputTokens）

**我们的实现**：`streamChat()` 接受 `caller` 参数（M3 埋的），`llm_request` span 的 `caller` 字段和 `attributes.inputTokens/outputTokens` 对应。`getCallerStats()` 负责聚合。

## 七、启动性能 marks：关键初始化阶段打时间戳

Agent 应用的"启动速度"是用户体验的关键指标，但"启动慢"很难定位原因——是数据库初始化慢？还是 MCP 连接慢？

**解法**：在关键初始化节点打 `mark(name)`，记录相对进程启动的毫秒数：

```
imports_done    → 主进程模块加载完成（通常很快）
tools_ready     → 工具注册表初始化完成
mcp_ready       → MCP 服务器连接完成（可能很慢）
window_shown    → 窗口显示给用户（用户感知的"启动完成"）
```

**判据**：marks 不记录操作详情，只记时间戳。用于"哪个阶段比上次慢了"的趋势对比，不用于详细诊断（那是 Span 的工作）。

---

# 推论组 C：可观测性的边界与代价

> 可观测性本身也有成本：存储开销、隐私风险、引入依赖。这一组解决"可观测性该做到哪里、不该做到哪里"。

## 八、隐私默认保守：记元数据，不记内容

可观测性系统最容易踩的坑是"记得太多"——把完整的 Prompt/Response 存进 Span。

**Alice Ch.13 的原则**：默认只记元数据（耗时、token 数、模型名、来源），不记内容（Prompt 文本、工具输入参数细节、用户消息原文）。

理由：
- Prompt 可能包含敏感信息（API key 泄漏的变体、用户私人信息）
- Span 系统会在内存里保留 MAX_SPANS=500 条记录，甚至可能落盘
- "记录所有内容用于调试"听起来方便，但一旦有人读取这些日志，隐私风险极高

**我们的实现**：`llm_request` span 只记 `model / turn / inputTokens / outputTokens / attempt / stopReason`，不记消息内容。`tool` span 只记 `toolName / success`，不记工具参数。

## 九、不引入完整 OTel SDK：轻量实现够用

OTel SDK 提供标准的 Span 创建、导出、采样等全套能力，还能对接 Jaeger、Grafana 等后端。

**为什么不用**：桌面应用没有远程 Exporter（不需要把数据发到外部系统），只需要 DevPanel 本地查看。引入 OTel SDK 增加 ~1MB bundle，但功能用到不到 10%。

**我们的做法**：实现兼容 OTel 概念的轻量版——SpanHandle 对应 OTel Span，`parentId` 对应 OTel parentSpanId，`attributes` 对应 OTel attributes，`status` 对应 OTel StatusCode。概念一致，但不引入 SDK 依赖。

**判据**：当以下任一条件成立时再引入完整 OTel SDK：
- 需要把 trace 数据发到远程系统（生产部署、多用户）
- 需要采样（当前全量记录 + 500 span 上限已够）
- 需要 OTel 标准 ID 格式（与其他系统互通时）

## 十、暂未实现项

**G4 日志文件落盘**（推迟）：
- 现状：只有 console 输出，关窗口日志消失
- 推迟原因：Electron 日志路径管理 + 文件轮转是独立工程问题，涉及 app.getPath('logs')、按日期滚动、最大保留大小
- 推迟到独立日志系统任务做

**G5 DevPanel 树状调用链视图**（推迟）：
- 现状：DevPanel 展示扁平 span 列表 + callerStats
- 推迟原因：前端改动大（树形渲染组件），当前后端数据已有 parentId，前端随时可按需实现
- 判据：parentId 信息已在 Span 中，数据模型完备，只差前端渲染

---

# 第二部分：实战记录

## M7 阶段做了什么

对照 Alice Ch.13 + CC sessionTracing.ts 审计当前实现，发现一个特殊情况：**前一个 agent 在工作树里已经实现了 tracer 基础设施和大部分埋点（包括 Phase A/B/C 所有基础），但有一根关键的线没接上**，代码随 M6 的 `git add -A` 一起提交进了历史。

**已完成**（随 M6 提交）：
- `tracer.ts`：SpanType 枚举、SpanHandle、mark()、getCallerStats()（含 token 统计）、getSpanTypeStats()
- `loop.ts`：compress/llm_request/tool_blocked/tool/tool_execution spans，LoopState 含 `interactionSpanId`
- `index.ts`：四个 startup marks（imports_done / tools_ready / mcp_ready / window_shown）
- `subagent.ts`：subagent span

**M7 补完的一根线**：
- `types.ts`：`AgentLoopOptions` 加 `interactionSpanId?: string`
- `runtime.ts`：传 `chatSpan.id` 给 agentLoop
- `loop.ts`：从 options 读取 `interactionSpanId` 初始化 state

**测试**：140 → 161（+21：新增 tracer.test.ts 覆盖所有 SpanType、父子嵌套、blocked 分离、mark、callerStats、SpanTypeStats、MAX_SPANS 溢出）

## 坑 1：tracer 基础设施已完整但调用链树没形成

前一个 agent 实现了所有 SpanType 和埋点，但因为 `AgentLoopOptions` 没有 `interactionSpanId` 字段，所有子 span 引用的 `state.interactionSpanId` 永远是 `undefined`。

**症状**：span 都有记录（DevPanel 能看到），但没有父子关系——所有 span 都是孤立节点，不能还原成调用链树。

**修复**：三处改动接上断点：types.ts 加字段、runtime.ts 传值、loop.ts 初始化 state。

## 坑 2：duration=0 被 `!span.duration` 跳过

`getCallerStats()` 和 `getSpanTypeStats()` 原本用 `if (!span.duration) continue` 跳过"未结束的 span"（没有 duration 的）。

但在单测场景（span 开始和结束在同一毫秒），`duration=0`，被 `!0 === true` 错误跳过了——测试里的 span 都统计不到。

**修复**：改为 `if (span.duration === undefined) continue`，只跳过真正未结束的 span，duration=0 是合法值。

**沉淀**：用 `!value` 检查"有没有"时要注意 0/false/'' 都是 falsy。检查"有没有被设置"应该用 `value === undefined` 或 `value == null`。

## 暂缓项

- G4 日志文件落盘（独立任务）
- G5 DevPanel 树状调用链视图（前端任务，数据模型已完备）

## 沉淀：可观测性的设计检查清单

1. 新增的 LLM 调用，有没有 llm_request span？caller 字段对了吗？token attributes 记了吗？
2. 新的工具执行路径，tool_blocked（等待用户确认）和 tool_execution（实际执行）分开了吗？
3. 新的 interaction 入口（如 headless agent），有没有创建 interaction span 并把 id 传给 agentLoop？
4. 关键初始化步骤，有没有对应的 startup mark？
5. Span 的 attributes 只记元数据（token 数/耗时/模型），没有记敏感内容（Prompt 文本/用户消息）吗？
6. MAX_SPANS 满时旧 span 会被剪裁，重要的统计（callerStats）不依赖历史 span 的完整性吗？
