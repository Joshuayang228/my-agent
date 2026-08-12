# 质量总控

> **质量维入口**（Unit / Eval / E2E）。  
> 深 Why：`methodology/m17-testing-architecture.md`、`methodology/m18-eval.md`。  
> 场景与 runner 真相以仓库代码为准：`__tests__/`、`evals/`。

## 分层与门禁

| 层 | 目的 | 命令 | 门禁 |
|----|------|------|------|
| Unit | 确定性逻辑 | `npm test` | commit 前必过 |
| Eval | Agent 行为场景（多 Mock LLM） | `npm run eval:run` | 行为改动时跑；不替代 unit |
| Persona Real Eval | B02–B07 真实 LLM + Judge + pass^k | `npm run eval:persona` | 远程人格验收；需要 `.env` / `LLM_API_KEY` |
| E2E UI | 界面冒烟 | `npm run test:e2e` | 涉 UI 时 |
| E2E Electron | 可选真对话 | `npm run test:e2e:electron` | 需 `TEST_LLM_API_KEY`；无 key 则 skip |

类型检查：`npx tsc --noEmit`。涉主进程/打包结构时补 `npx vite build`。

## Eval（总览）

- 目录：`evals/`（runner、mock-llm、graders、scenarios、baseline）
- 注入点：`AgentLoopOptions.streamChatOverride`（禁止用假 LLM 冒充产品功能，仅测试/Eval）
- 场景标签：框架向 `f*`、伙伴向 `p*`、人格向 `b01-*` 等——**按产品关心点选题，但 Eval 本身不是产品模块**
- `ModelBasedGrader` 只接受“是否存在违规”的负向二元问题；正向要求必须改写为“是否缺失该行为”，避免通过行为被当作违规。
- 模块卡可链接相关场景 ID；场景正文不复制进模块卡
- 历史规格底稿：`_archive/docs-legacy/eval-design.md`（可能过时）

```bash
npm run eval:run
```

远程人格验收：

```bash
EVAL_PASS_K=3 npm run eval:persona
```

该命令固定使用 `EVAL_MODE=real`，缺少 API Key、Judge 返回 `UNKNOWN` 或任何场景未达到
`pass^k` 都会失败，并在 `eval-reports/` 生成 JSON 与 Markdown 报告。报告不保存 API Key。Debug「Eval」展示这些真实报告，并提供受控 Runner：Mock 可直接运行；Real 必须确认模型、`pass^k`、场景和预计调用数后启动。Runner 只允许固定 npm script，支持实时 trial 进度、停止和有限脱敏日志；打开页面不会自动产生真实模型调用。

2026-08-12 基线：DeepSeek `deepseek-v4-flash` 的 B02–B07 全部达到 `pass^3`。该结果是自动化行为门禁，不替代用户对语气、活人感和审美的最终人工验收。

## Unit 要点

- 新功能 happy path；修 bug 先复现测试  
- Mock 外部 IO；禁止 Mock 核心业务假装通过  
- 规范细节见 `agent-skills/typescript-guidelines.md`

## 与产品模块的关系

质量横切所有产品模块：

- 改伙伴/人格 → 看 `modules/companion.md` 必测 + 相关 Eval  
- 改记忆 → `modules/memory.md` 必测 + memory 单测  
- 改权限 → `modules/permission.md` 必测 + permission Eval/单测  

## 维护

- 新增门禁或分层策略 → 更新本文  
- 新增 Eval 场景 → 改 `evals/`，必要时在模块卡「必测」加链接  
- 旧 `testing.md` / `eval-design.md` 已归档，勿再当权威源
