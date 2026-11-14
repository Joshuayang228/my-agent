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



人物世界引擎统一与旅程闭环：[companion-engine-unification-v1.md](./companion-engine-unification-v1.md)，审查并修复事件、状态、投影、主动行为和用户旅程之间的断点。

生活引擎因果与现实锚点：[life-engine-causality-and-real-world-anchor-v1.md](./life-engine-causality-and-real-world-anchor-v1.md)，针对日内事件离散割裂缺乏状态因果重编排（问题4）以及宿主环境专注度/空闲现实关切感知（问题6）的系统化重塑。

伙伴时间控件：[companion-quiet-time-controls-v1.md](./companion-quiet-time-controls-v1.md)，Foundation 整点时间选择已回流到正式与 Playground 伙伴设置；正式默认、存量偏好数据与通知调度不变。

布局基线：[foundation-layout-boundaries-v1.md](./foundation-layout-boundaries-v1.md)，P1 布局基线、双层页头元信息及无滚动条直接横滚回流，人工验收完成。


| 文档 | 说明 |
|------|------|
| [prompt-coverage-and-review-v2.md](./prompt-coverage-and-review-v2.md) | 全量方案已确认：推进用途 / 消费者门禁、集中展示、缺失生成闭环和人物扩展；新增 UI 待候选验收后统一回流 |
| [foundation-reuse-enforcement-v1.md](./foundation-reuse-enforcement-v1.md) | P1 基础控件复用链路获批回流：四大体验候选收口与 TS AST 符号自动门禁全面生效 |
| [playground-state-switchers-v1.md](./playground-state-switchers-v1.md) | P0：统一 Playground 场景、状态与宽度控制器，采用 MCP 独立选项样式 |
| [playground-page-baseline-polish-v1.md](./playground-page-baseline-polish-v1.md) | P0 施工：Sidebar 底栏、Toast、Right Dock、人物世界与记忆页面样张统一精修 |
| [playground-navigation-world-polish-v1.md](./playground-navigation-world-polish-v1.md) | P0 施工：一级导航、Right Dock 四 Tab、朋友圈社交流与记忆四色语义 |
| [playground-bilingual-ui-vocabulary.md](./playground-bilingual-ui-vocabulary.md) | Playground 中文分类与常用 UI 控件中英分层文案 |
| [foundation-design-language-v2.md](./foundation-design-language-v2.md) | P0 施工：颜色、主题、圆角、动效与 Foundation 组件研究升级 |
| [product-experience-map-v1.md](./product-experience-map-v1.md) | E0 / E1 总合同：产品体验总图、正式 IA 与六条主旅程 |
| [product-experience-journeys-v1.md](./product-experience-journeys-v1.md) | E0 / E1 子合同：Chat 主旅程 Playground 候选 |
| [playground-world-living-dimensions-v1.md](./playground-world-living-dimensions-v1.md) | P0 施工：人物世界六个生活维度与隔离样张 |
| [settings-information-architecture-v1.md](./settings-information-architecture-v1.md) | P0 施工：设置体系信息架构、风险分层与隔离体验候选 |
| [playground-skills-detail-v1.md](./playground-skills-detail-v1.md) | P0 施工：Skills 极简列表、详情元信息、文件树与内容预览 |
| [playground-workspace-five-tools-v1.md](./playground-workspace-five-tools-v1.md) | P1 回流进行中：先统一五功能正式工作区，再补真实后端；P0 夹具继续隔离 |

| [playground-mcp-scenarios-v1.md](./playground-mcp-scenarios-v1.md) | P0 施工：MCP 多服务、连接状态与工具数量场景直接审阅 |
| [playground-model-and-workspace-v2.md](./playground-model-and-workspace-v2.md) | P0 施工：从用户故事重构模型设置与任务工作区候选 |



---

## 已完成施工快照（冻结）

Agent Host 总体架构：[agent-host-architecture-v1.md](./agent-host-architecture-v1.md)，已完成 Agent Manifest、Domain Registry、Capability Registry、Application Orchestrator、Context Provider、Scoped Tool Catalog 与固定 Workflow / 自然语言 Tool 统一入口。

Agent Host 架构收口：[agent-host-architecture-closeout-v2.md](./agent-host-architecture-closeout-v2.md)，已完成会话唯一工具目录、Skill 元数据关系、Companion 跨入口事实链和恢复隔离收口。

内容完整性管线：[content-integrity-pipeline-v1.md](./content-integrity-pipeline-v1.md)，已完成人物世界内容的来源协议、写入校验、连续性边界和 Debug 证据收口。

内容完整性管线收口：[content-integrity-pipeline-v2.md](./content-integrity-pipeline-v2.md)，已完成 Memory 来源证据、Prompt 动态上下文结构和全链路架构审计。

架构可靠性加固：[architecture-reliability-hardening-v1.md](./architecture-reliability-hardening-v1.md)，已完成 Companion 事务边界、Outbox 恢复、IPC sender 安全、Conversation Application Service、存储基准与五边界审计。

