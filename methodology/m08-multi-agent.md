# M8：多 Agent 协作工程化方法论

> 这份文档沉淀我们对多 Agent 协作的设计思考。
> 前半部分是**认知框架**——多 Agent 该怎么设计、为什么。
> 后半部分是**实战记录**——我们做了什么改动、踩了什么坑。
>
> 对照源：Alice Ch.6（三种模式 + isReadOnly 并发控制）× CC coordinatorMode.ts（Coordinator 系统提示原则）× 我们的 subagent.ts + delegate_task
> 沉淀时间：2026-07-04

---

# 第一部分：认知框架

## 一、第一性原理：多 Agent 不是"更大的单 Agent"，而是"分而治之"

看到上下文窗口满了，最直觉的想法是：换个更大窗口的模型。但这是错误的反应——**上下文大小解决不了多 Agent 真正要解决的问题**。

多 Agent 的第一性原理：**任务的瓶颈不是"装不下上下文"，而是"需要做很多独立的事"。多 Agent 的本质是分而治之——把任务分解为可独立处理的子任务，分配给独立的 Agent 实例。**

一旦接受这个认知，多 Agent 的所有设计都变成一个问题的展开——**"哪些任务该分、怎么分、信息怎么流动"**：

```
第一性原理：多 Agent = 分而治之（并发 + 隔离 + 综合）

├─ 推论组 A：什么时候该分、什么时候不该分
│     §二 信息积累型 vs 并发执行型 · §三 三种协作模式
│
├─ 推论组 B：分了之后怎么隔离
│     §四 上下文隔离 · §五 工具隔离 · §六 权限只降不升
│
└─ 推论组 C：信息怎么流动和综合
      §七 结构化返回 · §八 不委托理解 · §九 continue vs spawn
```

> **一个前置边界**：多 Agent（任务分解）和并发（同时执行多个操作）不是一回事。单 Agent 也可以并发调工具（batch executeAll），多 Agent 也可以串行执行。多 Agent 解决的核心问题是"任务边界清晰、可以独立完成的子任务"，并发只是其中一种优化手段。

---

# 推论组 A：什么时候该分、什么时候不该分

> 第一性原理说"分而治之"，但不是所有任务都该分。分错了反而更慢、更容易出错。这一组解决"哪些任务该分、哪些任务不该分"。

## 二、信息积累型 vs 并发执行型：任务性质决定 Agent 数量

Alice Ch.6 核心判据：**先判断任务是"信息积累型"还是"并发执行型"，再决定用单 Agent 还是多 Agent。**

| 任务类型 | 特征 | 最优方案 | 原因 |
|---------|------|---------|------|
| **信息积累型** | 任务需要持续积累上下文才能完成，后面的步骤依赖前面的推理 | 单 Agent + 上下文管理 | 分开会丢失推理链，协调成本高于收益 |
| **并发执行型** | 任务可以拆成多个独立子任务，各自完成后汇总 | 多 Agent 并发 | 并发加速，且各子任务上下文不污染 |

**信息积累型典型场景**：
- 复杂代码重构（理解代码 → 设计方案 → 多文件修改 → 测试修复）
- 长篇文档写作（列大纲 → 分章节 → 补充细节 → 统一风格）
- Bug 定位（复现 → 日志分析 → 假设验证 → 根因定位）

这些任务如果强行分给多个 Agent，会发现"综合结果"本身就是一个需要完整上下文的任务，分开反而更难。

**并发执行型典型场景**：
- 查五个城市的天气并汇总对比（五个独立查询）
- 分析 docs/ 下所有 Markdown 文件，提取标题和摘要（可并发读取）
- 研究三个竞品的官网，总结优劣势（三个独立研究）

这些任务的子任务边界清晰、互不依赖，分开后各自完成再汇总，效率明显更高。

**判据**：问自己"子任务 B 需不需要看到子任务 A 的完整推理过程"。需要 → 信息积累型，单 Agent；不需要 → 并发执行型，多 Agent。

