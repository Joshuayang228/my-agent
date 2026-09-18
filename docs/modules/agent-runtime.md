# Agent 运行时

MCP 已启用配置由主进程启动恢复，连接失败不阻塞窗口；意外断开保持活动快照为可恢复失败，设置页跟随 `mcp:status-changed` 显示重试，自动重连与工具许可仍受活动连接、Registry 和执行前校验共同约束。
## 一句话

对话主循环、Prompt 组装、上下文压缩、任务队列与可观测——聊天能跑起来的横切骨架。

## 边界

**做**：Agent Loop（流式事件 / 工具超时 / 重试）、会话 Runtime 中心化、System Prompt 四层组装、上下文压缩、后台任务队列、子 Agent、MCP Client、多 Provider LLM、模型连接 / 用途路由 / 主进程模型发现、Headless、Observer/DevPanel。MCP 工具许可由配置、活动连接、Registry 注册和执行前调用共同约束；模型连接密钥由主进程解密装配，Renderer 与备份只接触脱敏结构。
**不做**：伙伴生活世界语义（见 companion）；结构化记忆库本身（见 memory）；权限策略语义（见 permission）。

## 短 Why

产品横切叠在运行时之上；没有稳定 Loop / Prompt / 压缩，伙伴与记忆无处挂载。

## 主入口

| 类型 | 位置 |
|------|------|
| 运行时 | `agent/runtime.ts` · `agent/loop.ts` |
| Prompt | `agent/prompt-builder.ts` · `prompts/registry.ts` · `prompts/texts.ts` |
| 压缩 | `agent/context-manager.ts` |
| 队列 | `services/task-queue.ts` |
| UI 调试 | DevPanel（Debug）· PlaygroundPage |
| 分层说明 | [`../architecture.md`](../architecture.md) |

## 依赖

- **依赖**：llm、tools、storage、sandbox（执行前）、companion/memory（组装时注入）
- **被依赖**：Chat IPC、召唤/反思后台任务、Eval 框架场景；人物世界生活资产增改删和朋友圈用户赞评走 companion IPC，不进入 Loop。

## 不变量

- `chat:send` 只传本轮用户消息；历史由 session-store 加载
- 工具执行前走权限引擎（见 permission）
- 权限决策与工具执行的运行证据统一使用 `ToolContext.sessionId` 记录会话归属；Loop 不从不存在的顶层会话字段读取，避免 workspace/runtime 证据丢失或串会话。
- 主 Assemble 只在 `prompt-builder`；辅助 Prompt 不得再走一套平行组装器冒充主路径
- Loop 的 `done` 必须保留真实 `TerminalReason` 且只发一次；只有 `completed` 才保存完整 assistant、启动后台善后和成功通知
- Runtime 从配置初始化到生成器退出持续持有会话锁，abort 只发信号；session:delete 必须等待 chat IPC 的完整收尾，再删除记录，不能以 done 或 abort 回执判断存储已无写入。

## 必读文件

- `electron/main/agent/runtime.ts`
- `electron/main/agent/loop.ts`
- `electron/main/agent/prompt-builder.ts`
- `electron/main/agent/context-manager.ts`
- `electron/main/services/task-queue.ts`
- `docs/architecture.md`

## 必测点

- Loop 流式事件与工具超时
- Runtime 中心化（乐观 UI + done 后 session 对齐）
- 相关单测：`agent-loop`、`task-queue`、`observer` 等
- 开发者模式：正式关于页与候选共用 `AboutSettingsContent`；Electron 独立目录覆盖开关、入口隐藏与完整重启恢复。UI E2E 的 `ui-e2e` 模式显式保留开发入口，不能当作正式默认

## 已落地能力

- 模型用途安排已从候选回流为共享 `ModelUsageArrangements`：正式页与 Playground 使用同一行密度、分隔、启停语义与固定排序 / 移除操作槽；选择和按钮由 Foundation 提供。组件只接收 props，正式保持真实整组保存与失败保留，候选仅修改内存。四主题宽窄与长标签、hover / pending 几何、排序 / 启停 / 移除和失败恢复有 UI 回归；符号级门禁验证两处调用和基础依赖，不接受未使用 import 或同名遮蔽。生图 / 图片理解语义差异仍未解决，不因布局共享宣称模型整页完成。

- 用途优先级已进入真实调用：主 / 辅助 / 图片理解配置工厂按同用途顺序装配首选与备用，过滤停用项和缺失引用并去重，每项保留独立端点、Key 和协议。独立用途不继承主用途备用池，辅助 thinking 按目标计算，一次性连接覆盖不继承保存的备用链。就绪检查允许使用已配置备用；每次请求单独认证，远程缺 Key 不发送请求。取消或已输出模型事件后停止切换，避免拼接两次回答。Unit 覆盖装配和中断，独立 Electron 覆盖正式添加 / 排序、完整重启、503 后备用请求及凭据隔离；本地协议测试不代表真实厂商可用性。

