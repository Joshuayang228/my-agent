# docs/requirements/ — 施工合同索引

> **统一称呼：施工合同**（勿称需求文档 / 需求合同 / 开工合同）。
> **只放**开工前对齐 Why/What/How/验收的合同。进行中合同指导施工；完成后冻结为历史施工快照，当前能力回到模块卡 / Architecture / Quality / Decisions。
> **不是**能力清单——「有什么」见各 [`../modules/`](../modules/) 模块卡的「已落地能力」节。
> **不是**文档体系说明——见 [`../docs-system.md`](../docs-system.md)。
> **不是**暂缓评估 / 历史批次——评估见 [`../deferred/README.md`](../deferred/README.md)；历史快照见 [`../../_archive/README.md`](../../_archive/README.md)。

## 怎么放文件

| 类型 | 含义 | 处置 |
|------|------|------|
| **进行中** | 仍指导未完成施工 | 行为或范围变化时同步合同 |
| **已完成施工快照（冻结）** | 主线已验收，保留当时 Why/What/How | 不再同步当前实现；稳定事实必须先吸入模块卡 / Architecture / Quality / Decisions |

不要把灵感写进本目录（去 `wishlist.md`）；不要把进度写进本目录（去 `progress.md`）；不要把文档元规则、可行性评估、已完成工程批次写进本目录。

---

## 进行中


| 文档 | 说明 |
|------|------|
| [playground-bilingual-ui-vocabulary.md](./playground-bilingual-ui-vocabulary.md) | Playground 中文分类与常用 UI 控件中英分层文案 |

---

## 已完成施工快照（冻结）

| 文档 | 说明 |
|------|------|
| [asset-governance-audit-automation.md](./asset-governance-audit-automation.md) | 已落地：全量资产审计、设计资产 / SubAgent 角色登记、机器报告与自动漏登门禁 |
| [agent-asset-usage-evidence-v1.md](./agent-asset-usage-evidence-v1.md) | 已落地：生产资产与真实 LLM / Tool / Memory / Permission 运行记录的脱敏证据链、反向查询、导出与 Debug 跳转 |
| [docs-self-evolution-review.md](./docs-self-evolution-review.md) | 文档自进化复盘、重复真相源候选检测和只读 AI 复盘提示词 |
| [docs-change-impact-closeout.md](./docs-change-impact-closeout.md) | 文档变更影响、自动触发、稳定 ID 与施工合同收工门禁 |
| [docs-truth-source-lifecycle.md](./docs-truth-source-lifecycle.md) | 文档 canonical source、历史归档、规则路由和自动一致性门禁收口 |
| [companion-character-profile-world.md](./companion-character-profile-world.md) | 小航候选：档案/世界结构已接入，人物故事内容待定；旧状态不迁移 |
| [chat-right-dock.md](./chat-right-dock.md) | Chat 右侧能力坞 Phase 1：文件 / 审阅 / 终端；Debug 覆盖；命令控制台 |
| [debug-llm-call-storage.md](./debug-llm-call-storage.md) | 对齐 Alice 的 LLM Debug 调用记录存储、IPC 同步与侧栏恢复 |
| [playground-component-fitting-room.md](./playground-component-fitting-room.md) | Playground：Alice 壳 + Storybook 思路（Phase 0） |
| [frontend-alice-shell.md](./frontend-alice-shell.md) | 前端壳层对齐 Alice 布局（大气改造 Phase A） |
| [experience-debug-playground.md](./experience-debug-playground.md) | 体验调试 Phase 0：DevPanel 两面 + 工具手测 + Prompt 会话覆盖 |
| [frontend-visual-language.md](./frontend-visual-language.md) | 前端视觉语言 + 设置 IA + Chat 气质（Phase1–3） |
| [companion-world-framework.md](./companion-world-framework.md) | 产品终局：三槽、单活跃、Catch-up、生活世界 |
| [companion-architecture.md](./companion-architecture.md) | 模块边界与依赖方向 |
| [companion-tech-spec.md](./companion-tech-spec.md) | W0–W6 验收与技术方案 |
| [companion-mutable-reflection.md](./companion-mutable-reflection.md) | 自动反思写 MUTABLE（门闸 / 入队 / Settings） |
| [companion-cast-content.md](./companion-cast-content.md) | 三角色文案定位 + 分味剧本/衣柜约定 |
| [companion-protagonist-persona.md](./companion-protagonist-persona.md) | 主角行为人格已进入 Playground / Eval 验收；人物故事待定 |
| [eval-remote-persona-acceptance.md](./eval-remote-persona-acceptance.md) | 已落地：真实/Mock 分层、B02–B07 pass^k 与远程报告 |
| [prompt-chinese-unification.md](./prompt-chinese-unification.md) | 模型可见文本中文化、结构化注册表、调用覆盖门禁、自动指纹与 Debug 统一目录 |
| [skill-management-2.md](./skill-management-2.md) | 已落地：Skill 版本、校验、隔离试跑与激活追踪 |
| [skill-eval-v1.md](./skill-eval-v1.md) | 已落地：Skill 触发、指南注入、工具边界、回复约束与 Debug 证据链 |
| [agent-asset-catalog-v1.md](./agent-asset-catalog-v1.md) | 已落地：伙伴与人格生产资产的统一注册与 Debug 目录 |
| [memory-strategy-assets-v1.md](./memory-strategy-assets-v1.md) | 已落地：记忆提取、召回、去重、生命周期与纠错策略注册 |
| [permission-sandbox-assets-v1.md](./permission-sandbox-assets-v1.md) | 已落地：权限责任链、沙箱档位、命令分级、路径边界、审批生命周期与有效沙箱策略注册 |
| [eval-case-grader-assets-v1.md](./eval-case-grader-assets-v1.md) | 已落地：普通 / Skill Eval Case、结构化 Grader 判据和统一 Scenario 注册表 |
| [provider-capability-assets-v1.md](./provider-capability-assets-v1.md) | 已落地：Provider 预设唯一注册表、三协议适配能力和 Thinking / Context / Vision / Failover 策略资产 |
| [frontend-companion-surfaces.md](./frontend-companion-surfaces.md) | Alice 对照前端表面：生活/工具 IA、P0–P2 验收 |
| [first-run-and-ui-e2e.md](./first-run-and-ui-e2e.md) | 首次配置旅程与 UI E2E 稳定门禁 |
| [persona-human-review.md](./persona-human-review.md) | 已落地：Persona Eval Trial 的独立人工审阅闭环 |

---

## 与模块卡的关系

- 模块卡：横切边界 + 必读文件 + 当前“已落地能力”表
- 施工合同：大改开工前对齐；完工后冻结，不再承担当前能力真相
## 施工收工门禁

施工合同从“进行中”转为“已完成施工快照（冻结）”前，必须确认：

- 稳定事实已回流模块卡、`docs/architecture.md`、`docs/quality.md` 或 `docs/decisions.md`；
- 未排期缺口已进入 `docs/wishlist.md` 并拥有 `WISH-xxx` ID；
- `docs/progress.md` / `docs/changelog.md` 已按职责更新；
- `npm run docs:validate` 通过；
- 文首已加入“生命周期：已完成施工快照（冻结）”。
