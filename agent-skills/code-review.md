# Code Review — My Agent 项目审查协议

## 使用场景

当用户请求代码审查、Review PR、检查安全性/质量/最佳实践，或完成功能准备提交时使用。

这不是“把代码读一遍然后说没问题”的清单，而是一套**基于证据、沿调用链、主动寻找绕过路径**的审查协议。审查结论必须能回答：

1. 这段代码的真实边界是什么？
2. 谁能控制输入？输入经过了哪些信任边界？
3. 代码是否真的在生产调用链上生效？
4. 失败、绕过、重试、重启和资源耗尽时会怎样？
5. 哪些结论已经被测试证明，哪些只是推断？

---

## 一、审查等级

先判断本次审查等级，避免小改动和高风险改动使用同一套成本：

| 等级 | 适用场景 | 最低要求 |
|---|---|---|
| L0 快速检查 | typo、单文件少量改动、无行为变化 | diff、调用点、类型/格式检查 |
| L1 变更审查 | 普通功能、跨文件修复、UI/业务逻辑 | 完整调用链、正反例测试、类型检查 |
| L2 安全审查 | IPC、凭据、权限、路径、Shell、网络、MCP、Prompt/外部内容 | L1 + 攻击面矩阵 + 绕过测试 + 资源上限检查 |
| L3 发布审查 | 主进程/打包/数据库迁移/大范围重构/安全审计 | L2 + 全部门禁 + 文档收工 + Git 状态复核 |

如果任务同时满足多个等级，按最高等级执行。无法判断时按更高等级处理。

---

## 二、事实优先级与审查前准备

### 2.1 事实优先级

发生冲突时按以下顺序判断：

1. **当前生产代码行为**；
2. 当前测试、Eval、构建和运行证据；
3. 模块卡、施工合同和架构文档；
4. methodology 理念或历史记录；
5. 个人猜测。

旧文档中的“已完成”“暂缓”“当前没有”不能直接当作事实。必须回到定义、调用方、执行边界和测试确认。

### 2.2 审查前必须完成

- [ ] 读取当前 `git status --short`，识别本轮无关存量修改；不得 reset、checkout 或覆盖用户改动。
- [ ] 确认审查范围、用户目标和不碰的边界。
- [ ] 找到功能的定义、所有调用方、最终执行点、持久化点、日志/事件点和测试。
- [ ] 涉及模块时先读对应 `docs/modules/<name>.md`；涉及安全时读 `agent-skills/security-checklist.md`。
- [ ] 若是复杂功能，确认对应施工合同、架构和必测点是否存在。
- [ ] 先查项目内参考实现/方法论，再做新判断；不要只凭记忆审查。
- [ ] 同一路径连续失败两次必须切换研究/验证路径，不能第三次盲试；发现需求越界时要明确报告并停止扩 scope。
- [ ] 新增复杂需求若缺施工合同或用户确认，不得以 Code Review 名义直接改实现；先补合同/复述边界。

### 2.3 四步追踪法

对每个重要函数或接口，按以下顺序追踪：

```text
定义 / 类型
  → 调用方 / IPC 入口
    → 中间件 / 权限 / 配置装配
      → 实际执行 / 持久化 / 日志 / Renderer 反馈
```

如果只找到了定义，没有找到调用方或测试，结论必须标为“证据不足”，不能说已覆盖。

---

## 三、差异审查：不要只看新增代码

### 3.1 先看变更意图

逐个文件回答：

- 这个改动解决的根因是什么？
- 它改变了哪个不变量、权限边界、数据契约或用户行为？
- 有没有只修了一个入口，其他入口仍走旧逻辑？
- 有没有把生产事实复制到 Playground、测试夹具或 Debug 文案中，造成第二事实源？

### 3.2 再看调用链回归

重点搜索：

```text
谁调用了这个函数？
谁绕过了这个函数？
是否存在旧入口、fallback、动态 import、恢复路径、Headless 路径或 Debug 路径？
```

常见漏网入口：

- UI IPC 与后台/启动恢复使用了不同校验；
- Chat、Playground、Debug、Scheduler 各自拼 LLM 配置；
- 权限预检使用静态 metadata，但实际执行使用动态 metadata；
- 主会话绑定了 `ToolContext.workdir`，子 Agent 或文件 middleware 没绑定；
- 手动连接做了确认，启动恢复却静默执行；
- Renderer 展示为“已确认”，主进程却没有重新验证。

