# Eval Case 与 Grader 资产注册 v1 施工合同

> 状态：已落地（2026-08-15）
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 统一称呼：施工合同

## 1. 需求背景（Why）

生产资产目录已经覆盖 Prompt、伙伴与人格、记忆策略、权限与沙箱、Tool schema 和 Skill，但开发者仍无法从同一目录查看“系统有哪些 Eval Case、每个 Case 在测什么、使用哪些 Grader、评分判据来自哪里”。目前 Debug「质量 / Eval」可以查看运行后的报告，却不能在运行前审阅完整的静态测试资产。

现有 Eval 场景列表还分别维护在 `evals/index.ts` 和 `evals/eval.test.ts`：两者已经发生漂移，CLI 列表遗漏了 `C02`。如果继续在 Debug 再复制第三份目录，会进一步扩大事实源分叉。

本合同将 Eval Case / Grader 作为质量生产资产注册，同时保持静态定义、运行输入和运行报告三者边界：

- 静态资产回答“有哪些测试、在测什么、如何评分”；
- 真实报告回答“本次到底给 Agent 发了什么、Agent 回了什么、为什么通过或失败”；
- API Key、Judge 隐藏推理、临时工作目录和运行时用户数据不进入静态目录。

## 2. 功能目标（What）

1. 建立普通 Eval 场景的唯一注册入口，统一 F / P / B / C 场景列表，供 Vitest Runner、CLI 和生产资产目录共同读取；修复 `C02` 只在测试入口存在、CLI 入口遗漏的问题。
2. 将普通 Eval Scenario 与 Skill Eval Case 注册为 `eval-case` 资产，展示稳定 ID、描述、所属套件、Mock / Real 模式、是否 required、来源、Grader 依赖和可公开的输入 / 期望摘要。
3. 将每个实际配置的评分器实例注册为 `eval-grader` 资产，展示稳定 key、Grader 类型、来源、结构化判据、所属 Case、Model Judge 检查项和执行顺序。
4. 扩展 `EvalGrader` 的资产描述字段，使 Grader 工厂和自定义 Grader 在创建真实评分器时同时提供结构化定义；禁止资产注册表重新猜测 `grade()` 内部规则。
5. Skill Eval 的四类固定评分器（激活、指南注入、工具边界、回复约束）建立稳定定义，并由真实 Runner 与资产目录共同引用。
6. Debug「提示词管理器 → Eval Judge」继续作为 Eval 资产分类入口，新增 `eval-case` / `eval-grader` 类型标签；Case 和 Grader 保持只读，不能载入为 Prompt 实验副本。现有 `eval-judge` Prompt 仍作为可查看的文本资产存在。
7. Debug「质量 / Eval」继续负责运行、报告、Trial、实际初始 messages、System Prompt、工具名、Agent 回复和 Judge 证据；不与静态资产目录重复。

## 3. 技术方案（How）

### 3.1 普通场景唯一注册表

新增类似：

```text
evals/scenario-registry.ts
```

注册项保存：

```ts
{
  scenario: EvalScenario
  source: string
  suite: 'framework' | 'persona' | 'companion'
}
```

由它导出唯一的普通场景数组。以下入口必须改为消费同一注册表：

- `evals/eval.test.ts`
- `evals/index.ts`
- Eval 资产注册表

首期登记：

```text
F01–F08
P01–P06
B01–B07
C01–C02
```

`B02–B07` 的 Persona Real Eval 可以继续使用现有专用子集，但该子集必须能与统一注册表做一致性测试。

### 3.2 Grader 结构化定义

为 `EvalGrader` 增加只读资产描述，例如：

```ts
assetDefinition: {
  kind: string
  source: string
  criteria: Record<string, unknown>
}
```

结构化定义由真实 Grader 工厂或自定义 Grader 构造时提供：

- TerminalReason
- ToolCall
- ErrorCode
- ExecutionModeChanged
- Filesystem
- Security
- TextNotContains
- NoRetry
- ModelBasedGrader
- SystemPromptContains
- PreamblePreservedAfterCompression
- CompanionAssembleRoster
- AsideQualityFixtures

Model Judge 的 `systemContext` 和负向二元 `checks` 继续使用现有 `reportPlan`，注册表不维护第二份 Judge 问题。

Skill Eval 为以下固定评分器建立共享定义：

```text
SkillActivation
SkillInjection
SkillToolBoundary
SkillResponse
```

Runner 输出的 `graderName` 和资产目录必须读取同一组定义。

### 3.3 资产 key 与内容

Case 使用稳定 key：

```text
eval-case:F01
eval-case:B02
eval-case:C02
eval-case:S01
```

Grader 实例使用 Case 范围内稳定 key：

```text
eval-grader:<case-id>:<kind>:<ordinal>
```

其中 `<kind>` 来自 Grader 的结构化定义，`ordinal` 只解决同一 Case 内同类 Grader 多次出现；不得使用随机 ID。

