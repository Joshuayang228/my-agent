# 方法论缺口审计（2026-07-09）

> **这是什么**：用三个新参考源（learning-claude-code 14 章、Anthropic 官方 10 篇文章、lingxi 生产级 Go Agent）对照我们的 M1-M10 方法论，找出「完全缺失的模块」和「已有模块的盲点」。
>
> **怎么用**：这是接下来几天的**对照 + todo 文档**。每完成一项，在对应条目打勾并注明落地位置（哪个 commit / 哪个 mNN 章节）。
>
> **为什么一字不落存档**：三份 agent 报告的原始结论都完整保留在第四部分，避免汇总时丢失细节——后续任何一条要动手时，能追溯到原始论据。
>
> 沉淀时间：2026-07-09 · 参考源：`_reference/learning-claude-code-master`、`_reference/lingxi`、Anthropic 官方文章

---

# 第一部分：最终汇总（三源交叉去重，按价值排序）

三个源的视角互补：
- **learning-claude-code**：CC 生产实现的机制盲点 + 我们没有的模块
- **Anthropic 官方文章**：设计原则层（Eval / workflow-vs-agent / think tool）
- **lingxi**：工程韧性层（错误体系 / 可观测性架构 / 沙箱安全）

排序依据：**多源共识度 + 对「人格化桌面 AI 伙伴」的价值**。

## 🔴 第一梯队：多源共识 or 系统性空白，最该补

### [ ] 1. Eval 评估体系 —— 最大系统性空白（Anthropic P0）
我们有单元测试（验证代码正确），但**完全没有衡量"Agent 行为质量"的评估体系**——人格一致性、记忆有效性、对话质量都没法系统度量。Anthropic 把 eval 当开发核心驱动力（eval-driven development）。含 pass^k 一致性度量、LLM-as-Judge 校准、capability→regression eval 演进。
**建议：独立新模块（暂记 M12 Eval），对伙伴产品极高价值。**

### [ ] 2. 任务生命周期系统 —— 完全缺失模块（CC 共识）
后台任务统一状态机、通知幂等（notified 标志）、进度追踪（input/output token 分别计数）、断线重连、稳定空闲判定。桌面伙伴的记忆整合/主动关怀/定时任务/长任务全靠它，还是"陪伴可见性"（DreamTask 式"正在为你做什么"pill）的基础设施。
**建议：独立新模块（暂记 M11），高价值。**

### [x] 3. M6 权限安全 —— 三源全部点名的重灾区
- **Anthropic**：Auto Mode AI 分类器（两阶段：快速 filter + CoT 推理）、Deny-and-Continue、输入层注入探针、OS 级沙箱
- **lingxi**：运行时审计钩子、**删除强制走回收站（send2trash）** ✅ 已实现（commit 待提交）
- **CC**：Denial Tracking 自动降级、yoloClassifier（AI 审计 AI）、危险规则黑名单本质
**桌面直接操作用户文件，风险最高。补进 M6，极高价值。**

**已完成部分**：
- ✅ 新增 `file_delete` 工具，所有删除操作默认走回收站（trash）
- ✅ 白名单机制：临时文件、构建产物（node_modules/.git/__pycache__/dist/build 等）可永久删除
- ✅ 审计日志：记录所有删除操作（路径、时间、是否可恢复）
- ✅ 单元测试 9 个全部通过

**待完成部分**：
- [ ] AI 分类器替代硬规则（Auto Mode）
- [ ] Deny-and-Continue 模式（拒绝后引导寻找替代方案）
- [ ] 输入层注入探针（工具结果进入上下文前扫描）
- [ ] Denial Tracking 自动降级（连续拒绝后从 auto 降回 ask）

### [~] 4. 独立错误体系 —— 后端已落地（2026-07-09，commit 待填）
Code 枚举 + 因果链保留（Wrap/Unwrap）+ **错误可直接作为 UI 事件**。联动 M9——错误码驱动人格化道歉话术（"您拒绝了…"）。我们方法论连章节都没有。
**建议：独立新章节，高价值且联动人格化。**

- [x] `electron/main/errs/index.ts`：`AgentErrorCode` 枚举（12 码，每个对应真实抛错点）+ `AgentError`（code/cause 因果链/retryable）+ `toAgentError` 归一化（含 LLMError duck-typing 互操作）
- [x] `error` 事件加 `code?: string`（renderer 解耦，不依赖主进程枚举）；runtime/loop/chat 的抛错点全部接上错误码
- [x] `chain()` 沿 cause 链收集诊断信息（仅内部日志）；`toEventPayload()` 脱敏 message + code 给前端
- [x] 11 个单测（errs.test.ts）
- [ ] **前端按 code 分派 UI**（重试按钮 / 降级提示）—— 待做
- [ ] **联动 M9 人格化道歉话术**（错误码 → 语气模板）—— 待做，需和人格引擎一起设计

## 🟡 第二梯队：已有模块的明确盲点

### [ ] 5. M7 可观测性 → Observer 接口化（lingxi 架构级 + CC 细节）
从"轻量 tracer"升级为"接口化生命周期钩子"（Noop/OTel/mock 可插拔，业务零改动）+ OTel GenAI 标准语义（`gen_ai.*`）+ span/metrics 闭环（同一处 End span + Record metric）。CC 补充：孤儿 span 30min TTL 清理 + `interval.unref()`、懒加载 exporter、Console Exporter 流模式自动禁用。
**架构级改造但成本低（exporter 换本地 SQLite/文件）。**

### [ ] 6. M4 上下文压缩盲点（CC）
- 压缩断路器 `MAX_CONSECUTIVE_FAILURES=3`（CC 真实数据：每天曾浪费 25 万次 API 调用）——**注：我们 M4 已有 consecutiveCompactFailures 熔断，需核对是否已覆盖**
- 多压缩策略互斥防竞速（激进策略会销毁精细策略保留的上下文）
- Microcompact 可过期工具结果清理白名单（COMPACTABLE_TOOLS）
- Token 阈值四态机（Warning→Error→AutoCompact→Blocking，预留 3K 供手动 /compact）
- context rot 理论依据

### [ ] 7. M5 记忆盲点（CC）
- **「不存什么」硬清单**（能 grep/git log 推导的、已在 CLAUDE.md 的、临时状态——即使用户要求也不存）——**注：我们 M5 G4 提取判据已部分吸收，需核对完整度**
- 使用前强制校验（不是 TTL：命名文件 check exists、命名函数/flag 则 grep）
- 主 Agent 写过就不重复提取的互斥（hasMemoryWritesSince）
- 记忆写入子 Agent 的最小权限沙箱
- MEMORY.md 只加载前 200 行的索引懒加载
- team memory 并发冲突（后写覆盖）是公开未解问题