人物世界核心引擎重构：[companion-world-engine-core-v1.md](./companion-world-engine-core-v1.md)，已完成统一人物运行态、领域命令、领域事件、幂等投影、执行账本、主会话与窗口 Outbox、Read Model 和 Electron 旅程验收。

提示词开发者审阅：[debug-prompt-review-workbench-v1.md](./debug-prompt-review-workbench-v1.md)，候选已回流正式提示词管理器；唯一计数、用途排序、正文及按需来源 / 调用证据已验收，当前事实见 agent-runtime 模块卡。

Debug 能力证据：[debug-capability-evidence-v1.md](./debug-capability-evidence-v1.md)，四页真实历史、主动问候限次与呈现回执、生活发布关联已验收；全仓基线失败及类型 / 依赖债另有记录。

Debug 正式回流复核：[debug-production-parity-v4.md](./debug-production-parity-v4.md)，七组 26 个入口逐页对齐及整套 / 真实接口回归完成；当前能力见 agent-runtime，验证边界见 quality。

Debug 页面呈现：[debug-presentation-alice-v3.md](./debug-presentation-alice-v3.md)，Alice 对照候选已整批回流正式 Debug；当前能力见 agent-runtime 模块卡，验证与限制见 quality。

Debug 阅读层级：[debug-foundation-reading-v2.md](./debug-foundation-reading-v2.md)，已确认候选回流正式页；当前能力见 agent-runtime 模块卡，验证与限制见 quality。

人物共创技能：[character-system-builder-skill-v1.md](./character-system-builder-skill-v1.md)，用户决策 / 材料 / 反馈驱动的完整人物共创规程；当前能力见伙伴模块，技能源码持续维护。

注册模型请求边界：[prompt-registered-request-boundary-v1.md](./prompt-registered-request-boundary-v1.md)。固定配方签发、模型入口身份与来源校验、压缩恢复 / 子任务续跑、实验作用域及失败门禁已验收；当前事实见运行时、伙伴与记忆模块卡。

设置布局统一：[settings-layout-consistency-v1.md](./settings-layout-consistency-v1.md)。九区同源页头、共享间距及正式回流已验收；当前能力见伙伴模块卡。

人物世界六面正式回流：[world-six-surfaces-production-rollout-v1.md](./world-six-surfaces-production-rollout-v1.md)。已验收六面真实数据、维护 / 换装、角色隔离、失败恢复、受控图片与备份；当前能力见伙伴模块卡。