Case 资产内容包括：

- ID、描述、套件和来源
- Mock / Real / 可切换模式
- required / pass^k 属性
- Grader asset key 列表和顺序
- Skill Case 的用户输入、预期激活、允许工具、回复包含 / 禁止项
- 普通 Scenario 的公开摘要；实际装配 messages 仍以运行报告为准

Grader 资产内容包括：

- kind、name、来源
- 结构化 criteria
- Model Judge reportPlan / checks（若存在）
- 所属 Case 和顺序

### 3.4 统一生产资产目录

新增类似：

```text
evals/asset-registry.ts
```

由统一场景注册表、真实 Grader 实例和 `SKILL_EVAL_CASES` 生成 `ModelContextAsset[]`，再由：

```text
electron/main/debug/model-context-assets.ts
```

进行高层聚合。

共享类型增加：

```text
ModelContextAssetType: eval-case | eval-grader
```

现有 `PromptAssetKind: eval` 不需要增加新分类。

### 3.5 Debug / Playground / 报告边界

- **提示词管理器 / 生产资产目录**：静态 Case、Grader、Eval Judge Prompt，只读审阅来源和判据。
- **质量 / Eval**：启动真实 Runner、查看报告、Trial、实际输入、Agent 回复和评分证据。
- **Playground**：不复制 Eval Case 目录；未来若需要 A/B 草稿必须另立施工合同。
- **Settings**：不编辑内置 Case / Grader。

不进入静态资产目录：

- API Key、Base URL 中的凭据和环境变量原值
- Judge 隐藏 reasoning
- 本次运行生成的临时工作目录
- 真实报告中的用户 / Agent 动态内容
- 人工审阅备注

## 4. 影响范围评估

- Eval 类型：`evals/types.ts` 增加 Grader 资产定义。
- Eval 注册：新增统一 Scenario Registry 和资产注册表，消除 `index.ts` / `eval.test.ts` 重复列表。
- Grader：通用 Grader 工厂、ModelBasedGrader 和场景内自定义 Grader补结构化判据。
- Skill Eval：四类评分器名称 / 定义集中，Runner 与资产目录复用。
- 共享类型：增加 `eval-case` / `eval-grader`。
- Debug UI：增加资产类型标签并禁止结构化 Eval 资产载入 Prompt 实验副本；沿用现有“Eval Judge”分类，不新增顶层导航。
- 测试：场景唯一性、C02 一致接入、Case / Grader key 唯一、判据来自真实 Grader、无报告 / Key / reasoning、统一目录与 UI 标签。
- 文档：质量总控、架构、注册管理方法论、progress、changelog、wishlist 和本合同状态。
- 不改：现有评分结果语义、Runner 的隔离目录、远程模型调用门禁、报告格式、人工审阅和 pass^k 判定。

## 5. 实施步骤

1. 建立普通 Scenario 唯一注册表，迁移 `eval.test.ts` 与 CLI；测试场景 ID 唯一且 C02 不再漂移。
2. 扩展 `EvalGrader` 资产定义，为通用、ModelBased 和场景自定义 Grader 补真实结构化判据。
3. 集中 Skill Eval 固定 Grader 定义，并让 Runner 输出复用。
4. 建立 Eval Case / Grader 资产注册表，生成稳定 key、版本、指纹、依赖和只读内容。
5. 接入统一 Debug 目录与 UI 标签，禁止结构化 Eval 资产载入 Prompt 实验副本。
6. 补 Unit / Eval / UI E2E，确认评分行为和报告行为未回归。
7. 更新方法论、模块 / 质量 / 架构账本，执行完整门禁后提交并推送。

每一步必须独立可验证。如果实现过程中需要改变 Judge 问题、Case 输入、Grader 判定或报告 schema，应停止并单独说明，不借资产注册任务偷偷修改评分标准。

## 6. 风险与权衡

- **打包体积风险**：Electron Debug 聚合若直接导入全部 Scenario 实现，可能增加主进程 bundle；实施时优先复用轻量注册元数据，并通过 build 对比确认没有不可接受增长。
- **评分漂移风险**：只登记 Grader 名称无法解释真实判据，因此必须由真实 Grader 实例提供结构化 `criteria`，不能在注册表猜测。
- **答案泄漏风险**：静态目录面向开发者，可以展示测试判据，但被测 Agent 的真实运行输入不得注入评分标准；Runner 的 Generator-Evaluator 隔离保持不变。
- **隐私风险**：运行报告和人工备注可能包含动态内容，只在“质量 / Eval”查看，不复制进静态资产。
- **key 稳定性风险**：同类 Grader 多次出现时使用 Case 范围内 ordinal；调整顺序属于评分计划变更，必须同步版本和测试。
- **范围膨胀风险**：本合同不包含 Provider 能力注册、Prompt A/B 工作台、自动改写 Case / Grader 或根据 Eval 结果自动修改 Prompt。