### [ ] 8. Workflow vs Agent 决策框架（Anthropic P0）
"何时不该用 Agent、用简单 workflow 就够"——伙伴大部分是简单对话，不需要完整 Agent Loop。5 种 workflow 模式（Prompt Chaining、Routing、Parallelization、Orchestrator-Workers、Evaluator-Optimizer）+ simplicity-first 原则。
**可补进 M1。**

### [ ] 9. Think Tool（Anthropic P0）
零副作用推理工具（不获取信息、不改状态，只记录思考）——伙伴遵循用户偏好（=政策）、长工具链时保持一致性。带领域示例的 think prompt 在航空客服提升 54%。
**可补进 M2/M9。**

## 🟢 第三梯队：中价值

- [ ] **M1/架构**：工具层 vs 服务层平级且互斥的边界原则（决定 AI 能力边界）、`querySource` 全系统"身份证"机制（防递归 + 行为分流）
- [ ] **M1 韧性**：分层超时 + 心跳保活（lingxi）、重试的可重试/不可重试错误码白名单
- [ ] **配置管理章节**：配置源抽象 + 本地热更新（弃 etcd watch，取思想，用本地文件监听）
- [ ] **启动优化**：等待窗口内并行 I/O、阶段计时、超时不缓存 null（可扩进 M7）
- [ ] **可逆性/undo**：连 CC 都没解决的空白，信任型陪伴产品差异化机会
- [ ] **Context Engineering**：升为独立学科、just-in-time 检索（轻量引用+按需加载）、结构化笔记（跨 context reset 的工作记忆）、context reset vs 压缩
- [ ] **M2 工具**：partitionToolCalls 并发分批、contextModifier 延迟修改、isDestructive/isReadOnly 中间地带建模、Tool Search 懒加载、工具描述截断防污染、Tool Use Examples（input_examples）、工具合并、Response Format Enum、Namespacing
- [ ] **M8**：Mailbox 权限冒泡、动态 Agent 列表移出工具描述保 prompt cache（曾浪费 10.2% token）、侧信道 Emitter（控制流/数据流分离）
- [ ] **Generator-Evaluator 架构**：独立 evaluator 解决自我评价过于宽容（Anthropic Harness Design）

## ⚪ 已确认排除（lingxi 标注云特有，不踩坑）
A2A 分布式协议全套（AgentCard 网络发现、凭证透传、JSON-RPC、分布式 IPC 回调）、cgroup/容器资源指标、会话级降采样（本地 100% 采样）、ES 字段预算（preview/sha256/chars，`_ignored` 特有）、多租户 label 维度（product_name/intention_code）、企业策略管控（MDM 下发）

---

## 落地优先级建议（我的判断）

三源交叉后，最值得做的排序：

1. **M6 安全补强**（三源全点名 + 桌面操作真实文件风险最高）——尤其"删除走回收站"和"AI 分类器替代硬规则"
2. **Eval 体系**（最大系统性空白，但工程量大，是长期投入）
3. **任务生命周期 M11**（桌面伙伴后台能力的基础设施）
4. **错误体系 + M7 Observer 接口化**（两个偏架构、成本低、联动人格化）

其余（M4/M5 盲点、workflow 框架、think tool）是"补进现有方法论"的增量，随手可做。

---

# 第二部分：三源视角差异（为什么要交叉）

| | 关注层面 | 典型缺口 |
|---|---------|---------|
| **learning-claude-code** | CC 生产实现的机制细节 + 缺失模块 | 任务系统、压缩熔断、记忆排除清单、Denial Tracking |
| **Anthropic 官方文章** | 设计原则 / 智能层 | Eval 体系、workflow-vs-agent、think tool、context engineering |
| **lingxi** | 工程韧性 / 生产扛压层 | 错误体系、Observer 接口化、沙箱安全、超时分层 |

**两份报告"撞车"的缺口 = 最可信的真缺口**：
- 可观测性不够深（Anthropic context engineering + lingxi Observer 接口化 + CC span 细节）
- 权限/沙箱偏弱（Anthropic Auto Mode + lingxi 审计钩子 + CC Denial Tracking）

**视角差异的洞察**：Anthropic 讲"怎么让 Agent 更聪明/更安全"（原则层），lingxi 讲"怎么让 Agent 在生产扛得住"（韧性层），CC 讲"生产级实现的每个机制细节"。三层都是我们方法论的盲区。

---

# 第三部分：三份 agent 报告原文（一字不落存档）

> 以下是三个 subagent 的完整原始报告，未经删改，供后续追溯任何细节。

## 报告 A：Anthropic 官方 10 篇文章 vs 我们方法论

### Article 1: Building Effective Agents

**Core Theme**: Agent system architecture taxonomy and design principles.

**Uncovered Principles**:

1. **Workflow vs Agent 的明确区分** -- Anthropic 定义 workflow 为"预定义代码路径编排 LLM"，agent 为"LLM 自主决定过程和工具使用"。文章给出 5 种 workflow 模式（Prompt Chaining、Routing、Parallelization、Orchestrator-Workers、Evaluator-Optimizer），并明确指出"只有简单方案不够时才增加复杂度"。我们的 M1 直接进入 Agent Loop，M8 讨论了信息积累型 vs 并发执行型，但没有覆盖"何时不该用 Agent、用更简单的 workflow 就够"这个决策框架，也没有 5 种 workflow 模式的完整分类。

2. **ACI（Agent-Computer Interface）设计哲学** -- 把工具设计提升到"界面设计"的高度：给模型留够 token "think" 空间再写答案、格式贴近训练数据中自然出现的格式、避免格式开销（如 JSON 转义、diff chunk header 计数）、Poka-yoke 防错设计（如强制绝对路径避免相对路径错误）。我们 M2 的 description 四要素只是 ACI 的一个子集。

3. **Simplicity-first 原则** -- "Start with simple prompts, optimize with comprehensive evaluation, add multi-step only when simpler solutions fall short." 这是全文的纲领性原则。我们的方法论倾向于"学最好的、用对的"，但缺少一个显式的"何时不该加复杂度"判据框架。

**对伙伴产品的价值**: 高。伙伴产品的日常交互大部分是简单对话（不需要 Agent Loop），只有部分请求需要完整的工具调用循环。需要一个路由层判断"这次请求走简单回复还是走完整 Agent Loop"。

---

### Article 2: Claude Think Tool

**Core Theme**: 给 Agent 一个专用的"思考"工具，在复杂工具调用链中插入结构化推理步骤。

**Uncovered Principles**:

4. **Think Tool 作为独立工具** -- 不同于 extended thinking（回复前的深度思考），think tool 是在回复过程中、收到工具结果后停下来反思。特别适合：政策密集环境、顺序决策、工具输出分析。带领域示例的 think prompt 在航空客服场景提升 54%。关键在于这是一个"零副作用"的工具——不获取新信息、不修改状态，只记录思考过程。

5. **为 Think Tool 提供领域化推理示例** -- 不只是给工具，还要在 system prompt 中教模型"怎么想"：列出适用规则、检查信息完整性、验证合规性。这是一种将领域知识编码为推理模板的方法。

**对伙伴产品的价值**: 高。伙伴需要遵循用户偏好（相当于"政策"），在长工具链中保持一致性。Think tool 可以让伙伴在执行复杂任务时自我检查"这符合用户的偏好吗"。

---

### Article 3: Advanced Tool Use

**Core Theme**: 大规模工具库的三项进阶能力。

**Uncovered Principles**:

6. **Tool Search Tool（按需发现）** -- 工具定义本身占大量 token（50 个工具约 55K token）。解法是只预加载核心工具，其余标记 `defer_loading: true`，Agent 需要时通过搜索工具按需加载。85% token 节省，准确率从 49% 提升到 74%。我们 M2 没有讨论工具发现/按需加载机制。

7. **Programmatic Tool Calling（代码编排工具调用）** -- 让 Agent 写 Python 代码编排工具调用，中间结果不进入 Agent 上下文，只有最终输出回传。减少 37% token、消除多次推理开销。我们 M2 的并发调度是在框架层做的，没有让 LLM 自己写编排代码的模式。

8. **Tool Use Examples（使用示例）** -- 在工具定义中提供 `input_examples`，展示参数格式约定、可选参数组合模式、嵌套结构用法。准确率从 72% 提升到 90%。我们 M2 的 description 四要素只有文字描述，没有结构化示例。

**对伙伴产品的价值**: 中-高。当前工具数量有限（约 20 个），Tool Search 暂时不急；但随着 Skill 和 MCP 生态扩展，按需加载会变得必要。Tool Use Examples 对现有工具立即有用。Programmatic Tool Calling 对数据处理类任务（如分析用户文件）非常适合。

---

### Article 4: Demystifying Evals for AI Agents

**Core Theme**: Agent 评估体系的完整方法论。

**Uncovered Principles**:

9. **评估驱动开发（Eval-Driven Development）** -- 不是测试之后的验证，而是开发前先定义 eval、用 eval 衡量改动效果。结构：task → trial → grader → transcript → outcome → harness → suite。三类 grader：code-based（确定性）、model-based（LLM 判分）、human（金标准）。capability eval 从低通过率开始爬坡，saturation 后毕业为 regression eval。

10. **pass@k vs pass^k 一致性度量** -- pass@k 度量"k 次里至少成功一次"（能力天花板），pass^k 度量"k 次全部成功"（一致性）。对用户面产品，pass^k 更重要——用户期望每次都可靠。

11. **Eval 任务设计原则** -- 任务要明确到"两个领域专家独立判断会得出同样的 pass/fail"；评结果不评路径（不惩罚创造性替代方案）；构建双向测试集（该做的场景 + 不该做的场景）；避免单类不平衡。

12. **LLM-as-Judge 校准** -- 用人类专家定期校准 LLM 评分器，给 LLM 退路（"Unknown"选项防止幻觉），每个维度独立评分而非一个 LLM 评所有维度。

**对伙伴产品的价值**: 极高。这是我们方法论最大的缺口。我们有单元测试（验证代码正确性），但没有：
- 衡量"伙伴体验质量"的 eval 体系
- 人格一致性的 pass^k 测量
- 记忆有效性的 capability eval
- 模型升级时的 regression 检测
- LLM-as-Judge 对对话质量的自动评分

---

### Article 5: Claude Code Auto Mode

**Core Theme**: 用 AI 分类器替代人工审批，实现安全的自主执行。

**Uncovered Principles**:

13. **Overeager Behavior 作为独立威胁模型** -- Agent 理解用户目标、真心想帮忙，但超出用户授权范围采取主动行动。这与 prompt injection 和 misalignment 是不同的威胁类别。我们 M6 没有把"好心办坏事"作为独立威胁建模。

14. **模型分类器替代人工审批** -- 两阶段：Stage 1 快速单 token filter（偏保守，8.5% FPR），Stage 2 仅对 Stage 1 标记的做 chain-of-thought 推理（降到 0.4% FPR）。分类器只看用户消息 + 工具调用，剥离 assistant 文本和工具结果（防止 agent 说服分类器）。

15. **Deny-and-Continue 模式** -- 拒绝不中断会话，而是作为 tool_result 返回给 agent 并指示寻找更安全的替代方案。连续 3 次拒绝或累计 20 次才终止。使 FP（误拦）的代价仅为一次重试。我们 M6 的拒绝追踪是"告诉 AI 别再试"，不是"引导 AI 找替代方案"。

16. **Input-layer Prompt Injection Probe** -- 在工具结果进入 Agent 上下文前，用独立探针扫描注入企图，发现后在结果旁注入警告让 Agent 重新锚定用户意图。与 transcript classifier 形成双层防御。我们 M6/M9 的防注入只在人格层（PROTECTED 声明），没有对工具结果的输入层扫描。

17. **Multi-agent Handoff 分类** -- 子 Agent 委派时做 outbound check（委派的任务是否超出用户意图），返回时做 return check（子 Agent 是否被中途注入劫持）。我们 M8 的权限只降不升是静态规则，没有动态分类。

**对伙伴产品的价值**: 极高。伙伴产品的核心体验矛盾就是"自主 vs 安全"——不能每次都问用户（破坏伙伴感），也不能完全放开（overeager 风险）。Auto Mode 的分级分类器模式是最适合伙伴产品的方案。

---

### Article 6: Claude Code Sandboxing

**Core Theme**: OS 级沙箱实现文件系统隔离 + 网络隔离。

**Uncovered Principles**:

18. **文件系统隔离 + 网络隔离必须同时存在** -- 只有文件系统隔离，被劫持的 Agent 可以通过网络泄露 SSH key；只有网络隔离，被劫持的 Agent 可以修改系统文件逃逸沙箱。两者缺一不可。我们 M6 提到沙箱是独立问题但没有详述这个"必须同时"的原则。

19. **OS 级原语（bubblewrap/seatbelt）而非应用层沙箱** -- 用 Linux bubblewrap 和 macOS seatbelt 做内核级强制，覆盖 Agent 启动的所有子进程。不靠应用层检查。我们的 sandbox 实现是应用层的路径检查 + 命令检查，没有 OS 级隔离。