### 3.3 审查生产真相边界

- Prompt 正文必须来自生产 Prompt/Role Pack 资产，不能只在 Playground 复制。
- Debug 只能展示生产事实，不能伪造“当前状态”。
- Playground 默认隔离真实会话、设置、LLM、工具和持久化副作用。
- 注册表只能是索引/证据层，不能变成运行配置的第二事实源。

---

## 四、安全审查攻击面矩阵（L2 必做）

### 4.1 IPC / Electron / Renderer

- [ ] `ipcMain.handle` 的每个参数都有运行时类型、长度、数量和枚举校验。
- [ ] 敏感操作由主进程重新确认，不能只信 Renderer 的 `confirmRisk`、checkbox、`isApproved` 或 UI 状态。
- [ ] `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true` 和 preload 白名单保持有效。
- [ ] 外部导航不能继承 preload；外链交给系统浏览器，并校验协议、凭据和 URL。
- [ ] 事件只发给正确的 `event.sender`，广播检查窗口生命周期。
- [ ] IPC 契约修改同步四处：`src/shared/types.ts`、preload、主进程 handler、`src/vite-env.d.ts`。

特别检查：`settings:get` 不得把解密后的 API Key、密码、token、MCP env 或其他长期凭据返回 Renderer。需要测试“已配置但原文为空”的安全视图。

### 4.2 凭据、敏感数据与日志

- [ ] API Key、token、密码、MCP env 使用环境变量或 Electron `safeStorage`，不硬编码。
- [ ] 新密文解密失败 fail-closed；旧明文/旧密文迁移不能把损坏内容当凭据继续使用。
- [ ] 导入、导出、备份、Debug、Trace、Task、错误和子 Agent 日志都检查敏感字段。
- [ ] 错误只返回用户友好信息；日志只能保留必要的类型、长度、hash 或结构证据。
- [ ] “脱敏视图”不能被 Renderer 回传后覆盖真实 secret；哨兵值必须由主进程恢复，无法恢复就拒绝。

### 4.3 工具权限与执行边界

- [ ] `isReadOnly`、`isDestructive`、`isConcurrencySafe` 等 metadata 是否可能随参数变化？
- [ ] 动态 metadata 是否在权限预检、Debug 预检、并发调度、Headless 和实际执行中统一解析？
- [ ] metadata 解析失败是否 fail-closed，而不是默认为只读/可并发/非破坏性？
- [ ] 子 Agent 权限只降不升，工具集不能超出父级；`continue_task` 不能假设旧实例只读。
- [ ] Headless/Scheduler 无交互时只自动批准明确只读工具。
- [ ] 用户确认只表示同意，不得绕过危险命令、路径边界、沙箱或资源限制。

### 4.4 文件、路径、Shell、Git、子进程

- [ ] 路径做 `realpath`、工作区边界和 symlink 检查；读取、写入、删除、打开外部文件不能各写一套守卫。
- [ ] 子 Agent、middleware、Terminal、Git 和文件工具使用 `ToolContext.workdir`，不能悄悄退回主进程 `cwd`。
- [ ] Shell 控制符、命令替换、环境变量展开、`~`、`--output=` 等 option injection 都有负例。
- [ ] safe-command 白名单按完整命令/参数判断，不能只看首词（例如 `find -delete`、`prettier --write`、`npm audit fix`）。
- [ ] Windows 大小写、PowerShell、危险 Git 子命令和 full-access bypass-immune 规则有回归测试。
- [ ] `git` ref、branch、path、count、author 等参数防 option injection，并使用 `--` 终止选项解析。
- [ ] full-access 也不得永久删除文件系统根、当前工作区根或 `.git`。
- [ ] 子进程环境不继承主进程 API Key/Token/Secret；超时、输出和派生进程有上限。

已知低层边界（如 Shell 解释器语义、symlink TOCTOU）必须如实披露，但先检查 `docs/decisions.md` 和模块卡：若已被 DEC-037 等决策明确接受，就不能反复写成 wishlist 欠债；只有威胁模型或触发条件变化时才重新立项。

### 4.5 网络、URL、MCP 与外部内容