- 本机 HTTP(S) 回环上的 OpenAI 兼容连接允许无 Key，统一判断位于 `src/shared/llm-connection-test.ts`；远程、userinfo 和非兼容协议不获豁免。正式测试、发现、Runtime、已有辅助调用与 Playground 真实模型试验共用该判断，不借用全局凭据。设置安全视图由主配置工厂派生 `llmConnectionReady`、`llmEffectiveModel` / `llmEffectiveBaseUrl`，首次启动与聊天顶栏不再只看旧全局 Key / 模型名；就绪不表示端点可达或型号兼容。独立 Electron 目录覆盖正式无 Key 保存、发现、测试、重启后对话及 401 后补 Key 重试。

- 数据库快照替换失败时保留旧文件，不再退回直接复制覆盖；临时写失败统一给出保存失败提示，清理失败记结构化警告。正式模型页另经专用整组保存 IPC，在同一同步段更新连接与路由并一次落盘，失败恢复已写键；密钥先加密，主进程合并串行化。真实 SQLite 故障与完整 Electron 重启覆盖两键一致性，不代表其他设置也具有整组保存语义。

- 正式模型新增 / 编辑与候选共用 ModelConnectionForm，五类来源与预设默认值同源，新增独立卡片、已有连接原位编辑，保留模型清单和用途。source / presetId 随加密连接 JSON 保存，自定义 provider 经共享类型与校验进入真实测试链；更换端点 / 协议不复用旧 Key，同连接改名可保留。四主题宽窄 UI 与本地 Anthropic 协议 Electron 覆盖保存、重载和真实请求；整页其余卡片及关窗 / 多窗口生命周期仍待完成。
- 模型配置工厂对主 / 辅助 / 图片理解路由整体传递目标连接的端点、模型、密钥与协议；目标连接缺密钥时不借用主连接、全局或环境凭据，未指定协议则按目标地址自动检测。无有效用途路由才整体回退，一次性测试指定端点时需携带自己的凭据 / 协议，或满足本机无 Key 边界。`model-routing` 工厂回归覆盖此边界。
- 正式模型配置的连接保存、删除、模型清单增删启停与用途路由操作，等待整组保存成功再更新可见清单；失败保留编辑草稿并提示，保存期间锁住表单写操作，离页后不回写本地列表。新增 / 已修改连接、非空手动模型输入及保存中状态阻止设置切页、返回和应用导航快捷键；保存、取消或清空输入后可离开，未修改的编辑表单不阻挡。保护不自动持久化草稿凭据，不覆盖关窗 / 崩溃恢复。
- 模型连接测试 / 发现分别按连接持有请求令牌，保存成功后的删除、端点 / 协议 / 密钥及连接启停变化清理旧状态；被测试模型变化仅清理测试，发现列表可连续添加。取消或失败保存保留原结果。迟到成功、业务失败与 IPC 异常均不越过失效令牌回写；卸载清理，IPC 异常显示可重试错误。此为 Renderer 归属保护，不代表底层网络请求已取消。
- 模型连接新增 / 编辑及模型 ID 输入共用 Foundation TextField，用途路由与 MCP 认证选择共用 SelectField；业务校验、测试连接和保存仍由原适配器负责。注册表 Unit 检查真实 JSX 符号及未使用导入 / 同名遮蔽负例，不把共用业务表单等同于全部基础控件已收口。
- 开发者模式同时约束侧栏、顶栏和全局 Debug / Playground 快捷键。快捷键进入前读取实际保存值；从设置页跳转先完成保存，关闭开关后不能利用旧壳层状态进入。读取失败提示并留页，切页后的迟到读取不重新导航；这是产品入口控制，不替代主进程权限检查。
- MCP 替换连接在等待旧客户端关闭前确定归属，每次异步返回核对连接身份；停止立即撤销归属，旧握手或关闭回调不得复活或删除新连接。设置页的状态查询和工具清单使用同代读取，新推送及离页会使旧响应失效；不把迟到的已连接状态覆盖到异常断开卡片上。
- 文件规则已接入 Loop 与 Debug 的真实预检：别名归一后合并工具及文件权限，命中 ask 才签发当次调用的内部确认凭据；无交互或拒绝确认时不执行。Registry 在调用前重新核验，规则或目标变化会使旧确认失效，子调用不能复用另一 callId 的授权。匹配语义和工具范围见 permission 模块，不在运行时复制策略。

