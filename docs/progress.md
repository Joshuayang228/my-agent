# 项目进度

> **当前状态入口**：只记录项目现在在哪、最近完成、下一步和阻塞项。完整历史见 [`../_archive/ledgers/progress-through-2026-08-16.md`](../_archive/ledgers/progress-through-2026-08-16.md)。

## 人读摘要（约 30 秒）

| | |
|---|---|
| **当前阶段** | 公开 alpha；基础运行时、伙伴世界、记忆、权限、Debug / Playground、生产资产与安全边界主线已落地。 |
| **当前施工** | Playground 基础 → 产品体验 → Agent 实验结构正在等待人工验收：基础组件与产品场景已分工作域，Right Dock 改为预览默认 + 按需 Tab，正式页面尚未回流。 |
| **产品主线** | 继续打磨伙伴体验、人物故事与 Pack 内容；真实 Persona Eval 结果仍需人工语气与审美验收。 |
| **明确暂缓** | 原生语音输入、Playground Prompt Lab 加厚、生图 Moments。 |
| **明确不做** | 当前威胁模型下不做 OS 级 Shell 强隔离和 Python 嵌入沙箱，见 DEC-037。 |
| **历史** | 完整施工流水和旧测试数字已冻结到归档，不再由本文件重复维护。 |

## 最近完成

### 2026-08-23 · Playground 布局收口

- Playground 壳统一提供工作域、当前一级 Tab、目的说明和内容宽度，面板不再各自漂移。
- 基础故事筛选按基础控件 / 状态反馈 / 开发基础分组；产品体验依赖改为紧凑证据摘要；页面组合移除外层故事卡套内层预览的重复包裹。
- 本轮仍停留在 Playground P0，未改变正式产品页面。

### 2026-08-23 · Foundation 基础模块补齐

- 基础组件工作台不再只展示按钮、输入和工具卡；新增标签切换、生成动作、提示条、加载指示器、Markdown 渲染、资产目录、文件树和分栏拖拽等可交互故事入口。
- Foundation 页面收敛为“单行横向故事切换 + 真实预览”，移除无预览价值的资产总览和候选文字区；完整登记继续由注册表 / Debug 承担。
- 图标采用标记统一放到具体图标卡右上角；Markdown、文件树等正式基础能力继续使用真实组件 + 隔离样张验收。
- 本轮仍停留在 Playground P0，不回流正式产品页面。

### 2026-08-21 · Playground 两层边界与 Tab 事实表收口

- 将 Playground 文档固化为 `Foundation → Experience` 两层产品设计模型；`Agent 实验` 只作为独立隔离工作域，不引入第三层架构。
- 新增施工合同中的 Tab 事实表：设计语言、图标与视觉、基础组件、Chat、人物世界、记忆、设置、工作区和 Agent 实验各自的职责与禁区。
- 原“设计令牌”改名为“设计语言”，移除不属于该层的“组合实验”；基础组件不再展示记忆芯片、伙伴状态条等业务结构。
- 产品体验摘要改为“体验组成 / 基础能力”两行，业务组成与 Foundation 依赖均从注册表派生；人物世界四个 Tab 增加隔离样张并可逐个切换。
- Playground Right Dock 支持同类型 Tab 多实例，实例具备独立标识；仍保持只读样张，不连接真实审阅或终端。
- 本轮仍是 Playground P0 候选施工，不回流正式 Chat、设置或人物世界默认行为。

### 2026-08-19 · Playground 全屏壳与目录减噪

- Playground 改为与设置一致的独立全屏工作区，进入后不再保留产品 Primary Sidebar，消除双层侧栏。
- 删除页面顶部重复说明块、基础组件“组件索引”和全局采用标记开关；采用图标只保留在有直接证据的具体资产上。
- 图标目录收敛为紧凑的图标 + 中文名 + 灰色英文名，key / 用途 / 优先级继续留在注册数据和搜索中。

### 2026-08-19 · 产品体验基础依赖门禁

- 新增产品体验注册表，为 Chat、人物世界、记忆、设置、工作区和业务状态声明稳定 key、真实来源与 `usesFoundation`。
- UI 资产显式区分 foundation / experience；TypeScript 与 Unit 会阻止不存在、非基础层或生命周期不兼容的依赖。
- `assets:check` 增加产品体验资产家族；Playground 双向展示“使用的基础 / 被哪些体验使用”，反向关系完全派生。

### 2026-08-19 · Playground 两层设计工作台候选

- Playground 导航收敛为“基础 / 产品体验 / Agent 实验”三个工作域；基础组件和业务状态在工作台内筛选，不再把按钮、输入、确认框等混成一级导航。
- 产品体验按 Chat、人物世界、记忆、设置、工作区直接进入，页面组合去掉第二套内部页面导航。
- 已把“产品体验缺基础能力时先回基础侧创建并验收”的 AI 开发规则写入前端规范。

### 2026-08-19 · Playground 导航与生活面精修候选