- [ ] URL 使用 `new URL()` 解析，拒绝危险协议、凭据 URL、loopback/private/link-local/metadata 地址和不受控重定向。
- [ ] 响应体、重定向次数、超时、MCP server 数量、参数、env 和 schema 有上限。
- [ ] MCP stdio/SSE 连接、保存启用配置和启动恢复都经过主进程确认/校验。
- [ ] MCP 外部工具描述、网页、文件、RAG、命令输出和 Tool Result 都当作不受信任数据。
- [ ] Prompt Injection 防线只改变发给模型的安全包装，不篡改 UI 原始结果；启发式不能宣称是完整分类器。
- [ ] 外部工具描述/schema 不能无限注入模型上下文；超限应截断或 fail-closed。

### 4.6 资源耗尽与数据完整性

- [ ] Prompt、消息、history、图片、文件、Diff、RAG、正则、工具结果、报告和 JSON 都有长度/数量/深度上限。
- [ ] 算法复杂度已估算：LCS/正则/排序/嵌套 JSON 不能因输入放大到内存或 CPU DoS。
- [ ] SQLite 使用参数化查询；迁移幂等；导入事务不会写入半成品。
- [ ] 备份 schema 与真实数据库 schema 一致，导入不能扩大权限、工作区或自动执行入口。
- [ ] 崩溃恢复、重试、取消和通知幂等不重复执行副作用。

### 4.7 Agent、LLM、记忆与产品资产

安全边界之外，还要检查横向功能是否仍遵守产品不变量：

- [ ] LLM 配置只通过 `loadMainLLMConfig` / `loadAuxLLMConfig` 装配；Provider、thinking、aux model、failover、timeout 和 token lane 没有在调用点漂移。
- [ ] Agent Loop 的消息配对、工具调用/结果配对、终止原因、压缩重试和 413 降级保持一致；不能只修 UI 流程而破坏持久化或后台善后。
- [ ] 上下文压缩保留关系最小集、系统约束、工具边界和必要状态；压缩摘要不能无意升级为长期记忆。
- [ ] Memory 的 SQLite / 向量双写、角色分桶、敏感信息、画像提取和纠错路径一致；自动提取不能“模型说了就记”。
- [ ] TaskQueue / Scheduler / Headless 具备恢复、取消、重试、通知幂等和无交互安全策略；后台任务不能绕过主对话权限。
- [ ] Prompt、Skill、Role Pack、Provider、Permission/Sandbox、Tool、Eval 等生产资产有稳定 key、来源、版本和实际运行证据；动态资产不能伪造静态正文；画像提取、记忆提取、压缩和辅助任务 Prompt 不能漏出资产链路。
- [ ] 生产 UI 文案和 Prompt 正文以简体中文为主；英文只保留技术术语、协议 token、代码、字段和用户明确要求的内容；locale 结构不能把中英韩等语言混成一份不可维护正文。
- [ ] Debug 展示生产真相；Playground 实验隔离，不写真实会话、设置、LLM、工具或生产资产。
- [ ] UI 改动检查默认、加载、空、错误、禁用、超长、窄窗口、深色/浅色和重复点击状态；交互必须真的可操作，不能只检查 DOM 存在。
- [ ] UI 入口、Renderer IPC、主进程 handler、持久化和事件回传的行为一致，不能只修一个视觉层。

### 4.8 Skill、伙伴与用户扩展边界

- [ ] 用户 Skill 的 frontmatter 使用纯数据解析器，不执行 YAML tag、JavaScript、模板或任意代码；名称、正文、版本目录和回滚路径有边界。
- [ ] Skill 的 `allowed_tools` 只能缩小/描述能力，不能绕过 PermissionEngine、沙箱、Headless 或主进程确认。
- [ ] 内置 Skill、用户 Skill、MCP、Role Pack 和生产资产的来源、优先级、版本和覆盖关系明确；热加载/删除/回滚不会留下旧工具或旧 Prompt。
- [ ] Companion 的 `roleId`、active role、universe、protected/mutable、资产和反馈记忆有隔离；跨角色读取/写入必须是明确产品行为并有 `expectedRoleId` 或等价守卫。
- [ ] 自动反思、画像提取、Moment、成长和定时主动行为有频率/消息数/费用/敏感信息门闸；后台自动写入不能篡改 PROTECTED 或把外部内容升级为事实。