- MCP 添加表单由 `settings/McpConnectionForm.tsx` 同时服务正式设置与 Playground，候选仅注入隔离 actions，不再维护重复字段与状态机。测试成功不因阶段切换被清理；取消后保留草稿，旧响应不复活；修改后必须重测，空白名单可保存；保存完成后列表刷新失败仅重试刷新。主进程取消 / 超时、资源接管、并发配置和 Electron 重启恢复的完整证据仍按 R10 继续补齐，不因表单共享宣布整项完成。
- MCP 测试连接现在与正式客户端共用能力协商和 elicitation 处理器，资源清单随同一连接接管；保存结果支持 owner/requestId 有界重放，确认迟到、窗口销毁、导航和渲染进程退出不会重新开放连接。整表 MCP 设置写入、添加向导持久化和工具许可更新共用配置锁，许可只有写盘成功后才更新活动连接。独立 Electron 数据目录验证本地 SDK 测试、保存、SQLite 密文包络、Renderer 凭据哨兵及完整重启后 Bearer 自动认证；OAuth 与第三方服务认证仍是缺口。

- MCP 服务卡片由 `settings/McpServiceCard.tsx` 同时供正式设置与 Playground 使用；服务状态、开关、工具数量、许可与重试不再各自维护 JSX。正式设置订阅 `mcp:status-changed`：意外断开映射为连接失败和重试，缺失快照才是未连接；手动停止仍删除快照。未知工具清单不展示为零，长清单内部滚动，操作期间槽位固定。列表变更在设置页内串行，禁用 / 删除先保存再断开，保存失败不提前断开；许可更新同步本地配置快照，后续启停不覆盖刚修改的许可。OAuth 登录生命周期仍属 R10 未完成部分。

- MCP 生产传输由 `mcp/transport.ts` 统一创建，支持旧 stdio / SSE 和 Streamable HTTP；配置与 connect IPC 共用 `src/shared/types.ts` 的 `McpServerConfig`。可选 Bearer 随 MCP 配置整体加密，Renderer 仅收到哨兵；复用已存令牌要求同 id、同传输、同 URL，换地址需重新提供令牌。带令牌只允许 HTTPS 或回环 HTTP，新 HTTP 传输拒绝自动重定向；手动连接仍由主进程确认，不实现隐式 OAuth。未声明 tools 的服务可连接为零工具；已声明但发现失败仍为错误，不能假装成功。正式添加向导、隔离测试与取消 / 保存生命周期仍属 R10 未完成部分。
- MCP 工具许可由服务配置的 `allowedTools` 字段承载；旧配置未设置时兼容为全部允许。MCP Bridge 注册工具和 `McpClientManager.callTool` 执行前均再次过滤，正式设置通过 `mcp:set-tool-allowed` 更新并持久化；审批规则仍独立负责高风险确认。

- 正式相处说明经 `settings.companionResponseNote` 进入 `buildSystemPrompt` 的独立 L3 区块，主对话和召唤读取，workspace 排除。空值不注入、组装侧再次限长；动态 Prompt key 只登记用户数据来源，不复制正文。该偏好不替代 Role Pack 或工具权限；产品入口与保存契约见伙伴模块卡。

- 差异内容与模式控件由 Foundation `DiffViewer` / `DiffViewControls` 统一提供，基础故事、工作区候选和正式 ReviewPanel 实际引用；底层继续复用 CodeBlock，业务只提供已有 unified/before/after，不重算差异。空字符串是有效稿件，缺稿时统一内容和按钮状态一起回退，避免并排选择导致新文件空白。模式按钮尺寸固定，长文件在所在滚动区阅读；符号绑定 Unit 和正式 Renderer 空稿/缺稿回归保护三层复用。
- 工作区文字恢复和外部打开动作由 Foundation `ActionButton` 提供，正式浏览器、审阅、侧边聊天和 FileBrowser 共用固定高度与语义色；业务回调和真实数据路径不下沉到基础层。
- 工作区固定图标操作由 Foundation `IconButton` 提供，正式文件浏览器刷新/复制/系统打开/关闭、右坞添加入口、审阅刷新/清空、终端运行/终止、侧边聊天发送/停止、候选工作区开关/添加和浏览器刷新均复用同一固定尺寸与无障碍 label；业务回调、菜单焦点和资源边界仍由调用方负责。
- 正式文件浏览器的搜索输入与工作区地址栏、命令控制台、侧边聊天共用 Foundation `TextField`；文件树节点和 HTML 预览/源码切换仍属于业务组合层。
- 文件浏览器 HTML 预览/源码模式选择由 Foundation `SegmentedControl` 提供，业务层只维护当前模式和沙箱内容切换。
- 正式右坞与 Playground 工作区候选的添加工具菜单复用 Foundation `WorkspaceToolMenu`，统一 ArrowUp/Down 循环、Escape、失焦和选择后的触发器焦点恢复；工具列表和实例创建仍由各自业务层提供。