## 三、三种协作模式：不同场景的最优解各不相同

Alice Ch.6 提出三种模式，背后是"任务的分解方式"不同：

| 模式 | 适用场景 | 关键机制 | 代价 |
|------|---------|---------|------|
| **父子（Subagent）** | 任务边界清晰、子任务数量事先可知 | 父 Agent 通过工具创建子 Agent，结果作为 tool_result 返回 | 最简单，但父 Agent 需要有足够上下文综合 |
| **Coordinator** | 任务分解本身需要推理，子任务有依赖顺序 | 专门的 Coordinator 负责分解和综合，Worker 负责执行 | Coordinator 需要理解任务才能做好分解 |
| **Swarm** | 子任务边界动态出现，任务跨会话持久化 | 去中心化任务队列（SQLite），Peer 各自领取任务 | 任务依赖关系设计复杂，调试难度高 |

**我们的实现**：只做了**父子模式**（Subagent），对应 `delegate_task` 工具。这是最简单的起点，覆盖大多数中等复杂度的多 Agent 需求。Coordinator 和 Swarm 留待产品需要时再引入。

**父子模式的核心**：
- 子 Agent 作为一个工具被调用（`delegate_task`）
- 子 Agent 有独立上下文（不污染父 Agent 的消息历史）
- 子 Agent 完成后，结果作为 tool_result 返回给父 Agent
- `isReadOnly` 控制并发：只读子 Agent 可以并行启动，写操作的子 Agent 需要串行

---

# 推论组 B：分了之后怎么隔离

> 第一性原理说"独立处理"，但如果子 Agent 可以访问父 Agent 的上下文、工具、权限，"独立"就是假的。这一组解决"子 Agent 怎么真正隔离"。

## 四、上下文隔离：子 Agent 有自己的消息历史

子 Agent 应该有独立的消息历史，不与父 Agent 共享。

**为什么**：
- 父 Agent 的上下文包含大量无关信息（整个对话历史），会干扰子 Agent 的推理
- 子 Agent 的中间过程（工具调用、推理内容）不应该出现在父 Agent 的上下文里，否则父 Agent 的上下文很快满
- 只有子 Agent 的**最终结果**应该返回给父 Agent（作为 tool_result）

**我们的实现**：
- `runSubAgent` 创建新的 `messages: ChatMessage[]`，只放子任务的 user 消息
- 子 Agent 调用 `agentLoop` 时传入这个独立的 messages 数组
- 子 Agent 完成后，只把最终的 content 返回，中间的 tool_calls/tool_results 全部丢弃

## 五、工具隔离：子 Agent 只能用受限工具集

子 Agent 的工具集是父 Agent 工具集的**受限子集**。

**黑名单**（`SUBAGENT_TOOL_BLACKLIST`）：
- `delegate_task`：防止无限递归（子 Agent 再创建子 Agent）
- `remember` / `forget`：不应修改主 Agent 的记忆
- `task_plan`：不应操作主 Agent 的任务计划

**白名单逻辑**：
```
如果 config.allowedTools 指定了工具列表
  → 只给这些工具（显式控制）
否则
  → 只给 isReadOnly=true 的工具（默认安全）

如果 config.readOnly=true
  → 再过滤掉 isDestructive=true 的工具
```

**判据**：子 Agent 的工具集应该"刚好够完成任务"，不多给。多给的工具是潜在的风险（权限泄漏、错误操作）。

## 六、权限只降不升：子 Agent 不能比父 Agent 权限更高

子 Agent 的权限模式应该继承或降级父 Agent 的权限，不能升级。

**Alice Ch.6 原则**：创建子 Agent 时，把当前的 `permissionMode` 传递给子 Agent。子 Agent 只能继承或降级（如 `auto` → `confirm-all`），不能升级（如 `confirm-all` → `auto`）。