| 文档 | 说明 |
|------|------|
| [culture-corner-v1.md](./culture-corner-v1.md) | 已完成施工快照（冻结）：四类文化生活（书影音展游）、心愿状态切换、感想录入与正式生活面回流 |
| [footprints-travel-v1.md](./footprints-travel-v1.md) | 已完成施工快照（冻结）：足迹旅行记录、岛屿停留经历与正式生活面回流 |
| [home-spaces-v1.md](./home-spaces-v1.md) | 已完成施工快照（冻结）：家居空间总览与有意义物件陈列、正式生活面回流 |
| [wardrobe-clothing-system-v1.md](./wardrobe-clothing-system-v1.md) | 已完成施工快照（冻结）：衣物资产、当前穿着状态、穿搭槽位与换上链路、正式生活面回流 |
| [prompt-layered-composition-v1.md](./prompt-layered-composition-v1.md) | 已完成施工快照（冻结）：15 项通用功能 Prompt 合同、四层固定顺序组合器、人物适配覆盖边界、关系标签与隔离人物验证 |
| [character-system-extension-v1.md](./character-system-extension-v1.md) | 已完成施工快照（冻结）：首个人物的 Role Pack 分工、Prompt 装配、材料采集与扩展边界 |
| [character-design-method-v1.md](./character-design-method-v1.md) | 已完成施工快照（冻结）：通用人物设计方法、首次冷启持久化、三条连续性分离、世界观经历库与主动搜索边界 |
| [companion-material-grounding-v1.md](./companion-material-grounding-v1.md) | 已完成施工快照（冻结）：阅读材料来源、观察 / 推断分离、确认主体记录、会话图片候选观察与失败证据 |
| [world-and-character-authoring-v1.md](./world-and-character-authoring-v1.md) | 已完成施工快照（冻结）：世界观套装、主角 / 朋友边界、用户人物草稿与发布、正式角色架世界观切换及跨世界生活数据隔离 |
| [character-luffy-v1.md](./character-luffy-v1.md) | 已完成施工快照（冻结）：默认宇宙唯一首个人物路飞、四位核心伙伴卡司、8 张出厂视觉资产与全套 Electron 验收 |
| [character-state-and-relationship-v1.md](./character-state-and-relationship-v1.md) | 已完成施工快照（冻结）：关系事件历史、情绪事件幂等、朋友圈可见性与发布/互动策略、正式设置回流与状态展示切换 |
| [companion-autonomous-moment-media-v1.md](./companion-autonomous-moment-media-v1.md) | 已完成施工快照（冻结）：朋友圈自主配图的事件级幂等、预算门闸、受控媒体归属与 Debug 证据；外部供应商效果按凭据条件验收 |
| [debug-ui-information-architecture-v1.md](./debug-ui-information-architecture-v1.md) | 已完成施工快照（冻结）：Debug 七组正式回流与只读证据；屏幕验收限制见快照 |
| [debug-prompt-layered-assets-v1.md](./debug-prompt-layered-assets-v1.md) | 已完成施工快照（冻结）：Prompt 语义编译、全入口注册与防漏门禁 |
| [product-experience-production-rollout-v1.md](./product-experience-production-rollout-v1.md) | 已完成施工快照：Chat、人物世界、设置、记忆、主题 / Foundation、工作区的正式回流与主线后端验收；RAG、MCP OAuth、完整 PTY 等后置边界明确保留 |
| [companion-world-model-v1.md](./companion-world-model-v1.md) | 已完成施工快照：人物世界六面、静态 / 动态分层、事件关联、生活切片、真实生图资产链、正式回流与质量门禁；RAG、MCP OAuth、完整 PTY 等后置边界明确保留 |
| [luffy-full-journey-v1.md](./luffy-full-journey-v1.md) | 已完成施工快照（冻结）：以路飞贯穿聊天、生活世界、记忆、生图与 Debug 的全功能人物验收；外部效果门与独立 P2 边界保留 |
| [image-generation-product-integration-v1.md](./image-generation-product-integration-v1.md) | 已完成施工快照：对话与人物世界统一真实生图入口、视觉资产归属、受控读取、定位和备份恢复 |
| [playground-memory-information-architecture-v1.md](./playground-memory-information-architecture-v1.md) | 已完成施工快照：四类长期记忆导航、紧凑列表与 Debug 来源开关 |
| [playground-memory-settings-journey-v1.md](./playground-memory-settings-journey-v1.md) | 已完成施工快照：记忆来源、纠正与设置管理的关系旅程 |
| [memory-world-boundary-v2.md](./memory-world-boundary-v2.md) | 已完成施工快照：用户 / 伙伴 / 关系 / 当前状态的记忆边界与人物世界关系 |
| [sidebar-navigation-baseline-v2.md](./sidebar-navigation-baseline-v2.md) | 已完成施工快照：开发入口位置已回流；Secondary Nav 候选被后续人工验收否决 |
| [chat-page-baseline-v1.md](./chat-page-baseline-v1.md) | 已落地：Chat 页面组合基线、开发入口上移、非 Chat 空顶栏移除、引用式主角提示与设置自动保存 |
| [asset-governance-audit-automation.md](./asset-governance-audit-automation.md) | 已落地：全量资产审计、设计资产 / SubAgent 角色登记、机器报告与自动漏登门禁 |
| [agent-asset-usage-evidence-v1.md](./agent-asset-usage-evidence-v1.md) | 已落地：生产资产与真实 LLM / Tool / Memory / Permission 运行记录的脱敏证据链、反向查询、导出与 Debug 跳转 |
| [docs-self-evolution-review.md](./docs-self-evolution-review.md) | 文档自进化复盘、重复真相源候选检测和只读 AI 复盘提示词 |
| [docs-change-impact-closeout.md](./docs-change-impact-closeout.md) | 文档变更影响、自动触发、稳定 ID 与施工合同收工门禁 |
| [docs-truth-source-lifecycle.md](./docs-truth-source-lifecycle.md) | 文档 canonical source、历史归档、规则路由和自动一致性门禁收口 |
| [companion-character-profile-world.md](./companion-character-profile-world.md) | 小航候选：档案/世界结构已接入，人物故事内容待定；旧状态不迁移 |
| [chat-right-dock.md](./chat-right-dock.md) | Chat 右侧能力坞 Phase 1：文件 / 审阅 / 终端；Debug 覆盖；命令控制台 |
| [terminal-pty-v1.md](./terminal-pty-v1.md) | 已冻结：完整 PTY 暂缓，保留未来重新开工条件与 IPC 草案 |
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

| [frontend-companion-surfaces.md](./frontend-companion-surfaces.md) | Alice 对照前端表面：生活/工具 IA、P0–P2 验收 |
| [first-run-and-ui-e2e.md](./first-run-and-ui-e2e.md) | 首次配置旅程与 UI E2E 稳定门禁 |
| [persona-human-review.md](./persona-human-review.md) | 已落地：Persona Eval Trial 的独立人工审阅闭环 |
| [provider-capability-assets-v1.md](./provider-capability-assets-v1.md) | 已落地：依据 Alice Provider 清单扩充共享预设、路由归一化与设置展示 |

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