- 共享 Markdown 的代码高亮与 Mermaid 读取真实容器继承的语义主题，支持同屏局部深浅主题，不再只看 html。Prism 主题在共享入口清洗容器白底，内部 token 透明，Diff 新增 / 删除 / 选区高亮保留；Chat、文件预览、审阅、Foundation 故事和工作区候选共用同一 CodeBlock。Mermaid 配置与绘制统一串行，保留 strict 与资源上限；失败显示可读提示和原文，取消或卸载不发布旧结果，测量节点始终释放。四候选主题未因此注册为生产主题，全量通用控件复用和全产品 adopted 仍未完成。

- 受限浏览器由主进程执行 URL/DNS 校验和抓取，Renderer 只接收文档文本放入无脚本 sandbox；每次加载有 sender/requestId 归属，组件卸载会取消未完成请求。它仍不是登录、脚本或任意导航浏览器。
- 正式 workspace 侧聊已通过本地 SSE + 独立数据目录的 Electron 流程：真实项目文件读取、首段流式回复、流中关闭、服务端断连、存储删除和重开正常回复。无长期记忆召回时不再对 undefined 调用 trim；组装异常不会因 span 尚未创建而再次报错。主进程统一取消/等待/删除，删除期间拒绝新发送，工具确认校验窗口并在关闭/销毁时拒绝和清理；初始化阶段可取消且退出前保持运行锁。创建会话失败时重试重新调用 createWorkspace，未创建成功不能发送；父会话变化时整体重建侧聊，正文、草稿、确认和旧发送错误不进入新实例。同父会话切换标签/折叠保留实例；创建失败与旧状态隔离有 Renderer 故障注入回归，切换主会话后的旧流断开/存储删除及新侧聊发送有真实 Electron 证据。

- 原始代码共享渲染：`MarkdownRenderer.tsx` 导出的 `CodeBlock` 接收原文而不进行 Markdown／aside／Mermaid 解释；基础 Markdown／Diff 故事、候选工作区、正式文件代码预览和 ReviewPanel 共用它。代码块主题底色同源、复制保留原文，复制操作槽固定；剪贴板失败可重试。正式五功能菜单顺序已对齐；浏览器是真实受限只读查看器，侧聊真实链路与验收见上条，不再是未接入壳。

- Playground 场景控制器统一为 MCP 风格独立选项；Chat 主旅程/宽度、记忆分类/场景、模型/Skills/MCP、工作区功能/形态/宽度与公共故事选择共享尺寸、间距和主题选中态。动效样张兼容构建压缩的秒单位，统一换算毫秒展示与放慢演示；产品内容标签与正式 UI 不受影响。

- 正式 ChatRightDock 接入 PanelRight 同页折叠保留和 Foundation TabStrip：标签内常驻固定关闭槽、左右/Home/End 切换、Delete 关闭后恢复焦点，关闭后台标签不切换内容或重编号。WorkspaceFilesPanel 提供左树右多预览、去重、关闭重开与异步读取隔离；审阅真实 `before/after` 支持 unified／并排、错误重试和过期结果丢弃。文件与终端切换标签、折叠及设置／Playground 导航时保留，切换项目重建；审阅按 sessionId 重建。终端支持 pending 取消、迟到响应清理与失败重试；主进程校验窗口归属，Windows 使用 taskkill `/t` 回收进程树，终止等到 close 才成功，失败保留记录供重试。握手前输出有界缓存，未握手到期与窗口销毁清理运行；普通大块输出分包且不插入换行，累计上限仍为 2MB 字符。Windows Electron 已验证权限拒绝后重试、2 万字符输出及停止/关闭后的父子进程退出；Unix 进程组尚无实机证据。完整 PTY 已按 2026-09-14 产品决策暂缓，不作为当前工作区回流阻塞项；现阶段正式能力称为 Agent 命令控制台。浏览器是主进程校验 + sandbox/CSP 的受限只读查看器，不支持脚本、登录或任意站内交互；侧聊已接上下文、确认隔离与消息失败重试，真实关闭验证见上条。
- 工作区文件 / 审阅上下文按右坞标签实例保存，侧聊使用最近选中的来源；正式发送载荷回归覆盖文件乱序读取、缓存切换、关闭来源，以及审阅多实例、主会话切换、读取失败、清空失败重试和清空后迟到 diff。浏览器地址栏不重复渲染标签栏已有的图标；地址栏、文件树和侧聊仍共用 Foundation 输入与操作控件。R13 的完整门禁与跨页面采用核验仍在施工中。

