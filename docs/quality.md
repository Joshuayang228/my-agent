# 质量总控

> **质量维入口**（Unit / Eval / E2E）。  
> 深 Why：`methodology/m17-testing-architecture.md`、`methodology/m18-eval.md`。  
> 场景与 runner 真相以仓库代码为准：`__tests__/`、`evals/`。


### Prompt 中文门禁

- `__tests__/unit/prompt-language.test.ts` 直接验证生产主 Prompt、动态注入块、内置工具 schema / 示例与 Eval Judge 自有问题。
- 允许工具名、JSON 字段、枚举、路径、代码和 `VIOLATION_FOUND / NOT_FOUND / UNKNOWN` 等协议 token；禁止重新引入英文自然语言指令。
- 用户自定义 Prompt、用户安装 Skill、第三方 MCP 与外部网页/命令原始内容不属于翻译范围。

### Prompt 资产注册表门禁

- `__tests__/unit/prompt-assets.test.ts` 验证每个生产注册项都有唯一稳定 `key`、用途、角色、来源、版本、`zh-CN` locale、静态 / 动态模式和插槽数组。
- 静态资产的 `zh-CN` 模板必须来自真实生产正文；动态资产不得伪造固定模板，必须登记实际组装器和动态插槽。
- Debug 当前装配快照必须通过同一注册表返回资产 key、用途、角色、来源、版本、locale、模式和插槽，不得维护第二套目录文案。
- 未来增加英文时，在同一 key 下进行独立版本等价性测试，并验证运行时按 locale 单选，不把多语言版本并发注入模型。

## 分层与门禁

| 层 | 目的 | 命令 | 门禁 |
|----|------|------|------|
| Unit | 确定性逻辑 | `npm test` | commit 前必过 |
| Eval | Agent 行为场景（多 Mock LLM） | `npm run eval:run` | 行为改动时跑；不替代 unit |
| Persona Real Eval | B02–B07 真实 LLM + Judge + pass^k | `npm run eval:persona` | 远程人格验收；需要 `.env` / `LLM_API_KEY` |
| E2E UI | 纯 Renderer 界面冒烟 | `npm run test:e2e` | 涉 UI 时；固定 Chrome + `127.0.0.1:5174`，不启动 Electron |
| E2E Electron | 首次配置 + 可选真对话 | `npm run test:e2e:electron` | 首次配置用本地 SSE 服务必跑；真对话需 `TEST_LLM_API_KEY`，无 key 则仅 skip 真对话 |

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
`pass^k` 都会失败，并在 `eval-reports/` 生成 JSON 与 Markdown 报告。报告保存每次 Trial 的实际初始 messages、System Prompt、工具名、运行配置与 Judge checks，但不保存 API Key 或 Judge 推理过程。被测 Agent 不接收评分标准；同一场景的多个检查维度在 Agent 回复后通过一次 Judge 调用完成。Debug「质量 / Eval」展示这些真实报告，并提供受控 Runner：Mock 可直接运行；Real 必须确认模型、`pass^k`、场景和预计调用数后启动。报告中的人工审阅是独立本地注释层：按报告文件名、场景和 Trial 关联，支持 1–5 正向体验评分、风险信号、结论和备注；不改原始 JSON、不改变自动 PASS/FAIL，也不自动修改 Prompt。Runner 只允许固定 npm script，支持实时 trial 进度、停止和有限脱敏日志；打开页面不会自动产生真实模型调用。Debug 入口按诊断任务收口为提示词管理器、请求与运行、伙伴状态、质量 / Eval、系统；请求与运行内部保留 LLM 调用、Span / 调用链和实时事件。提示词管理器的实验副本不影响真实会话，只有二次确认保存到现有 L3 设置后才影响后续对话。Playground 按设计与 Agent 实验分组，设计组件边缘态不再单独占用体验夹具入口，静态人格场景不冒充真实 Eval。

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