**我们的实现**：暂未实现权限模式传递（子 Agent 固定用 `executionMode='auto'`）。这是一个安全 gap，但当前子 Agent 只能调只读工具，风险可控。正确实现应该是：`delegate_task` 工具从 toolContext 读取父 Agent 的 executionMode，传给子 Agent。

---

# 推论组 C：信息怎么流动和综合

> 分了之后，信息在 Agent 之间怎么传递？谁负责综合决策？这一组解决"信息流"。

## 七、结构化返回：每个 Agent 返回结构化文本，不直接写全局状态

**反模式**：通过共享全局状态传递信息

```
Agent A 写入全局状态 { findings: "..." }
Agent B 写入全局状态 { findings: "..." }  ← 竞态！谁的会被覆盖？
Agent C 读取全局状态  ← 可能读到不一致的中间状态
```

**正确模式**：结构化文本返回，父 Agent 负责综合

```
Agent A 返回结构化文本（JSON / Markdown）
Agent B 返回结构化文本
父 Agent 读取两个结果，综合决策
```

**我们的实现**：
- 子 Agent 的 `content` 作为 tool_result 返回
- 父 Agent 从 tool_result 里拿到子 Agent 的输出，自己读取和综合
- 没有全局共享状态

## 八、不委托理解：父 Agent 必须自己综合，不能说"based on your findings"

CC coordinatorMode.ts 最核心的原则：**Never write "based on your findings" or "based on the research." These phrases delegate understanding to the worker instead of doing it yourself.**

**错误做法**：
```
子 Agent 研究完 → 返回"在 auth.ts:42 有空指针"
父 Agent：delegate_task("基于你的发现，修复这个 bug")  ← 错！
```

**正确做法**：
```
子 Agent 研究完 → 返回"在 auth.ts:42 有空指针"
父 Agent 读取结果 → 理解问题 → 自己写明确的修复指令
父 Agent：delegate_task("修复 auth.ts:42 的空指针。user 字段在 session 过期时是 undefined，加空检查……")
```

**判据**：父 Agent 的职责是**"理解子任务的结果，综合决策"**，不是"把子任务的结果转手给另一个子任务"。每次启动新子任务前，父 Agent 必须证明自己理解了——通过在 prompt 里写出具体的文件路径、行号、修改内容。

## 九、continue vs spawn：根据上下文重叠度决定

CC coordinatorMode.ts 的决策框架：**子 Agent 完成研究后，下一步是继续这个子 Agent（SendMessage）还是启动新的？**

| 情况 | 选择 | 原因 |
|------|------|------|
| 研究探索的文件正好是要修改的 | **Continue** | 子 Agent 已经有文件在上下文，给它明确方案就能直接改 |
| 研究范围广但实现范围窄 | **Spawn fresh** | 避免拖着探索噪音，聚焦上下文更干净 |
| 纠正失败或扩展最近工作 | **Continue** | 子 Agent 有错误上下文，知道刚才试了什么 |
| 验证另一个子 Agent 的代码 | **Spawn fresh** | 验证者应该用新鲜眼光看代码，不带实现假设 |
| 第一次尝试方向完全错了 | **Spawn fresh** | 错误方向的上下文会污染重试，干净起点避免锚定 |

**我们的实现**：父子模式只有 spawn（每次 `delegate_task` 都是新子 Agent），没有 continue。这是简化实现，足够覆盖大部分场景。完整的 Coordinator 模式需要 continue 机制（对应 CC 的 SendMessage）。

---

# 第二部分：实战记录

## M8 阶段做了什么

对照 Alice Ch.6 + CC coordinatorMode.ts 审计当前实现，发现**一个 P0 功能性破损 bug** + 三个 P1/P2 gap。

### P0 破损 bug：delegate_task 完全不可用

**症状**：`delegate-task.ts:51` 的 `_registry` 永远是 `undefined`，每次调用都返回 `'[Error] Sub-agent system not initialized.'`。子 Agent 功能实际上完全无法使用。