- 工作区候选标签默认无描边，各标签内常驻关闭图标，关闭非当前标签保持当前选择；右端仅保留添加入口，收起由 Chat 侧控制。浏览器地址居中可编辑，Enter 校验并切换本地样张，Esc 恢复，未知地址明确显示无样张，不导航外站。

- MCP 添加正式流程已接入独立测试会话：远程 Streamable HTTP / Bearer 与本地 stdio 均先经主进程风险确认和真实发现，再由用户选择工具后保存；未保存连接不进 Registry、不写设置、不自动重连。测试按窗口绑定、30 秒超时、5 分钟保留，取消 / 页面销毁清理，工具发现限制 1000 项 / 2MiB / 100 页；保存失败保留测试结果可重试，保存成功后接管同一连接避免重复启动。正式表单采用 Foundation 输入、分段选择和固定动作槽。候选 17 个场景仍使用隔离夹具，未读写真实生产配置。

- 工作区 Playground 固定为审阅、浏览器、文件、终端、侧边聊天五个入口，共 21 种形态与展开/窄栏切换；不再以任务阶段组织工作区。文件使用正式 FileBrowser 的只读夹具；网页、终端和聊天仅为隔离交互，正式 ChatRightDock 与执行链路未变。 Chat 处理中组合态在对话与工作区之间使用明确分隔线，并在对话右上角提供 PanelRight 开关；收起仅隐藏工作区，保留标签和任务状态。

- Skills 详情候选由一张 SettingCard 包裹，“返回 Skills”图标与文字独占一行，下方名称与启用开关同行；不改变 Skill 状态或生产管理行为。

- MCP Playground 候选：顶部场景 Tab 直达未添加、1/2 服务、连接中、待确认、1/2/3 工具、无工具、已停用、连接失败和待登录。每个服务独立卡片，未知工具数不当作零；确认、启停、取消和重试仅改变隔离夹具。生产 Streamable HTTP / Bearer 已具协议链路，候选仍不调用真实服务；OAuth 与添加向导不能凭夹具认定完成。

