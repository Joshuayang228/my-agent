# 远程 Persona Eval 验收

> 状态：**已落地**（2026-08-12）
> 对象：`evals/` 质量横切层，首批覆盖主角候选 `B02–B07`
> 关联模块：[伙伴世界](../modules/companion.md)、[质量总控](../quality.md)

## 需求背景（Why）

当前 B02–B07 已能在无 API Key 时用预设回复跑通，但这只能证明 Eval 管线和确定性禁用词检查可用，不能证明真实 LLM 的人格行为通过。远程协作阶段无法依赖 Playground 肉眼验收，因此需要把真实模型验收做成可重复、可审阅、可回滚的命令行流程。

当前还有三个工程缺口：

1. Eval 测试不会自动读取项目 `.env`，无法直接复用现有 DeepSeek 配置。
2. Mock 通过与真实模型通过没有在结果中明确分层。
3. `runPassK` 已存在但未接入 B02–B07，也没有保存可供远程审阅的回复与 Judge 证据。

## 功能目标（What）

1. 增加明确的 `mock` / `real` Eval 模式。
2. `real` 模式缺少 API Key 时必须失败，不能静默降级为 Mock。
3. 新增 `eval:persona` 命令，默认运行 B02–B07，使用 `pass^k` 稳定性验收。
4. 默认 `k=3`；允许通过环境变量调整。
5. 生成本地 JSON + Markdown 报告，包含：
   - 运行模式、模型、API 配置是否存在（不保存 Key）
   - 每个场景每次 trial 的 Agent 文本回复
   - 当次实际 Agent 输入快照：模型、Base URL、执行模式、初始 messages、System Prompt、工具名（不含 API Key）
   - Model Judge 的评分背景和全部 checks，并明确这些维度在 Agent 回复后通过一次 Judge 调用完成
   - code-based / model-based Grader 结果
   - violations、evidence、通过次数和 `pass^k`
6. 保留 `npm run eval:run` 的现有全量 Mock / 普通模式兼容。

## 技术方案（How）

### 配置与模式

- 新增 Eval 运行配置模块，使用 `dotenv` 读取项目根 `.env`，不打印或写入 API Key。
- `EVAL_MODE=mock|real` 控制场景是否允许 Mock 回退。
- `EVAL_PASS_K` 控制 Persona 场景重复次数，范围限制为 1–10。
- `EVAL_REPORT=1` 或 `real` 模式启用报告输出。
- `eval:persona` 使用独立 Vitest 配置，将范围固定为 `B02–B07`、模式固定为 `real`、默认 `k=3`。

### 运行与报告

```text
eval:persona
  → vitest.eval-persona.config.ts
  → B02–B07
  → 每个场景运行 k 次 AgentLoop
  → 收集 text 事件和 Grader 结果
  → 写 eval-reports/*.json + *.md
```

报告保存当次实际 Agent 初始输入快照、用户可审阅的 Agent 文本、Judge 评分计划、Grader 证据和元数据；不保存原始 API Key、Judge 推理过程或完整工具原始输出。历史报告缺少新快照字段时继续兼容展示。

### 通过语义

- 单 trial：所有 Grader 通过才算通过。
- `pass^k`：同一场景 k 次全部通过才算稳定通过。
- `VIOLATION_FOUND`：失败。
- Mock 模式的 Model Judge 显示 `SKIPPED`，只能标记为管线通过，不能冒充真实人格通过。
- Real 模式缺少 Key、Judge 调用失败或无法解析结果：失败。

## 影响范围评估

- **破坏性**：不改变生产 Agent Loop；新增 Eval 模式、报告和命令；`eval:run` 默认行为保持兼容。
- **安全**：只读取环境变量 / `.env`；报告禁止写入 API Key；报告目录加入 `.gitignore`。
- **测试**：新增运行配置、报告格式和 `pass^k` 单测；需跑全量 Unit、Eval、TypeScript、Build。
- **文档**：更新 `docs/quality.md`、`docs/progress.md`、`docs/requirements/README.md`。
- **远程验收**：真实 DeepSeek 运行需要当前机器具备网络和 `.env` 配置；没有 Key 时明确失败。

## 实施步骤

1. 新增施工合同和运行配置模块；验证 `.env` 加载、模式和 `k` 校验。
2. 改造 B02–B07 的真实 / Mock 分支，接入 real 缺 Key 失败门禁。
3. 改造 Eval Runner / Vitest 包装器，接入 Persona `pass^k`。
4. 新增 JSON / Markdown 报告和 `eval:persona` 命令。
5. 补 Unit，运行 TypeScript、Unit、Mock Eval、Build。
6. 使用现有 DeepSeek 配置运行真实 B02–B07，保存报告并根据结果判断是否需要调整人格规则。
7. 更新质量文档和进度账本，提交并推送。
8. Debug 增加 Eval 查看器，直接读取 `eval-reports/*.json`；Playground 继续只承载人格设计基线。
9. Debug 增加受控 Runner：只允许 Mock / Persona Real 两个白名单套件；真实运行必须先确认模型、`pass^k`、场景数和预计调用数，支持实时状态、有限日志、取消与完成后自动刷新。

## 风险与权衡

- 同一个模型既生成回复又担任 Judge，可能存在系统性偏差；本轮先保留现有结构，后续可增加独立 Judge 模型。
- `pass^3` 增加 API 消耗和运行时间，但能暴露一次性偶然通过。
- Judge 的 `UNKNOWN` 在 Real 模式按失败处理，优先保证验收可信度；Mock 模式仅作为管线烟测。

## 落地结果

- `npm run eval:run` 固定作为 Mock 管线烟测，当前 23/23 通过，不读取 `.env` 后误消费真实 API。
- `npm run eval:persona` 自动读取项目 `.env`，固定运行 B02–B07 真实模型验收。
- DeepSeek `deepseek-v4-flash` 于 2026-08-12 完成正式 `pass^3`：
  - B02–B07 全部 3/3，通过 18 次真实 Agent 回复和 18 次 Model Judge。
  - 首轮暴露 B03“只分类、不落小动作”和 B05“只确认路径、未确认恢复方式”波动，已回流 Role Pack、Playground 与施工合同后重新通过。
- 修复 ModelBasedGrader 两个历史根因：
  - `chatComplete()` 返回字符串，却被误当作 `{ content }`，导致 Judge 永远为空。
  - Judge 正则使用 `\s` 跨行吞掉下一条结论，现改为逐行严格解析并兼容 Markdown。
- 报告输出到本地忽略目录 `eval-reports/`，包含回复、Grader evidence 和 `pass^k`，不保存 API Key。
- Debug 新增「Eval」页签：展示最新结果、历史报告、B02–B07 矩阵、逐 trial 回复和 Grader evidence。
- Debug 的逐 Trial 详情补齐完整可解释链路：实际用户/历史消息、模型与执行模式、工具列表、可折叠 System Prompt 快照、一次性 Judge 全部检查项、Agent 回复和 Grader evidence。
- 被测 Agent 只接收 System Prompt、初始 messages 和工具，不接收 Judge checks；多个人格维度在 Agent 回复后一次性发送给 Judge AI，B02–B07 `pass^3` 通常为 18 次 Agent 调用 + 18 次 Judge 调用。
- Eval Runner 只映射 `npm run eval:run` / `npm run eval:persona` 两个固定 script，不接受任意命令；真实验收在确认后启动，可观察、可取消，打开页面不会隐式产生费用。
- Playground「人格验收」保持静态设计基线，避免把理想行为样例冒充最近一次真实验收结果。
