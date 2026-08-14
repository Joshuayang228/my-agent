# AGENTS.md — My Agent 项目权威规则

<!-- RULE_HIERARCHY:START -->
> 规则层级：**L4 · 独立项目规则**
> 规则链（父 → 子）：`L1 <Vault>/AGENTS.md` → `L2 <Vault>/积核/项目/AGENTS.md` → `L3 <Vault>/积核/项目/个人项目/AGENTS.md` → `L4 <Vault>/积核/项目/个人项目/my-agent/my-agent/AGENTS.md`
> 加载约定：仅适用于 `<Vault>`（`瓶盖的AI碎碎念`）内部；始终按父 → 子读取。若 Agent 从子目录或独立 Git repo root 启动且未自动加载上层规则，必须主动补读；冲突时近层优先，安全红线不可覆盖。
<!-- RULE_HIERARCHY:END -->

> `AGENTS.md` 是本项目面向所有开发 Agent 的 canonical source。
> Claude Code 通过同目录 `CLAUDE.md` 的 `@AGENTS.md` 导入；Codex 等工具直接读取。
> 所有 Agent 必须从项目根目录到当前工作目录，按父 → 子顺序完整读取沿途 `AGENTS.md`。
> 多级规则冲突时，除安全红线和上级不可覆盖规则外，以更接近当前工作目录的规则为准。
> 高频强约束写在正文；低频场景规则放 `agent-skills/`。

## 项目定位

My Agent 是一个人格化桌面 AI Agent：有性格、有记忆、能成长，目标是成为用户的数字伙伴，而不只是命令式工具。

产品方向优先保护：

- **人格化交互和长期记忆是核心差异化**——关系型 AI、活人感、人设系统、情感记忆，这是我们的核心竞争力。
- **基础设施层对齐 Claude Code**——Agent Loop、上下文压缩、工具系统、System Prompt 结构等框架能力，参考 CC 的生产验证方案，不重复发明。参考源码：`_reference/framework-harness/repos/claude-code-sourcemap-main/`。
- **工具 ≠ 内部服务**——工具是 AI 可见、可调用、会进入对话历史的能力；内部服务是框架私有能力（调度器、日志、自动备份），不暴露为工具。

## 启动上下文

文档分四维：**产品**（`docs/modules/`，入口 `README.md`）· **技术**（`architecture.md`）· **质量**（`quality.md`）· **账本**（progress / changelog / wishlist / pitfalls / decisions / rules-feedback）。
**「有什么能力」**看对应模块卡的「已落地能力」节（导览：[`docs/modules/README.md`](docs/modules/README.md)）。
**施工合同**（唯一称呼，勿称「需求文档 / 需求合同 / 开工合同」）索引：[`docs/requirements/README.md`](docs/requirements/README.md)。
协作 SOP 在根目录 `agent-skills/`（与 docs 并列，见下文「agent-skills」）。深 Why 在 `methodology/`。文档四维见 `docs/docs-system.md`。

**模块卡纪律**：`docs/modules/` 只放**有实质边界的模块卡** + `README` 导览。能力清单写在各卡「已落地能力」，**禁止**再维护总 `capability-catalog`；能力合并后更新导览指向存活卡，**禁止**留下仅「请改读 xxx」的重定向/空壳文档。

**按任务类型读**：

| 任务 | 先读 |
|------|------|
| 落在某产品能力（伙伴/记忆/权限/运行时等） | 对应 `docs/modules/<名>.md`（含「已落地能力」）→ 其「必读文件」→ 必要时 `architecture.md` |
| 「有没有某某能力 / Prompt 怎么组装」 | 模块卡「已落地能力」；伙伴 Prompt 管线见 `companion.md` |
| 跨模块 / 架构 | `docs/modules/README.md` + `architecture.md` + `progress.md` |
| 大改要对齐 / 翻施工合同 | `docs/requirements/README.md` → 对应 `docs/requirements/*.md` |
| 测试 / Eval 门禁 | `docs/quality.md` |
| 小改（typo、单文件少量且意图明确） | 相关代码即可 |

从 summary 恢复且信息完整可跳过；summary 可能过时（如跨天）时仍应读文件确认。

动手前若已读模块卡：用几行复述边界、拟改文件、不碰什么、必测点；越界先问用户。

