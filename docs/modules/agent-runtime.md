# Agent 运行时

MCP 已启用配置由主进程启动恢复，连接失败不阻塞窗口；意外断开保持活动快照为可恢复失败，设置页跟随 `mcp:status-changed` 显示重试，自动重连与工具许可仍受活动连接、Registry 和执行前校验共同约束。
## 一句话

对话主循环、Prompt 组装、上下文压缩、任务队列与可观测——聊天能跑起来的横切骨架。

## 边界

**做**：Agent Loop（流式事件 / 工具超时 / 重试）、会话 Runtime 中心化、System Prompt 四层组装、上下文压缩、后台任务队列、子 Agent、MCP Client、多 Provider LLM、模型连接 / 用途路由 / 主进程模型发现、Headless、Observer/DevPanel。MCP 工具许可由配置、活动连接、Registry 注册和执行前调用共同约束；模型连接密钥由主进程解密装配，Renderer 与备份只接触脱敏结构。
**不做**：伙伴生活世界语义及生活资产角色绑定（见 [companion](companion.md)）；结构化记忆库本身（见 memory）；权限策略语义（见 permission）。生活资产创建的角色校验属于 Companion IPC，不进入 Agent Loop、ToolRegistry 或模型输入。

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

- MCP 清单通过 McpServiceList 与 Playground 共用服务数量、添加入口和空态；添加按钮使用 Foundation ActionButton，hover / 禁用保持尺寸，向导打开时按钮保留并禁用。真实配置和管理锁仍由 SettingsPanel 持有，查询报错不显示无服务空态；候选只使用隔离数据。

- MCP 新增向导通过 beforeLeaveRef 暴露同步保存 / 刷新状态，正式 Settings 在此期间拒绝内部导航与卸载；失败恢复原表单，已保存后只重试刷新，不重复提交。向导打开期间与已有服务管理互斥，管理请求进行中不能打开向导，防止旧整表快照覆盖新连接。测试中或取消清理中仍可离页，沿用卸载清理与迟到结果隔离；Playground 不绑定正式离页门控，不新增草稿持久化。

- 设置页 MCP 普通服务管理经 runMcpAction 串行执行时同步保护离页和窗口卸载，覆盖非 OAuth 启停 / 重试、删除与工具许可，失败释放锁后可原处重试。真实 Electron 验证删除请求在途时拒绝 reload / quit，完成后完整重启配置仍为空。OAuth 启停 / 登录重试保持原离页取消路径，不由此锁改变；新增向导及未提交草稿不纳入此保证。

- SettingsPanel 的普通设置自动保存队列也保护桌面卸载：防抖待提交、在途保存和失败保留项都会阻止重载 / 显式退出；原队列保存成功后放行。模型连接仍使用独立草稿判定，不把未提交密钥加入自动保存；Playground preview 不注册拦截。

- 正式模型页复用同一留页判定保护内部导航、桌面重载和显式退出：未保存连接、手动模型输入及保存中会留页提示；保存或取消后正常离开。普通关闭仍隐藏，取消退出后恢复此语义；不自动持久化草稿或 Key，不承诺强杀 / 崩溃恢复。

- 流式模型读取因用户停止抛错时，Loop 先检查实际 AbortSignal，沿既有取消协议返回 ABORTED / done(aborted)，不进入重试、上下文压缩或 model_error。未取消的服务异常仍保留原错误处理。真实 Electron Stop 与流中抛错 Unit 已覆盖。

- Windows 首次保存模型连接和其他敏感设置前确认系统加密状态已写出；未就绪最多等待 15 秒，超时 / 损坏拒绝提交并可重试。模型双键、单键和备份准备共用存储保护，Renderer 仍只拿脱敏结构。正式模型表单保存成功后立即强退，重启发现模型时实际携带原凭据的 Electron 回归已通过；不自动保存未提交草稿，不承诺系统账户变化、状态文件被替换或断电恢复。

- 模型配置成功持久化后由 settings-store 发布无载荷事件，结构化记忆索引订阅并重新核对，不要求重启；备份只有实际新增模型键时才通知。失败回滚与订阅者异常隔离有真实存储测试；不改变 RAG 自动重建尚未完成的边界。

- RAG 文档向量与长期记忆共用 embeddings 的空间身份函数；查询在计算相似度前按请求空间、返回模型和实际维度隔离，不将其他端点数据当作命中。文档记录不删除；旧文档向量无身份或换连接时不自动重建，此恢复流程仍待 S2 完成。