- Skills Playground 候选：每个 Skill 独立名称与开关卡片，详情先显示源 `when_to_use` 与 `description`，再显示元信息和完整文件；文件区沿用正式只读页的 48vh 高度上限，内部独立滚动、键盘可达，滚动到底不传递到外层页面。仅选取内置 `code-review`、`content-creator` 的 SKILL.md 作为只读样张，独立启用状态只保存在 Renderer，不修改正式 Skill 管理。

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| Agent Loop（流式事件 · 工具超时 · 重试） | 已落地 | `agent/loop.ts` |
| 人物世界生活资产 IPC | 部分 | `ipc/companion.ts` · `life/assets.ts` · `companion:create-asset` / `update-asset` / `delete-asset`；用户创建白名单由 createAsset 校验，不进入 Loop |
| 生活资产备份 IPC | 已落地 | `ipc/data-export.ts` · `data:export` / `data:import`；覆盖 `companion_assets` 与 `companion_asset_seeds`，按 id / 播种键合并，会话与资产同一事务失败回滚。旧备份缺字段仍可导入。记忆继续走 `memoryStore.addMemory`，不进入 Loop |
| 会话 Runtime 中心化（chat:send 只传本轮） | 已落地 | `agent/runtime.ts` · `ipc/chat` |
| TerminalReason 终态传递与 Runtime 去重 | 已落地 | `agent/loop.ts` · `agent/runtime.ts` · `runtime-terminal-reason.test.ts` |
| System Prompt 四层组装 | 已落地 | `prompt-builder.ts` |
| 自有模型提示词统一中文 + 自动语言门禁 | 已落地 | 主 Assemble / 压缩 / 画像 / 子 Agent / 内置工具 schema；`prompt-language.test.ts` |
| 上下文压缩 L1–L4 | 已落地 | `context-manager` |
| 任务队列（后处理 / 反思等） | 已落地 | `services/task-queue` 等 |
| 子 Agent | 部分 | `subagent`；召唤下任务工边界（M26-G2）；Swarm 见 wishlist |
| SubAgent 角色生产资产 | 已落地 | `agent/subagent-asset-registry.ts`；Debug 资产目录登记三个内置角色，真实运行通过 `subagent-role` usage evidence 关联 |
| MCP Client（stdio / SSE / Streamable HTTP） | 协议与异常断开 UI 已落地，OAuth 待回流 | `mcp/` · 设置页 |
| 多 Provider LLM + Failover | 已落地 | `llm/`；OpenAI Compatible / Anthropic / Gemini；配置唯一经 `loadMainLLMConfig` / `loadAuxLLMConfig` |
| Provider 能力生产资产 | 已落地 | `provider-presets.ts` 唯一预设源；依据 Alice 本地 Provider 清单登记海外直连、国内服务商、编程套餐、聚合与代理、本地 / 自定义五组共 24 个 Provider 入口；模型 ID 不写入入口预设，由用户按账户实际可用列表填写；`provider-asset-registry.ts` 派生 Provider 资产，Debug「提示词管理器 → 模型 Provider」只读展示；ListenHub / CLIProxy 不冒充普通聊天入口 |
| 首次模型配置旅程 | 已落地 | 无 Key 自动进入设置「模型」；Provider / Key / Base URL / 模型修改后防抖自动保存，当前配置可独立测试连接；未修改 API Key 不会用空值覆盖安全存储 |
| 设置离开保存门控 | 已落地 | 返回按钮与全局离开快捷键共用 SettingsPanel 增量保存队列；保存失败留页并保留草稿，成功才切页或新建会话，并刷新外层模型 / 伙伴 / 开发者模式状态；处理中重复快捷键不重复执行。不涵盖窗口强制退出及独立编辑器草稿 |
| 正式模型发现 | 已落地 | `settings:fetch-models` 只走主进程；OpenAI Compatible / Anthropic 读 `/v1/models`，Gemini 明确不支持。无 Key 不发请求；已存 Key 按 `connectionId` 注入，草稿 Key 不读已存密钥。成功列表点选后才写入连接清单，手动添加去重；有清单时路由只选已启用模型 |
| Headless 运行（定时/后台） | 已落地 | `runtime.runHeadless`；无交互时只自动批准明确只读工具 |
| Observer / DevPanel 可观测 | 已落地 | tracer / observer / DevPanel |
| LLM Debug 安全元数据持久化 | 已落地 | tracer sink · `llm_debug_logs` · Debug IPC；只保留结构元数据、正文长度和资产证据，不持久化 Prompt / 响应 / hidden reasoning |
| Chat Callback 三通道 UI | 已落地 | `src/components/chat/callbacks/` |
| Chat 页面组合基线 | 已落地 | Sidebar 默认 248px、开发入口固定在底部产品区上方、Chat 专属 52px 会话顶栏、居中欢迎区、引用式主角提示与紧凑输入卡；Playground 复用正式组件验收标准 / 窄宽 |
| Chat 右侧工作坞正式 Tab | 部分 | `ChatRightDock`；正式文件工具已收进 `WorkspaceFilesPanel`，内部左树右多预览；审阅 / 终端保持真实面板与 IPC，终端事件按实例 runId 过滤并在终止／卸载时清理 |
| 工具卡行内附着 assistant（Alice Phase B） | 已落地 | `resolve-tools-for-message.ts` · 历史 `toolCalls`+`role=tool`；进行中挂 live host |
| Dev Playground（无 Assemble 试跑） | 已落地 | PlaygroundPage · `debug:playground-run` |
| Debug / Playground 独立全页 | 已落地 | 入口固定在 Primary Sidebar 底部开发区；各自页面壳直接占满主区，不继承 Chat 顶栏；非双 tab / 非抽屉；记忆与 Skills 不再通过 SecondaryNav 进入 |
| 开发者模式门控 | 已落地 | 正式关于页与 Playground 共用 `AboutSettingsContent` / `SettingSwitch`；`settings.developerMode` 真实持久化；普通模式隐藏侧栏 Debug / Playground 整组入口和 Chat 顶栏 Debug 按钮；关闭只收回入口，不删除诊断数据。UI E2E 的 `ui-e2e` 模式仍显式保留开发入口 |
| 工具手测（权限门闸） | 已落地 | `debug:tool-run` · confirmRisk |
| Prompt 会话覆盖（不写 settings） | 已落地 | 载入实装 → playgroundRun |
| 设计语言场 | 已落地 | Playground「基础 → 设计语言」；颜色 / 主题 / 圆角动效三组 Tab，不混入业务组合 |
| Playground 基础 / 产品体验工作台 | 已落地 | `src/components/playground/` · 基础 → 产品体验 → Agent 实验；统一内容宽度、单一一级入口、基础故事筛选和当前体验基础引用；图标尺寸 / 搜索 / 动效均有可见样张，边界见施工合同 | Playground Chat 已覆盖初次进入、聊天、处理中、确认、完成、失败六态；处理中嵌入五功能工作区，确认 / 结果 / 失败留在对话里，不再使用旧任务进度卡或预览坞。人物世界样张收敛为朋友圈 / 物什 / 名册，角色架改在设置样张查看；记忆作为设置中的独立入口，业务状态不再作为独立入口。
| Playground UI 矩阵加厚（确认/芯片/状态条/反馈/独白） | 已落地 | M32-G9 Phase 1 · Toast 关闭位统一、MarkdownRenderer 等正式组件故事格 |
| Playground 模型连接与编程套餐候选 | 部分 | `SettingsExperienceCandidate.tsx` 读取六个套餐预设，名称 / 专用地址联动；官方、套餐、聚合、本地与自定义入口分离，适配器仅自定义可选。连接详情常驻，右上获取 / 测试；获取成功后展示可直接加入的候选项，模型状态只用勾选 / 空心圆表达，草稿与候选按连接隔离、重复模型不可添加。保存连接、添加模型、上方用途引用均为隔离状态；普通 Ark 的聚合分类只作用于候选。正式多连接 / 用途路由 / 主进程发现已回流，Playground 获取仍是隔离 fixture；套餐真实调用见 `WISH-027` |
| Playground 单项采用标记与主题对照 | 已落地 | `AdoptionMark` 只挂具体 token / 组件 / 故事证据，不再给目录批量标记或提供全局开关；七主题同页审计 |
| UI 组件 / 图标语义资产注册 | 已落地 | `ui-component-registry.ts` 继续承担组件资产身份与生命周期；`foundation-story-registry.ts` 负责 Foundation Playground 故事的 story key、assetKey、分组和 renderer 关系；基础组件工作台按 13 个任务入口展示全部已建故事，并补齐 Select / Form Field / Checkbox / Switch / Diff Viewer 及 IconButton / Card / Badge / Tag / Divider 隔离故事，完整候选登记由注册表 / Debug 承担；业务结构由产品体验注册表的 `experienceParts` 登记；图标目录仅显示紧凑的图标 + 中英文名，具体 adopted 小勾位于对应图标卡右上角并来自真实证据 |
| 全局 Debug 诊断 | 已落地 | `DevPanel` 全页工作区；提示词、请求与运行、伙伴状态、质量 / Eval、系统统一从全局入口进入；Chat 不再叠加 Debug 半屏 |
| 项目文件预览 | 已落地 | `FileBrowser` · text/image/unsupported；图/文本/md；html 沙箱 iframe；pdf·Office 外开；Playground 可用只读静态树 / 文件样张且跳过 IPC |
| Chat 右侧能力坞 | 部分 | `ChatRightDock` · 五入口顺序为审阅/浏览器/文件/终端/侧边聊天；五工具已有真实 IPC；侧聊支持受控上下文、确认隔离、创建/发送失败重试及父会话切换清理；四主题/Mermaid 与 Foundation 全量复用仍待验收，浏览器受限只读、终端非 PTY |
| Agent 生产资产目录与运行证据链 | 已落地 | Debug「提示词管理器」聚合 Prompt / 伙伴人格 / 记忆策略 / 权限与沙箱 / Tool schema / Skill / Eval Case 与 Grader / Eval Judge / 模型 Provider / MCP；真实 LLM / Tool / Memory / Permission 运行通过稳定 key 写入脱敏证据，支持调用级分组、资产最近使用、跨面板跳转与 JSON / JSONL 导出 |
| GitHub Actions 质量门禁 | 已落地 | Docs / Asset 工作流；Unit 在无界面 Runner 使用 Electron external 占位路径，不下载桌面二进制；官方 Actions 使用 v7 |
| Skills 管理 | 已落地 | 正式 Settings 与 Playground 共用 `settings/SkillViews.tsx` 的列表 / 独立详情 / 限高全文；内置正文只读，用户正文校验保存、取消与页内确认删除，失败可重试，离页迟到响应不覆盖新页面。`skills:set-enabled` 经 registry 串行持久化到 `skill-state-store`；停用从新摘要和工具注册移除，旧工具引用执行前再次校验。版本 / 回滚 / 隔离试跑后端仍供其既有调用者使用，不再是正式 Skills 页入口 |
| Skill Eval 证据闭环 | 已落地 | `npm run eval:skill`；S01–S03 覆盖应触发 / 不触发 / `allowed_tools`；JSON + Markdown 报告；Debug「质量 / Eval」展示输入、Trace、工具、回复与四类 Grader |
| Prompt 受控编辑 | 已落地 | 生产资产只读；实验副本可隔离试跑；二次确认后复用 `settings.systemPrompt` 保存为 L3 自定义补充指令 |
| Playground 多轮隔离对话 | 已落地 | `playgroundRun.history` · PromptLab transcript |
| Playground 模型测试（烟测 + thinking.disabled 探测） | 已落地 | `基础 → 设计语言`、`Agent 实验 → 模型能力` 等一级入口 · `debug:model-smoke` / `model-probe-thinking`；能力缓存供辅助调用 |
| Debug 世界态透视 | 已落地 | `debug:world-snapshot` · DevPanel 伙伴状态域 |
| Debug 诊断闭环 | 已落地 | 提示词管理器 / 请求与运行 / 伙伴状态 / 质量·Eval / 系统；LLM 调用、Span 与实时事件收进请求与运行内部视图 |
| Debug 真实请求元数据 | 已落地 | `LLMCallsPanel` 在请求与运行域读取真实调用的角色 / 计数 / 长度 / 资产证据；正文不落盘，装配预览不声明为实发内容 |
| Debug 全量 LLM 调用浏览 | 已落地 | 请求与运行域提供元数据筛选、最新优先分页、详情、JSONL 导出、两步清空；查询与导出共用过滤语义，并附带对应 span 的资产证据 |
| Debug Persona Eval 验收台 | 已落地 | 报告读取 + `debug:eval-run-*` · `PersonaEvalPanel`；逐 Trial 展示实际 messages / System Prompt / 工具 / 配置、一次性 Judge checks、回复与 evidence；兼容旧报告 |
| Persona Eval 真人格人工审阅 | 已落地 | `persona_eval_human_reviews` · `debug:persona-eval-human-review-*`；独立保存正向体验、风险信号、结论与备注，不改自动 Eval |

