# M18 Eval 体系 — 代码走读

> 理念章：[`m18-eval.md`](./m18-eval.md)
> Persona 专章：[`m18-eval-persona.md`](./m18-eval-persona.md)
> 最近核对：2026-08-16

---

## 一、套件入口

```text
vitest.eval.config.ts          → evals/eval.test.ts
vitest.skill-eval.config.ts    → evals/skill.test.ts
vitest.eval-persona.config.ts  → evals/persona-real.test.ts
```

普通 Eval 固定 `EVAL_MODE=mock`；Persona 固定 `real` 且单 worker；Skill 默认 mock，可通过环境变量显式切 real。

## 二、Scenario 唯一注册表

`evals/scenario-registry.ts` 登记 23 个普通 Scenario，并为每项记录 source 和 suite。`EVAL_SCENARIOS`、Debug 资产目录和 Vitest 都从这里派生。新增场景如果只加到某个 test 数组而不登记，会被注册表一致性测试拦截。

## 三、输入构造与真实 Loop

`runScenario()` 的顺序：

```text
创建临时 workdir
→ 创建真实 ToolRegistry
→ scenario.registerTools
→ scenario.buildOptions
→ 注入 _streamChatOverride 或 MockTurn
→ snapshotAgentInput
→ 运行真实 agentLoop 并收集 AgentStreamEvent
→ 顺序执行全部 Grader
→ 清理 workdir
```

Mock 的是 LLM 边界，不是 Agent Loop、ToolRegistry、权限逻辑或事件流。

## 四、报告快照

`snapshotAgentInput` 只保存非秘密输入：

```text
model / baseUrl / executionMode
systemPrompt / toolNames / messages
```

`snapshotJudgePlan` 从 Grader 的 `reportPlan` 读取 single-call systemContext 和 checks。API Key 不在类型中，hidden reasoning 也不进入 `agentTexts`。

## 五、Code-based Grader

`evals/graders/index.ts` 提供确定性检查：

- 是否出现工具调用；
- 工具名、顺序和次数；
- 是否出现拒绝/降级事件；
- 文本包含/不包含；
- 文件状态或结构断言。

这类 Grader 快、稳定、无费用，适合框架和明确禁词边界。

## 六、Model-based Grader

`evals/graders/model-based.ts`：

1. Mock 模式返回通过并记录 `[SKIPPED]`；
2. Real 模式缺 Key 返回失败；
3. `collectAgentText` 只收集用户可见文本；
4. `buildEvalJudgePrompt` 一次组装全部 checks；
5. `chatComplete` 使用 caller=`eval-judge` 和 Prompt 资产 key；
6. 逐行解析 `VIOLATION_FOUND / NOT_FOUND / UNKNOWN`；
7. 找不到可解析结论或 UNKNOWN 都进入 violations。

## 七、pass^k 与 Persona 报告

`evals/persona-real.test.ts` 串行遍历 B02–B07，调用 `runPassK(scenario, k)`。每个 Trial 都是完整 `runScenario`，不是复用第一次结果。`writePersonaEvalReport` 同时生成 JSON 和 Markdown；Debug 只读扫描符合固定文件名模式的 JSON。

## 八、Skill Eval

Skill Eval 有独立 Case、Runner、Grader Definition 和报告：

```text
evals/skill/cases.ts
evals/skill/runner.ts
evals/skill/grader-definitions.ts
evals/skill/report.ts
```

它验证触发、注入、工具边界和回复证据，不与普通 Scenario 数组混合。

## 九、Debug 受控运行器

`electron/main/debug/eval-runner.ts` 将 suite 映射到固定 npm script，不接收任意命令。Runner：

- 单进程互斥；
- 输出 `redactSensitiveText`；
- 80,000 字符上限；
- Persona progress 只接受 B02–B07；
- Windows 使用 taskkill 结束进程树；
- Mock/Skill 子进程使用过滤后的环境变量。

## 十、报告读取与人工审阅

- `persona-eval-reports.ts` / `skill-eval-reports.ts`：basename + 文件名正则 + Schema 校验；
- `persona-eval-review-store.ts`：复合主键、参数化 SQL、枚举和长度校验；
- `ipc/debug.ts`：报告只读、人工审阅单独写入、导出通过系统 Save Dialog。

## 十一、测试证据

- 普通 Eval：23/23；
- Skill Eval：1/1；
- Unit 覆盖 scenario registry、asset registry、Judge 解析、报告读取、人工审阅和 Debug Runner；
- Persona Real 不在普通验证中自动调用，需要用户明确提供 Key。

## 十二、当前缺口

- 缺 Provider HTTP/SSE 原始 fixture replay；
- Real Persona 费用和模型漂移决定它不能成为每次 commit 的默认门禁；
- 人工审阅尚无多人标注一致性工具。