## 规则冲突优先级

规则冲突时按此裁决：

1. **安全红线** — 密钥泄露、权限绕过、数据破坏
2. **用户显式指令** — 用户明确说"这样做"
3. **开发流程规范** — 本文档和 agent-skills 的流程约束
4. **代码风格标准** — 命名、格式、注释
5. **建议性规则** — 性能优化、可读性建议

示例：用户明确要求"暂时硬编码 token 测试"时，不以安全红线拒绝（用户知情授权）；但"push 时保留硬编码 token"应拒绝并给替代方案。

---

## 硬约束（常驻，必须默认执行）

以下规则「漏了就出事」，不下沉 skill，每次都生效。

### 安全红线

- 禁止硬编码 API Key、密码、token 或任何凭据；一律走环境变量或 Electron `safeStorage`。
- `.env` 必须在 `.gitignore` 中。
- 对外错误信息只暴露用户友好内容，不暴露堆栈、内部路径、SQL 语句。
- 文件路径操作做防穿越检查；SQL 用参数化，禁止拼接用户输入。

> 沙箱分级、权限规则引擎、命令安全分级等详情见 `agent-skills/security-checklist.md`。

### 架构分层依赖方向

主进程 import 方向必须遵守：

```text
ipc/（入口）→ agent/（核心）→ llm/（外部服务）
                    ↓
              storage/、tools/、memory/
```

**禁止反向依赖**：
- `agent/` 禁止 import `ipc/`
- `llm/` 禁止 import `agent/`、`ipc/`
- `storage/` 禁止 import `agent/`、`ipc/`、`llm/`
- `tools/builtins/` 禁止 import `agent/`、`ipc/`

**允许方向**：`ipc/` → `agent/`/`storage/`/`tools/`/`llm/`/`memory/`；`agent/` → `llm/`/`tools/`/`storage/`；`tools/` → `llm/`（仅需要时）；所有模块 → `utils/` 和 `src/shared/types.ts`。

新增模块前先明确它属于哪一层。

### IPC 四处同步

修改 IPC 接口时**必须同步四处**，否则运行时报"方法未定义"或类型漂移：

1. `src/shared/types.ts` — 载荷数据类型
2. `electron/preload/index.ts` — preload 桥接层
3. `electron/main/ipc/*.ts` — 主进程处理器
4. `src/vite-env.d.ts` — `window.electronAPI` 的 TypeScript 形状

改完用 `tsc` + 测试验证。频道名是字符串，TS 校不住 preload 与 handler 拼写一致——靠纪律。

### LLM / 外部服务配置统一装配

- **唯一工厂**：`electron/main/llm/aux-config.ts` 的 `loadMainLLMConfig` / `loadAuxLLMConfig`。
- **唯一打模型入口**：`streamChat` / `chatComplete`（`llm/index.ts`）。
- Runtime、IPC、Playground、memory、delegate、标题生成等**禁止**手拼 `apiKey`+`baseUrl`+`model`；策略（如 `thinking.disabled`）挂在 `loadAuxLLMConfig`，不散落在各调用点。
- 详规：`agent-skills/model-config.md`。

### Prompt 单一事实源