---

## 五、测试策略：必须证明“能绕过时也绕不过”

### 5.1 每个修复至少有一组反证测试

测试不应只验证“正常输入成功”，至少补一项：

- 类型错误、空值、超长、超数量、重复 ID；
- 路径穿越、symlink、越界 cwd、option injection；
- 大小写、Shell 控制符、命令替换、PowerShell；
- Renderer 伪造确认、伪造只读 metadata、脱敏哨兵缺少旧值；
- 网络重定向、私网地址、凭据 URL、超大响应；
- 重启/恢复、取消、重试、并发和重复通知；
- Prompt Injection、恶意 MCP 描述/结果、损坏密文。

### 5.2 测试类型选择

| 问题 | 首选测试 |
|---|---|
| 纯函数、解析、边界 | Unit |
| Agent 行为、工具序列、Prompt 约束 | Mock Eval |
| Skill 触发与约束 | Skill Eval |
| 页面导航、组件状态、IPC 入口 | UI E2E |
| 主进程真实打包/窗口/preload | Electron E2E（显式启用） |
| Provider/SSE 解析 | 本地 fixture/replay；不能用手写内部对象替代边界 |
| UI 视觉/交互/响应式 | 真实页面 UI E2E + 截图/主题/窄窗口检查；不能只断言元素存在 |
| Prompt/Skill/资产注册 | 注册表纯函数测试 + 真实调用覆盖 + Debug 来源/版本/指纹检查 |

禁止把 UI 冒烟 E2E 描述成真实 Agent 对话质量验证。禁止为方便而 mock 掉正在审查的安全边界。

### 5.3 真实模型与凭据

默认不运行真人格 Eval、真实付费调用或真实 API Key 测试。只有用户明确授权并完成费用/隐私确认时才可运行；否则使用本地 Mock、fixture、纯函数和结构测试。

---

## 六、正确性、架构与可维护性

### 正确性

- [ ] 正常路径、失败路径、取消路径、重试路径和恢复路径行为一致。
- [ ] 错误不会吞掉真实状态；空 `catch` 必须有明确的边界注释和可观测记录。
- [ ] 生产入口与 fallback/旧入口行为一致，不能只修新路径。
- [ ] 类型、运行时校验和持久化 schema 三者一致。
- [ ] 关键状态转移先落盘再广播；失败不会写入半截 assistant/记忆/任务。

### 分层与依赖

- [ ] 遵守 `ipc → agent → llm` 及 storage/tools/memory 的依赖方向。
- [ ] LLM 配置只走 `loadMainLLMConfig` / `loadAuxLLMConfig`；调用点不手拼 apiKey/baseUrl/model。
- [ ] 工具与内部服务分离；进入对话历史并可被模型调用的才是工具。
- [ ] Prompt/Skill/Provider/Permission 等生产资产有稳定 key、来源、版本和真实运行关联。

### 可维护性

- [ ] 新增非平凡函数有背景、设计意图和关键约束注释。
- [ ] 没有重复事实源、复制实现或为了方便试验而复制生产 Prompt。
- [ ] 函数超过约 50 行、文件超过约 800 行只视为复杂度信号，不是自动违规；需要说明拆分取舍。
- [ ] 新增 TODO/FIXME/HACK 必须说明原因、边界和是否同步到 wishlist。
- [ ] 删除代码前说明原因；删除或改变决策注释时必须同步更新。
- [ ] 改动涉及用户可见能力、模块边界、质量门禁或安全不变量时，同轮更新对应文档。

### 文档、合同与规则收工

- [ ] 跨 3 个以上文件、架构变化或复杂功能先有施工合同；实施状态与代码事实一致。
- [ ] 模块边界/入口/不变量/必测变化 → 更新对应模块卡；用户可见行为 → 更新 `docs/changelog.md`；阶段变化 → 更新 `docs/progress.md`。
- [ ] 技术取舍 → `docs/decisions.md`；新坑 → `docs/pitfalls.md`；规则冲突/缺失 → `docs/rules-feedback.md`。
- [ ] 暂缓、工程债、审计确认但未排期的事项 → `docs/wishlist.md`；明确取消/不做的事项应勾掉并在 `docs/decisions.md` 记录理由与重启条件，不能继续伪装成待办。
- [ ] 方法论中的历史快照必须明确标注日期/历史性质；当前测试数量和能力不能引用过时数字。