## 相关决策

- `DEC-010`：主进程分层与 import 方向约束。
- `DEC-013` / `DEC-014`：多 Provider 路由与辅助模型配置分离。
- `DEC-024`：基础设施对齐 Claude Code，差异化集中在人格层。
- `DEC-029` / `DEC-030`：工具与服务边界、Loop 状态机。
- `DEC-032` / `DEC-033`：413 压缩重试与输出截断恢复。

## 现状 / 缺口

- 工作区侧边聊天 IPC 会话在活动期间绑定发起 Renderer，并以请求令牌释放归属；跨窗口发送／中断被拒绝，缺省会话 ID 不触发全局 Runtime 中断。

**现状**：Loop / Runtime / Prompt / 压缩 / 队列 / MCP / Skill 管理 / 可观测主线已落地；Prompt 由生产注册表统一登记稳定 key、用途 / 角色、来源、版本、自动指纹、locale 和动态插槽；核心 key 已类型化，生产 LLM 调用必须声明非空 key 或显式 promptless 原因。Debug 提示词管理器已扩展为生产资产统一目录，覆盖 Prompt、伙伴人格、记忆策略、权限与沙箱、Tool schema、Skill、Eval Case / Grader、Eval Judge、模型 Provider 和 MCP；真实 LLM / Tool / Memory / Permission 路径写入 `available / used / triggered / matched` 四类脱敏关联，调用详情逐次展示资产证据，资产详情可反查最近使用，未知 key 不静默入库；LLM Debug 只通过现有 observer → tracer Span sink 持久化结构元数据、正文长度和资产证据；schema v14 会清理历史正文，侧栏不再读取 Prompt / 响应 / hidden reasoning；全页 Debug 已按开发者诊断任务收口：提示词管理器 / 请求与运行 / 伙伴状态 / 质量·Eval / 系统；请求与运行域直接读取真实请求快照并保留调用链 / 事件，质量域读取 Skill / Persona Eval 报告：Skill Eval 展示触发、指南注入、工具边界和回复约束证据，Persona Eval 在独立本地审阅层保存真人格人工判断；原始报告和自动判定保持只读。Playground 已按设计 / Agent 实验两组收口，设计组件边缘态合并展示，旧人格验收与体验夹具源码保留但不再作为 active 入口。
**缺口**：Swarm（wishlist）；更完整的子 Agent 产品化；真实 HTTP/SSE replay 与操作系统级 Shell 隔离仍未纳入默认门禁；外部 MCP 工具描述已标记为不受信任数据，超大 schema fail-closed。

- 2026-09-17：复核生活资产备份 IPC。`data:export` / `data:import` 覆盖生活资产与播种标记，失败与会话同一事务回滚；记忆导入仍走 `memoryStore.addMemory`。该链路不进入 Loop，也不把朋友圈互动、MCP、权限、凭据或项目路径纳入备份。

- 2026-09-17：复核开发者模式门控。正式关于页与候选共用同一内容组件；Electron 独立目录覆盖开关、入口隐藏和完整重启恢复。该证据不把全产品回流标为 adopted。

- 模型设置的正式展示已收敛到多连接、用途路由与连接清单面板；正式获取走主进程，Playground 仍用隔离 fixture。旧单连接字段仅作为空清单兼容回退，不再作为独立产品 UI 入口。

- 主对话 Runtime 根据用户消息是否携带图片选择 primary 或 image 配置；image 路由无效时回退主配置，辅助任务仍走 auxiliary。