20. **Network Proxy 架构** -- 通过 Unix domain socket 连接到沙箱外的代理服务器，代理服务器维护域名白名单并处理新域名的用户确认。我们没有网络隔离。

**对伙伴产品的价值**: 中。桌面应用可以利用 Electron 的进程隔离 + OS 沙箱。当伙伴需要执行用户的代码/脚本时，OS 级沙箱是必须的安全底线。

---

### Article 7: Effective Context Engineering

**Core Theme**: 将上下文管理提升为一门系统化学科。

**Uncovered Principles**:

21. **Context Engineering 作为独立学科** -- 不只是"prompt engineering"，而是"在每次推理时策划最优的 token 集合"。核心原则：找到最小的高信号 token 集合来最大化期望结果。Context rot（随 token 增加召回能力下降）是架构级约束。

22. **System Prompt 的"正确高度"** -- 在两个极端之间找平衡：过于具体的 if-else 硬编码（脆性高）vs 过于笼统的高层指导（假设共享上下文）。最优高度是"足够具体以引导行为，又足够灵活以提供强启发式"。我们 M9 的 prompt 结构讨论了层级，但没有讨论"指令粒度"的选择。

23. **Just-in-time Context Retrieval** -- Agent 维护轻量引用（文件路径、查询、链接），运行时用工具按需加载，而非预先全量检索。渐进式发现（progressive disclosure）让 Agent 逐层积累理解。我们 M5 有向量检索，但没有"Agent 自主探索按需拉取"的模式。

24. **Structured Note-taking 作为跨 context reset 的记忆** -- Agent 主动写笔记/待办到外部文件，context reset 后读回。这不同于 M5 的跨会话记忆，而是单任务内的"工作记忆持久化"。Claude 玩 Pokemon 的例子展示了这种模式在非编码领域的价值。

25. **Context Reset vs Compaction** -- 对有"上下文焦虑"（接近窗口限制时过早收工）的模型，完全重置 + 结构化交接比压缩更有效。我们 M4 只讨论了压缩，没有"重置 + 交接文档"这个替代方案。

**对伙伴产品的价值**: 高。长对话是伙伴产品的核心场景。将 context engineering 作为独立学科对待，特别是 just-in-time retrieval 和 structured note-taking，对维持长对话质量至关重要。

---

### Article 8: Writing Tools for Agents

**Core Theme**: 为 Agent 设计高效工具的原则和方法。

**Uncovered Principles**:

26. **工具合并（Consolidation）** -- 不是暴露底层 API 的每个端点，而是合并多步操作为单个高级工具。例如不做 `list_users` + `list_events` + `create_event`，而是做一个 `schedule_event`。减少中间输出占用上下文。我们 M2 没有讨论工具合并原则。

27. **Namespacing** -- 用前缀/后缀命名空间（如 `asana_projects_search`）帮助 Agent 在大量工具中导航。前缀 vs 后缀的选择对不同 LLM 有不同效果，需要通过 eval 决定。

28. **Response Format Enum** -- 工具暴露 `response_format: "concise" | "detailed"` 参数，让 Agent 控制返回信息量。简洁模式用于后续操作只需 ID，详细模式用于需要全部上下文。

29. **Eval-driven Tool Optimization Loop** -- 系统化流程：生成 eval 任务 → 运行 eval → 分析 transcript → 让 Claude Code 自动优化工具描述 → 用 held-out test set 验证。"我们在工具上花的时间比在整体 prompt 上更多。"

30. **工具响应结构选择** -- XML、JSON、Markdown 对不同任务有不同效果，没有万能格式。需要通过 eval 为具体场景选择最优格式。

**对伙伴产品的价值**: 中-高。随着工具数量增长和 MCP 生态接入，这些原则会越来越重要。Response Format Enum 对节省伙伴的上下文预算立即有用。

---

### Article 9: Harness Design for Long-Running Apps

**Core Theme**: 长时间自主运行的多 Agent 架构设计。

**Uncovered Principles**:

31. **Generator-Evaluator（GAN-inspired）架构** -- 用独立的 evaluator agent 评估 generator 的产出，形成迭代改进循环。解决"Agent 评价自己的工作时过于宽容"的问题。Evaluator 通过 Playwright MCP 实际操作应用来验证。

32. **Sprint Contract（代理间合同）** -- Generator 和 Evaluator 在每个 sprint 前协商"完成"的具体定义，双方迭代直到达成一致。这在 spec 和实现之间建立了桥梁。

33. **"每个 Harness 组件编码了一个关于模型不能做什么的假设"** -- 模型升级后要重新检验这些假设，剥离不再 load-bearing 的组件。这是一个元原则：harness 设计不是静态的，需要随模型能力演化。

34. **Self-evaluation 的固有缺陷** -- Agent 评价自己的工作时系统性偏向正面。即使有可验证结果的任务也是如此。解法是分离执行和评估。

**对伙伴产品的价值**: 中。当伙伴执行复杂的多步任务（如帮用户完成一个项目）时，evaluator 模式可以确保质量。"Sprint contract"模式可以让伙伴和用户就"什么算完成"达成一致。

---

### Article 10: AI-Resistant Evals

**Core Theme**: 设计能抵抗 AI 能力提升的评估系统。

**Uncovered Principles**:

35. **评估需要持续迭代以保持有效性** -- 每代模型都可能使现有 eval 饱和。需要监控饱和度，及时升级 eval 难度。

**对伙伴产品的价值**: 中。提醒我们 eval 体系不是一次性建设。

---

### 报告 A 的方法论缺失原则清单（按价值排序）