- RAG 检索使用当前 Vectra 三参数 API，保留相关度过滤、topK 上限与不可信资料提示；rag_search 与导入入口一致，合法本地连接无需 Key，空端点 / 模型拒绝。真实 SQLite / Vectra 测试覆盖导入到工具查询和磁盘重开；独立嵌入模型配置与跨模型向量空间仍待 S2 完成。

- RAG 导入入口继续从 loadMainLLMConfig 读取真实连接；取消选文件不加载配置、不导入，空端点或空模型拒绝，合法本地连接不再因没有 Key 被提前拒绝。嵌入适配器不缓存跨连接的永久失败状态，失败仍由调用方处理；此项不新增 RAG 入口、IPC 载荷或独立嵌入模型选择，也不代表完整文档检索已验收。

- 正式数据页整份导入在同一 SQLite 事务写入会话、消息、生活资产、播种标记、朋友圈已发布历史与用户赞评、记忆和设置，再一次原子替换快照；SQL 失败回滚，最终替换失败同步补偿内存，不更换数据库实例。设置恢复判断真实存储值，默认 [] 不再阻止空库恢复，密文仍由 settings-store 准备。主进程在窗口 / 后台任务启动前核对带管理标记的恢复图片目录：未提交的清理，已被数据库引用的保留并移除标记，损坏引用或链接不冒险清理。真实 Electron 已在快照替换前 / 后 SIGKILL 后重启验证；不包含断电耐久性或向量索引崩溃重建。历史恢复不进入 Loop，不重放奖励。

- MCP Streamable HTTP 首次 OAuth 登录已接入正式共享表单与服务卡：SDK 处理发现 / 动态注册或公共客户端 ID / PKCE / 授权码交换；主进程回环监听按窗口、请求和端点隔离，校验 state、单次回调并支持取消 / 超时 / 失效窗口清理。授权后返回发起窗口，测试连接发现工具，再经现有保存与许可流程接管。令牌仅在内存，不保留 refresh token、不落盘或回传 Renderer；重启、过期或 401 显示需要登录，不后台弹窗或无限重连。OAuth 请求拒绝重定向、私网越界和无界响应，并固定已校验的 DNS 地址；明确选择的回环服务仅放行同源。真实本地协议 Unit 与独立 Electron 从正式按钮验证浏览器授权、工具许可及真实调用、取消重试、失效状态和重启边界；不代表第三方供应商全部兼容。后续凭据恢复 / 刷新 / 账户管理见 WISH-045，决策见 DEC-043。

- 正式外观页与 Playground 共用 `AppearanceSettingsContent`；主题 / 字号选项从设计资产直接派生，操作共用 Foundation ActionButton，选中图标始终占位。正式入口保留本机主题 / 字号保存，候选只更改内存，不触发 IPC 或修改本机偏好；此 UI 同源收口不改变 Runtime、Prompt 或模型配置。
- 共享外观页只显示产品标题与设置项，不把设计资产来源等展厅说明带入正式页面；页头说明可省略，四主题宽窄、键盘、固定操作槽及刷新恢复由正式入口测试覆盖。

- 备份导入 / 导出在主进程共用单操作租约，系统对话框绑定 invoke 发起窗口而非聚焦窗口；子框架和失效窗口不获得租约，重复请求返回忙碌。Renderer 退出、窗口销毁及主文档导航使准备阶段失效，迟到确认 / 读取不再写入；已进入写入阶段继续持锁到成功或失败，旧请求收尾不能解锁新请求。此保护不代表跨存储原子导入、崩溃回滚或撤销已发起文件写入。
- 生图媒体备份子项已接入：会话 JSON 保留工具调用 / 结果配对，图片以无路径引用和独立字节条目携带；读取失败不生成残缺备份。导入预检摘要、尺寸、完整 PNG 解码与引用归属，重新编码后恢复至 userData 下排他目录，不写备份声明路径；只恢复新增会话所需媒体，重复导入不复制，事务或文件写入失败清理本批目录。整份 25MB、图片最多 32 张 / 合计 16MB / 单张 8MB；解码后也执行总量限制。设置页只透传共享白名单错误，未知异常仍脱敏。真实 Electron 已覆盖正式导出、删除原图 / 会话、导入、完整重启显示与定位；核心事务及崩溃目录处理由本节整份导入能力保证，不代表完整 R06 或向量索引恢复已交付。
- Windows 打包目录产物已实际验证 native 生图与媒体恢复：包内 sharp 0.35.4、libvips DLL 与原生模块存在，`My Agent.exe` 完成正式设置、生成、落盘、定位、备份恢复和重启流程。此证据只覆盖未签名目录产物，不覆盖安装向导、签名发布、其他 OS 或外部模型兼容。

