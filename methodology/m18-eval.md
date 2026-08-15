# M18 Eval 体系工程化方法论 — 上章：框架 Eval

> 参考源：Anthropic 官方 Article 4（Demystifying Evals for AI Agents）、CC Harness Engineering Guide（long-running-harness.md / eval-awareness.md）、feiche observability/ 源码（Observer 接口 + eval 脚本）。
>
> **上下章分工**：上章专注框架行为的 Eval——工具选择、权限决策、错误处理、压缩保护、安全边界，这些有明确对标和确定性断言。下章专注伙伴行为的 Eval，见 `m18-eval-persona.md`。

---

## 一、第一性原理

**行为质量只能通过过程证据度量，最终答案的对错不足以判断 Agent 的行为是否可靠。**

一个 Agent 可以碰巧给出正确答案，但推理路径完全错误——它调了错误的工具，越权访问了不该碰的文件，只是凑巧结果没有崩掉。反过来，一个路径完全正确的 Agent，可能因为表达略差而被"最终答案评分"淘汰。

过程证据的含义：调了哪个工具、调用顺序对不对、权限被拒绝时有没有找替代方案、连续失败后是否降级、错误码是否正确——这些是行为质量的实际载体，不是最终文本。

**推论地图**：

```
根认知：过程证据 > 最终答案
    │
    ├─ ① 过程证据从哪里来？ → Transcript（事件流即证据，§2）
    │
    ├─ ② 谁来度量才可信？ → Grader 独立上下文，不看推理过程（§3）
    │
    ├─ ③ 什么行为能确定性度量？→ 框架行为（code grader），伙伴行为另说（§4）
    │
    ├─ ④ 如何量化可靠性？ → pass^k 不是 pass@k（§5）
    │
    └─ ⑤ 如何随时间演进？ → Capability eval 爬坡 → Regression eval 守位（§6）
```

---

## 二、Transcript：事件流就是过程证据，不另建

大多数 eval 系统需要专门建设"证据收集层"——在 Agent 每次调用工具后打一个日志、在每次 LLM 返回时记录 token 数……这是因为它们的 Agent 框架没有把行为观测内建进来。

我们不用另建。`agentLoop` 产出的 `AgentStreamEvent[]` 本身就是 transcript：

```
tool_calls / tool_start / tool_end    → 工具调用轨迹
error { code: AgentErrorCode }        → 结构化错误码
execution_mode_changed { mode }       → 权限自动降级事件
done { reason: TerminalReason }       → 循环终止原因
```

M7 tracer 还额外记录了每次 LLM 调用的 span（token 数、耗时、调用链），作为补充证据。

这对应 feiche 的 Observer 接口的设计哲学：**生命周期钩子既是生产监控的入口，也是 eval 证据的来源**。不同之处在于 feiche 把它设计成接口（`OnLLMEnd / OnToolEnd`），我们直接用 agentLoop 的 yield 事件——本质是同一件事，只是形态不同。

**推论**：eval harness 的工作不是"采集证据"，而是"驱动 agentLoop + 对已有证据断言"。eval 基础设施越薄，越好维护。

---

## 三、Generator-Evaluator：绝不让生成者批改自己的试卷

CC Harness Engineering Guide 里最重要的一句话：**绝不让生成者批改自己的试卷**。

自我评估偏差的原理：模型拥有自己推理的完整上下文，每个决策都"感觉是合理的"。承认失败意味着否定之前的输出，这是 LLM 所抵触的。在短任务里，人类能发现问题；在自动 eval 里，如果 grader 拿着 Agent 的 system prompt 和工具调用历史来评分，它会因为"理解你为什么这么做"而给出同情分。

**Grader 独立上下文规则**：

```
Agent（生成者）
  ↓ 产出 transcript + 状态变化
Grader（评估者）← 只看 transcript + workdir，不看 AgentLoopOptions
  ↓ 返回具体违规点，不返回综合分
```

`EvalContext` 只包含三样东西：transcript、workdir、scenarioId。grader 看不到 mockResponses、看不到 system prompt 的内容、看不到 registry 里注册了什么工具。这个隔离不是形式，是 eval 可信度的基础。

