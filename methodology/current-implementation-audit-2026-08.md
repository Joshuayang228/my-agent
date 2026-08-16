# 当前实现逐章审计矩阵（2026-08）

> 本矩阵是方法论审计的索引，不替代代码。事实优先级：代码行为 > 测试证据 > 模块卡 > 方法论愿景。对“缺口”只记录尚未落地或仍需专门验证的部分。

| 章节 | 主题 | 当前真实入口 | 测试证据 | 当前主要结论/缺口 | 最近审计 |
|---|---|---|---|---|---|
| M01|Agent Loop|electron/main/agent/loop.ts；runtime.ts；message-pipeline.ts|agent-loop.test.ts；runtime.test.ts|Loop 终止原因、压缩重试、工具配对和日志元数据已对齐|2026-08-16|
| M02|流式设计|electron/main/llm/index.ts；ipc/chat.ts；App.tsx|streaming.test.ts；chat-flow.test.ts|AsyncGenerator 拉取语义、compact 元数据事件、finally 清理已对齐|2026-08-16|
| M03|错误系统|electron/main/errs/index.ts；utils/sanitize-error.ts；App.tsx|error*.test.ts|专门 UI 分支只有权限拒绝、限流/请求失败/工具超时；其余走通用展示|2026-08-16|
| M04|工具系统|tools/builder.ts；registry.ts；middleware.ts；builtins/|tool-registry.test.ts；tool-metadata.test.ts；headless-policy.test.ts|当前内置工具 24 个；动态 metadata 在权限预检、并发、Headless 与执行路径统一解析，无法证明安全时 fail-closed|2026-08-16|
| M05|LLM 路由|llm/index.ts；aux-config.ts；provider-router.ts；failover.ts；vision.ts|llm*.test.ts；provider*.test.ts|统一配置工厂、Provider failover、Vision 降级已对齐；413 仍由 Loop 处理|2026-08-16|
| M06|System Prompt|agent/prompt-builder.ts；prompts/registry.ts；prompts/texts.ts|prompt*.test.ts；prompt-registry.test.ts|中文事实源、分层上下文、日期/精确时间边界、防注入锚点已对齐|2026-08-16|
| M07|上下文压缩|agent/context-manager.ts；model-context-window.ts；relationship-minset.ts|context-manager.test.ts；context-structured-summary.test.ts|L1/L2/L3/L4、图片剥离、file 快照、413 reactive compact 已对齐|2026-08-16|
| M08|记忆系统|storage/memory-store.ts；memory/vector-store.ts；profile-extractor.ts；strategy-registry.ts|memory-store.test.ts；citation-correct.test.ts；sensitive-memory.test.ts|画像提取对健康/财务/凭据等敏感类别 fail-closed；凭据长期记忆在工具、存储、导入和向量召回多层硬拒绝|2026-08-16|
| M09|任务生命周期|services/task-queue.ts；scheduler/index.ts；ipc/tasks.ts；agent/runtime.ts|task-queue.test.ts；tasks-ipc.test.ts；scheduler.test.ts|恢复、checkpoint、retry、通知幂等和 task:sync 已按当前实现校准；任务 ID 使用 UUID，后台错误不持久化正文|2026-08-16|
| M10|权限与安全|sandbox/permission-engine.ts；command-guard.ts；file-path-guard.ts；headless-policy.ts；tools/registry.ts|permission-engine.test.ts；command-guard.test.ts；file-path-guard.test.ts；tool-registry.test.ts|硬边界先于规则；动态 metadata 统一进入权限链；Shell/Git/file 工具绑定 ToolContext；full-access 仍阻止 .git/工作区根永久删除|2026-08-16|
| M11|Hook/扩展架构|tools/middleware.ts；utils/tracer.ts；utils/observer.ts；skills/registry.ts|middleware.test.ts；observer.test.ts；skill*.test.ts|无面向用户生命周期 Hook API 是刻意边界；扩展通道为 Skill/MCP/Role Pack/Settings|2026-08-16|
| M12|IPC 架构|src/shared/types.ts；electron/preload/index.ts；electron/main/ipc/；src/vite-env.d.ts|类型检查；security-boundaries.test.ts；settings-security.test.ts|按 IPC 四处同步规则复核；settings:get 只返回敏感设置安全视图，主进程负责 API Key/MCP secret 恢复与高风险确认|2026-08-16|
| M13|MCP 集成|mcp/client.ts；mcp/bridge.ts；mcp/config-security.ts；ipc/mcp.ts|mcp-config-security.test.ts；settings-security.test.ts|stdio/SSE、重连、elicitation、resources 和保守 metadata 已对齐；Renderer 只拿 env 哨兵，启动/连接前由主进程恢复并校验 secret|2026-08-16|
| M14|可观测性|utils/logger.ts；tracer.ts；observer.ts；llm-debug-store.ts；ipc/debug.ts|observability.test.ts；conversation-debug.test.ts；terminal-security.test.ts|Debug 只保存结构证据、长度、hash 和资产引用，不保存正文/Key/hidden reasoning；Terminal、Diff、报告与工具结果有资源上限|2026-08-16|
| M15|状态机|agent/runtime.ts；services/task-queue.ts；shared/types.ts|runtime-state*.test.ts；task-queue.test.ts|运行态、取消、失败和恢复边界已对齐；状态枚举扩展需同步类型|2026-08-16|
| M16|并发与数据|tools/registry.ts；tools/middleware.ts；storage/database.ts|concurrency*.test.ts；database*.test.ts|工具并发上限 10；关键任务状态 await 落盘，普通入队仍允许非阻塞|2026-08-16|
| M17|测试架构|vitest*.config.ts；playwright*.config.ts；__tests__/；evals/|npm run test；eval:run；eval:skill；test:e2e|Unit/Eval/Skill Eval/UI E2E 分层已复核；真实 HTTP/SSE replay 与真实对话 E2E 仍是显式可选缺口，测试数量以最新门禁为准|2026-08-16|
| M18|Eval/Persona Eval|debug/eval-runner.ts；debug/persona-eval-reports.ts；evals/；storage/persona-eval-review-store.ts|eval 23/23；skill 1/1；persona 配置与报告测试|Judge 多维一次调用、真实消息/System Prompt/tools/config 快照、人工审阅独立存储已对齐|2026-08-16|
| M19|多 Agent|agent/subagent.ts；tools/builtins/delegate-task.ts；ToolContext|subagent.test.ts；subagent-roles.test.ts；summon-delegation.test.ts|子 Agent 权限只降不升；Headless 拒绝子 Agent 工具；委派正文只留 hash/长度，workdir 与动态 metadata 传递到执行边界|2026-08-16|
| M20|自进化|skills/registry.ts；agent/runtime.ts；skills/loader.ts|skill-versioning.test.ts；skill*.test.ts|Skill frontmatter 使用 js-yaml 数据解析；版本备份和回滚已对齐|2026-08-16|
| M21|人格引擎|companion/identity/；companion/orchestrator.ts；prompt-builder.ts|companion-identity.test.ts；prompt-builder.test.ts|Role Pack、PROTECTED/MUTABLE、具名角色和回滚已落地；自动人格生成仍为缺口|2026-08-16|
| M22|成长核|companion/growth/|companion-mutable.test.ts；companion-reflection.test.ts|按 role 版本、校验、反思门、日志和回滚已落地|2026-08-16|
| M23|生活世界|companion/life/engine.ts；ticker.ts；catchup.ts；world-state.ts；store.ts|companion-life.test.ts；companion-catchup.test.ts；world-state.test.ts|离线 catch-up、世界默认值和角色隔离已对齐|2026-08-16|
| M24|Moment 事件层|companion/life/moments.ts；moment-*|moment-*.test.ts|一致性、互动、格式、润色和轻提示已对齐|2026-08-16|
| M25|资产层|companion/life/assets.ts；grant-asset.ts；companion/asset-registry.ts|companion-assets.test.ts；bookshelf-slice.test.ts|资产注册、授予、可用性和删除边界已对齐|2026-08-16|
| M26|卡司|companion/cast/；asset-registry.ts|companion-cast.test.ts；companion-summon.test.ts；companion-availability.test.ts|roster、召唤、可用性和委派边界已对齐|2026-08-16|
| M27|对话两空间|src/shared/aside.ts；MarkdownRenderer.tsx；reply-stance.ts；tone-control.ts|aside-quality.test.ts；conversation-debug.test.ts|主答/aside 解析、语气与调试叠加已对齐|2026-08-16|
| M28|冷启动关系|growth/relationship-stage.ts；reflection-gate.ts；companion.ts|relationship-stage.test.ts；companion-session-role.test.ts|按角色关系阶段与主角切换已对齐|2026-08-16|
| M29|非对称记忆|storage/memory-store.ts；ipc/memory.ts；agent/runtime.ts|citation-correct.test.ts；sensitive-memory.test.ts；memory-feedback-role.test.ts|用户视图、召回视图、Debug 证据视图边界已对齐|2026-08-16|
| M30|叙事能力|agent/prompt-builder.ts；expertise-level.ts；relationship-minset.ts；moment-format.ts|expertise-level.test.ts；relationship-minset.test.ts|专家度、关系最小集和生活上下文注入已对齐|2026-08-16|
| M31|主动在场|companion/life/ticker.ts；moment-tips.ts；proactive-greeting.ts；presence.ts|moment-tips.test.ts；proactive-greeting.test.ts；companion-presence.test.ts|冷却、勿扰、每日上限、应用在场和默认关闭已对齐|2026-08-16|
| M32|Debug/Playground|ipc/debug.ts；agent/debug-tool-run.ts；debug/；DevPanel.tsx；playground/|debug-*.test.ts；playground*.test.ts；UI E2E|Debug 是生产真相；Playground 隔离实验；真实资产从注册表读取且不复制正文；破坏性工具、真人格 Eval、MCP 连接由主进程确认|2026-08-16|

## 阅读规则

- 理念章回答为什么；代码章回答当前怎么做。若旧段落与本矩阵冲突，以本矩阵引用的生产代码为准。
- 生产 Prompt、Role Pack、Memory Strategy、Permission/Sandbox、Tool、Skill、Eval、Provider、MCP 都必须通过注册表或 Debug 快照追溯。
- 本轮未调用真实模型；Persona Eval 只复核 runner、报告结构和脱敏边界，真实运行仍需用户明确配置凭据。