| 优先级 | 缺失原则 | 来源文章 | 对伙伴产品的价值判断 |
|--------|---------|---------|-------------------|
| **P0** | **评估驱动开发体系**（task/trial/grader/harness 结构、capability vs regression eval、pass^k 一致性度量、LLM-as-Judge 校准） | Demystifying Evals | 没有 eval 就无法系统地衡量和改进伙伴体验质量，尤其是人格一致性和记忆有效性 |
| **P0** | **Think Tool 作为独立推理工具**（零副作用 scratchpad + 领域化推理示例） | Think Tool | 伙伴在遵循用户偏好（=政策）、处理复杂多步任务时，需要显式推理空间来保持一致性 |
| **P0** | **Workflow vs Agent 决策框架**（5 种 workflow 模式 + "只在简单方案不够时才加复杂度"） | Building Effective Agents | 伙伴的大部分交互是简单对话，不需要完整 Agent Loop；需要轻量路由决定走哪条路径 |
| **P1** | **AI 分类器替代人工审批**（两阶段分类、剥离 assistant 文本防说服、overeager threat model） | Auto Mode | 伙伴产品不能频繁弹窗确认，但也不能完全放开；模型分类器是最佳平衡点 |
| **P1** | **Deny-and-Continue 模式**（拒绝作为 tool_result 返回、引导找替代方案、N 次升级） | Auto Mode | 比"告诉 AI 别再试"更优雅——让伙伴自己找到安全的替代方案，减少对话中断 |
| **P1** | **Context Engineering 作为独立学科**（有限注意力预算、context rot、最小高信号 token 集） | Context Engineering | 需要将 M4 压缩和 M9 prompt 结构统一到"context engineering"这个完整框架下 |
| **P1** | **Just-in-time Context + Progressive Disclosure**（轻量引用 + 按需加载 + 逐层发现） | Context Engineering | 伙伴面对用户的文件系统和信息时，应该像人一样按需探索，而非预先全量加载 |
| **P1** | **Input-layer Prompt Injection Probe**（工具结果进入 Agent 前的独立扫描 + 警告注入） | Auto Mode | 伙伴会读取用户的文件/网页，这些内容可能包含注入攻击；需要输入层防御 |
| **P2** | **Eval-driven Tool Optimization**（用 eval 衡量工具效果、让 Agent 分析 transcript 自动优化） | Writing Tools | 工具质量需要系统化衡量和迭代，不能只靠人工判断 |
| **P2** | **Tool Consolidation + Namespacing + Response Format Enum** | Writing Tools + Advanced | 随着工具增长、MCP 接入，需要更系统的工具组织和效率策略 |
| **P2** | **Tool Use Examples**（`input_examples` 展示参数模式） | Advanced Tool Use | 提升工具调用准确率的低成本方法（72%→90%） |
| **P2** | **Tool Search Tool（按需发现大规模工具库）** | Advanced Tool Use | MCP 生态扩大后必须有；当前工具量级暂不急 |
| **P2** | **Structured Note-taking 作为 task-level 工作记忆** | Context Engineering | 长任务中 Agent 主动写笔记、context reset 后读回，与 M5 跨会话记忆互补 |
| **P2** | **Context Reset + 结构化交接（vs 仅压缩）** | Context Engineering + Harness Design | 某些模型有"上下文焦虑"，完全重置可能比压缩更有效；作为 M4 的补充方案 |
| **P2** | **Generator-Evaluator 迭代架构**（独立 evaluator 解决自我评价过于宽容） | Harness Design | 伙伴执行复杂创作任务时，独立评估者可以提升质量 |
| **P2** | **OS 级沙箱（bubblewrap/seatbelt + 网络代理）** | Sandboxing | 应用层路径检查可被子进程绕过；需要 OS 级强制 |
| **P2** | **ACI 设计哲学**（格式贴近训练数据、避免格式开销、Poka-yoke） | Building Effective Agents | 工具格式的微调对 LLM 行为影响大，值得系统化 |
| **P3** | **Programmatic Tool Calling（代码编排）** | Advanced Tool Use | 数据处理任务时减少上下文污染；当前场景较少 |
| **P3** | **Overeager 行为作为独立威胁模型** | Auto Mode | 需要补充到 M6 的威胁建模中 |
| **P3** | **Sprint Contract（Agent 间协商完成标准）** | Harness Design | 多 Agent 执行复杂任务时有用 |
| **P3** | **"每个 harness 组件编码了模型能力假设"元原则** | Harness Design | 模型升级时要重新审视架构组件是否仍 load-bearing |

### 报告 A 总结：三个系统性缺口

1. **没有 Eval 体系** -- 我们有单元测试（验证代码正确性），但没有衡量"Agent 行为质量"的评估系统。Anthropic 把 eval 视为开发的核心驱动力（eval-driven development），而我们完全缺失这一层。

2. **没有"何时不用 Agent"的决策框架** -- 我们 10 篇方法论全在讲"怎么做好 Agent"，但没有讲"什么时候不该启动完整 Agent Loop"。Anthropic 的核心原则是 simplicity first + workflow/agent 区分。

3. **权限系统停留在静态规则，没有 AI 分类器** -- 我们的责任链是规则匹配，Anthropic 的方向是用模型做动态判断（Auto Mode）。对伙伴产品来说，"不打扰用户又足够安全"的体验依赖于比规则更智能的决策。

---

## 报告 B：lingxi 生产级 Go Agent vs 我们方法论

### 一、读到的关键事实（有代码依据）

先列出判断所依赖的实证，便于核对：

- **可观测性是一等公民**：`observability/` 是独立包，`Observer` 接口（`observer.go`）把 AgentRun/Turn/Tool/LLM 四类生命周期钩子标准化，`OTelObserver` 全量对齐 OTel GenAI 语义约定（`gen_ai.*`），span 与 Prometheus metrics **闭环记录**（`OnLLMEnd` 里同时 `span.End()` + `recorder.Record*`）。
- **指标体系细到桶**：`docs/metrics_references.md` 定义了 TTFB、SSE 间隔、AI Gateway 耗时、token 用量（分 prompt/completion/cache）、成本、工具耗时、JSON 修复次数等，每个都有明确 Histogram buckets 和 label 维度（model/source/agent/product_name/intention_code）。
- **PII 脱敏内建于遥测链路**：`OTelObserver` 在 `OnLLMStart` 对 user/assistant/tool 消息做选择性脱敏（`marshalMessagesWithSelectiveSanitize`），system prompt 不脱敏；`pkg/masking/mask.go` 提供字段级掩码。
- **大字段预算**：`WithMaxCaptureChars` — 超限文本存 `.preview/.sha256/.chars` 三件套，防 ES `_ignored`。
- **会话级确定性采样**：`session_sampler.go` — 用 FNV-1a 哈希 conversation.id，保证一个会话的所有 span 要么全采要么全丢，rate 可热更新。
- **错误体系**：`errs/` — 带 Code 枚举 + Message + InnerErr 的结构化错误，实现 `Unwrap`/`Is`/`CodeOf`，且 `Error` 本身实现了前端 Event 接口（错误能直接作为事件流回前端）。
- **重试/退避**：`retrier.go` — 指数退避 + 白名单错误码（`GateWayLimitError`/`RateLimited.*`/`EmptyToolCalls`），溢出保护。
- **配置中心**：`configcenter/` — Source 抽象，etcd 支持 prefix watch **热更新**，env/file 是启动快照；类型安全 `ConfigVar[T]`。
- **A2A（agent-to-agent）**：`lingxiclaw/a2a/` — 标准 A2A 协议客户端（AgentCard 发现、拦截器链透传凭证/身份）、IPC 回调注册表、侧信道 Emitter、三级事件分类持久化、超时分层。
- **沙箱**：Python `audit_lite.py`（`sys.addaudithook` 拦截 `os.remove/rmdir`，强制 send2trash + 路径白名单）+ `jupyter_executor.py`（kernel 审计钩子经 stdin `__PERM_REQ__` 通道向前端请求授权）+ `kernel_pool.py`（按 workspace 复用 kernel）。架构上是**独立 local-server 进程** + Jupyter kernel 子进程，与主 agent 逻辑（云端）进程隔离。
- **上下文压缩**：`offloader.go` — 按轮次 + token 双限裁剪历史（不是压缩摘要，是硬裁剪）。