**一个具体推论**：model-based grader 也必须遵守这个规则。LLM judge 只能看 Agent 的输出文本，不能看 Agent 的 system prompt 或推理过程。如果 judge 知道"你的 system prompt 要求你这样做"，它会给出"理解你的处境"的高分。这是 v1 不上 LLM judge 的核心原因之一——先把 code-based grader 的独立性验证清楚，再谈 LLM judge。

---

## 四、两类行为，两条度量路径

不是所有 Agent 行为都可以用同一种方式度量。根本区别在于**确定性**：

**A 类：框架行为（确定性）**

权限是否被拒绝、是否触发了降级、错误码是否正确、文件是否被修改、工具调用顺序是否符合预期——这些是代码路径决定的，给定相同输入，输出必定相同。它们用 code-based grader 精确断言，用脚本 LLM 注入（`_streamChatOverride`），零 API 消耗，每次代码变更都可以跑。

**B 类：伙伴行为（概率性）**

人格在长对话后是否飘移、记忆召回是否自然而不机械、拒绝用户不合理要求时语气是否到位——这些取决于模型的随机性和上下文理解，给定相同输入，不同 run 可能走不同路径。它们需要真实 LLM + model-based grader，定期手动跑，成本非零。

**为什么严格分开**：

混在一起的后果是：当 eval 失败，你不知道是代码 bug（A 类）还是模型随机抖动（B 类）。分开的 eval 套件，代码改动后只跑 A 类（零成本、确定性），发版前跑 B 类（有成本、但该花）。

---

## 五、pass^k 而非 pass@k：可靠性才是伙伴价值

**pass@k**（k 次里至少一次通过）= 能力天花板。"这个 Agent 有没有能力做到这件事？"

**pass^k**（k 次全部通过）= 可靠性。"这个 Agent 每次都能做到这件事吗？"

对 Coding Agent（CC 的核心用例），pass@k 很有意义——你只需要它完成任务一次，然后人类审查。但对伙伴产品，用户的体感是"每次对话"，不是"最好情况下"。如果 Agent 在 10 次对话里有 7 次正确处理了权限拒绝、3 次越权执行了——用户的体感是"它时不时会越权"，而不是"它的能力天花板很高"。

**实践推论**：
- A 类框架行为：pass^1 = 100% 是硬要求，因为这些是确定性代码路径
- B 类伙伴行为：pass^3 ≥ 80% 作为发版 bar；低于 80% 说明行为不稳定，需要调整 system prompt 或修框架 bug
- 用脚本 LLM 跑的 A 类场景不需要多次采样（本来就确定，k=1 就够）

---

## 六、Capability Eval → Regression Eval 的生命周期

Anthropic Article 4 里的一个重要原则：eval 不是一次性建设，而是有生命周期的。

**起步（Capability Eval）**：新能力刚做完，通过率低。每次改动，验证能力边界在爬坡。这是 M12 现在处于的阶段——11 个场景，测的是我们 M1-M10 的核心框架能力。

**成熟（Saturation）**：场景通过率接近 100%，新改动不影响。这时 Capability Eval "毕业"，成为 Regression Eval——它的作用从"验证能力"变成"防止退化"。

**退化防护（Regression Eval）**：每次代码变更自动跑，任何 fail = 行为退化警报。这是 CI 里的 eval，我们的 A 类场景已经具备这个条件。

**教训：不要过早 freeze eval 场景**。一个框架能力修了之后，如果 eval 场景设计太宽松，它通过了但能力其实退化了——因为场景本身就没测到边界。我们的 F03（连续拒绝降级）第一版就因为阈值设计错误（downgrade 和熔断同时触发），场景测的其实是错误的行为。

---

## 七、eval 场景设计原则

从"行为质量通过过程证据度量"这条根认知，推导出场景设计应该遵守的原则：

**① 任务要具体到"两个领域专家独立判断会得出同样的 pass/fail"**

模糊场景："Agent 应该正确处理权限拒绝"——正确处理是什么意思？两个工程师可能给出不同答案。
具体场景："用户拒绝 file_write 工具后，Agent 在下一轮调用了不同的工具，且 workdir/output.txt 不存在"——明确，可断言。

