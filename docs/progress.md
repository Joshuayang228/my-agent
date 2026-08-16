# 项目进度

> **当前状态入口**：只记录项目现在在哪、最近完成、下一步和阻塞项。完整历史见 [`../_archive/ledgers/progress-through-2026-08-16.md`](../_archive/ledgers/progress-through-2026-08-16.md)。

## 人读摘要（约 30 秒）

| | |
|---|---|
| **当前阶段** | 公开 alpha；基础运行时、伙伴世界、记忆、权限、Debug / Playground、生产资产与安全边界主线已落地。 |
| **当前施工** | 文档真相源与生命周期收口；Playground 常用控件中英分层施工合同仍在进行中。 |
| **产品主线** | 继续打磨伙伴体验、人物故事与 Pack 内容；真实 Persona Eval 结果仍需人工语气与审美验收。 |
| **明确暂缓** | 原生语音输入、Playground Prompt Lab 加厚、生图 Moments。 |
| **明确不做** | 当前威胁模型下不做 OS 级 Shell 强隔离和 Python 嵌入沙箱，见 DEC-037。 |
| **历史** | 完整施工流水和旧测试数字已冻结到归档，不再由本文件重复维护。 |

## 最近完成

### 2026-08-16 · 文档自进化复盘闭环

- 新增 `npm run docs:self-review`：只读扫描最近提交、变更影响、重复长句候选、活跃文档体量、施工合同、Wishlist、规则反馈和 docs:check 结果。
- 新增 `npm run docs:self-review:prompt`：生成给 AI 的结构化语义复盘提示词，明确不自动修改 canonical 文档。
- 复盘产物写入 ignored 的 `var/docs-self-review/`，不触碰用户已有 `.tmp/`、`.env`、用户数据或运行报告。
- GitHub Actions 每周生成复盘 artifact；CI 不调用模型、不提交修复。
- AI 复盘结论按现有账本路由到 rules-feedback / wishlist / decisions / 模块卡，不新增第二套问题系统。

### 2026-08-16 · 文档变更影响与收工闭环

- Wishlist 未完成项统一为 `WISH-001`～`WISH-021`，保留来源，ID 不复用。
- 四张模块卡新增相关 DEC 薄索引；不复制决策正文。
- 新增 `docs-impact-check`，按 staged 代码路径提醒或要求复核模块卡、Architecture、Quality、Progress 和 Changelog。
- 新增 `docs:validate` 统一入口；`npm prepare` 启用 `.githooks/`，commit / push 自动触发文档门禁。
- 新增 GitHub Actions 文档门禁，Pull Request 和 push 自动运行 `npm run docs:check`。
- 施工合同增加收工门禁：稳定事实回流、Wishlist ID、账本更新、文档验证和冻结生命周期缺一不可。

### 2026-08-16 · 文档真相源与生命周期收口

- 建立当前事实矩阵：代码 / 模块卡 / Architecture / Quality / Decisions / Wishlist / Progress / Changelog 各自只负责一种事实。
- 完整归档旧 Progress、Changelog、Wishlist、Rules Feedback 和 dated audit；活跃文件只保留当前内容。
- 施工合同区分进行中与已完成施工快照；完工合同不再承担当前能力真相。
- 统一当前规则入口到 `AGENTS.md`，并增加决策发现与归档搜索规则。
- 新增 `npm run docs:check`，阻止链接、状态、DEC 引用和易漂移数量再次失真。

### 2026-08-16 · 安全审计 v5 与威胁模型收口

- Renderer 不再接收 API Key 或 MCP env 原文；主进程负责已保存凭据恢复和高风险设置确认。
- MCP 配置校验、资源上限、secret hydrate 与启动恢复统一进入主进程安全边界。
- DEC-037 明确当前不建设 OS 级 Shell 强隔离或 Python 嵌入沙箱。
- 完整审计报告已冻结在 [`../_archive/audits/security-audit-2026-08.md`](../_archive/audits/security-audit-2026-08.md)。

### 2026-08-14～15 · Agent 生产资产与使用证据链

- Prompt、Role Pack、Memory Strategy、Permission / Sandbox、Tool、Skill、Eval、Provider 与 MCP 进入统一生产资产目录。
- 真实 LLM / Tool / Memory / Permission 运行通过稳定 key 记录脱敏使用证据，支持反向查询、导出和 Debug 跳转。

## 当前状态

### 产品

- 伙伴世界 W0–W6、三槽、召唤、自动反思 MUTABLE 已落地。
- 人物行为人格已进入 Playground 与 Persona Eval；人物故事、职业、经历、住所和完整世界观仍待产品确认。
- Debug 回答“生产系统实际是什么”；Playground 只做隔离实验，不复制生产真相。

### 工程

- Agent Loop、上下文压缩、任务队列、多 Provider、MCP、Skill、权限责任链和工作区路径防线已落地。
- 当前能力清单以 [`modules/README.md`](./modules/README.md) 及各模块卡“已落地能力”为准。
- 当前门禁以 [`quality.md`](./quality.md) 和实际命令输出为准，不在 Progress 固定测试数量。

## 下一步

1. 完成 Playground 常用 UI 控件的中文主名与灰色英文辅助名。
2. 在 Playground 做伙伴语气、活人感和审美人工验收。
3. 根据人工验收结果决定是否进入主角人物故事设计。
4. 从 Wishlist 选择下一项前，先确认是否需要新的施工合同。

## 阻塞与暂缓

- 原生语音输入：等待明确采用系统 STT 或云端 Whisper，见 [`deferred/native-voice-input.md`](./deferred/native-voice-input.md)。
- 人物故事：不是工程阻塞，需要产品设定确认。
- 真实 Persona Eval：会产生远程模型费用，只有明确需要时运行。

## 历史索引

- [完整 Progress 快照（截至 2026-08-16）](../_archive/ledgers/progress-through-2026-08-16.md)
- [完整 Changelog 快照（截至 2026-08-16）](../_archive/ledgers/changelog-through-2026-08-16.md)
- [2026-08 当前实现逐章审计](../_archive/audits/current-implementation-audit-2026-08.md)
- [2026-07 方法论缺口审计](../_archive/audits/gap-audit-2026-07.md)