- Prompt 正文必须跟随生产代码或 Role Pack 资产维护；禁止在 `src/components/playground/` 再复制一份 Prompt 文案作为目录真相。
- `electron/main/prompts/registry.ts` 是 Prompt 注册表事实源；静态 Prompt 由 `electron/main/prompts/texts.ts` 等生产常量直接提供，动态 Prompt 标记为 `dynamic` 并指向实际组装器。Debug「提示词管理器」通过 `debug:model-context-assets` 在主进程聚合 Prompt、Tool schema、Skill、Eval Judge 和 MCP；兼容接口 `debug:prompt-assets` 不再作为统一目录入口。
- 新增或修改 Prompt 时，必须同步注册表项和对应测试；目录展示不能脱离实际运行路径单独演进。
- 核心 Prompt key 只通过 `electron/main/prompts/keys.ts` 的 `PROMPT_KEYS` 使用，Role Pack key 通过统一工厂生成；生产 `streamChat` / `chatComplete` 必须声明非空资产 key，或显式填写 `promptlessReason`。
- Debug「提示词管理器」是生产资产统一目录：除 Prompt 外还聚合伙伴与人格资产、记忆策略、Tool schema、Skill、Eval Judge 和当前 MCP 工具；资产同时显示人工版本与自动指纹。Playground 只接收显式实验副本，不复制目录。
- **Prompt 当前只做中文**：先用简体中文写清意图、行为边界、优先级和例外；英文只保留必要的技术术语、工具名、JSON key、协议 token 或 canonical name。
- 禁止中英文逐句对照或把同一条规则重复写成两种自然语言；英文不是默认翻译层，而是必要的技术契约或外部原文。
- Prompt 结构必须分离稳定身份、动态上下文、行为策略、工具环境和协议契约；参考 Alice 的模板 + 动态插槽 + 独立上下文区块思路，但不复制其产品语义。
- 动态生活、世界、关系和用户偏好内容应由实际组装器独立注入；可变人格、热更新覆盖和 Playground 实验副本不得隐式覆盖稳定身份 Prompt。
- Prompt 代码与文案分层维护：自然语言中文放 Prompt 正文，英文术语放结构化术语 / 协议字段；禁止把中英文长期散落在 JSX 或字符串拼接中。
- 英文 Prompt 版本、多语言 Prompt 资产和按 locale 选择的运行时暂不实现，统一登记到 `docs/wishlist.md`；当前不做韩文或其他语言版本。

### 生产资产注册管理

- 会影响 Agent 行为、模型输入、工具权限或 Eval 结果的生产定义，必须有稳定 key、真实 source、version、fingerprint、ownership 和 status；需要跨资产解释时补 dependencies / derivedFrom。
- 注册表只能从生产常量、loader、ToolRegistry 或纯函数事实生成，禁止在 Debug / Playground 或 registry 文件中复制第二份 Prompt、Role Pack、记忆策略阈值或权限规则。
- 用户记忆、会话历史、当前世界状态、工具原始输出和凭据是运行时 / 用户 / 外部数据，不得伪装成内置生产资产；Debug 只展示它们与生产资产的关联。
- Debug 的生产资产目录只读；Playground 只能显式载入为隔离实验草稿，Settings 才管理用户拥有的编辑能力。结构化资产未经单独合同不得直接写入 Playground 或生产文件。
- 新增资产类型时必须同步共享类型、生产聚合器、Debug 标签、单元测试和对应文档；资产目录的存在不能替代真实行为 Eval。
- 详细设计与当前实现见 methodology/asset-registration-management.md、methodology/asset-registration-management-code.md。
### UI 文案与代码语言分层

- **产品/UI 文案以简体中文为主**；分类、状态、操作说明和用户提示不要为了“看起来专业”批量追加英文。
- **Playground 分类只用中文**，例如「状态与反馈」「快捷键与提示」；分类标题不写成中英混排。
- Playground 仅对常用、可迁移的 UI 控件术语提供学习辅助：中文是主名，英文作为低对比度、小字号的辅助名，例如「加载指示器  Spinner」「空状态  EmptyState」。不要求所有状态、描述和完整句子双语化。
- **双语学习标注默认只属于 Playground 展示层**；生产页面是否展示英文必须另行确认，不得因为 Playground 有英文辅助名就自动回流到 Chat、设置或伙伴生活面。
- **代码层保持英文原名**：组件名、变量名、函数名、API、IPC 频道、协议字段、图标 canonical name 和代码示例不得翻译成中文，也不得把中英文拼进同一个代码标识。
- 结构化维护双语术语，优先使用 `labelZh` / `labelEn` 等字段；禁止把中英文长期散落在 JSX 字符串中，便于未来分别统一翻译文案层和代码/术语层。
- 技术术语在解释性文档中可保留英文原文，但必须服务于理解；这不等于要求产品界面全面双语化。

### Debug / Playground 边界

- **Debug = 生产真相**：只读展示真实 Prompt、运行状态、系统配置、调用链、事件和日志；凡是回答“系统现在实际是什么”的内容都放 Debug。
- **Playground = 隔离实验**：只放设计系统、组件/页面故事、模拟夹具、模型/工具/对话试验；默认不写真实会话、设置或生产资产。
- 生产资产目录不得为了方便试验复制进 Playground。Playground 需要生产数据时只允许显式“载入为实验草稿”，草稿与生产源分离；该能力可按需求后置。