- Playground 组件故事已提升为一级入口，保留“设计 / Agent 实验”作为视觉分组，不再嵌套第二套页面导航。
- Right Dock 候选拆分为文件、预览、审阅、终端四个 Tab，默认仅显示预览，文件 / 审阅 / 终端通过“+”添加；审阅与终端只渲染隔离占位。
- 人物世界候选移除重复“生活广播”标题和 Catch-up 独立卡，改为社交流样张；记忆候选收敛为三种主色 + 灰色。
- Chat 壳候选移除主内容区独立“新对话”顶部框，让欢迎区直接承接内容；侧栏入口不变。
- 新增 Renderer E2E 覆盖一级导航、右坞按需 Tab、朋友圈样张、记忆颜色；本轮仍停留在 Playground P0，未回流正式页面。

### 2026-08-18 · Playground 页面基线精修候选

- Sidebar 候选底栏真正贴底，隐藏“开发 / 产品”标签，主侧栏候选只保留人物世界 / 设置；已删除被否决的“二级页收起”和工具 Secondary Nav。
- Right Dock 加入只读项目文件树 / 代码预览样张，人物世界加入只读 Moments / Catch-up 样张，均显式跳过真实 IPC。
- Toast 四态关闭按钮统一右边界；记忆分类图标、名称与数量在窄宽下保持同行。
- 本轮仍处于 Playground P0，等待人工确认后才决定是否回流正式页面。

### 2026-08-17 · 记忆后台任务生命周期收口

- 修复 GitHub Asset registry CI 在 `memory-tools` teardown 阶段出现 `EnvironmentTeardownError` 的时序竞态。
- 记忆向量异步写入继续保持非阻塞，但通过 `drainMemoryBackgroundTasks` 提供测试 / 退出前的生命周期边界。
- 相关单测在关闭数据库或测试环境前 drain，避免动态加载辅助模型配置跨越 Vitest 生命周期。

### 2026-08-17 · Chat 页面组合基线与设置自动保存

- Primary Sidebar 默认宽度收敛为 248px（216–320px），Debug / Playground 固定在会话列表上方，底栏只保留产品入口。
- Chat 顶栏只显示会话标题和特殊上下文；Debug / Playground 等全页视图不再继承 52px 空白顶栏。
- 欢迎区按可用高度居中，主角联动说明改为轻量引用样式，输入卡与 Playground 页面组合故事保持同源。
- 设置页移除重复的“设置 / 保存”顶部栏，字段修改后 800ms 防抖自动保存，未修改 API Key 不覆盖安全存储。
- Renderer E2E 覆盖开发入口顺序、Playground 顶部起点和设置无手动保存栏。

### 2026-08-17 · GitHub Actions 与跨平台删除安全收口

- 清理 `.tmp/` 临时审计报告、过期文档重构草稿和未引用 Prompt 注册表草稿，并将 `.tmp/` 纳入本地忽略。
- 修复 Linux 工作区位于 `/tmp` 时普通文件被永久删除白名单误命中的问题；白名单现在只检查工作区内部相对路径段。
- Unit CI 使用 Electron external 占位路径，不再下载桌面二进制；官方 Checkout / Setup Node / Upload Artifact Actions 升级到 v7。
- GitHub 失败日志中的大量 EnvironmentTeardownError 已确认为下载超时后的连锁噪声，根因测试已补回归并在本地 CI 等价环境通过。

### 2026-08-17 · 全量资产治理与自动登记施工

- 新增 `src/shared/design-asset-registry.ts`，统一 Settings、Playground、MarkdownRenderer 的主题与字体比例来源。
- 新增 `electron/main/agent/subagent-asset-registry.ts`，登记 researcher / coder / analyst 的稳定角色资产，并接入 Debug 聚合与真实运行证据。
- 新增 `scripts/asset-governance.mjs` 与 `npm run assets:check`，维护 12 个资产家族、18 个 ModelContextAssetType 的治理覆盖，生成 `var/asset-audit/` 机器快照并对 staged 漏登 fail-closed。
- Git hooks 与 GitHub Actions 已接入资产门禁；全量盘点快照见 `_archive/audits/asset-registry-audit-2026-08.md`。

### 2026-08-17 · UI 组件资产注册与方法论

- 在统一资产注册方法论中补入 UI 组件 / 图标的身份、采用生命周期、Playground 验收和无障碍契约，不另造第二套管理哲学。
- 新增 `src/shared/ui-component-registry.ts`，区分 candidate / playground / adopted / deprecated / archived，并明确 Radix 候选不等于已安装依赖。
- Playground「组件 → 组件目录」支持按分类、采用状态和中英文 / key / 来源搜索，已采用项指向真实组件源码。
- 增加 UI 组件注册表 Unit 与 Renderer E2E，图标分类导航恢复中文单语，英文只保留在具体常用组件 / 图标名中。
- 已采用组件的无障碍验证状态与采用状态分离；当前专项复核登记为 WISH-022，不用“已采用”冒充“已验证”。

### 2026-08-16 · Playground Lucide 语义图标目录

- 保持 `lucide-react` 为生产唯一图标源，不把 Alice 的 Tabler 图标库混入产品依赖。
- 新增 `src/shared/icon-registry.ts`：按导航、对话、开发、伙伴、资产、状态登记稳定语义 key、中文主名、灰色英文名和 P0/P1 优先级。
- Playground「组件 → 图标」增加可搜索、按分类筛选的图标资产目录，作为后续正式 UI 采用前的统一验收面。
- 增加注册表单测和 Playground UI 验收，避免图标 key 漂移或目录与实际组件脱节。

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
