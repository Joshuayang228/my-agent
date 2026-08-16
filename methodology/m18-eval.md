# M18 Eval 体系工程化方法论 — 框架、资产与门禁

> 下篇聚焦人格行为与人工审阅：[`m18-eval-persona.md`](./m18-eval-persona.md)
> 代码走读：[`m18-eval-code.md`](./m18-eval-code.md)
> 最近核对：2026-08-16

---

## 一、第一性原理：Eval 要证明行为路径，而不只证明答案

Agent 的结果可能碰巧正确，但路径错误：调错工具、越权访问、忽略拒绝、丢失工具配对。Eval 因此必须同时保存：

```text
输入（messages / System Prompt / tools / config 摘要）
→ AgentStreamEvent transcript
→ Grader 独立判定
→ 结构化报告
```

普通日志不是 Eval 证据源。Eval 使用真实 Agent Loop 事件流，并为每个场景创建隔离 workdir；Grader 只看 transcript 和允许的文件状态，不看模型 hidden reasoning。

## 二、四类 Scenario

当前普通注册表 `evals/scenario-registry.ts` 有 23 个场景：

| 前缀 | 数量 | 关注点 |
|---|---:|---|
| F01–F08 | 8 | Loop、工具、权限、错误、压缩等框架行为 |
| P01–P06 | 6 | 人格 Prompt、语言、边界和基础行为 |
| B01–B07 | 7 | 语气与具名主角行为；B02–B07 支持真实模型 |
| C01–C02 | 2 | 伙伴上下文与 aside 质量 |

Scenario 必须拥有稳定 ID、来源、suite、required、构造输入和 Grader 顺序。CLI、Vitest、Debug 资产目录共同消费同一注册表，禁止平行维护场景数组。

## 三、Unit、普通 Eval、Skill Eval、Persona Eval 不互相冒充

```text
npm run test          → 纯单元/集成测试，无真实模型
npm run eval:run      → 23 个普通 Mock Eval，无网络、无费用
npm run eval:skill    → Skill Case 独立套件，默认 Mock
npm run eval:persona  → B02–B07 真实模型 pass^k，显式凭据
npm run test:e2e      → Renderer UI E2E
```

普通 Eval 中的 Model Judge 会明确记录 `[SKIPPED] Mock 模式不运行 Model Judge`；它只能证明管线和确定性规则没有回归，不能证明真实人格质量。真实 Persona Eval 缺 API Key 必须失败，不能把“跳过”伪装成通过。

## 四、Generator 与 Evaluator 必须分离

被测 Agent 和 Judge 使用独立调用：

- Agent 只完成用户请求；
- Judge 只接收用户可见回复、背景和检查项；
- Judge 不获得 Agent hidden reasoning；
- Judge 不能读取 API Key；
- Judge 的 Prompt 是注册资产 `eval-judge`，可在 Debug 追溯来源和版本。

同一回复的多个维度由一次 Judge 调用完成，而不是每个维度分别调用一次。这样可以固定上下文、降低费用，并让报告保留完整的检查计划。

## 五、Grader 不打“感觉分”，只回答可举证问题

`EvalGrader` 的输出固定为：

```typescript
interface GraderResult {
  pass: boolean
  violations: string[]
  evidence: string[]
}
```

Model Judge 的每个检查项只能返回：

```text
VIOLATION_FOUND
NOT_FOUND
UNKNOWN
```

`UNKNOWN` 在门禁里按失败处理，因为无法解析或没有证据时，不应乐观猜测通过。人格自然度的主观 1–5 分属于人工审阅层，不与自动 Judge 结论混写。

## 六、一次运行必须可复查

Persona 报告保存：

- 实际初始 messages；
- 实际 System Prompt；
- tool 名称；
- model、baseUrl、executionMode 等非秘密配置；
- Agent 用户可见回复；
- Judge system context 和全部 checks；
- 每个 Grader 的 violations / evidence；
- pass^k 的每次 Trial。

报告不保存 API Key、Cookie、hidden reasoning，也不把主进程普通 Debug 日志当作原始 Prompt 仓库。

## 七、pass^k 衡量可靠性

伙伴行为不是“六次里偶尔有一次说得像人”就够。真实 Persona Eval 对 B02–B07 每个场景连续运行 k 次，只有全部通过才算 pass：

```text
pass^k = k 次全部通过
```

这与 pass@k 的“至少一次成功”不同。前者度量稳定可靠，适合关系型产品的发布门禁。

## 八、资产注册与运行证据分离

静态资产目录登记：

- Scenario 的 ID、描述、suite、required、来源；
- Grader kind、criteria、Judge checks；
- Prompt 的 stable key、版本和 fingerprint。

运行报告才保存实际 messages、回复和判定。注册表回答“这是什么”，报告回答“这次发生了什么”。

## 九、Debug 的运行边界

`DebugEvalRunner` 只允许三个白名单 suite：

```text
mock
skill
persona-real
```

它不接受任意命令或参数；同一时刻只运行一个子进程；输出脱敏且有长度上限；Windows 取消时终止进程树。真实 Persona Eval 在 UI 中需要二次确认，避免隐式付费。

## 十、Capability、Regression 与人工校准

一个场景先作为 Capability Eval 探索正确边界；行为稳定后，固定输入、检查项和报告结构，升级为 Regression Eval。自动 Judge 不能替代审美判断，因此 Debug 提供独立人工审阅层：自然度、角色一致性、情绪承接、强行乐观、计划推动、心理诊断、模板化和结论。

人工审阅记录使用报告文件名 + scenarioId + trialId 关联，不修改原始 JSON，也不能反向改变自动判定。

## 十一、当前缺口

- 普通门禁尚没有 Provider HTTP/SSE fixture replay；
- Persona Judge 仍可能受模型版本漂移影响，需要持续用人工审阅校准；
- 当前真实门禁集中在 B02–B07，跨多会话长期关系的真实模型 Eval 仍有限；
- UI E2E 证明页面和交互，不证明真实 LLM 行为。

这些缺口必须写入质量策略或 wishlist，不能靠增加一个绿色状态图标掩盖。