- 数据与隐私页正式 / 候选共用 `DataSettingsContent`，两列备份操作来自 Foundation ActionButton，备份范围说明不再分叉。真实数据走既有 data:export / data:import，候选仅模拟反馈；同步防重入、处理状态、取消静默、失败页内重试与内部错误脱敏由共享交互覆盖。正式设置保留跨设置子页的忙碌状态，离页旧结果不写回新页面；不等于取消主进程任务或跨窗口事务保护。

- App 全局快捷键按已提交视图绑定，普通侧栏 / 搜索等重渲染不再取消等待中的设置离页；会话创建、搜索状态和通知读取最新已提交引用。真实视图切换 / 卸载仍拒绝旧导航，设置保存失败继续保留草稿，重复离页期间不重复创建会话。UI 受控保存覆盖该竞态，不将其视为此前所有 Electron 偶发失败的同根因证明。

- MCP 服务卡与添加向导的逐工具许可复选框共用 Foundation `CheckboxField`，基础故事也实际引用同一组件。保留原生标签 / Space / disabled 语义与固定 16px 操作槽；选中状态仍由正式许可数据或向导草稿持有，保存中禁用、失败保留，空选择仍提交空许可列表。不改变主进程授权和执行前校验，OAuth 的独立证据见本卡首次登录能力。

- 模型高级区回流为共享 `ModelAdvancedSettings`：正式与候选共用默认折叠、全局预算、Temperature 和连接测试，输入 / 操作均来自 Foundation；正式移除候选没有的 Top P / 最大输出 UI，不删除运行时存储字段。测试明确选择已保存主对话首选连接，复用现有 IPC；候选只返回样张结果。用途筛选由 `src/shared/model-routing.ts` 同时供 Renderer 与配置工厂使用，不复制第二份规则。
- 模型参数边界共用 `model-parameters.ts`：Temperature 允许 0–2，预算允许非负安全整数，0 表示不限；空 / 非法草稿留在页面且不写入，IPC 再次校验。Temperature=0 不再被配置工厂当作空值丢弃。自动保存失败展开放在模型页的行内重试入口，不叠加遮挡控件的 Toast；主用途测试结果在配置成功保存（包括脱敏身份不变的换 Key）、切页或卸载后失效，不代表底层网络已取消。
- 模型连接测试与模型发现绑定发起窗口的主框架：主文档导航、窗口销毁或渲染进程退出时取消在途请求，凭据读取 / 配置装配后先复核归属再发请求，迟到成功不发布；正常完成与失败均清理监听。发现与 `chatComplete` 共用取消信号并保留原超时；不取消同页导航，不改变普通设置子页的 Renderer 结果隔离，不自动保存未提交草稿。

- 模型用途安排已从候选回流为共享 `ModelUsageArrangements`：正式页与 Playground 使用同一行密度、分隔、启停语义与固定排序 / 移除操作槽；选择和按钮由 Foundation 提供。组件只接收 props，正式保持真实整组保存与失败保留，候选仅修改内存。四主题宽窄与长标签、hover / pending 几何、排序 / 启停 / 移除和失败恢复有 UI 回归；符号级门禁验证两处调用和基础依赖，不接受未使用 import 或同名遮蔽。两处用途文案现共用 `MODEL_ROUTE_PURPOSES`，image 专用于生成，附图理解归主对话；生图整体施工边界见本卡现状缺口，不因布局共享宣称模型整页完成。
- 模型连接卡片已共用 `ModelConnectionCard`，连接详情、模型清单、手动添加、发现结果和内联编辑由同一组件展示，操作来自 Foundation。正式调用方保留真实保存、删除、请求代际隔离与错误恢复；候选只改夹具状态。测试 / 获取各状态与 hover 不改变头部操作槽尺寸，四主题宽窄和超长名称有几何回归；不将展示共享等同于模型整页或全产品回流完成。
- 连接清单的标题、数量、右侧添加入口与空态共用 `ModelConnectionList`；新增 / 编辑期间禁用重复添加，取消恢复，操作按钮由 Foundation 提供。删除最后一项后重开或完整重启保持空态，不合成旧默认连接或用途。
- 主配置仅从保存的连接与 primary 用途装配；没有有效主用途时返回空身份，不读取旧全局模型字段或 LLM_* 环境变量。辅助 / 图片无独立有效用途时只沿用新主用途，不读取旧 auxModel；显式一次性连接覆盖仍可用。Chat 显示当前模型或「未配置模型」，不再提供仅写旧地址的 Provider 快选；Debug 系统快照使用同一配置工厂。
- 未配置时 Runtime 返回配置指引且不请求旧端点。Chat 等待调用回执及 done 都完成后才解除监听和发送状态；调用被拒绝时直接清理并显示可重试提示，流错误不被数据库历史覆盖。受控 UI 覆盖两种完成顺序与拒绝，独立 Electron 覆盖删空、重启、无请求及重新配置后对话。