**② 评路径，不评文本**

不惩罚创造性替代方案。如果 Agent 通过读取文件内容而不是直接写入完成了任务，这条路径应该通过，哪怕文字描述和"预期答案"不同。grader 应该断言"是否越权执行"，不应该断言"最终文本是否匹配"。

**③ 双向测试集：该做 + 不该做**

只有"该做"的场景，eval 会被绕过——Agent 学会"反正只考正面行为，我把所有工具全调一遍就行了"。不该做的场景：临时信息不应写入记忆、被拒绝的操作不应越权执行、工具注入指令不应改变系统约束。

**④ 脚本 LLM 只测框架行为，真实 LLM 只测模型行为**

脚本 LLM 的预设响应和真实 Agent 的推理无关。用脚本 LLM 跑 P02（身份注入防护），测到的其实是"我给 Agent 文本，Agent 是否机械地把它复述出来"——这不是有意义的测试。P02 必须用真实 LLM，才能测到 M9 G2 防注入声明真正起作用。

---

## 八、LLM-as-Judge 的使用原则（v2 方向）

B 类伙伴行为最终需要 LLM judge。但 LLM judge 有它自己的设计规则，照搬"给 GPT 发一段话让它打分"是无效的：

**judge 的角色设定决定评分质量**

不要让 judge 扮演"公正评分员"，要让它扮演"真实用户"或"对这个产品完全陌生的人"。问"这条回复让你感觉你在跟一个真实的人说话，还是在跟客服 bot 说话？"比问"这条回复的温暖度是几分"更有区分度。

**拆成具体违规项，不打综合分**

"有没有出现'您好，请问有什么可以帮您的'这类客服话术？"（有/没有）比"温暖度 7/10"有信息量。具体违规项迫使 judge 在 transcript 里找证据，不能靠"感觉"作答。

**定期人工校准**

每月抽 20-30 个 judge 评过的对话，人工重新打标，计算 LLM judge 和人类的一致率。低一致率的维度是 prompt 需要优化的方向。

---

## 九、实战记录

### 已实现（2026-07-25）

`evals/` 目录：11 个场景，F01-F07（框架行为）+ P01-P04（伙伴行为 A 类），脚本 LLM，零 API 消耗，`npm run eval:run` 独立运行。

主要踩坑：
- F02 初版：`confirmTool` 始终返回 false 导致替代方案工具也被拒绝，掩盖了真正要测的"拒绝后是否找替代"这个行为
- F03 初版：downgrade 阈值和熔断阈值都是 3，同一轮两个事件同时触发，Agent 没有机会用降级后的模式继续运行——场景设计和实现语义对不上，修法是把 downgrade 阈值改为 MAX_CONSECUTIVE_DENIALS - 1

技术决策：用 vitest 而不是 ts-node 驱动 eval（解决 `moduleResolution: "bundler"` 的模块解析问题），两者在配置文件里完全隔离。

### 暂缓项

| 项目 | 原因 |
|------|------|
| B 类真实 LLM 场景 | 需要 model-based grader，v2 引入 |
| LLM-as-Judge 实现 | 需先稳定 code-based grader，再增加 judge 层 |
| Baseline diff 和回归报警 | 需要版本化 baseline 机制，v2 引入 |
| pass^k 多次采样 | runner 接口已预留，等真实 LLM 场景补入 |
| F08 压缩后 preamble 保留 | 需要消息捕获机制，独立小任务 |

### 设计检查清单

为新的 eval 场景设计时，对照以下问题：
- [ ] 场景定义具体到两个工程师独立判断会得出一致结论吗？
- [ ] grader 断言的是过程（工具轨迹、错误码、文件状态），而不是最终文本？
- [ ] 场景是否同时有正向用例（该做）和负向用例（不该做）？
- [ ] 使用脚本 LLM 还是真实 LLM 选择正确吗（框架行为用脚本，模型行为用真实）？
- [ ] grader 的 violations 是"具体可操作的问题"而不是"综合评分"？