### 二、工程化缺口清单（按对桌面产品价值排序）

#### 🔴 高价值 — 桌面产品直接受益，建议补进方法论

**缺口 1：可观测性的"闭环 + 标准语义约定 + 生命周期钩子接口化"**
- **lingxi 怎么做**：`Observer` 是一个稳定接口（4 类 8 个钩子），业务代码只依赖接口；`OTelObserver`/`CompositeObserver`/`NoopObserver` 可插拔。所有 span 走 OTel GenAI 标准 key（`gen_ai.usage.input_tokens` 等），metrics 与 span **在同一处闭环**记录。`CompositeObserver` 支持一次 fan-out 到多个观察者（如同时喂 tracing + 计费）。
- **对应模块**：M7（可观测性，只有轻量 tracer）。
- **我们缺的工程维度**：
  1. **把 tracer 从"日志"升级为"接口化生命周期钩子"** —— NoopObserver 默认注入，生产可换 OTel，测试可换 mock，业务零改动。这是 M7 最该抄的架构，跟云无关。
  2. **对齐 OTel GenAI 语义约定的 attribute key** —— 即使桌面不接 Jaeger，用标准 key 命名（agent/turn/tool/llm 的 input/output/token/ttft/finish_reason）能让本地 trace 面板、future 云同步、第三方工具直接复用。
  3. **span 与 metrics 闭环** —— 在同一个 `OnXxxEnd` 里既结束 span 又记录指标，避免两套统计口径漂移。
- **桌面价值判断**：**高，且几乎零改造成本**。桌面反而更需要本地可观测（用户机器上出问题没法登服务器看日志）。区别是 exporter 换成本地 SQLite / 结构化日志文件 / 可选上报，而不是 OTLP collector。

**缺口 2：结构化错误体系（Code + Wrap + 可作为事件流回前端）**
- **lingxi 怎么做**：`errs.Error{Code, Message, InnerErr}`，`Code` 是带 `String()` 的枚举（`ToolNameNotFound`/`MaxGenerationExceeded`/`ContentEmpty` 等 agent 语义错误），`Wrap/Wrapf` 保留因果链，`Is/CodeOf` 支持类型判断。关键：`Error` 实现了 `EventType() "error"`，**错误能直接作为 AGUI 事件推给前端渲染**。
- **对应模块**：无对应（M 模块没有独立的错误体系章节，明显盲区）。
- **我们缺的工程维度**：一套 agent 领域错误码 + 因果链保留 + 错误直达 UI 的机制。桌面 AI 伙伴的错误（工具失败、超轮次、内容审核、权限拒绝）需要**分类**才能决定 UI 表现（重试按钮？降级提示？人格化道歉话术？）。
- **桌面价值判断**：**高**。人格化产品尤其需要——错误码决定了"伙伴"用什么语气回应失败（参考 sandbox 里权限拒绝的话术模板 `_deny`："请以「您拒绝了…」开头回复用户"，这就是错误码驱动人格化话术）。这点对 M9 人格引擎也有联动价值。

**缺口 3：分层超时 + 心跳保活 + 资源清理（长任务韧性）**
- **lingxi 怎么做**（A2A 文档 §7）：超时分 4 层（工具配置超时 → IPC 缓冲 3min → context deadline → 单次等待超时 → 心跳 5s）；IPC 等待期间每 5 秒发心跳防前端断连；资源清理有明确的 defer + 后台 TTL cleanup（10min）防泄漏。
- **对应模块**：M1（Agent Loop）部分相关，但没讲透超时分层和心跳。
- **我们缺的工程维度**：长任务（生成 PPT、深度研究）的**超时分层**和**保活心跳**。桌面 agent 跑本地长任务（大文件处理、多轮工具调用）时，UI 需要心跳知道"还活着"，否则用户以为卡死。
- **桌面价值判断**：**高**。桌面长任务比云更常见（本地大文件），心跳保活对 UX 直接相关。

**缺口 4：重试与退避的"错误码白名单"策略**
- **lingxi 怎么做**：`retrier.go` 只对特定错误码（限流类 + `EmptyToolCalls`）重试，指数退避 + 上限 + 溢出保护，且**重试轮次与生成轮次共享配额**（防无限重试）。明确**不重试**业务错误（参数错、工具不存在）。
- **对应模块**：M3（LLM 路由）或 M1，可能提了重试但没讲"哪些该重试"。
- **我们缺的工程维度**：**可重试 vs 不可重试的分类**。桌面同样会遇到模型限流、空 tool_calls（豆包这类模型的已知问题）、网络抖动。盲目重试业务错误会浪费 token 和时间。
- **桌面价值判断**：**高**。桌面调云端模型 API 一样会限流/抖动，退避策略直接影响可用性。

**缺口 5：沙箱的"审计钩子 + 强制安全删除 + 授权经通道回传前端"**
- **lingxi 怎么做**：三层——(a) `audit_lite.py` 用 Python `sys.addaudithook` **在解释器层**拦截 `os.remove/os.rmdir`，强制改用 send2trash（可恢复），配路径白名单（workspace/tmp/pycache/回收站/python env/matplotlib cache）；(b) `jupyter_executor.py` 把权限请求经 Jupyter stdin `__PERM_REQ__` 通道**异步回调前端**，用户点授权才放行；(c) 进程级隔离：agent 逻辑在云端进程，代码执行在用户机 local-server 的 Jupyter kernel 子进程，`kernel_pool` 按 workspace 复用 + Lock 串行化。
- **对应模块**：M6（权限安全，只有命令分级 + 路径守卫）。
- **我们缺的工程维度**：
  1. **运行时审计钩子** —— 不是靠"命令分级"事前分类，而是在真正执行危险操作（删除）时**运行时拦截**。桌面版可对等：Electron 主进程拦截 fs 操作，或在工具执行层加 audit hook。
  2. **"不可逆操作"专项处理** —— 删除强制走回收站而非永久删除，这是桌面 AI 伙伴**必须有**的安全网（用户文件误删是灾难）。
  3. **授权请求异步回传 UI + 阻塞等待** —— 权限请求作为一种消息流回前端，用户决策再放行，而不是配置文件里写死白名单。