### 质量底线

- 修 bug 先定位根因，禁止猜测式修改。
- 同一方法失败两次必须换路径，禁止第三次盲试。
- 禁止 Mock 真实 AI 调用（测试场景除外）。
- **禁止分期实现或临时方案**——每次给出完整可用实现，不留"TODO 后续补""先用简化版"。功能确实复杂需分步时，在**施工合同**（`docs/requirements/`）里明确拆分边界，每步独立可验证。
- 编辑文件前先 Read 最新版本；删代码前说明原因，大段删除先获用户确认；改依赖（package.json 等）声明新增/移除了什么。
- **注释三要素**：非平凡函数须写背景 / 设计意图 / 关键约束；禁止功能复述。详规见 `agent-skills/typescript-guidelines.md`。
- **注释保护**：禁止以「太长 / 自解释 / 顺便清理」删决策注释；实现变了须同步更新。
- **代码删除声明**：认为可删时先标 `// TODO: 建议移除 - 原因：xxx`，告知用户获许可再删。
- 不确定的假设用 **[待确认]** 标记并告知用户，禁止默默假设后往下走。
- 文件 >500 行时优先读目录/关键章节，不全量读浪费 token。

### Git 提交与推送门控

功能开发完成且测试通过后**必须**立即 commit + push：

- 用户已长期授权仓库任务在验证通过后直接 commit + push，**无需每次再次询问是否提交或推送**；除非用户在当轮明确要求不提交、暂缓推送或只做审查。
- 每个可独立回滚的任务必须在当轮完成提交与推送，不得只在回复中建议用户之后再提交。
- commit 前必须通过单元测试（`npm run test`）和类型检查（`npx tsc --noEmit`）。
- 改动涉及 import 结构、主进程模块或打包配置时，commit 前必须补跑 `npx vite build`——`tsc` 查不出重复导入/打包期错误（已踩坑：重复 import 过了 tsc、build 才失败）。
- 动手前先 `git status`：把与本次任务无关的存量改动单独提交或 stash，不混进本次提交。
- 严禁本地积压大量未提交修改；严禁只 commit 不 push。
- 一个 commit 只做一件事；用 `git add <具体文件>` 而非 `git add .`，staged 后再 `git status` 复查。
- 遇 `Failed to connect to 127.0.0.1` 类代理报错，检查代理端口（Clash 常见 7890 / 7897），更新或 `git config --global --unset http.proxy` 尝试直连，直至推送成功。

> commit 规范、分支命名、PR 流程详见 `agent-skills/git-workflow.md`。

---

## 施工合同规范（`docs/requirements/`）

> 统一称呼：**施工合同**。落点固定为 `docs/requirements/*.md`。
> 禁止混用「需求文档 / 需求合同 / 开工合同」等别名（避免 AI 找错目录）。

**适用场景**：跨 3 个以上文件的新功能、架构变更、复杂功能模块。这类任务**必须先写施工合同，用户确认后再动手**。

必须包含：需求背景（Why）、功能目标（What）、技术方案（How：架构/数据流/关键接口/依赖）、影响范围评估（破坏性/测试/文档）、实施步骤（按逻辑顺序、每步可验证）、风险与权衡。

---

## 开发流程闸（防偷懒，必须默认执行）

以下三道闸是自循环时最容易被跳过的，缺了它 agent 会「没确认就写、没研究就造、没验证就说完成」。

### 闸 1：接需求分三态

- **逃生口**（可跳过确认直接改）：单行 typo / 格式 / 注释修正；单文件 <10 行且用户意图明确；用户明说"直接改""帮我改一下"。
- **新需求**（首次提出）：严格按 **思考 → 提问 → 复述 → 方案 → 等许可** 五步，用户确认后才编码。**"复述确认"和"等许可"两步不可省。**
- **已批准方案的子任务**：简化为"一句话汇报当前要做什么 → 直接执行"，无需重走五步。

### 闸 2：先研究后协作（硬门）

接到需求先查项目参考，再搜外部，不要直接自己实现。搜索优先级：
1. Claude Code 源码 `_reference/framework-harness/repos/claude-code-sourcemap-main/`
2. Alice 方法论 `_reference/framework-harness/`
3. GitHub / npm / 社区方案 → 最后才自研