**根因**：工具执行时有 `toolContext` 作第二参数传入（`execute(args, toolContext)`），但旧代码试图从 `delegateTaskTool._registry` 这个不存在的私有字段取注册表。

**修复**：
1. `types.ts`：`ToolContext` 加 `registry?: unknown`（类型为 unknown 避免循环 import）
2. `runtime.ts`：构建 toolContext 时带入 `registry: toolRegistry`
3. `delegate-task.ts`：`execute` 改为 `async (args, toolContext) =>`，从 `toolContext.registry` 取注册表并断言类型

### G1：子 Agent span 没有父 span ID

**症状**：子 Agent 的 span 都是孤立节点（parentId=undefined），不能嵌进调用链树。

**修复**：
1. `types.ts`：`ToolContext` 加 `parentSpanId?: string`
2. `runtime.ts`：toolContext 带入 `parentSpanId: chatSpan.id`
3. `delegate-task.ts`：把 `toolContext.parentSpanId` 传给 `runSubAgent`
4. `subagent.ts`：`SubAgentConfig` 加 `parentSpanId`，创建 span 时用它

### G2：子 Agent 用主模型，没用辅助模型

**症状**：轻量的子任务（研究、文件分析）也用主模型，浪费成本。

**修复**：`delegate-task.ts` 优先读 `s.auxModel`，无辅助模型时 fallback 主模型。

### G3：description 没有指导何时用子 Agent

**症状**：工具描述太通用，没有体现 Alice 核心判据："信息积累型用单 Agent，并发执行型才用多 Agent"。

**修复**：重写 description，加入"When to use"和"When NOT to use"两个段落，明确判据和典型场景。

## 坑 1：ToolContext.registry 的类型难题

想直接在 `src/shared/types.ts` 里写 `registry?: ToolRegistry` 会报循环依赖——因为 shared/types 被 renderer 和 main 都 import，但 ToolRegistry 是主进程专属模块。

解决方案：`registry?: unknown`，使用方按需断言类型。这是"shared 类型文件不能依赖具体实现"的常见模式。

## 坑 2：工具 execute 的第二参数容易漏

很多工具的 `execute: async (args) =>` 只有一个参数，忘了 toolContext 是第二参数。这次修 delegate_task 时差点又漏了，还好 tsc 会报"参数不匹配"。

**沉淀**：工具的 execute 签名是 `(args: Record<string, unknown>, ctx?: ToolContext) => Promise<string>`，第二参数是可选的，但如果工具需要访问 registry/signal/parentSpanId，必须显式接收第二参数。

## 暂缓项

- **权限模式传递**：子 Agent 应该继承父 Agent 的 `executionMode`（不能升级权限），当前固定用 `'auto'`。安全 gap，但因子 Agent 只能调只读工具，风险可控。
- **Coordinator 模式**：专门的 Coordinator Agent + Worker pool + continue 机制。Alice Ch.6 第二种模式，适合更复杂的任务分解场景。暂时父子模式够用。
- **Swarm 模式**：去中心化任务队列 + 依赖关系管理。Alice Ch.6 第三种模式，适合跨会话持久化任务。产品需求不明确时不引入。

## 沉淀：多 Agent 的设计检查清单

1. 这个任务是"信息积累型"还是"并发执行型"？前者用单 Agent，后者才考虑多 Agent。
2. 子 Agent 的上下文真的隔离了吗？中间过程有没有污染父 Agent？
3. 子 Agent 的工具集是受限的吗？有没有给它不该有的工具（delegate_task / remember）？
4. 父 Agent 综合子任务结果时，有没有"based on your findings"这种委托理解的表述？
5. 子 Agent 的 span 有 parentId 吗？能在调用链树里看到父子关系吗？
6. 子 Agent 用的是辅助模型吗？还是浪费主模型做轻量任务？
7. 工具的 description 有没有指导"什么时候该用、什么时候不该用"？