- 用途优先级已进入真实调用：主 / 辅助 / 图片理解配置工厂按同用途顺序装配首选与备用，过滤停用项和缺失引用并去重，每项保留独立端点、Key 和协议。独立用途不继承主用途备用池，辅助 thinking 按目标计算，一次性连接覆盖不继承保存的备用链。就绪检查允许使用已配置备用；每次请求单独认证，远程缺 Key 不发送请求。取消或已输出模型事件后停止切换，避免拼接两次回答。Unit 覆盖装配和中断，独立 Electron 覆盖正式添加 / 排序、完整重启、503 后备用请求及凭据隔离；本地协议测试不代表真实厂商可用性。

- 本机 HTTP(S) 回环上的 OpenAI 兼容连接允许无 Key，统一判断位于 `src/shared/llm-connection-test.ts`；远程、userinfo 和非兼容协议不获豁免。正式测试、发现、Runtime、已有辅助调用与 Playground 真实模型试验共用该判断，不借用全局凭据。设置安全视图由主配置工厂派生 `llmConnectionReady`、`llmEffectiveModel` / `llmEffectiveBaseUrl`，首次启动与聊天顶栏不再只看旧全局 Key / 模型名；就绪不表示端点可达或型号兼容。独立 Electron 目录覆盖正式无 Key 保存、发现、测试、重启后对话及 401 后补 Key 重试。

- 数据库快照替换失败时保留旧文件，不再退回直接复制覆盖；临时写失败统一给出保存失败提示，清理失败记结构化警告。正式模型页另经专用整组保存 IPC，在同一同步段更新连接与路由并一次落盘，失败恢复已写键；密钥先加密，主进程合并串行化。真实 SQLite 故障与完整 Electron 重启覆盖两键一致性，不代表其他设置也具有整组保存语义。

- 正式模型新增 / 编辑与候选共用 ModelConnectionForm，五类来源与预设默认值同源，新增独立卡片、已有连接原位编辑，保留模型清单和用途。source / presetId 随加密连接 JSON 保存，自定义 provider 经共享类型与校验进入真实测试链；更换端点 / 协议不复用旧 Key，同连接改名可保留。四主题宽窄 UI 与本地 Anthropic 协议 Electron 覆盖保存、重载和真实请求；整页其余卡片及关窗 / 多窗口生命周期仍待完成。
- 模型配置工厂对主 / 辅助 / 图片理解路由整体传递目标连接的端点、模型、密钥与协议；目标连接缺密钥时不借用主连接、全局或环境凭据，未指定协议则按目标地址自动检测。仅辅助 / 图片无有效用途时整体沿用新主配置；主用途不存在时不回退旧身份。一次性测试指定端点时需携带自己的凭据 / 协议，或满足本机无 Key 边界。`model-routing` 工厂回归覆盖此边界。
- 正式模型配置的连接保存、删除、模型清单增删启停与用途路由操作，等待整组保存成功再更新可见清单；失败保留编辑草稿并提示，保存期间锁住表单写操作，离页后不回写本地列表。新增 / 已修改连接、非空手动模型输入及保存中状态阻止设置切页、返回和应用导航快捷键；保存、取消或清空输入后可离开，未修改的编辑表单不阻挡。保护不自动持久化草稿凭据，不覆盖关窗 / 崩溃恢复。
- 模型连接测试 / 发现分别按连接持有请求令牌，保存成功后的删除、端点 / 协议 / 密钥及连接启停变化清理旧状态；被测试模型变化仅清理测试，发现列表可连续添加。取消或失败保存保留原结果。迟到成功、业务失败与 IPC 异常均不越过失效令牌回写；卸载清理，IPC 异常显示可重试错误。此为 Renderer 归属保护，不代表底层网络请求已取消。
- 模型连接新增 / 编辑及模型 ID 输入共用 Foundation TextField，用途路由与 MCP 认证选择共用 SelectField；业务校验、测试连接和保存仍由原适配器负责。注册表 Unit 检查真实 JSX 符号及未使用导入 / 同名遮蔽负例，不把共用业务表单等同于全部基础控件已收口。
- 开发者模式同时约束侧栏、顶栏和全局 Debug / Playground 快捷键。快捷键进入前读取实际保存值；从设置页跳转先完成保存，关闭开关后不能利用旧壳层状态进入。读取失败提示并留页，切页后的迟到读取不重新导航；这是产品入口控制，不替代主进程权限检查。
- MCP 替换连接在等待旧客户端关闭前确定归属，每次异步返回核对连接身份；停止立即撤销归属，旧握手或关闭回调不得复活或删除新连接。设置页的状态查询和工具清单使用同代读取，新推送及离页会使旧响应失效；不把迟到的已连接状态覆盖到异常断开卡片上。
- 文件规则已接入 Loop 与 Debug 的真实预检：别名归一后合并工具及文件权限，命中 ask 才签发当次调用的内部确认凭据；无交互或拒绝确认时不执行。Registry 在调用前重新核验，规则或目标变化会使旧确认失效，子调用不能复用另一 callId 的授权。匹配语义和工具范围见 permission 模块，不在运行时复制策略。