自己实现前必须说明：**搜了什么、为什么现有方案不适用**。
**豁免**（一句话说明理由即可）：行业标准库常规集成、纯 UI 或 <3 文件小改动、已批准方案指定了实现方式的子任务。

### 闸 3：完成前按序验证

声称"已完成 / 已修复"前**必须按顺序**执行，即使用户一直说"继续"也不能跳过第 1 步：
1. **自审**（对照 `agent-skills/code-review.md` 清单，跳过了 Phase 6 就在此补做）
2. 运行测试并展示通过结果
3. 确认 build 通过
4. 确认无新增 linter 报错
5. **文档收工**：用户可见能力或横切行为变了 → 同轮更新对应模块卡「已落地能力」；必要时 changelog / progress「人读摘要」。Cursor `stop` hook（`.cursor/hooks/`）会在产品代码有改、模块卡未动时提醒。

禁止未经验证就说"已完成""已修复"。

---

## agent-skills（规则技能库）

**是什么**：与 `docs/` 四维并列的**协作 SOP**——低频、场景化的详细规范。不回答「产品/架构是什么」，回答「这类活怎么干」。目录在仓库根下 `agent-skills/`（不在 `docs/` 内）。

**何时读（注入时机）**：

1. 任务匹配下表任一场景 → **动手前先 Read 对应文件**，再改代码
2. 完成前验证 → 必读 `code-review.md` 做自审（见上方闸 3）
3. 正文硬约束（安全、分层、IPC、Git 门控等）**始终生效**，不必等索引触发
4. 小改（typo / 单文件少量）可不读技能文件，但仍遵守硬约束

**不要**每轮把 `agent-skills/` 全部读进上下文；按场景点读即可。

### 场景规则索引

| 场景 | 读取文件 |
|------|----------|
| TypeScript / 主进程 / 工具系统开发 | `agent-skills/typescript-guidelines.md` |
| React / CSS / UI 改动 | `agent-skills/frontend-guidelines.md` |
| Bug 修复 / 调试 | `agent-skills/debug-guide.md` |
| 代码审查 / 自审 | `agent-skills/code-review.md` |
| Git / commit / push / PR | `agent-skills/git-workflow.md` |
| 部署 / 打包 / 发版 | `agent-skills/deploy-checklist.md` |
| LLM Provider / 模型配置 / 上下文压缩 | `agent-skills/model-config.md` |
| 安全 / 密钥 / 权限 / 沙箱 | `agent-skills/security-checklist.md` |
| 写文档 / 文章 / README | `agent-skills/writing-style.md` |
| `methodology/` 方法论沉淀 | `agent-skills/methodology-writing.md` |

## 工作方式

- 用户明确要求修改时直接推进；需求含糊或风险较高时先问清楚。
- 新增功能前搜索项目内已有实现，避免重复造轮子（冗余搜索策略见 `agent-skills/typescript-guidelines.md`）。
- 复杂功能优先查项目参考资料：`_reference/framework-harness/`、Alice 方法论、项目 `docs/`，再考虑 GitHub/npm 或自研。
- UI 视觉与交互采用两阶段流程：先在产品内 Playground 建立并确认 Alice 对齐的设计基线，再回流 Chat / 设置 / 人物世界等正式页面，最后才做能力的渐进披露。
- Playground 是组件与页面组合态的设计实验室，不是生产数据浏览器或最终产品 IA；不得借展厅新增 Alice 专属模块、复制生产资产目录或把临时展示入口写死到产品壳层。
- 新 UI 先建 Playground 故事格：优先复用正式组件，至少覆盖默认态与一个边缘态；经确认的 token、间距、层级、文案和交互规则再回流正式页，形态变化须同轮更新故事格。
- 所有响应用**简体中文**，技术术语保留英文原文；重要信息可加粗。
- 长对话（>10 轮）关键操作前先复述当前目标；发现自己重复、偷懒或模糊化时主动建议开新会话。

## 前端验收

涉及 UI 的改动尽量用浏览器或截图检查：深色/浅色主题、文本溢出遮挡错位、主要交互是否真实可操作（不只是元素存在）。