---

## 七、审查完成门禁

### L0/L1

- [ ] `git diff --check`
- [ ] 相关 Unit / Eval / E2E 通过
- [ ] `npx tsc --noEmit` 通过
- [ ] 如果改了 `package.json` / lockfile / 构建配置：依赖锁定、安装脚本和产物入口经过审查
- [ ] 没有新增 lint/build 错误

### L2/L3

按项目规则依次执行：

```text
git diff --check
npm run test
npm run eval:run
npm run eval:skill
npx tsc --noEmit
npm run build
npm run test:e2e
npm audit --registry=https://registry.npmjs.org
npm audit --omit=dev --registry=https://registry.npmjs.org
```

不运行 `npm run eval:persona`，除非用户明确授权真实模型、费用和隐私风险。

完成前还要：

- [ ] 检查 `git status --short`，确认没有误加入 `.env`、凭据、报告、`dist` 或临时目录。
- [ ] 精确 `git add <文件列表>`，不要使用 `git add .`。
- [ ] 暂存后再次运行 `git diff --cached --check`，确认没有凭据、`.env`、临时目录、报告或无关改动。
- [ ] 若有依赖变更，检查 lockfile、npm lifecycle script、依赖来源和 `npm audit` 结果，不用未经验证的 `overrides` 掩盖漏洞。
- [ ] 测试失败、构建警告或剩余缺口不能用“基本没问题”掩盖。
- [ ] 高风险暂缓项写入 `docs/wishlist.md`；已决策接受的剩余风险引用对应 DEC，不重复创建待办；用户可见能力变化同步模块卡/`docs/changelog.md`。
- [ ] 项目规则要求推送时，commit 成功后立即 `git push`，并确认本地 HEAD 与远端分支一致。

---

## 八、输出模板

审查结果按严重程度排序，先问题后摘要。每条问题必须包含：

```text
[必须修复 / P0-P1]
标题：一句话说明风险
位置：绝对文件路径 + 行号/函数
证据：调用链、测试或代码事实
影响：攻击者/错误输入/故障如何触发
修复：最小完整修复方案
验证：应新增或已运行的测试命令
```

严重度建议：

- **P0 必须立即阻断**：凭据泄露、远程代码执行、权限绕过、数据破坏、生产构建不可用。
- **P1 本轮必须修复**：高概率安全漏洞、核心功能错误、数据完整性破坏、无界资源 DoS。
- **P2 应修复或明确排期**：中等风险、可观测性缺口、边界行为回归；未做要进 wishlist。
- **P3 建议改进**：可维护性、性能或体验优化，不阻塞提交。

无问题时也必须写明：

- 审查范围和证据；
- 已排除的主要攻击面；
- 未覆盖/暂缓边界；
- 运行过的验证命令和结果。

禁止只输出“LGTM”“看起来没问题”或“测试通过所以安全”。

---

## 九、项目特有反模式速查

发现以下模式时，默认提高审查等级并追完整调用链：

- `settings.getAllSettings()` 直接返回 Renderer；
- Renderer 传 `confirmRisk: true`、`isReadOnly: true` 就决定主进程权限；
- 只在静态工具 metadata 上判断权限，忽略 `resolveMetadata(args)`；
- `process.cwd()` 代替 `ToolContext.workdir`；
- 用命令首词判定 Shell 安全；
- Git 参数未使用 `--` 或未校验 ref/branch/path；
- `img-src https:`、远程 `loadURL`、外部页面继承 preload；
- Markdown、网页、文件、MCP 描述/结果被拼成系统指令；
- `safeStorage` 解密失败回退原字符串；
- 备份 SQL/字段名与真实 schema 不一致；
- LCS/正则/JSON/报告/Terminal 输出没有资源上限；
- 把历史测试数字或历史实现当作当前事实；
- 只改代码不改模块卡、质量文档、审计报告或 wishlist。

## 输出原则

问题优先，证据优先，明确风险等级，明确验证结果；不确定的判断标记 `[待确认]`，不要默默假设。审查结论必须区分“已验证”“推断”“暂缓”。