- MCP 添加表单由 `settings/McpConnectionForm.tsx` 同时服务正式设置与 Playground，候选仅注入隔离 actions，不再维护重复字段与状态机。测试成功不因阶段切换被清理；取消后保留草稿，旧响应不复活；修改后必须重测，空白名单可保存；保存完成后列表刷新失败仅重试刷新。主进程取消 / 超时、资源接管、并发配置和 Electron 重启恢复的完整证据仍按 R10 继续补齐，不因表单共享宣布整项完成。
- MCP 测试连接现在与正式客户端共用能力协商和 elicitation 处理器，资源清单随同一连接接管；保存结果支持 owner/requestId 有界重放，确认迟到、窗口销毁、导航和渲染进程退出不会重新开放连接。整表 MCP 设置写入、添加向导持久化和工具许可更新共用配置锁，许可只有写盘成功后才更新活动连接。独立 Electron 数据目录验证本地 SDK 测试、保存、SQLite 密文包络、Renderer 凭据哨兵及完整重启后 Bearer 自动认证；OAuth 首次登录已有独立协议与 Electron 证据，第三方具体互操作仍须按服务验证。

- MCP 服务卡片由 `settings/McpServiceCard.tsx` 同时供正式设置与 Playground 使用；服务状态、开关、工具数量、许可与重试不再各自维护 JSX。正式设置订阅 `mcp:status-changed`：意外断开映射为连接失败和重试，缺失快照才是未连接；手动停止仍删除快照。未知工具清单不展示为零，长清单内部滚动，操作期间槽位固定。列表变更在设置页内串行，禁用 / 删除先保存再断开，保存失败不提前断开；许可更新同步本地配置快照，后续启停不覆盖刚修改的许可。OAuth 首次登录与需登录状态也复用此服务卡，后续登录保持能力见 WISH-045。

- MCP 生产传输由 `mcp/transport.ts` 统一创建，支持旧 stdio / SSE 和 Streamable HTTP；配置与 connect IPC 共用 `src/shared/types.ts` 的 `McpServerConfig`。可选 Bearer 随 MCP 配置整体加密，Renderer 仅收到哨兵；复用已存令牌要求同 id、同传输、同 URL，换地址需重新提供令牌。带令牌只允许 HTTPS 或回环 HTTP，新 HTTP 传输拒绝自动重定向；手动连接仍由主进程确认，不实现隐式 OAuth。未声明 tools 的服务可连接为零工具；已声明但发现失败仍为错误，不能假装成功。正式添加向导、隔离测试与取消 / 保存已接入；更长期的 OAuth 生命周期不在本次范围。
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
| 用户主动生图与媒体恢复 | 已落地 | `tools/builtins/image-generate.ts`、`llm/image-generation.ts`、`storage/generated-images.ts` / `generated-image-backup.ts`；独立生图用途、Images / Gemini 单次请求、审批与项目安全落盘、共享图片卡、定位 / 重启 / 备份恢复；正式 Electron 及 Windows 打包应用验证，外部厂商互操作未验证 |
| 人物世界生活资产 IPC | 部分 | `ipc/companion.ts` · `life/assets.ts` · `companion:create-asset` / `update-asset` / `delete-asset`；用户创建白名单由 createAsset 校验，不进入 Loop |
| 生活资产备份 IPC | 已落地 | `ipc/data-export.ts` · `data:export` / `data:import`；覆盖 `companion_assets` 与 `companion_asset_seeds`，按 id / 播种键合并，会话与资产同一事务失败回滚。旧备份缺字段仍可导入。整份预检共用记忆存储正文断言，非法记忆不得在会话 / 资产写入后才被拒绝；通过后记忆继续走 `memoryStore.addMemory`，不进入 Loop；合法输入的跨存储原子导入仍未实现 |
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