- **桌面价值判断**：**极高**。桌面直接操作用户真实文件，比云沙箱风险更大。send2trash 模式、运行时删除拦截、UI 授权回路是桌面产品的核心安全设计。**这是 M6 最该补的一块。**

#### 🟡 中价值 — 桌面需要，但形态要改造

**缺口 6：配置热更新与配置源抽象**
- **lingxi 怎么做**：`configcenter` 抽象 Source 接口，etcd 源支持 prefix watch **运行时热更新**（改采样率、开关不重启），env/file 源是启动快照；`ConfigVar[T]` 类型安全，采样率通过 `rateFunc` 闭包实现热更。
- **对应模块**：无对应（方法论完全没讲配置管理，确认是空白）。
- **我们缺的工程维度**：**配置源抽象 + 部分配置热更新**。桌面不需要 etcd，但需要：本地 settings 文件（用户可改）、可选云端下发配置（feature flag、模型开关、prompt 模板）、以及**不重启生效**的机制。
- **桌面价值判断**：**中**。etcd/prefix watch 是云服务特有，桌面不需要。但"配置源抽象 + 热更新（改人格参数、模型选择、采样开关无需重启）"对桌面有价值——桌面版的热更对象是本地文件监听而非 etcd watch。**取其思想，弃其实现。**

**缺口 7：会话级确定性采样**
- **lingxi 怎么做**：`session_sampler.go` FNV-1a 哈希会话 ID，同会话全采或全丢，rate 热更。
- **对应模块**：M7。
- **我们缺的工程维度**：采样策略。桌面单机 QPS 极低，**通常应 100% 采样**（本地存储便宜），采样"降流量"的动机基本不存在。但"同会话决策一致"的思想在**选择性详细记录**（只对出错会话保留完整 input/output）时有用。
- **桌面价值判断**：**低-中，部分云特有**。降采样是云服务省成本/省带宽特有，桌面不需要。但"按会话决定记录详细程度"可借鉴用于本地存储控制。

**缺口 8：大字段预算（preview/sha256/chars）**
- **lingxi 怎么做**：超长文本存摘要三件套，防 Elasticsearch `_ignored`。
- **对应模块**：M7 / M4（上下文压缩，但那是喂模型；这是存遥测）。
- **我们缺的工程维度**：遥测数据的存储预算。
- **桌面价值判断**：**低，云特有**。`_ignored` 是 ES 特有问题。桌面本地存 SQLite/文件没有字段大小硬限制。**明确标注：桌面不需要。** 但"记录 sha256 做去重/引用"可选保留。

**缺口 9：token/成本/TTFB 的精细化指标 + 标签维度**
- **lingxi 怎么做**：token 分 prompt/completion/cache_read/cache_creation 四类计量，成本单独计量，label 带 model/source/agent/product_name/intention_code，TTFB 和 SSE 间隔有专门直方图。
- **对应模块**：M7 / M3。
- **我们缺的工程维度**：指标的**维度设计**（按什么切分）和 **cache token 单列**（缓存命中率直接关系成本和延迟）。
- **桌面价值判断**：**中**。桌面用户也关心 token 消耗（尤其自带 key 的用户）、响应速度。cache 命中率对用 Claude prompt caching 的桌面 agent 有实际成本意义。多维 label（product_name/intention_code 这类云端多租户维度）桌面可精简，但 model/agent/场景维度值得保留。

#### 🟢 低价值 / 云服务特有 — 桌面单机基本不需要

**缺口 10：A2A（agent-to-agent）分布式协议**
- **lingxi 怎么做**：完整的跨服务 A2A——AgentCard 发现（`/.well-known/agent.json`）、JSON-RPC 传输、凭证/身份 header 透传拦截器、IPC 回调注册表（`sync.Map` 全局表 + Signal 唤醒）、侧信道 Emitter、三级事件持久化。这是为了让灵犀 agent 调用**远端独立部署**的其他 agent（wps-cowork 等）。
- **对应模块**：M8（多 Agent）。
- **我们缺的工程维度**：如果 M8 讲的是**进程内/本地多 agent 协作**，那 lingxi 的 A2A 是**跨网络分布式 agent 编排**，量级不同。
- **桌面价值判断**：**大部分云特有**。桌面单机不需要跨服务 AgentCard 发现、凭证透传、JSON-RPC 网络传输、IPC 分布式回调。**但有两个思想值得下沉到 M8**：
  1. **侧信道 Emitter 模式** —— 主通道走组件生命周期，侧信道走实时数据/心跳/文件产物。桌面多 agent 或 agent→UI 通信同样受益于"控制流与数据流分离"。
  2. **能力发现 + 标准化 agent 描述** —— 即使本地多 agent，用统一的 card/signature 描述能力也有价值。
  - 分布式 IPC、凭证透传、notify 代理转发这些**明确标注为云特有**。

**缺口 11：容器/进程强隔离（cgroup、系统资源指标）**
- **lingxi 怎么做**：`pkg/metrics/cgroup` 读容器 CPU/内存，`collector_unix/windows` 跨平台系统指标，Go runtime 指标（goroutine/GC/heap）。sandbox 用独立 local-server 进程 + Jupyter kernel 子进程隔离。
- **对应模块**：M6 / M7。
- **我们缺的工程维度**：进程级资源监控与隔离。
- **桌面价值判断**：**mostly 云特有**。cgroup、容器 CPU 核数是 K8s 部署特有。但**"代码执行放独立子进程 + kernel 池 + Lock 串行化 + idle 回收"这个进程隔离模式对桌面高度适用**——Electron 桌面 agent 执行不可信代码/工具时，也应该 fork 子进程而非在主进程跑。系统资源监控（本机 CPU/内存占用）对桌面 UX 也有意义（别让 AI 伙伴把用户机器跑爆）。

### 三、精简结论：按"抄不抄"分三档

**该抄（桌面直接受益，改造成本低）：**
1. **M7 → Observer 接口化生命周期钩子 + OTel GenAI 标准语义 + span/metrics 闭环**（架构照搬，exporter 换本地）
2. **新增"错误体系"章节** → Code 枚举 + Wrap 因果链 + 错误可作为 UI 事件（联动 M9 人格化话术）
3. **M6 → 运行时审计钩子 + 不可逆操作强制走回收站 + 授权请求异步回传 UI 阻塞等待**（桌面安全核心）
4. **M1 → 分层超时 + 心跳保活 + defer 资源清理**
5. **M3/M1 → 重试的可重试/不可重试错误码白名单 + 指数退避**
6. **M6 → 代码执行子进程隔离 + kernel 池 + Lock 串行化 + idle 回收**

