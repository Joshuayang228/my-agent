# Skill Eval v1 施工合同

> 状态：已落地（2026-08-14）
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 统一称呼：施工合同

## 1. 需求背景（Why）

Skill 管理器 2.0 已经解决了 Skill 的保存、校验、版本和隔离试跑，但仍缺少行为质量闭环：开发者可以保存一个 Skill，却无法证明它是否在正确场景被激活、激活后是否注入了指南、是否调用了越权工具。

现有 Eval Runner 已能驱动 `agentLoop`、注入 Mock / Real LLM、执行 Grader 并保存报告。本阶段复用这条生产验证链路，不在 Playground 复制一套 Skill 运行器。

## 2. 功能目标（What）

1. 建立稳定的 Skill Eval 用例契约：用户输入、Skill fixture、期望激活状态、允许工具、响应约束和 Mock / Real 模式。
2. 实现确定性 Mock Skill Eval，覆盖：应触发、不得触发、激活后注入、工具边界。
3. 支持可选真实 LLM Skill Eval：真实模型决定是否调用 Skill 工具，Runner 仍使用同一 Grader 契约；无 API Key 时不运行真实套件。
4. 保存 Skill Eval JSON / Markdown 报告，包含输入、Skill 元数据、激活 trace、工具调用、注入证据、回复和逐项判定。
5. Debug「质量 / Eval」提供 Skill Eval 运行入口和历史报告查看，不暴露 API Key，不复制判定逻辑。

## 3. 技术方案（How）

### 3.1 用例与运行器

- `evals/skill/types.ts`：Skill Eval Case、Evidence、Grader 和 Report 类型。
- `evals/skill/cases.ts`：内置最小 fixture，不修改生产 Skill；未来可扩展为从用户 Skill 显式载入实验副本。
- `evals/skill/runner.ts`：创建隔离 `ToolRegistry`，复用生产 Skill 激活工具、`agentLoop`、Mock / Real LLM 路径；不写设置、不写真实会话。
- Mock 用例通过预置 tool call 验证 Runner 与 Grader 确定性；Real 模式由模型自行决定触发，结果只作行为验收，不伪装成 Unit。

### 3.2 判定维度

- **触发判定**：期望触发时必须激活目标 Skill；期望不触发时不得激活目标 Skill。
- **注入判定**：激活后 Tool result 必须包含 Skill 指南正文的生产指纹对应证据。
- **工具边界**：除 Skill 激活工具本身外，所有工具调用必须属于用例的允许集合。
- **回复约束**：可选检查必须包含 / 禁止包含的文本片段；不做模糊的主观综合分数。
- 每项结果包含 pass、violations、evidence，报告只展示证据，不保存模型隐藏推理。

### 3.3 Debug 与 IPC

- 新增 `DebugEvalSuite = 'skill'` 和 `npm run eval:skill` 白名单套件。
- 新增 `debug:skill-eval-reports` / `debug:skill-eval-report-get`，读取 `eval-reports/*skill-eval*.json`。
- 质量面板增加 Skill Eval 子视图：运行、状态、历史报告、Case 详情和证据。
- 运行入口复用现有 `DebugEvalRunner`；真实模式需要确认，Mock 模式不需要确认。

### 3.4 隐私与隔离

- 报告只保存模型、Base URL、用户测试输入、Skill 名称 / 版本 / 来源 / 指纹、工具调用、回复和判定证据。
- 不保存 API Key、隐藏 reasoning、完整外部工具原始输出或不必要的 Skill 私密正文。
- 生产 Skill 只通过显式 fixture / 实验副本进入 Eval，不在 Eval 中直接修改生产文件。

## 4. 影响范围评估

- Eval 类型、Skill Registry、AgentLoop ToolContext、报告读写、Debug IPC / preload / shared types、质量 UI。
- 新增 Unit：用例契约、Mock runner、四类 grader、报告解析、Debug 套件计划。
- 新增 Eval：`npm run eval:skill`，默认 Mock；真实模式通过 `EVAL_MODE=real` 和 API Key 启用。
- UI E2E：质量页能看到 Skill Eval 入口和报告空态 / Case 证据布局。

## 5. 实施步骤

1. 扩展生产 Skill 激活工具工厂和 Eval 共享证据类型；
2. 建立 Skill Eval Case、Mock runner、四类确定性 grader；
3. 输出 Skill Eval JSON / Markdown 报告并新增独立命令；
4. 接入 Debug Runner 白名单、报告 IPC 和质量面板；
5. 补 Unit / Eval / UI E2E，更新质量、模块、进度、changelog；
6. 完整门禁、commit + push。

## 6. 风险与权衡

- Mock 只能证明运行器和生产 Skill 工具契约，不代表模型具备真实触发能力；Real Skill Eval 单独标记并需要 API Key。
- 报告不保存完整 Skill 正文，开发者需要回到 Debug 统一目录查看静态正文；真实请求中的动态正文仍以 LLM Debug 请求为事实源。
- 本阶段不做自动 Skill 生成、版本 Diff、导入导出和多语言 Skill 资产。