- R06 主动生图子项已接通：`image_generate` 使用独立用途与 Images / Gemini 单次请求，不借主模型、不自动重试；附图理解归主对话。结构化结果经 schema v17 保存后发布，共享 `GeneratedImageResult` 覆盖主 / 侧聊天与隔离故事，支持有界预览、原图、读取重试和文件定位。生成等待中点击停止会关闭 HTTP 请求且不落新图；目标被其他操作创建时不覆盖。会话引用、摘要、主框架及迟到结果隔离保护读取 / 定位。连续工具批次不覆盖前批结果。媒体备份恢复和 Windows 打包应用 native 流程已有真实证据，边界见上方能力及备份说明；未验证外部供应商、安装向导、签名发布或其他 OS。模型页关窗 / 多窗口生命周期与全产品清单仍未完成，不因本子项收口把整项标 adopted。

- 工作区侧边聊天 IPC 会话在活动期间绑定发起 Renderer，并以请求令牌释放归属；跨窗口发送／中断被拒绝，缺省会话 ID 不触发全局 Runtime 中断。

**现状**：Loop / Runtime / Prompt / 压缩 / 队列 / MCP / Skill 管理 / 可观测主线已落地；Prompt 由生产注册表统一登记稳定 key、用途 / 角色、来源、版本、自动指纹、locale 和动态插槽；核心 key 已类型化，生产 LLM 调用必须声明非空 key 或显式 promptless 原因。Debug 提示词管理器已扩展为生产资产统一目录，覆盖 Prompt、伙伴人格、记忆策略、权限与沙箱、Tool schema、Skill、Eval Case / Grader、Eval Judge、模型 Provider 和 MCP；真实 LLM / Tool / Memory / Permission 路径写入 `available / used / triggered / matched` 四类脱敏关联，调用详情逐次展示资产证据，资产详情可反查最近使用，未知 key 不静默入库；LLM Debug 只通过现有 observer → tracer Span sink 持久化结构元数据、正文长度和资产证据；schema v14 会清理历史正文，侧栏不再读取 Prompt / 响应 / hidden reasoning；全页 Debug 已按开发者诊断任务收口：提示词管理器 / 请求与运行 / 伙伴状态 / 质量·Eval / 系统；请求与运行域直接读取真实请求快照并保留调用链 / 事件，质量域读取 Skill / Persona Eval 报告：Skill Eval 展示触发、指南注入、工具边界和回复约束证据，Persona Eval 在独立本地审阅层保存真人格人工判断；原始报告和自动判定保持只读。Playground 已按设计 / Agent 实验两组收口，设计组件边缘态合并展示，旧人格验收与体验夹具源码保留但不再作为 active 入口。
**缺口**：Swarm（wishlist）；更完整的子 Agent 产品化；真实 HTTP/SSE replay 与操作系统级 Shell 隔离仍未纳入默认门禁；外部 MCP 工具描述已标记为不受信任数据，超大 schema fail-closed。

- 2026-09-17：复核生活资产备份 IPC。`data:export` / `data:import` 覆盖生活资产与播种标记，失败与会话同一事务回滚；记忆导入仍走 `memoryStore.addMemory`。该链路不进入 Loop，也不把朋友圈互动、MCP、权限、凭据或项目路径纳入备份。

- 2026-09-17：复核开发者模式门控。正式关于页与候选共用同一内容组件；Electron 独立目录覆盖开关、入口隐藏和完整重启恢复。该证据不把全产品回流标为 adopted。

- 模型设置的正式展示已收敛到多连接、用途路由与连接清单面板；正式获取走主进程，Playground 仍用隔离 fixture。旧全局身份不参与配置工厂装配；独立嵌入配置等存量字段的物理清理不在本批范围。

- 主对话 Runtime 根据用户消息是否携带图片选择 primary 或 image 配置；image 路由无效时回退主配置，辅助任务仍走 auxiliary。