**取思想弃实现（形态要改）：**
7. **新增"配置管理"章节** → 配置源抽象 + 热更新，但用本地文件监听替代 etcd watch
8. **M4/M7 → cache token 单列计量 + token/成本本地统计**（自带 key 用户关心）
9. **M8 → 侧信道 Emitter（控制流/数据流分离）+ 能力发现描述**

**云服务特有，桌面明确不需要：**
10. 会话级降采样（本地 100% 采样即可）
11. 大字段 preview/sha256/chars 预算（ES `_ignored` 特有）
12. A2A 分布式协议全套（AgentCard 网络发现、凭证透传、JSON-RPC、notify 代理、分布式 IPC 回调）
13. cgroup/容器资源指标、多租户 label 维度（product_name/intention_code）

**最该优先补的三块**：M6 沙箱安全（缺口 5，桌面直接操作用户文件风险最高）、M7 Observer 接口化（缺口 1，架构级且零成本）、独立的错误体系章节（缺口 2，当前完全空白且联动人格化）。

---

## 报告 C：learning-claude-code（14 章）vs 我们 M1-M10

### 一、我们完全缺失的模块（M1-M10 无对应）

**06-task-system 任务生命周期系统** — 后台任务的统一状态机、通知幂等、进度追踪、断线重连；桌面伙伴的记忆整合/主动关怀/定时任务全靠它。**高优先级，建议新增 M11。**

**10-startup 启动优化** — 等待窗口内并行 I/O、阶段计时、超时不缓存 null；Electron 冷启动直接影响陪伴即时感。**中高优先级，可扩展进 M7。**

**08-mcp 外部能力接入** — 六种传输、连接状态机、命名空间、描述截断、Elicitation（工具反问用户）；看产品是否接外部服务。**中优先级，选择性补。**

**09-enterprise 企业配置分层** — 五层配置来源、策略下发、向后兼容铁律；个人桌面伙伴用不到策略管控本身。**低优先级，仅吸收原则。**

**12-reflection / 13-next-questions（元章节）** — 非模块，但提炼出「可逆性/undo」这个连 CC 都没解决的空白，对信任型陪伴产品是差异化机会。**可逆性属高优先级空白。**

### 二、已有模块的盲点

**M1 Agent Loop / 架构**
- 工具层 vs 服务层平级且互斥的边界原则（决定 AI 能力边界在哪）
- `querySource` 全系统「身份证」机制（防递归 + 行为分流）
- 编译时 DCE flag vs 运行时灰度 flag 双轨制

**M2 工具系统**
- `partitionToolCalls` 并发分批（连续只读合批，默认 10 路，抛异常保守退化）
- `contextModifier` 延迟修改防竞态
- `isDestructive`/`isReadOnly` 中间地带（建文件既非只读也非不可逆）建模不足
- ToolSearchTool + searchHint 懒加载
- 工具描述截断防上下文污染、配置文件原子写入（这两条从 MCP 章借来）

**M4 上下文压缩**
- Token 阈值四态机（Warning→Error→AutoCompact→Blocking，预留 3K 供手动 /compact）
- 压缩断路器 `MAX_CONSECUTIVE_FAILURES=3`（真实数据：每天曾浪费 25 万次 API 调用）
- 多压缩策略互斥防竞速（激进策略会销毁精细策略保留的上下文）
- Microcompact 可过期工具结果清理白名单
- context rot 理论依据

**M5 记忆系统**
- 「不存什么」硬清单（能 grep/git log 推导的、已在 CLAUDE.md 的、临时状态——即使用户要求也不存）
- 使用前强制校验（不是 TTL：命名文件 check exists、命名函数 grep）
- 主 Agent 写过就不重复提取的互斥
- 记忆写入子 Agent 的最小权限沙箱
- MEMORY.md 只加载前 200 行的索引懒加载
- team memory 并发冲突（后写覆盖）是公开未解问题

**M6 权限与安全**
- Denial Tracking：连续拒绝后自动从 auto mode 降级回人工询问（安全+成本双控）
- yoloClassifier：AI 审计 AI + 三层快速路径优化
- 危险前缀黑名单本质：禁止设为 allow 规则（非禁止执行）
- 复合命令 50 子命令上限防 ReDoS
- 权限提示是信息设计（显示规则来源）

**M8 多 Agent**
- 权限请求经 Mailbox 向 Leader 冒泡（带 workerColor）
- 动态 Agent 列表移出工具描述以保 prompt cache（曾浪费 10.2% fleet token）
- In-Process(AsyncLocalStorage) vs Split-Pane(tmux) 两种运行方式
- worker prompt 反模式「永远不要写 based on your findings」

**M7 可观测性（覆盖良好，少量盲点）**
- 懒加载 Exporter、Console Exporter 流模式自动禁用
- 孤儿 Span 30 分钟 TTL 清理 + `interval.unref()` + WeakRef 内存管理
- Perfetto 多 Agent 时间线泳道可视化

**M9 人格引擎 / M10 自进化** — 参考源无直接对应章节，无法从 CC 侧补充盲点；但 M9 的 KV Cache 意识与「动态列表移出工具描述保 cache」互通，M9 的 PROTECTED/MUTABLE 分层与企业配置优先级思想呼应。

### 三、报告 C 缺口清单（按对「人格化桌面 AI 伙伴」价值排序）

**第一梯队 — 立即补新模块**
1. **任务生命周期系统（→ M11）**：后台能力 + 陪伴可见性（DreamTask 式 pill）基础设施
2. **可逆性 / undo 机制**：连 CC 都没解决的空白，信任型陪伴产品的差异化关键

**第二梯队 — 补进现有 M**
3. **M4**：压缩断路器 + 多策略互斥 + microcompact 清理
4. **M6**：Denial Tracking 降级 + AI 审计快速路径 + 危险规则黑名单本质
5. **M5**：「不存什么」硬清单 + 使用前强制校验 + 写入最小权限
6. **M1/架构**：工具/服务边界原则 + `querySource` 身份证

**第三梯队 — 中价值**
7. **启动优化（→ M7）**：并行 I/O 窗口、超时不缓存 null
8. **MCP 接入**：视路线决定；否则先吸收「描述截断 + 原子写入」进 M2
9. **M8**：Mailbox 权限冒泡 + cache 友好化列表注入
10. **M2**：并发分批 + contextModifier + isDestructive 中间地带

**第四梯队 — 低价值，仅吸收原则**
11. **企业配置分层**：不做策略管控，但「配置来源优先级 + 向后兼容铁律」应进配置约定，分层思想可复用到人格配置

**报告 C 一句话结论**：最该补 **M11 任务生命周期** 和 **可逆性机制**；其余多为已有模块的可靠性/安全性盲点（压缩熔断、拒绝降级、记忆排除原则、工具/服务边界），补进对应 M 即可，不必新开。