### Playground 基线门

- Playground 先验收设计语言，再验收正式页面：设计系统 / UI 控件故事格用于 token 与单组件状态，页面基线用于 Chat、Primary Sidebar、Right Dock、人物世界、设置等组合态。
- 页面基线故事格必须使用正式组件或正式 class；禁止复制一套仅供展厅使用的皮肤。真实数据、LLM、会话写盘和设置保存默认隔离，展厅交互不得产生产品副作用。
- 第一阶段只确认视觉与交互基线（布局、密度、颜色语义、圆角、动效、状态、文案）；第二阶段才按用户旅程把能力分为始终可见、场景出现、开发者可见三层。
- 用户确认前不得以 Playground 试验结果直接重排正式产品 IA；用户确认后，正式页面与故事格必须同轮更新并按截图验收。

## 收尾沉淀

**契约变了才更新对应文档**（不机械全更）。真相冲突时：代码行为 > 模块卡现状 > architecture > methodology 愿景。

| 变了什么 | 更新 |
|----------|------|
| 模块边界 / 入口 / 不变量 / 必测 / 现状缺口 | 对应 `docs/modules/<名>.md`（必更） |
| 新增大产品能力且会反复改 | `docs/modules/README.md` + 新建模块卡（须有实质边界，禁止空壳/重定向卡） |
| 能力增删或行为变更（「有什么」） | 对应模块卡「已落地能力」节（同轮） |
| 模块合并 / 废弃 | 删旧卡；导览改指存活卡；勿留重定向文件 |
| 分层 / 主数据流 / 目录边界 | `docs/architecture.md` |
| 质量门禁或 Eval 分层策略 | `docs/quality.md` |
| 施工合同状态（进行中↔已落地） | `docs/requirements/README.md`（必要时改对应文首状态） |
| 项目阶段 / 下一步 | `docs/progress.md`（对内，状态变化必更新） |
| 用户可见能力或修复 | `docs/changelog.md`（对外） |
| 暂缓 / 缺口 / 灵感 | `docs/wishlist.md`（见下方硬约束） |
| 技术取舍 | `docs/decisions.md`（账本，一条即可） |
| 新坑 | `docs/pitfalls.md`（账本） |
| 规则问题 | `docs/rules-feedback.md`（账本） |

已归档（勿再当权威源，见 `_archive/docs-legacy/`）：features / api-contracts / testing / eval-design / glossary / 曾用的总 `capability-catalog`——**「有什么」改查各模块卡「已落地能力」**。类型以 `src/shared/types.ts` 为准；IPC 仍遵守「四处同步」硬约束。

### wishlist 同步（硬约束，防遗忘）

识别到以下任一情况时，**必须在当轮把条目写进 `docs/wishlist.md`「待办缺口」**（可与灵感区分开写），不得只口头说过或只写在方法论暂缓段：

1. 方法论/深啃留下的**暂缓、占位、工程债**（本轮不做）
2. Gap 审计或 code review 里**确认要做但未排期**的项
3. 产品灵感 / 外部参考启发（可放「灵感」节）

同步纪律：

- 条目用 `- [ ]` 一行描述 + 可选来源/对应章节编号（如 M07 G9）
- **按顺序推进**时以 `methodology/README.md` 待补队列为准；wishlist 是防丢的旁路账本，不是第二套编号路线图
- 项被完成或明确取消 → 在 wishlist 勾掉或删除，并在 `progress.md` 留痕
- 收尾自检：若本轮新增了「以后再说」，问自己 wishlist 里有没有对应行

## 规则自进化

遇到规则不合理、冲突、缺失或过时时：

1. 立即记录到 `docs/rules-feedback.md`（一行描述 + 建议改动）
2. 累计 3 条反馈后主动建议修订规则
3. 用户确认后批量更新本文档和相关 agent-skills 文件

## 工具入口

- `AGENTS.md` 保存完整共享规则，是唯一权威规则源。
- `CLAUDE.md` 只保留 `@AGENTS.md` 和必要的 Claude 专属差异。
- `.cursor/rules/core.mdc` 只保留 Cursor 专属入口或差异，不复制公共规则正文。
- `.cursor/` 旧规则已归档至 `_archive/cursor-legacy/`，仅作历史参考。
