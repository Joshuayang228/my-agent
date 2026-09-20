# 全产品体验正式回流 v1 施工合同

> 状态：进行中
> 生命周期：进行中；全产品 P1 回流，未完成，不以工作区子项完成代替总体验验收。

S6 写入响应隔离结果（2026-09-20）：四页旧 busy 红测转绿；新增 / 编辑 / 删除及新旧写入锁交叠、既有切角读取共 39 项通过，含深浅宽窄与截图。Unit 复核 1236、根 tsc / build 通过；首跑监听测试不稳定已记入 WISH-042，未宣称修复。此次只关闭 Renderer 响应污染，不关闭后台受理角色竞争或总体验采用。

S6 生活资产在途响应隔离：四页受控红测已证明切到新伙伴后，旧写入仍让添加按钮 disabled。沿用 DataSettingsContent 的代次隔离模式，在 AssetsPanel / WorldDetailsPanel 的新增、编辑、删除回调及 finally 检查写入归属；切角释放旧界面锁，不取消已经提交到后端的操作。允许修改上述两组件、既有 chat E2E 和对应文档；不改 UI 形态、IPC / 数据库契约、依赖或后台角色授权。必测旧成功 / 失败不污染新草稿、新请求 pending 时旧 finally 不解锁，以及既有切角读取；真实后端受理时角色竞争不由 Renderer 替身证明，仍待全链验收。

S4 模型草稿离开保护已落地（2026-09-20）：同一判定保护内部导航、桌面重载和显式退出；取消退出恢复普通关窗隐藏，后台索引只在最终退出停止。未提交凭据不写盘，强杀 / 崩溃不保证恢复。真实 Electron 生命周期及 onboarding 共 22 项、UI 保存中 / 手动输入 / 保存失败回归 3 项通过；其他设置队列及在途写入竞争仍未关闭，RAG / OAuth 后续保持暂缓。 Unit 1236、根 tsc / build、Eval 23 + 1、资产 31 通过；主进程同树类型 72 → 72 无新增但非全绿。不提升体验资产采用状态，合同继续施工。

S4 模型草稿离开保护实施边界：复用 ModelRoutingSettings 既有同步 beforeLeave 判定与 Toast，接入桌面 beforeunload；未提交连接 / 手动模型输入及保存中拒绝重载和显式退出，用户保存或取消后可正常离开。不新增弹窗样式、自动保存、IPC、依赖或未提交密钥持久化；普通关窗仍隐藏。主进程 will-prevent-unload 只恢复退出标记并显示原窗口，不调用 preventDefault 放行；memoryIndexSync.stop 从可取消的 before-quit 移到最终 will-quit，避免取消退出后索引被停止。允许修改模型页、主进程生命周期接线、既有生命周期测试及相关文档；必测真实重载 / quit 被阻止、取消编辑后重载 / 退出成功、取消退出后普通 close 仍隐藏，以及既有模型诊断重载取消。强杀 / 崩溃 / 系统强制结束不承诺保留草稿；其他设置队列与在途竞争仍按原 S4 另行核实。

S4 草稿生命周期取证（2026-09-20）：真实 Electron 新数据目录的模型草稿，BrowserWindow.close 后窗口数仍为 1 且不可见；show 后名称与未保存 Key 完整保留。正式返回按钮被现有 beforeLeave 门控拦截，已保存连接未变。实际 page.reload 和 app.quit / 重启后草稿消失，配置仍未新增该连接：隐私边界成立，但重载 / 显式退出没有未保存提醒，离开保护尚未完成。只新增既有 model-diagnostic-lifecycle 套件的隔离测试，不改产品或安全策略；不得将观察到的草稿消失固化为必须保持的断言，不通过自动持久化未保存密钥绕过。Unit 1236、根 tsc / build、生命周期与既有真实 HTTP 取消共 2 项通过；证据 var/verification/s4-draft-lifecycle-final。后续仍需补明确的离开保护并核实配置写入竞争，不关闭 S4。

S6 生活面角色通知（2026-09-20）：正式 culture / home / footprints 三条受控红测证明 App 已收到 zhou 切角通知，共享 WorldDetailsPanel 仍显示 lin 内容与草稿；根因是没有订阅既有 onRoleChanged。仅在共享组件增加生产通知订阅，切角清展示 / 编辑 / 删除确认 / 新增草稿并重读；沿用请求序号拒绝旧响应，Playground 不订阅。不修改 UI 形态、IPC、后端或依赖。Unit 1236、根 tsc / build、四主题宽窄及失败恢复定向 UI 12 项通过。新增独立 Electron 用例实际创建 lin / zhou 的衣柜、文化、家具、足迹资产，走 requestSwitch 与真实广播验证四页就地更新及重载归属，单跑通过；完整 onboarding 20 项通过。证据 s6-living-role-red-verified / final / electron / onboarding 位于 var/verification。首次红测因表单标签误写“名称”而中止，不作产品失败证据。资产写入跨切角竞争与其余 S4–S6 仍未以本批证据关闭，RAG / OAuth 后续保持暂缓。

S6 衣柜读取修复（2026-09-20）：正式入口受控 IPC 复现三项失败：读取拒绝无提示、角色响应不一致仍展示、切到 zhou 后迟到 lin 结果覆盖新衣柜。本批仅修改 AssetsPanel 读取生命周期和既有 chat E2E；复用 WorldDetailsPanel 的请求序号与身份校验模式、Foundation IconButton 和共享错误提示，不新增依赖 / IPC / 存储。角色通知立即清旧内容及草稿，响应角色不一致清空并报错，普通刷新失败保留旧列表；旧请求的成功、错误和 finally 均不能更新当前状态。三条红测转绿；深浅宽窄、原位重试及既有删除 / 候选回归 14 项、Unit 1236、根 tsc / build 通过。证据 s6-wardrobe-read-red / final / themes 位于 var/verification；这些是 Renderer 受控时序，不冒充真实后端切角验收。不修改体验采用状态，不扩大到写入竞态，RAG / OAuth 继续暂缓。

S6 正式界面审计（2026-09-20）：既有 chat / Markdown / checkbox 界面套件 263 项通过（排除 OAuth 专项）；这是 Renderer 验证，其中真实 IPC 替身不等于 Electron 持久化证据。实际检查正式浅色宽屏文化角、深色窄屏家居长文、深色窄屏记忆失败编辑态及深色审阅原始代码截图，未见这些截面的白底或正文溢出。发现外观页将“基础设计资产”开发说明带入正式页面，新增正式入口断言复现后，从正式 / 候选共用组件移除说明；共享页头支持无说明，不影响其他调用方。Unit 1236、根 tsc / build、四主题宽窄与候选隔离定向 6 项通过；证据为 var/verification/s6-formal-ui-audit、s6-appearance-copy-red、s6-appearance-copy-final。没有据此提升四个体验资产状态。衣柜 AssetsPanel.load 的角色一致性、交错读取及失败反馈仍待复现，纳入既有 R12 / S6，不另增功能包；RAG / OAuth 后续继续暂缓。

S5 外部脚本子项（2026-09-20）：四项可选模型测试已迁移正式连接与用途，独立应用 / 数据目录，真实工具与终态断言；不再共享前置或使用旧颜色类名。协议复核发现 R01 流式 Stop 返回 model_error，确定性 Unit 证实 signal 已取消仍进入故障分支；本批只在 Loop 流读取 catch 中优先结束取消，其他故障行为不变。本地协议四项、无 Key 跳过四项已核验，Unit 1236、Eval 23 + 1、根 tsc / build 通过；外部供应商需明确费用授权后验收，不能用本地服务代替质量证据。其余收尾包仍进行中。

S4 首次凭据强退修复：已接统一只读持久化门，双键 / 单键保存先等待 Local State 的 DPAPI 记录，同步加密前复核；备份等待在快照和事务之前，随后复核取消状态。缺失最多等 15 秒，损坏 / 超限 / 不可用拒绝，失败零业务提交并可重试。Windows Electron 42 的格式依赖必须随升级回归，不写 Chromium 文件或复制系统密钥，不承诺断电或系统账户变化恢复。正式 UI 首次保存立即强退红测转绿，重启真实 HTTP 认证成立；本子项不关闭 S4 草稿与写入竞争或 S6 全产品验收。

S4 首次凭据强退定位（2026-09-20，Electron 42.9.1 / Windows）：独立临时 userData 经真实 saveModelConfiguration 保存随机测试凭据，返回成功后 Local State 仍不存在；立即 taskkill 自有 Electron 进程树，重启读取到 connections=0、routes=1、llmConnectionReady=false。另一个全新实例验证 safeStorage 可用，但 session.defaultSession.flushStorageData() 后 Local State 仍不存在，约启动 10855ms 后才出现；这是单次观测，不是可硬编码的等待时长。当前版本 browser_process_impl.cc 在退出主消息循环时提交 Local State；同步 encryptString 不构成持久化确认。修复必须保证敏感配置成功应答前具备可重启解密的系统状态；不得以固定 sleep、正常退出一次、明文降级、直接覆写 Chromium Local State 或只刷新 Session 替代。生产代码尚未修改，S4 未完成；下一步验证可用的系统状态持久化完成信号及失败时不提交配置的统一保存边界。

S5 工作区前置子项（2026-09-20）：仅修改 onboarding 三个工作区用例的准备流程及文档，保留首次模型配置的 UI 验收、终端拒绝 / 进程退出和侧聊流清理断言。复用已有真实设置 IPC；每项新建独立项目并走正式选择入口，不修改生产实现或新增依赖。红测证明单跑缺少模型 / 项目 / 右坞；三项独立通过，完整 onboarding 19、Unit 1227、根 tsc / build 通过。不关闭其余 S5 或 S6。

S5 文档监听子项（2026-09-20）：仅修改 Vite watcher 和既有真实服务回归，排除项目文档 / 方法论 / 协作规则目录，保留源码更新；真实红测到绿测验证 watcher 与 WebSocket，Unit 1227、根 tsc / build 通过。未修改体验注册状态、用户配置、IPC 或依赖，onboarding 前置依赖和外部脚本仍未收口，不关闭整个 S5。

S3 本批边界：删除 life/assets.ts 的衣柜 / 书架 / 文化默认常量及按角色硬编码覆盖，不以空柜为由制造人物设定；保留 world.default 住所 / 地点 / 物件、用户 CRUD 和已发布事件授予。不动 UI、IPC、Role Pack 正文或 Playground 样张，不批量清空旧数据库。5 个角色真实库红测复现无定义仍返回 9–10 件资产，修复后空态成立；测试的资产引用改用显式创建夹具，正式文化更新与六面验收不再依赖默认作品。旧开发数据残留及六面整体验收仍需分别核对，不将此项直接标为全产品完成。

用户调整（2026-09-20）：RAG 与 MCP OAuth 后续工作暂缓，待用户与 Agent 一起研究、明确产品方案并显式恢复后再施工。RAG 的导入完整性、失败反馈、独立配置与重建不再列为本次继续推进的阻塞项；MCP OAuth 保留已提交的首次登录能力，不继续扩展、打磨或新增互操作验收。既有能力不删除，也不把暂缓记成完成；本轮未提交的 RAG 实现和测试已撤回。详情及重启条件见 [暂缓记录](../deferred/rag-mcp-oauth.md)。其余正式回流范围保持进行中。

S2 配置提交唤醒子项：统一存储提交通知覆盖双键保存、单键保存与备份实际写入模型键，整次成功持久化后发布；失败恢复原值且不唤醒，观察者失败不反转保存结果。恢复 worker 取消旧尝试并禁止迟到结果发布，停止解除订阅。未变更 UI、IPC 形状、默认嵌入模型或依赖。Unit 1222、Eval 23 + 1、根 tsc / build、正式 Electron 2 项通过；S2 其余项及 S3–S6 保持进行中。

> 建立日期：2026-09-14
> 用户授权：重新启动目标模式，把 Playground 所有产品体验相关内容回流；缺后端就补后端，补文档，做好管理和测试。
> 最新范围纠正（2026-09-15）：用户明确旧设置能力可以不要，正式设置统一采用当前 Playground demo 的样式与交互。不得以保留旧能力为由增加 demo 中没有的旧页面、表单或次级入口；真实后端、用户数据和安全边界继续保留，只删除旧 UI 壳、重复入口和已被 demo 取代的展示能力。
> 最新授权（2026-09-16，覆盖上条保留要求）：当前仍在开发阶段，不需要旧界面、旧接口或旧开发数据兼容。回流以已确认 demo 为唯一产品形态；发生结构冲突时可重建相关开发数据，不为保留旧数据增加迁移层。此授权不等于批量清空无关文件、凭据或其他项目，也不取消权限、路径与凭据安全边界。
> 上位设计：[产品体验总图](./product-experience-map-v1.md)。本合同管理正式回流；既有 P0 合同保留候选设计依据，冻结快照不改写为生产完成证明。

## 当前收口清单（2026-09-19，基于 78c1a46）

本节统一解释下面的历史施工记录，不删除历史证据，也不把旧记录中的「仍待」自动当作今天的缺口。用户追问「这种测试还有多少」后，停止以不断追加边缘测试代替交付进度。当前已知剩余工作归为 **6 个收尾包**；这是工作包计数，不是未实现页面数、测试条数或工时承诺。只有新证据证明原目标内存在缺陷才补入对应包，必须说明影响和完成条件；外围增强不自动进入本轮。

### 已有链路与验收缺口

下表是代码与现有证据导航，不是本轮重新运行后的通过声明。整项结论仍为「待最终验收」；没有逐页实际检查就不批量采用资产。

| 范围 | 当前已有实现 / 证据 | 剩余归属 |
|---|---|---|
| R01 对话与导航 | App / PrimarySidebar；chat E2E 覆盖导航保存竞态、右坞开关及会话隔离 | S4、S6：草稿生命周期及正式组合态 |
| R02 设置骨架 | 正式 SettingsPanel 与候选共用 SettingsLayout；九区入口、内嵌业务页已有测试 | S6：逐区检查正式入口，不能只检查候选 |
| R03 外观 | AppearanceSettingsContent 与设计资产同源；四主题、字号及 Markdown / Diff 测试已存在 | S6：各正式入口四主题宽窄复核 |
| R04 伙伴与相处 | 共享偏好组件、角色架及真实 settings / Prompt 链；onboarding 有偏好持久化断言 | S6：角色切换、流中禁换角和跨页身份不能仅靠偏好保存测试代替 |
| R05 记忆 | 四类管理、长文编辑、敏感确认及真实 memory IPC；onboarding 有完整重启 CRUD | S1、S2：向量链不能由 SQLite CRUD 通过替代 |
| R06 模型与生图 | 共享连接 / 用途 / 高级表单、配置工厂、真实协议、生图与窗口诊断取消已实现 | S2、S4；付费外部服务结果不在本地协议证据内 |
| R07 数据与隐私 | 共享数据页；核心事务、媒体崩溃恢复、朋友圈历史与赞评备份已有独立 Electron 测试 | S1：导入后派生向量恢复 |
| R08 权限 | 共享规则编辑器；onboarding 验证真实规则热更新、重启及文件副作用阻断 | S6：正式折叠、卡片、添加位置及失败态 |
| R09 Skills | 共享 SkillViews；onboarding 验证真实编辑、启停和完整重启 | S6：长详情滚动与正式入口；试跑不回流 |
| R10 MCP | 共享连接界面、Bearer、逐工具许可；首次 OAuth 独立 Electron 协议测试 | S6：当前边界总验收；长登录按 DEC-043 后置 |
| R11 开发者模式 | 共享 AboutSettingsContent；onboarding 验证模式持久化、入口与快捷键门控 | S5、S6：快捷键偶发失败不能以重跑绿灯关闭 |
| R12 人物世界 | 六面入口及 IPC 已接通；onboarding 对六面真实存储读取和部分写入作断言 | S3、S6：人物 starter 来源及六面分别验收 |
| R13 工作区 | 正式五工具、真实文件 / 侧聊 / Windows 进程树；已有 Renderer 与 Electron 用例 | S5、S6：解除用例前置依赖并复核正式组合态 |
| R14 基础复用 | 注册表登记正式入口和数据路径；复用 Unit、共享组件及主题测试已存在 | S6：逐项检查真实符号调用、渲染与生命周期，不以路径 / 字符串出现替代 |

R12 六面不得合并成一个「可见」结论：朋友圈已有赞评及备份链；衣柜已有资产读写但 starter 归属未收口；文化角已有作品 / 笔记读写但同样存在 starter 问题；家居已有空间 / 物件资产与未设定空态；通讯录已有 roster、忙闲预检与开聊；足迹已有事件地点与用户地点记录。六面仍需分别核对角色隔离、当前展示与真实持久化，纳入 S6，不另起六项新功能。

### 六个收尾包及完成条件

| 编号 | 当前缺口与证据 | 完成条件 |
|---|---|---|
| S1 记忆派生索引恢复 | 已由本批关闭：此前只依赖 memory-store 进程内 afterCommit 通知，退出 / Embedding 失败没有持久恢复证据 | 已验证 SQLite 为事实源；正式备份提交点强退、Embedding 503 后重启保留源数据，服务恢复后补齐分类 / 角色镜像且不重复；真实磁盘 Vectra 检索命中。外部 Embedding 配置隔离仍属 S2 |
| S2 模型与嵌入配置收口 | 2026-09-20 已修 index-sync / RAG 空 Key 门控与 Embedding 进程级永久失败状态；仍缺独立嵌入模型选择、切换后向量空间一致性及旧键消费者完整核验 | 支持已声明的本地无 Key 嵌入；失败按连接隔离且切换可恢复；旧键清理沿调用链证明不破坏独立嵌入；配置、手动记忆与检索走同一真实链 |
| S3 人物生活数据来源 | assets.ts 仍内置衣柜 / 文化 starter；六面 Electron 测试甚至断言这些默认名称，不能据此证明设定获准 | 每项正式初始内容来自已确认 Role Pack / 用户操作 / 已发布事件；无来源用真实空态；候选样张保留隔离。不得为去掉夹具另造人物设定 |
| S4 草稿生命周期边界 | 普通 close 被 index.ts 阻止并隐藏到托盘，不等于草稿丢失；显式退出 / 重载、后台配置写入冲突仍需核实 | 逐一验证隐藏再显示、应用内导航、显式退出 / 重载和真实可达写入竞争；有缺陷修复，有不可达边界记录证据。不得为审计新增多窗口产品，也不擅自持久化未保存凭据 |
| S5 验收可靠性 | onboarding 多项依赖同一前置状态；Vite watcher 只排除验证产物，已记录文档触发重载；外部模型条件脚本仍引用旧 UI | 用例失败 / worker 重建不连带污染其他验收；文档不触发开发页面重载而源码 HMR 保留；外部脚本更新正式入口与隔离目录；已知偶发失败有可解释证据，不靠放宽断言或多次重跑宣称修复 |
| S6 全产品正式验收与采用 | 四个 experience 资产仍为 playground；已有批次报告不能证明最终代码所有正式入口一起成立 | 对照 R01–R14 与 R12 六面，从正式 App 逐项操作并检查深浅 / 宽窄 / 长文 / hover / 失败态；核实 Foundation 实际复用与夹具隔离；跑最终回归，更新采用状态、模块卡和账本，稳定事实吸收后冻结合同并提交推送 |

当前验证锚点：`var/verification/model-diagnostic-electron-full/.last-run.json` 与 `var/verification/moment-backup-ui-full/.last-run.json` 均为 passed；前者上一批报告为 26 通过 / 4 外部模型条件跳过，Unit 为 1191。结果文件本身不包含全部用例内容，数字引用上一批记录，不冒充本轮重新运行结果。审计确认 onboarding 六面测试使用真实 IPC / 存储，但内容有显式测试播种；这证明连接与读取，不证明真实人物内容或付费模型输出质量。

### 不扩大本轮目标

S2 空间隔离边界：embeddings 的生产函数生成请求空间指纹及返回模型 / 维度元数据，vector-store 和 RAG 的写入与查询共用；查询在 Vectra 相似度计算前过滤。结构化记忆在既有核对入口清理并重建不同请求空间镜像，SQLite 源不变；未配置时不因空间身份清理。旧对话 / 文档不删除但不推测其向量兼容性。对应策略注册表、真实库单测和文档同步；全量 Unit 1215、Eval 23 + 1、根 tsc / build、Electron 恢复 2 项通过。此项仅建立隔离约束，独立嵌入配置、设置保存后的唤醒、旧键消费核验、文档重建和服务端同名静默换模仍待 S2 完整收口。

S2 RAG 查询修复：真实库验证旧 queryItems(vector, topK) 在已导入数据时返回空数组，改为当前三参数调用；rag_search 的无 Key 拒绝与导入入口同步替换为端点 / 模型校验。只修改上述两处行为，不改 UI、权限、索引格式或默认嵌入模型。真实 Vectra / SQLite 的 4 条测试先红后绿，覆盖导入、topK、磁盘重开和工具查询；全量 Unit 1210、根 tsc / build 通过。此项不是独立嵌入配置、外部服务或 S6 正式入口验收。

S2 本批修复边界（2026-09-20）：仅替换 embeddings 的全局永久熔断、index-sync 与 RAG 导入的空 Key 门控，保留配置工厂、默认模型、SQLite / Vectra 格式和调用方重试边界；删除的全局标志会错误封禁其他连接，失败仍向上传递，不转成假成功。参考 Alice 的依赖故障不应令整个记忆不可用原则，但不引入其云端 / 本地 / 字符特征降级链；本项目已有索引 worker 退避重试，无需新增调度器。旧逻辑 5 条红测；修复后 Unit 1206、Electron 有 Key / 无 Key恢复 2 项、Eval 23 + 1、根 tsc / build 通过。不关闭 S2：嵌入模型仍固定默认值，向量元数据尚无端点 / 模型身份，后续必须验证切换不会混用不同向量空间。

- OAuth 刷新、跨重启登录恢复、账户管理与 SSE OAuth 已由用户后置，遵循 DEC-043。
- 完整 PTY、地图、操作系统控制、浏览器脚本登录、云同步及新人物设定不在本合同授权内。
- 强制崩溃后恢复未保存凭据、多窗口产品、其他 OS 和安装签名不因边缘测试自动新增；已有合同中的生命周期要求需由 S4 核实，不能仅以「单窗口」口头豁免所有竞争。
- 外部付费供应商 / 第三方 OAuth 互操作没有本轮真实授权证据时如实写未验证，不把本地服务当厂商实测，也不静默发起收费请求。
- 现有主进程类型债与依赖风险继续由 WISH-043 / WISH-044 管理；本轮新增问题必须解决，不能将历史债混成新增无限清单，亦不能宣称风险清零。

执行顺序：S1 → S2 → S3 → S4 → S5 → S6。前五包修改时只增补能证明具体缺口关闭的测试；最终回归用于确认整体未退化，不用于替代功能完成，也不因为一次重跑通过就抹去已知失败。

S1 实施边界与结果：SQLite 为唯一结构化记忆源，启动与成功提交后串行核对 Vectra 镜像；缺失 / 旧内容重建，删除与重复镜像清理，失败保留源数据并定时重试。采用持久源差异恢复而非第二份待办表，不改 schema / IPC / 备份格式。存储仅发提交通知，由 memory 层加载配置并执行索引，避免 storage 反向依赖 LLM。`memory-store`、`vector-store`、`memory/index-sync`、`embeddings` 的可取消请求参数、主进程启动 / 退出接线及恢复测试已完成；旧并发双写分支移除，分类 / 角色保留，写盘失败补偿内存。Vectra 查询缺 query 参数和首次冷读覆盖新索引均由真实测试复现并修复；原子存储适配器避免默认截断覆盖。Unit 9 条定向、全量 Unit 180 文件 / 1200 项、独立 Electron 1 项、完整 Electron 27 通过 / 4 外部模型条件跳过、Eval 23 + 1、assets / docs 门禁待本批收尾。参考 CC memoryScan 的事实源扫描、Alice 记忆分层及本项目 task-queue；S2 的嵌入配置 / 连接失败隔离仍另行收口。

## 1. 背景与目标（Why / What）

上一轮把正式右坞五工具的完成误判为全产品回流完成。实际正式 Settings 仍采用旧分组，WorldHub 仍为朋友圈 / 物什 / 名册 / 角色架，MemoryPanel 的紧凑卡片仍由 preview 条件控制。Vite 地址可访问、Playground 截图或右坞测试通过，都不能证明正式产品已采用全部候选。

目标是把用户已验收的产品体验进入正式 App 调用链，并补齐真实数据能力。范围包括 Chat 与导航、人物世界、设置与人物设置、记忆、主题与基础组件、工作区和跨页面状态。不得仅更新导航标签、复制候选页面或接入假数据后宣称回流。

授权覆盖已确认体验的实现与必要后端补齐；不自动扩大为云同步、操作系统控制、完整 PTY、浏览器脚本 / 登录、地图产品或新的生活内容设定。若必须改候选设计、涉及新的外部费用 / 授权或破坏性迁移，记录具体边界再请用户确认，不静默取消原目标。

## 2. 回流映射与验收单位

R03 / R14 外观验证：Unit 1078、完整 UI 254、根 tsc / build 通过；宽屏浅色和窄屏深色 Playwright 截图已人工查看。Electron 首轮本地模型发现点击超时，19 通过 / 1 失败 / 4 条件跳过；不改代码及断言，开启 trace 完整复核为 20 通过 / 4 跳过，偶发风险仍保留 WISH-042。证据见 `var/verification/appearance-shared-ui`、`appearance-shared-electron` 与 `appearance-shared-electron-trace`；该结果仅覆盖本批共享改造，不关闭 OAuth 或全产品验收。

R03 / R14 外观同源收口（2026-09-19）：源码对照确认正式 renderGeneral 与候选 AppearancePage 各自复制主题 / 字号按钮，虽读取同一设计资产，控件实现仍分叉。用户已授权全部已确认体验回流；本批将相同业务结构提取为 AppearanceSettingsContent，选项直接读取设计资产，复用 Foundation ActionButton，原有主题 / 字号状态与保存仍归正式入口，候选只更新隔离内存。允许修改上述两个消费者、共享组件、体验注册表、复用 Unit、外观 E2E 及相关文档；删除的仅为两处重复渲染，不删除任何选项或后端能力。不改 Foundation 默认行为，不增加主题、IPC、依赖或数据迁移。验证两处真实 JSX 引用、资产选项一致、主题切换 / 字号 / 重载、候选隔离和 hover 几何；四主题宽窄回归。当前浏览器连接失败，本轮尚未取得人工逐页截图证据，不得据此关闭 R01–R14 总验收。

R07 记忆预检一致性子项（2026-09-19）：已复现备份预检接受长度 0 / 1 / 20,001 的正文，而 memory-store 的权威校验拒绝这些值；旧 handler 会在调用记忆存储前提交会话 / 生活资产。此子项完整边界是“整份备份的正文校验与真实记忆存储同源，非法输入在任何业务写入前拒绝”。删除 data-export 内重复的正文长度 / 凭据判断，直接调用 assertMemoryContentAllowed；不改变存储类别、去重、向量索引、合并规则或 IPC 形状。允许修改 data-export、security-boundaries / data-export-ipc Unit、onboarding Electron 及记忆模块卡 / 进度 / 缺口记录；不改其他 UI、schema 或外部依赖。验收覆盖 0 / 1 / 2 / 20,000 / 20,001 边界、凭据拒绝、整份混合数据零写入、拒绝后合法导入重试。此项不代替合法输入的写盘失败补偿、跨存储原子性或崩溃恢复，R07 与总目标保持进行中。

R07 owner / 租约验收：handler 5 项受控红测先复现，首次测试夹具缺少 session-store 默认 loader，补齐后得到真实成功写入 / 并发进入的红测，再实施修复。最终新增 12 项 Unit 覆盖归属 / 互斥 / 失效 / 异常，全部 Unit 1069、完整 UI 252、独立 Electron 20 通过 / 4 外部模型条件跳过、Eval 23 + 1、根 tsc / build 通过；主进程同编译器对照 75 → 75 无新增。Electron 真实 invoke 在对话框 pending 时返回 busy，取消后正式页面备份往返成功。证据 `var/verification/backup-ownership-ui` / `backup-ownership-electron`；不声称主进程类型全绿、不声称备份跨存储原子性，不关闭 R07 与全产品目标。

R07 主进程生命周期边界：既有 data:export/import 使用 getFocusedWindow 且无统一锁，改为绑定 invoke.sender 对应窗口并在打开系统对话框前同步取得跨导入 / 导出的单操作租约；重复请求立即返回 busy，不排队打开迟到对话框。参考现有 MCP owner 失效监听与 config-lock，备份含交互对话框不能直接复用配置写队列。窗口销毁、渲染进程退出或主框架非原地导航使准备阶段失效，迟到对话框 / 文件读取不得进入写入；旧 finally 不得释放新租约。写入开始后保持互斥直到完成或失败，不声称能撤回已经开始的文件 / 数据库写入。继续使用既有 schema、安全过滤与合并策略，不声称导入所有存储已原子化或具备崩溃回滚。允许修改 data-export handler、专用备份操作租约模块、正式数据页 busy 文案适配、对应 Unit / UI / Electron 与模块 / 质量 / 账本文档；不新增外部依赖、IPC 频道或载荷字段。必测同窗 / 跨窗并发、取消与抛错释放、owner 非聚焦、无窗口 / 子框架拒绝、关闭 / 导航迟到、commit 中保持锁及真实 Electron 回归。数据库完整原子导入另按 R07 后续收口，不能因本锁上线关闭总目标。

R07 本批验收：Unit 1057、完整 UI 最终 252、Electron 最终 20 通过 / 4 外部模型条件跳过、资产 30、根 tsc / build 通过。真实 Electron 改为正式设置按钮发起导入导出，系统文件选择仅返回测试路径，实际 JSON / IPC / 独立目录存储恢复及重复合并均真实执行。四主题宽窄、同步锁、取消 / 错误 / 重试和跨子页 busy / 迟到隔离已覆盖；浅色宽屏与深色窄屏截图已检查。首次 UI 为 251 通过 / 1 旧整段文案断言失配，改为候选逐项列表断言；首次 Electron 为 16 通过 / 4 失败 / 4 条件跳过，导入新目录自动进入设置导致隐藏侧栏点击超时，后续 worker 重建缺前置，纠正首个初始化断言后整套通过。证据 `data-settings-ui-full` / `data-settings-ui-verified` / `data-settings-electron` / `data-settings-electron-verified` 位于 `var/verification/`。仅共享组件采用状态更新为 adopted，整项设置体验仍未完成；主进程全局备份锁与窗口生命周期继续归 R07 / WISH-045，不把本轮 UI 锁说成后端原子性。

R07 数据页同源边界：正式 renderData 与候选 DataPage 仍各自维护按钮和备份说明，正式对 IPC rejection 没有 catch。本批提取 DataSettingsContent，共用候选两列操作、逐项备份说明与页内反馈；按钮从 Foundation ActionButton 提供。删除两套重复 JSX；同步点击锁与迟到结果隔离归共享组件，正式 SettingsPanel 继续持有跨设置页的忙碌状态与入口锁，真实 export/import 仍由正式适配器注入，候选只模拟反馈。不改备份 schema、过滤、合并及恢复策略。允许修改共享组件、正式 / 候选调用、注册表、Unit / UI 测试及对应模块 / 质量 / 进度文档。必测四主题宽窄、hover / pending 几何、重复点击、取消、结构失败与 Promise rejection、失败重试、离页迟到隔离、候选零 IPC；已有真实 Electron 备份恢复继续回归。实现基于仓库现有组件，属于已批准 UI 回流，无需新增依赖或外部研究。

R01 / R14 本批验收：受控红测中保存值已写入但设置面板仍为 1，修复后同一用例及保存失败回归通过；新增连续五次 Playground 往返与搜索关闭 / 清空测试。Unit 1056、完整 UI 243、独立 Electron 20 通过 / 4 外部模型条件跳过、资产 29、根 tsc / build 通过。证据目录 `navigation-red`、`navigation-focused`、`navigation-ui-full`、`navigation-electron` 均位于 `var/verification/`。无视觉样式变化；本批只证明该保存期间竞态及当前回归通过，不关闭历史稳定性缺口，不推进整个体验为 adopted。

R01 / R14 导航生命周期修复边界：UI 受控保存测试已复现保存落盘后 Ctrl+b 触发 App 重渲染，待执行 Ctrl+n 被监听器清理取消，设置未离开且未新建会话。允许修改 App 全局快捷键监听、正式入口 E2E、模块卡与本合同 / 进度 / 日志 / 缺口记录；采用已提交状态引用，普通重渲染不取消导航，真实视图切换与卸载仍失效旧请求。保持保存失败拦截、开发者模式真实读取、重复离页锁；不修改 UI 形态、IPC、会话逻辑或依赖。这是已批准正式回流的缺陷修复，不新增候选。此前 Electron Playground 返回偶发失败尚无同一根因证据，WISH-042 不因此关闭。必测保存成功 / 失败、等待中重渲染与重复按键、完整 UI 及独立 Electron。

R10 复选框验收记录：Unit 1056、完整 UI 241、资产 29、根 tsc / build 通过；最终 UI 证据 `var/verification/checkbox-ui-full`。定向初测证明 h-4 在根字号 15px 下不是 16px，基础组件改为明确 16px；两处测试问题分别为错误导航路径、Playwright 拒绝对 disabled label 作普通点击，均按现场修正，禁用状态改为真实鼠标位置点击后断言不变。原始现场保留在 `checkbox-focused` / `checkbox-focused-verified`，不将中止批次记为通过。新 `checkbox.test.ts` 已显式纳入 Playwright UI project，避免只新增文件却未执行。

R10 复选框同源边界：把 FoundationAdvancedStories 内已有的原生复选框提取为 Foundation CheckboxField，基础故事、McpServiceCard 与 McpConnectionForm 实际消费同一控件。保留原生 input checkbox 的键盘、label、disabled 和表单语义，统一 16px 操作槽与主题强调色；不改变业务默认选中、工具许可保存、主进程执行前校验或 IPC。基础故事补已选 / 未选 / 禁用，既有 story key 保持不变；注册表 source 指向真实组件并在验证后更新状态。允许修改上述组件、UI / 产品体验注册表、绑定门禁与 Unit / UI 测试、运行时模块卡和文档。必须验收四主题宽窄、点击标签、Space 切换、disabled 不可操作、hover / 选中 / 保存中尺寸不变、许可失败保留及空许可准确提交；候选继续隔离。OAuth 与其他 MCP 能力不因控件统一而宣称完成。

R04 本批证据：绑定 Unit 新增检查先红后绿，完整 Unit 1055、UI 233、资产 28、根 tsc / build 通过；浅色宽屏与深色窄屏截图无控件溢出。首次 Electron 16 通过 / 4 失败 / 4 跳过，原码原断言带 trace 串行复核 20 通过 / 4 跳过，失败仍归 WISH-042。证据目录分别为 `var/verification/companion-foundation-ui-full`、`companion-foundation-electron`、`companion-foundation-electron-repeat`。无主进程 / IPC / 依赖变化，不扩称提醒后端或外部供应商验收。

R04 基础控件收口：CompanionSettingsContent 已被正式 SettingsPanel 与候选共同调用，但回答方式按钮、勿扰开始 / 结束与每日次数仍直接渲染原生控件。本批复用 Foundation ActionButton / TextField，保留候选卡片、字段和真实 settings 保存语义，候选只改内存；不改 Prompt、IPC、提醒策略或权限。不再保留该组件中的孤立按钮 / 输入实现，同时让候选角色架入口复用已有 ActionButton。检查还发现候选数字字段及补充说明为空回调，本批改为隔离本地状态，允许实际编辑但不持久化。允许修改上述两处 UI、组件注册 / 绑定门禁、正式入口 E2E 及对应文档。验收四主题宽窄、选中与键盘、hover 几何、保存失败恢复、候选隔离；不能以这些 UI 证据替代提醒调度后端验收或全产品完成。

下表是施工范围，不是已落地能力目录。所有行初始结论为**待正式验收**；部分已有真实实现需保留。每行施工前继续细化到具体控件、动作与数据字段，记录生产调用点和测试文件后才能推进状态。

| 编号 / 候选来源 | 正式落点 | 数据路径与已知差异 | 迁移分类 / 必须验收 |
|---|---|---|---|
| R01 Chat / `product-experience-journeys-v1.md` | `src/App.tsx`、`src/components/shell/PrimarySidebar.tsx` | 既有会话与 chat IPC；逐态对照欢迎、会话、处理、失败、导航及右坞分隔 | 直接回流已有流程，缺失行为先改造；离开 / 返回不丢会话、草稿或任务 |
| R02 设置骨架 / `SettingsExperienceCandidate.tsx` | `src/components/SettingsPanel.tsx` | 正式与候选共用 SettingsLayout 九区导航；各业务页连接真实设置与独立 IPC | 生产改造后回流；日常 / 高级分组、九个内容入口、嵌入记忆 / Skills / 角色架、窄宽及返回 |
| R03 外观 / `foundation-design-language-v2.md` | 设置外观、`src/index.css`、共享设计资产 | 四主题与全局主题共用资产；旧开发主题值不要求兼容映射 | 生产改造后回流；瓷青 / 曜石 / 松烟 / 绛紫同源，当前设置重启恢复、Markdown / Diff 各入口 |
| R04 伙伴与相处 / 设置候选 | 正式伙伴设置、`CharacterShelfPanel` | 既有角色切换、提醒、反思与 settings；候选补充说明写入链路待核实 | 生产改造后回流；设置内角色架、真实偏好保存与生效、流中禁换角、跨页同一主角 |
| R05 记忆 / `SurfaceBaselinePanel.tsx` 的 MemorySurface | `MemoryPanel`、正式设置记忆页 | `memory:*`、memory-store / vector-store；正式与故事共用四类导航、搜索、紧凑卡片及列表后新增行；六种历史类别按共享映射唯一归属 | 整页已接入；四类真实写入与重启、搜索 / 草稿 / 几何及失败恢复证据见 R05 记录 |
| R06 模型 / `playground-model-and-workspace-v2.md` | 正式模型设置、LLM 配置工厂 | 已有 settings、连接 CRUD、用途路由与 `settings:fetch-models`；Playground 获取仍是隔离 fixture | 生产改造后回流；连接 CRUD、发现与手动模型、用途路由、凭据安全存储、旧配置迁移、真实调用与失败恢复。本批收口主进程发现与认证失败恢复；不把 Playground 夹具当真实请求，也不把全产品标 adopted |
| R07 数据与隐私 / 设置候选 | 正式设置数据页及导入导出服务 | 复核实际导入 / 导出 / 备份字段与隐私边界；不按候选文案假定已包含所有数据 | 直接回流已有流程，缺失能力改造；取消、无效备份、失败提示、实际恢复一致性 |
| R08 权限与自动化 / 设置候选 | 正式权限设置、`PermissionRulesEditor` | 既有 executionMode / permissionRules 与执行侧规则引擎 | 直接回流既有规则能力；默认收起、独立规则卡、列表后添加、原位取消、保存及执行侧生效；硬边界优先 |
| R09 Skills / `playground-skills-detail-v1.md` | 正式设置 Skills、共享 `SkillViews` | 真实 list / get / validate / save / delete / set-enabled；registry 与 SQLite 启停状态 | 列表、独立详情、限高 SKILL.md 全文、真实启停与错误恢复；试跑不回流正式页，证据见 R09 执行记录 |
| R10 MCP / `playground-mcp-scenarios-v1.md` | 正式 MCP 设置、MCP 服务及 IPC | 真实协议 / Bearer / 首次 OAuth / 逐工具许可已接入；长登录与刷新后置，不以保存配置当连接成功 | 生产改造后回流；连接 / 断开 / 重试 / 删除、认证取消、工具开关持久化与执行侧校验；需细化安全契约 |
| R11 关于与开发模式 / 设置候选 | 正式关于页、开发入口、App 导航 | 核实 developer mode 配置、重启与入口门控，不仅隐藏单个按钮 | 生产改造后回流；正式与候选共用 `AboutSettingsContent` / `SettingSwitch`；普通模式隐藏 Debug / Playground 入口；「关于 My Agent」真实持久化控制入口可达，关闭安全返回且不删除数据。UI E2E 的 `ui-e2e` 模式仍显式保留开发入口，不能当作正式默认 |
| R12 人物世界 / `playground-world-living-dimensions-v1.md`、`SurfaceBaselinePanel.tsx` | `WorldHub`、`MomentsPanel`、`AssetsPanel`、`CastPanel`、`WorldDetailsPanel` 及共享 `WorldLivingContent` | 六生活面入口已接通；文化角 / 家居 / 足迹正式页走真实增改删，Playground 只改内存预览；足迹动态来自 moments；正式通讯录列表读取既有 `check-cast-availability`；正式朋友圈赞 / 评论落独立用户表；六面正式入口 Electron 已覆盖真实 IPC 读取；文化 starter 已去掉无证据数量文案；无 world.default.json 时世界态 / Catch-up / Prompt 切片回退为「未设定」，不再写入城西小公寓等未确认住所 | 生产改造后回流；衣柜 / 文化 / 家居 / 足迹编辑链、通讯录忙闲预检、朋友圈互动、六面正式入口 Electron、文化 starter 无证据数量文案与人物 starter 来源复核本批收口；不复制生活样张为生产事实，不把入口可见当成人物设定授权；合并原重复 R06 人物世界行，R06 仅指模型 |
| R13 工作区 / `playground-workspace-five-tools-v1.md` | `ChatRightDock` 及五工具 | 已有真实 project / session / terminal / browser / chat IPC，保留已验证实现 | 对照候选补差，不从头重写；重复图标、滚动、任务上下文、关闭 / 取消 / 失败恢复 |
| R14 Foundation 与业务状态 / `foundation-reuse-enforcement-v1.md` | 共享基础组件及以上消费者 | 部分工作区已有符号复用检查；不能外推为所有体验覆盖 | 同源复用与门禁；加载、空、错误、确认、hover/focus、长文、禁用、深浅宽窄 |

R12 必须拆成六个独立验收面：

| 生活面 | 复用起点 | 必补核验 |
|---|---|---|
| 朋友圈 | MomentsPanel、生活事件 | 真实动态 / 媒体 / 时间地点；候选互动存在时必须核实后端，不挂空操作 |
| 衣柜 | AssetsPanel、wardrobe 资产 / 当前穿着 | 当前与最近穿着来源、切主角隔离、真实编辑及空态 |
| 文化角 | bookshelf 与资产 / 生活事件 | 阅读 / 笔记 / 音乐 / 电影 / 摄影的真实类型与关系；缺 schema / 服务则补齐 |
| 家居 | 世界状态 / Role Pack / 资产 | 当前空间与物件的真实读取和必要持久化；不是设备控制 |
| 通讯录 | roster、CastPanel、召唤会话、`check-cast-availability` | 联系人与关系、最近互动、列表忙闲预检和开聊二次判定；不是切主角入口 |
| 足迹 | 地点与生活事件 / 世界状态 | 去过 / 常去 / 想去及地点记忆的归属与持久化；不是地图服务 |

统一留在 Playground：场景 / 宽度 / 主角夹具切换器、源码路径、基础引用说明、比较控件、采用标记、模型与生活假记录、故障注入开关、实验会话。真实数据为空必须显示真实空态；空态不能代替必要后端实现。

## 3. 技术与管理方案（How）

### R06 模型诊断窗口生命周期（2026-09-19，已验证子项）

验证：两条装配等待导航用例先红后绿；Unit 1191、根 tsc / build、Eval 23 + 1、资产 31 通过，主进程诊断 74 → 74 无新增。真实 Electron 专项从正式表单创建连接，模型发现与测试等待时重载均关闭服务端 HTTP，再次进入可重试；完整 Electron 26 通过 / 4 外部模型条件跳过。没有 UI 视觉变更，未重跑纯 UI 套件。此子项不替代关窗草稿保护、多窗口冲突或全产品回流验收。

正式 Renderer 已按请求身份丢弃迟到结果，但主进程 settings:test-connection / settings:fetch-models 未绑定 sender，重载或关闭窗口后仍可能发起 / 等待网络调用。本子项沿现有 backup-operation 的主框架归属与事件清理模式，增加只读诊断请求作用域；在读凭据、装配配置之后复核存活，在途网络接入 AbortSignal，成功与失败均释放监听。只接受存活窗口的主框架，主文档导航、渲染进程退出和窗口销毁撤销操作；同页导航不撤销。不更改配置格式、IPC 载荷、模型工厂、页面布局或 OAuth 范围；普通 React 子页切换继续由既有请求身份隔离，不声称新增页面级网络取消。允许修改 settings IPC、诊断作用域 helper、model-discovery、对应 Unit / Electron 与文档。先受控复现配置等待时窗口失效后仍发请求，再验证在途取消、子框架拒绝、成功失败监听清理及真实本地 HTTP 断开。

### 单一实现与证据链

沿 `候选故事 → 正式组件 → App 导航 → preload → handler → 服务 / 存储 → UI 反馈` 审核每个动作。基础控件由 Foundation 提供，业务布局和状态由正式组件持有，Playground 通过 props / 隔离数据复用。禁止生产 import `SettingsExperienceCandidate` 或 `SurfaceBaselinePanel` 来快速得到假页面。

每个编号实施时登记：已批准内容、具体允许修改文件、不碰项、真实数据路径、变更类型、测试命令、测试文件与结果、文档、剩余风险。现有 adopted 布尔值和 registry 状态不是验收证据；不能先批量改标记。

### 后端补齐约束

- 先核实已有模块与参考，复用服务；新 schema 在本合同补字段、迁移、输入校验、归属和回滚方案后再改，不能直接用 fixture 类型定义生产契约。
- IPC 四处同步。加载失败与真实空数据区分；取消、重试、重复提交、乱序与卸载后返回都有明确行为。
- 模型连接统一进入 `loadMainLLMConfig` / `loadAuxLLMConfig` 和既有调用入口；凭据仅经安全存储，不进页面摘要、日志或夹具。
- 人物世界沿单活跃主角、Role Pack / 生活引擎 / 派生截面扩展，不维护第二份世界真相，不擅自定人物故事。
- 记忆四类需明确与既有类别的存储和检索关系；保留 SQLite / 向量一致性及敏感边界，不按内容字符串猜分类。
- 没有外部凭据时可完成本地能力与协议测试，但真实厂商行为保持未验证，不能报告真实后端验收通过。

### 实施顺序

1. 建立本合同、纠正进度和缺口；从正式调用点确认差异，不以旧完成记录替代审计。
2. 统一正式设置容器与入口，回流记忆、伙伴与角色架、权限等交互；每个单元保留真实功能与失败恢复。
3. 回流人物世界六面；复用生活数据，完成缺失服务 / 持久化后接入，不发布只有 Tab 的空壳。
4. 完成模型、MCP、Skills、数据与隐私的真实控制链路；必要后端与前端一起验证。
5. 核对 Chat / 导航、四主题、Markdown / Diff 与全产品基础复用；已完成右坞只补差异。
6. 从正式 App 入口全旅程验收；最后更新采用状态、收拢稳定文档并冻结合同。

该顺序是施工依赖，不是简版先交付。未完成项继续属于本目标，不擅自移入暂缓；每次提交必须是可独立验证的完整变更。

### R10 添加向导的生产协议链路（2026-09-15）

- 纠偏记录：初版 `testing → ready` 会触发 effect cleanup，测试替身未同步取消状态而漏检。本轮将清理改为卸载与显式操作，候选重复表单替换为 `McpConnectionPreview` actions 适配器；正式与样张实际渲染同一组件。新增表单校验、共享 JSX 门禁、正式取消 / 迟到 / 重测 / 刷新失败回归和真实 SDK 测试。下述全写入锁、资源接管和异常恢复是必须完成的合同要求，不表示当前已全部实现；缺口同步 WISH-045。完整 R10 和全产品目标保持进行中。
- 2026-09-15 后端补齐：测试连接与正式 Manager 共用 MCP client capability 和 form elicitation 处理器；测试阶段请求取消，保存接管后使用正式处理器。资源清单随测试连接移交，不再在保存后丢失。保存成功 / 接管失败结果按 owner + requestId 做有界短期重放，工具选择变化不会复用旧结果；确认迟到、窗口销毁、渲染进程退出和主导航会清理测试会话。整表设置、向导新增与工具许可写入统一经过配置锁，写盘失败不更新内存许可。专项真实 SDK / 并发测试已通过；新流程真实 Electron 数据目录验收与完整重启恢复仍未完成。

- 添加流程施工范围补充：新建 `mcp/connection-tests.ts` / `config-lock.ts`、`settings/McpConnectionForm.tsx` 与共享草稿解析；修改 MCP Manager 的已连接对象接管入口、MCP / settings IPC、preload、共享类型 / Renderer 声明、SettingsPanel 与 SettingsExperienceCandidate 及对应注册和测试。替换旧添加表单、旧 handleAddMcp 与候选重复表单 JSX，不删除旧配置或现有服务管理后端。
- 测试会话按 Renderer 与 requestId 绑定，同窗口只允许一个、全局最多八个；主进程风险确认通过后连接，连接 / 发现总超时 30 秒，已测试结果保留 5 分钟。取消、页面离开、窗口销毁与超时清理连接，未保存的测试不写设置、不进入生产工具注册表、不自动重连。工具发现分页有页数、数量与累计大小上限。
- 保存只接收已测试 requestId 与该会话发现的工具白名单，不重新接受凭据或地址。先加密持久化，再接管同一已测试连接，避免二次启动本地服务；保存期间不允许取消或重复保存。持久化失败仍可重试；若保存已成功但连接失效，明确报告已保存未激活，由服务列表重试，不伪装回滚。所有 MCP 配置读改写使用主进程串行锁；既有整表写入的跨窗口旧快照冲突不由该锁冒充解决。
- 表单共用纯 props / 适配器：正式接真实 IPC；Playground 保留明确隔离 fixture、直达场景与模拟结果。基础按钮 / 输入 / 模式选择来自 Foundation；长工具清单内部滚动，异步操作槽固定，字段变化使旧测试结果失效。最终必须新增正式入口 UI 与真实 IPC / 本地协议证据，不能只以共享导入判定完成。

- 来源：已批准 MCP 添加候选的远程 Streamable HTTP / Bearer、本地 stdio、测试后选工具并保存。现有服务卡片共享不代表该向导完成。
- 实施顺序：先补生产传输与凭据契约并用真实本地协议服务验证；再补独立、可取消、未保存不注册工具的测试会话；最后共用添加表单并接入主进程保存 / 激活 / 失败恢复。这是同一 R10 的施工依赖，不缩减最终范围。
- 当前允许修改：`src/shared/types.ts`、`electron/main/mcp/client.ts` / `transport.ts` / `config-security.ts`、MCP IPC、preload / Renderer 类型声明、SettingsPanel 的类型与协议标签、对应 MCP Unit / 协议测试及模块卡、质量、进度、变更与缺口账本。保留其他存量改动。
- 契约：新增 `streamable-http` 与可选 `bearerToken`；继续读取旧 stdio / SSE 配置，不给旧表单增加兼容入口。MCP JSON 已由 safeStorage 加密，令牌只能在主进程恢复；Renderer 仅见哨兵。同 id 但地址或传输已变时不得恢复旧 Bearer；带令牌仅允许 HTTPS 或本机回环 HTTP，拒绝 HTTP 重定向，防止凭据被转发到未确认端点。不新增依赖，不改备份白名单或权限引擎。
- 必测：真实 SDK 初始化、工具发现 / 调用、资源读取、401 / 重定向拒绝、凭据脱敏 / 合并 / 修改地址拒绝、旧协议兼容和 IPC 类型同步。协议 fixture 证明本地互操作，不证明第三方服务认证或完整向导验收。
- 已复现空工具故障：仅声明 resources 的真实 SDK 服务收到 tools/list 后返回 -32601，旧 refreshInventory 将其标为连接失败。仅在未声明 tools 时使用空清单；声明后发现失败继续上抛。真实 stdio 子进程同时回归敏感环境过滤与显式 env，不改变父进程环境。
- 添加向导批次：正式表单已替换旧“直接连接”表单，测试 requestId 与窗口绑定，取消 / 卸载清理，测试结果选择工具后才可保存；配置保存成功后接管同一连接，保存失败保留结果。正式 Renderer 8 项组合回归通过。生产连接测试的真实主进程 IPC / 保存 / 接管尚未有 Electron 独立数据目录证据，候选表单仍是隔离样张；R10 继续进行。
- 本批结果：Unit 147 文件 / 856 项、串行 UI 120 项（`var/verification/mcp-http-ui`）、既有 Electron onboarding 8 项、根 tsc / build、Eval 23 + 1 项通过。新增协议测试直接运行正式 Manager 与回环 SDK 服务，Renderer 新增八种主题 / 宽度展示证据；Electron 仍仅既有回归，不宣称新协议完整保存 / 重启验收。主进程独立 tsc 仍失败，同一 CompilerHost 基线对比 71 → 70、无新增且移除 MCP ProcessEnv 诊断；CLI 的诊断输出与该对比口径分开，不当作全门禁通过。无独立 lint 脚本，审计全量 7 / 生产 4 未清零；添加向导、隔离测试取消和统一保存 / 激活仍待实现。
- 添加向导批次：正式表单已替换旧“直接连接”表单，测试 requestId 与窗口绑定，取消 / 卸载清理，测试结果选择工具后才可保存；配置保存成功后接管同一连接，保存失败保留结果。正式 Renderer 8 项组合回归通过。生产连接测试的真实主进程 IPC / 保存 / 接管尚未有 Electron 独立数据目录证据，候选表单仍是隔离样张；R10 继续进行。

### R02 本次施工边界（2026-09-14）

- 离开门控本批验证：Unit 959、静态 UI 189、Electron 18（外部模型 4 项条件跳过）、根 tsc / build 通过；定向 6 项覆盖八种离开快捷键、返回按钮深浅宽窄和高级参数。未新增依赖或改变 IPC；无独立 lint 脚本，使用 diff 检查且不将类型检查冒称 lint。全产品目标保持进行中。
- 2026-09-18 离开门控补齐：已复现保存失败后 Ctrl+, 卸载设置并丢失草稿。允许修改 App 全局导航接线、SettingsPanel 保存句柄、正式入口 E2E 和对应模块 / 质量 / 进度记录；复用既有 persistSettings 队列，快捷键成功保存后才切页或新建会话并刷新外层设置，重复离开请求在处理中不重复执行。不改 IPC、模型 / MCP 编辑器、权限或人物数据；既有 closeSettings 移到快捷键注册之前并允许指定目标页面，保留原来的外层状态刷新。

- 目标：正式设置按当前 Playground demo 的页面结构、控件、文案层级和交互完整回流，不是给旧设置换导航。记忆、Skills、角色架也必须采用已验收候选形态；仅把旧面板嵌入设置不能视为完成。真实保存及必要后端按 demo 需要接入，不要求保留全部旧设置能力。
- 文件归属：新增 `src/components/settings/SettingsLayout.tsx`；修改 `SettingsPanel.tsx`、`playground/SettingsExperienceCandidate.tsx`、必要的 `CharacterShelfPanel.tsx` 错误反馈；对应 Unit、Renderer / Electron E2E、注册表与质量 / 模块 / 账本文档。App 仅在回调接线必要时调整，不改 Chat 主流程。
- 迁移：以 demo 可见的模型控制、伙伴与角色架、记忆、Skills、MCP 等流程为准。取消上一版“旧参数页和旧开发者页必须换位置保留”的方案；不把 MUTABLE 原文、反思调校等旧设置独有功能塞进新设置。demo 需要的模型高级控制仍按其候选结构实现，不等于搬回旧参数页。
- 删除授权与数据边界：用户已授权舍弃旧设置 UI 能力；逐项说明旧入口 / 表单的移除及影响。此授权不等于删除用户数据、凭据、角色资产，或任意删除仍被其他入口使用的后端服务。必要存储 / 安全契约继续保留；无关后端不顺手清理。
- 不碰：模型 / MCP 新协议、记忆分类存储、六面数据模型、权限引擎、Prompt 与运行时。各内容页的完整视觉回流仍按对应编号推进，R02 不能代表 R03–R14 完成。
- 验证：共享导航数据及真实渲染引用 Unit；正式入口九区导航、窄屏键盘、角色架切换失败、内嵌记忆读取 / 编辑、Skills 读取及设置保存 E2E；完整 Unit / tsc / build / docs / assets 门禁。

### R04 相处说明接入边界（2026-09-14）

- 复核：上次提交仅接入了共享导航和部分伙伴内容；R02–R04 尚未整体验收。设置页仍有旧内容，不能写为全页 demo 已完成。
- 相处说明使用独立的 `companionResponseNote`，默认空、上限 4000 个 UTF-16 代码单元；不从旧 `systemPrompt` 迁移，也不覆盖它。沿既有 settings:get/set 保存，适用于本机所有伙伴的下一轮主对话与召唤；workspace 会话不注入。
- 组装使用独立 L3 用户偏好区块，序列化为带引号的文本，不替换身份、工具权限或系统规则；主进程存储限制长度，Debug 同源展示组装结果，用户正文不作为内置资产登记。
- 文件范围：SettingsPanel / CompanionSettingsContent / SettingsExperienceCandidate、共享设置类型、settings-store / settings IPC / preload / renderer 声明、runtime / prompt-builder / debug / Prompt 注册表、备份设置白名单及对应测试；同步伙伴模块卡与质量、进度、变更账本。
- 验证：旧 systemPrompt 不变、空值清除、超长拒绝、重新打开恢复、保存失败重试、候选编辑不写 IPC、Prompt 身份与权限不变、真实 Electron IPC 及独立测试数据目录。不上真实付费模型，不改模型/MCP/世界状态契约。

#### 当前收口记录

- 本批验证：Unit 825 项通过；根 `tsc --noEmit` 与 build 通过；UI 最终串行 95 项通过；Electron 7 项通过，4 项外部模型 Key 用例按配置跳过；assets / docs 门禁通过。Electron 本地协议服务已核验偏好进入主对话实发请求、workspace 请求排除偏好；未运行付费模型服从性 Eval。
- UI 稳定性记录：一次并行全量中记忆候选按钮在点击时被卸载并回到主界面；保持测试 / 产品代码不变，单独 trace 复核和最终串行全量均通过，根因尚未确定，不声称修复。失败现场在 `test-results`，复核 trace 在 `var/verification/memory-ui-recheck`。
- 2026-09-18 已复现并补全局快捷键保存门控；正式 Renderer 定向覆盖失败留页与草稿保留、成功后新建会话、重开恢复，以及原有返回按钮和高级参数自动保存。该证据不外推为窗口强制退出或独立模型 / MCP 编辑器草稿保护。

- 主进程独立类型诊断复核：对照上一提交的内存源文件，前后各 72 条；按文件、错误码和主错误信息比较无新增诊断（不比较行号和 import 链条明细）。这是无新增问题证据，不代表 `tsconfig.node.json` 门禁通过；历史问题仍由 WISH-043 管理。

- 伙伴设置已接独立字段、串行增量保存、失败重试固定槽及备份限长校验；证据落在 `prompt-builder`、`prompt-assets`、`settings-security`、`security-boundaries` Unit 与 `chat` / `onboarding` E2E。R04 整体仍待角色架等正式流程统一验收，不将该字段闭环等同全部伙伴设置完成。
- 修正上次误登记的 Foundation 故事：`foundation.settings-layout`、`foundation.setting-card` 没有对应基础 renderer，移除这两条错误故事记录，将实际组件登记为 Experience；组件本身保留，不删除任何已存在基础控件能力。
- 历史定位时正式仍为七个旧主题；2026-09-15 已切为四主题同源及旧值归一化，该旧诊断不再代表当前代码。正式模型、记忆、Skills、MCP 等内容不能因已嵌入九区导航而标为采用完成。

## 当前收口记录（2026-09-15）

### R13 跨页与上下文归属（2026-09-18）

- 验证环境补强：完整回归 trace 记录测试中途重新加载页面，重载前后 main.tsx 的 Vite 时间戳不同。允许同步调整 playwright.config.ts：一次构建的 ui-e2e 静态预览使用独立 5175，禁复用已有服务器，失败保留 trace；不修改业务断言或超时来遮掩问题，不把开发目录变动来源认定为已解决。
- 最终批次验证：Unit 959、静态 UI 188、Electron 18（4 项外部模型条件跳过）、根 tsc / build、资产 / 文档门禁通过。正式载荷专项覆盖审阅多实例、不同主会话、失败与清空重试、迟到 diff，以及文件乱序、缓存和关闭来源。环境加固同步 vite.config.ts 的 ui-e2e 多入口和 DesignSystemPanel 秒 / 毫秒换算；正式 dist 不含测试 HTML。无新增依赖、无独立 lint 脚本；本批不因此标全产品 adopted。
- 用户已批准五工具体验回流；本批对照实际 App → ChatRightDock → 文件 / 审阅 / 侧聊，补真实当前选中内容的上下文归属，不改变候选布局。正式浏览器移除用户已否决的地址栏重复图标，保留顶部标签图标。
- 已复现：A / B 文件读取乱序后页面选中 B，侧聊 send.focus 却收到 A；缓存文件切回及关闭来源也必须正确更新。按标签实例记录来源，只有最近选中的文件 / 审阅实例给侧聊供上下文，后台响应不能抢选中来源；关闭来源清除、换会话清除旧审阅、换项目由现有 key 重建全部实例。
- 允许修改：ChatRightDock、WorkspaceFilesPanel、ReviewPanel、BrowserPanel、对应正式入口 E2E / Unit、运行时模块卡 / 架构 / 质量及进度账本。不改 Runtime、权限、LLM 配置、IPC 载荷或人物数据；Playground 继续共用文件组件，不接真实数据。
- 必测：乱序读取、预览 Tab / 缓存切换、关闭来源、多实例隔离、审阅失败 / 清空、切页保留和换会话隔离；正式发送载荷与实际可见内容一致。完整 UI / Unit / 类型 / build / Electron 门禁仍需通过，不能以此子项覆盖 OAuth 或全产品验收。

### R10 异常恢复补验（2026-09-17）

- 凭据专项最终验证：定向 Electron 1 项及完整 Electron 18 项通过，4 项外部模型条件跳过；Unit 959、根 tsc / build 通过。未改生产代码或依赖，不重复 Renderer UI，不将旧 UI 数量当本批新结果；无独立 lint 脚本，diff 检查通过。
- 2026-09-18 凭据专项：扩展 onboarding.test.ts 的真实 MCP 保存 / 重启用例，使用随机临时 Bearer、本地认证服务和独立 userData；检查无认证 401、系统 safeStorage 可用、SQLite 密文和无 Token 原文、Renderer 哨兵，以及完整重启后新认证请求和 connected / 工具清单。只改验收及文档，不改生产存储或 IPC，不将该证据外推为 OAuth、第三方认证或其他凭据类型；原生确认仍沿既有测试替身批准。
- 2026-09-18 最终验证：Unit 959、UI 186、Electron 18 通过，4 项外部模型条件跳过；根 tsc / build、资产检查、Eval 23 + 1 通过。独立主进程 TypeScript Compiler API 对照 HEAD 覆盖本批源文件，前后各 75 条，按文件 / code / 主错误信息多重集比较无新增；导入来源说明差异不算新诊断，既有错误仍由 WISH-043 管理。无独立 lint 脚本，不把 tsc 称作 lint。Electron 初次整套失败先记录实际 DOM / 调用模型 / cwd，再修正新连接表单、显式移除旧测试路由和 stdio 夹具模块解析，未跳过本地测试。
- 范围：MCP Manager 连接生命周期、状态推送四处契约、Settings 订阅与迟到响应隔离、对应 Unit / Renderer / Electron；不改 OAuth、凭据策略、权限确认或其它 Runtime 行为。
- 异常关闭保留 error / reconnecting 快照，手动停止撤销归属；替换流程在 await close 前占有槽位，旧握手、旧关闭与旧失败不得操作新连接。重连失败只由当前连接安排下一次重试。
- 自审复现：停止期间旧流程仍调用 connect；Renderer 失败推送被迟到的 connected 查询覆盖。两者均先失败复现再修复，新增时序回归，保持真实协议与 stdio 子进程验证。
- 本批附带验收修复：朋友圈共享 hover 样式移除 translateY，严格保留评论槽几何断言；衣柜测试使用真实按钮名称 / 脱敏提示，并补齐入口所需 catchupStatus 夹具。
- Unit 161 文件 / 959 项通过；定向朋友圈、衣柜及四主题图表 3 项通过。完整 UI 前次 183 通过 / 3 失败，后续完整门禁结果以进度记录为准；图表偶发超时继续归 WISH-042。OAuth、safeStorage 凭据完整重启恢复、R13 跨页状态及全产品采用均未完成。

- R10 当前施工：先将候选与正式的 MCP 服务卡片合并为 `settings/McpServiceCard.tsx`，正式启停、删除、重试和工具许可继续调用既有 settings / MCP IPC；未知工具清单与已知零工具分离，长清单内部滚动，忙时操作槽固定。允许修改该共享组件、SettingsPanel、SettingsExperienceCandidate、对应 Unit / E2E、组件注册及运行时模块卡、质量和账本。不改权限引擎、连接确认、安全存储或 IPC 形状；旧服务列表 JSX 由共享卡片替代，不删除后端服务。候选本地/远程添加向导、Streamable HTTP / 认证和可取消测试仍属于 R10 待补部分，不因卡片共享而宣布整项 adopted。
- R10 已复现并修复当前页禁用 / 删除顺序：先保存配置，保存被拒绝时不得断开；保存后的停止通道若异常，明确报告配置已保存但连接状态未确认，不伪装成未发生任何变更。两次 IPC 不是原子契约，主进程统一协调与异常恢复仍由 R10 管理。
- 验收环境补充范围：真实 Vite 日志确认 `var/verification/.../traces/resources/*.html` 引发连续 page reload，破坏正在执行的验收。允许修改 `vite.config.ts` 的 watcher 排除与 `.gitignore` 的验证产物规则，并新增读取实际配置、启动真实 watcher 的单元回归；仅忽略 `test-results` / `var/verification` 产物，不关闭源码热更新，不更改产品路由或弱化 UI 断言。该修复不外推为此前无 trace 的返回首页问题已解决。
- Foundation 符号门禁的 5 秒超时在串行 Unit 再次复现：独立测量读取 436 文件（401 个依赖文件），实际审计仅需 7 个真实文件和 1 个负例夹具。本批允许将该测试的 TypeScript Program 限制为这些显式根文件，增加精确文件集合断言，保留全部 JSX 符号归属、别名和遮蔽负例；不增加超时，不替代完整 tsc 门禁。
- R10 本批最终证据：默认 `npm run test` 146 文件 / 844 项通过；根 tsc / build、Eval 23 + 1 项通过；MCP 专项 12 项通过；最终串行全量 UI 112 项通过（`--trace=retain-on-failure --output=var/verification/mcp-full-ui-isolated`），Electron 现有 onboarding 回归 8 项通过。此前完整 UI 曾为 111 通过 / 1 超时，原失败用例独立 trace 连跑 3 次通过；随后另定位 trace 产物引发重载并修复，未将所有偶发退出统称已解决。依赖审计全量 7 项 / 生产 4 项未清零（WISH-044）；仓库无独立 lint 脚本，未把 tsc 称为 lint。MCP 真正外部连接、完整添加流程及停止异常恢复仍待后续验收，本合同保持进行中。

- R12 文化角展示回流：允许修改 `WorldLivingContent`、`WorldDetailsPanel`、`SurfaceBaselinePanel`、相关 Unit / Renderer / Electron 测试及注册说明和文档。以已确认的四类卡片和读书笔记替代正式页旧嵌套列表；候选与正式共用 `WorldCultureContent`，书架既有笔记不丢失，未知类型和同名不同资产保留。不改 IPC、存储、人物设定、Prompt 或权限，也不新增播放等候选未具备的动作。
- 本批验收边界：Unit 验证分类、笔记、空态、异常字段和转义；Renderer 覆盖四主题宽窄长文；Electron 从正式入口验证真实资产 IPC 更新后的重载显示，不把 Renderer 重载称为完整应用重启或备份恢复。文化内容来源、生命周期、编辑流程和六面完整验收仍归 R12，不因共享展示已完成而标整个体验 adopted。
- Electron 实测补齐范围：`updateAsset` 把长笔记截为 24 字，故本批增加 `life/assets.ts` 与 `companion-assets.test.ts` 的正文保存修复。文化 / 书架的 note、detail、description 支持最多 4000 UTF-16 代码单元，保留换行和正文；超限或类型错误在 SQL 更新前拒绝，不部分修改名称。其他短标签规则、角色归属、IPC 形状和数据库结构不变。书架注入 Prompt 时仍仅取 24 字笔记摘要，存储全文不自动扩张模型输入；不进行破坏性迁移，已截断的历史内容不能自动恢复。
- `prompts/registry.ts` 与 `prompt-assets.test.ts` 同步书架动态插槽的真实格式化来源，不复制正文或阈值为第二事实源；这是前述不改 Prompt 范围的唯一必要补充，身份和行为文案不变。
- 文化角最终验证：Unit 串行 144 文件 / 839 项、Renderer UI 104 项、Electron onboarding 本地回归 8 项、Eval 23 + 1 项、根 `tsc --noEmit`、build 与 assets 检查通过。Electron 覆盖真实资产读写与 Renderer 重载，不代表完整应用重启或用户备份恢复；未调用付费模型。主进程独立类型对照为前后各 71 条诊断、无新增，不等于该门禁通过。默认并发 Unit 曾触发既有 Foundation 检查超时，最终串行通过但未宣称稳定性修复（WISH-042）；依赖审计仍为全量 7 项 / 生产 4 项，未改依赖，仍由 WISH-044 管理。

- R12 本批边界：`life/assets.ts` 为住所和常去地点增加真实 Role Pack 派生定义，与 `companion_asset_seeds(role_id, kind)` 同步事务初始化；无默认值不生成，已有资产优先，失败回滚且删除后不补种。默认物件初始化按稳定物件 ID 识别，避免新住所挡住原物件。
- 家居 / 足迹正式页和 Playground 共用 `world/WorldLivingContent.tsx`；正式 `WorldDetailsPanel` 负责真实 IPC、刷新失败保留内容、重试和主角一致性校验。常去、想去展示与动态日期不混淆，不新增虚假的访问记录。文化角组合与编辑入口不在本批完成范围，仍属 R12 未完成项。
- 证据：`companion-assets` / `companion-asset-registry` Unit 覆盖真实 sql.js 初始化与回滚；`chat` Renderer 四主题宽窄覆盖正式入口、长文、刷新失败 / 重试、两条同地点动态和角色不一致。Renderer 使用 IPC 替身，不能替代六面真实 Electron 验收。现有用户备份遗漏生活资产与初始化标记，继续在 R07 / WISH-045 内补齐。

- Electron 真实回归已通过 7 项：首启模型路由、伙伴设置保存/重载、Debug 质量审阅、workspace 会话、文件读取与侧聊关闭、Windows 终端进程树回收、主会话切换；4 项外部模型凭据用例明确跳过。
- R06 已补齐真实连接 CRUD、用途路由、密钥安全存储与主对话消费；正式选择用途时替换旧兼容路由，后续路由保存不会清空已保存密钥。
- R12 生活资产真实增改删：允许修改 `life/assets.ts` 的用户创建白名单、companion IPC / preload / Renderer 声明、`AssetsPanel`、`WorldDetailsPanel`、共享 `WorldAssetEditor`、Playground `previewEditable` 内存预览及对应 Unit / Renderer / Electron 测试。正式页走 `companion:create-asset` / 既有 update / delete；Playground 只改内存夹具，不写 IPC。家居新增默认 `furniture`，足迹新增默认 `footprint` 并支持常去 / 想去。不改朋友圈互动、地图、设备控制、人物 starter 故事或备份白名单。
- 本批验收边界：Unit 覆盖 create 白名单、超限拒绝和角色隔离；Renderer 覆盖 Playground 穿着夹具、内存增改删不写 IPC、正式新增失败保留草稿；Electron 在独立数据目录用真实 IPC 新增文化 / 家居物件 / 想去地点，重载后仍可见，超限拒绝，最后删除清理。不把 Renderer 替身或页面 reload 称为完整应用重启 / 备份恢复。`experience.world` 保持 playground；编辑器与详情 / 衣柜面板可 adopted。
- R12 确认流程补验：衣柜删除与通讯录强制开聊改为成功后才关闭确认；失败保留同一确认，处理中禁止取消和重复提交。CastPanel 去掉字面换行转义。不改 IPC、存储或召唤忙闲判定。正式入口覆盖失败重试和连点。该补验不关闭生活面编辑、备份或六面完整验收。
- R12 通讯录忙闲列表预检：正式 `CastPanel` 读取既有 `companion:check-cast-availability`，卡片在开聊前展示方便 / 忙碌 / 未读到；开聊仍走 `startSummon` 二次判定和强制确认。不改忙闲算法、IPC 形状或 Playground 静态通讯录夹具。Renderer 覆盖忙碌卡可见、可用卡可见、忙碌仍可开聊进入确认。该补验不关闭六面正式入口 Electron 或备份。
- R12 朋友圈互动后端：正式 `MomentsPanel` 无 preview 时走 `companion:toggle-moment-like` / `companion:add-moment-comment`；用户赞评写入 `companion_moment_user_interactions`，不改 `moment.text` 或 `meta.interactions`。Playground 仍用本地夹具。Renderer 覆盖正式入口赞 / 评论、IME 不误提交、失败保留草稿、pending 不双提交和评论槽几何。Electron 覆盖真实 IPC 赞评、空值 / 超长拒绝和重载保留。该补验不关闭人物 starter 来源复核、六面正式入口 Electron 或备份。
- R06 之外，R10 MCP 真实连接恢复，以及全产品逐项 adopted 证据仍未完成；R12 衣柜 / 文化 / 家居 / 足迹编辑链已接入 `companion_assets` 并有 Electron create / 重载 / 超限拒绝证据。通讯录忙闲列表预检与朋友圈真实赞评已接入。R07 生活资产备份已收口。六面正式入口 Electron、文化 starter 无证据数量文案与人物 starter 来源复核本批收口。无 world.default.json 时不得把城西小公寓或日常住处写入世界态 / Catch-up / Prompt。本合同继续保持进行中。

### R06 模型发现 / 认证失败恢复（2026-09-17）

- 本批边界：正式模型页的「获取已有模型」走主进程 `settings:fetch-models`，Renderer 不直连供应商、不读回已存密钥。OpenAI Compatible / Anthropic 用 `appendApiPath(baseUrl, 'v1/models')`；Gemini 明确不支持并提示手动添加。成功列表需要用户点选后才写入连接清单；手动添加走同一清单并去重。认证失败可重试，404 / 不支持不假装成可重试网络错误。
- 密钥契约：草稿 Key 优先；`useStoredApiKey` 只按 `connectionId` 取已存连接密钥，不再用全局 `llmApiKey` 冒充。读取连接时去密钥并加 `hasApiKey`；保存时丢掉 `hasApiKey` 并归一 `models[]`。有清单时路由只能选已启用模型；空清单仍兼容旧单 `model` 字段。
- 允许修改：共享校验 / 清单纯函数、主进程发现、settings IPC / preload / Renderer 声明、正式 `ModelRoutingSettings` / `SettingsPanel`、路由工厂，以及对应 Unit / E2E 和本合同 / 运行时模块卡 / 质量 / 账本。
- 明确不碰：Playground 获取仍是隔离延时夹具；MCP OAuth / 异常断开、完整 PTY、新编人物故事、Alice TokenDance / MiniMax 硬编码清单、全产品 adopted、`src/App.tsx` 无关脏改动。
- 验收：Unit 覆盖输入校验、远程列表解析、Gemini 不支持、401 不泄密、空列表、无 Key 不发请求、已存 Key 按连接注入、草稿 Key 不读已存密钥、清单存在时停用模型不能被路由选中。Renderer 正式页文案改为「连接与模型清单」。该证据不把编程套餐真实调用或全产品标为 adopted。

### R11 关于页开发者模式门控（2026-09-17）

- 2026-09-18 补充入口反证：原实现只隐藏可见入口，真实 Electron 在 `developerMode=false` 时按 Ctrl+Shift+D 仍离开聊天进入 Debug。全局快捷键改为读取已保存配置，从设置离开先走同一保存队列；读取失败留页并提示，迟到读取不抢回页面。关闭态覆盖设置内和聊天中 D/P，开启态完整重启后覆盖 D/P 进入与返回。该入口修复不代表 R11 或全产品已 adopted。
- 本批边界：正式「关于 My Agent」与 Playground 候选共用 `AboutSettingsContent` 和共享 `SettingSwitch`。正式开关走既有 `settings:set('developerMode')` 自动保存；候选只改内存样张，不写 IPC。普通模式隐藏侧栏 Debug / Playground 整组入口和 Chat 顶栏 Debug 按钮，不只隐藏单个按钮。关闭仅收回入口，不删除诊断数据、资产或后台服务。
- 允许修改：共享关于页、SettingsPanel / SettingsExperienceCandidate 接入、UI 组件与产品体验注册表、Renderer / Electron 测试，以及本合同 / agent-runtime / 质量 / 账本。`src/App.tsx` 保持 assume-unchanged，不把无关脏改动带进本批。
- 明确不碰：人物 starter 来源复核、MCP OAuth、模型发现、朋友圈互动备份、凭据、权限引擎、项目路径、用户旧数据兼容层、Playground 夹具当生产事实。
- 验收：Unit 锁住正式与候选实际渲染共享关于页 / `SettingSwitch`。Renderer 覆盖正式关于页开关写入、关闭设置后入口刷新，以及候选开关不写生产。Electron 独立数据目录从关于页打开开发者模式，入口出现，关闭后隐藏，完整重启后仍恢复，数据不丢。无 API Key 时完整重启会打开设置全屏并隐藏产品壳，必须先返回 Chat 再断言侧栏入口。UI E2E 默认开发入口可见是 `ui-e2e` 模式特例，不能当作正式默认。该证据不把全产品标为 adopted。

### R12 六面正式入口 Electron 与 starter 无证据数量文案（2026-09-17）

- 本批边界：从正式 `primary-sidebar` → `人物世界` 点齐六个生活面，断言真实 companion IPC 数据，不走 Playground 或 Renderer 替身。文化 starter 去掉“留下 3 条笔记”“看过两次”等无证据数量，保留作品名。小林没有 `world.default.json`，家居 / 常去保持真实空态，不把 `world-codec` 的中性居所文案写成已确认住所。
- 允许修改：`life/assets.ts` 文化 starter 描述、Playground 同源样张、`companion-assets` Unit、`onboarding` Electron，以及本合同 / companion 模块卡 / 质量 / 账本。
- 明确不碰：人物 starter 来源复核、新编人物事实、MCP / OAuth、模型发现、朋友圈互动备份、凭据、权限规则、项目路径、用户旧数据兼容层。
- 验收：Unit 锁住 `getStarterAssetDefinitions('lin')` 不再含伪计数。Electron 覆盖朋友圈真实动态、衣柜 starter 衣物、文化四类与清计数后的作品、家居空态、通讯录真实关系卡与忙闲文案、足迹动态地点不与常去混淆。该证据不把人物 starter 来源或全产品标为 adopted。

### R12 人物 starter 来源复核（2026-09-17）

- 本批边界：没有 `world.default.json` 的角色，`defaultWorldState` 的 home / currentLocation 使用「未设定」，不再按角色写城西小公寓、合租或小屋，也不回退成「日常住处」或「家」。读取已有 `world_json` 时回收旧 codec 编造的那批居所；用户后来写的地点保留。Catch-up 概况 Prompt 空居所同样回退为「未设定」。有 Role Pack 世界默认时仍以资产为准；小航继续保持「未设定」。
- 允许修改：`life/world-codec.ts`、`life/catchup.ts`、world-state / catchup / companion-assets / prompt-builder Unit，以及本合同 / companion 模块卡 / 质量 / 账本。
- 明确不碰：Role Pack 正文、新编衣服 / 书 / 电影 / 住所事实、MCP / OAuth、模型发现、朋友圈互动备份、凭据、权限规则、项目路径、用户旧数据兼容层。
- 验收：Unit 锁住 lin / zhou / xia 默认世界不含城西小公寓；`getStarterAssetDefinitions('lin')` 的 home / footprint 为空；Catch-up 空居所写「未设定」。该证据不把衣柜分味播种当成已确认人物事实，也不把全产品标为 adopted。

### R07 生活资产真实备份（2026-09-17）

#### R07 朋友圈历史与用户互动（2026-09-19，已验证子项）

已落地既有表的历史与用户赞评备份，Unit 覆盖非法关联、重复合并和失败回滚；正式 Electron 已验证新目录恢复、重启展示及保留新增评论。完整 Electron 25 通过 / 4 条件跳过，UI 结果文件 passed。此子项不代表 R07 派生向量恢复或全产品回流完成，整体施工合同保持进行中。

正式赞评依附 companion_moments，后者来自 published 事件；只备份互动行会在新设备成为不可见孤儿。沿既有 life/store schema 和已批准整份备份链补入已发布事件、对应动态快照与独立用户互动，不引入新社交服务。JSON 对象、正文、条数和关联均有界；每条互动必须指向同角色动态，每条动态必须指向同角色 published 事件；用户 actor 固定 user，点赞唯一，评论复用既有规范化。损坏或缺来源的现存历史应使导出明确失败，不悄悄丢弃互动。

恢复只写历史，不恢复未来 planned 事件、日剧本、当前世界状态或触发奖励 / LLM；历史事件 day_script_id 置空，不制造缺失剧本引用。按稳定 ID 合并，现有身份属于其他角色 / 事件则拒绝整份导入，不重新挂靠；相同归属已有行保留，重复赞不增加。导入沿同一同步事务、单次落盘和失败补偿，媒体与记忆语义不变。允许修改备份历史 storage helper、data-export、共享数据页范围说明、相关 Unit / Electron、模块卡与账本文档；不改朋友圈布局、赞评 API 或世界推进规则。共享数据页正式 / Playground 同轮显示真实备份范围，夹具不得调用真实服务。

必测：真实赞评导出→清空→恢复→重载展示、重复导入不覆盖、跨角色 / 缺动态 / 缺事件 / 非用户 actor / 超长评论 / 重复赞拒绝、SQL 与最后写盘失败回滚历史、事件仍 published 且不触发奖励；真实 Electron 从正式数据页往返，完整回归和文档门禁后提交。此子项不关闭向量崩溃待办、模型生命周期或全产品最终验收。

#### R07 整份核心数据导入提交（2026-09-19）

故障注入已复现：合法备份在设置写入或 persist 失败时，会话、消息、记忆、生活资产和播种标记仍各留下 1 条。正式数据页返回失败不能对应半导入。会话、记忆及设置实际共用 sql.js，采用同一同步事务和单次原子快照落盘；不新增独立数据库或通用分布式事务框架。参考本地 CC Switch 的暂存校验 / 单次提交边界，但其 rusqlite backup API 不适用于当前 sql.js；复用本项目已有同步保存与失败补偿方案。

允许修改 data-export、memory-store 的同步写入与提交后副作用边界、settings-store 的加密准备 / 写入原语、媒体恢复与启动清理、对应 Unit / Electron 和文档；不改 UI 布局、OAuth、模型路由和记忆去重策略。用共享存储原语替换导入逐条异步保存，不删除用户功能。输入校验与密文准备在提交前；提交段禁止 await，所有表在同一事务写入。SQL 失败回滚；COMMIT 后快照替换失败按本批新增身份和原设置值同步补偿，不能更换全局数据库实例令已有引用失效。仅落盘成功后发布记忆向量 / 资产副作用，失败清理本批媒体。崩溃期间媒体孤儿目录必须在启动时依据受控目录身份和实际数据库引用清理，不按任意外部路径删除。

必测：最后设置写入失败、真实快照 rename 失败、所有表及重开数据不变、零提前向量任务、失败后重试一次落盘、既有数据不覆盖、记忆去重及加密同源、带媒体失败清理、提交前 / 后崩溃重启。当前两项真实 SQLite 红测确认部分导入，首轮 fixture 缺记忆身份 / 时间被预检拒绝，补齐合法 fixture 并断言预检通过后才作为有效证据。整份恢复与启动验证完成前不宣称 R07 收口。

验收进展：上述故障注入已转绿，真实 Electron 从正式数据页发起，在快照替换前 / 后 SIGKILL 并完整重启，两种状态分别为核心数据全无 / 全有；媒体目录只清理未提交批次。完整 Electron 24 通过 / 4 外部模型条件跳过。设置恢复改查实际存储值，避免默认 [] 阻断空库配置导入。派生向量索引仍异步，提交后立即崩溃的索引待办恢复明确不在本子项保证内，已留 WISH-045；朋友圈互动备份、R06 生命周期和全产品清单继续，合同不冻结。下文 2026-09-17 生活资产批次记录保留其当时范围，不作为现行导入时序。

- 本批边界：正式 `data:export` / `data:import` 覆盖 `companion_assets` 与 `companion_asset_seeds`。按稳定 id / 播种键合并，不覆盖现有记录。会话与生活资产同一事务，失败整笔回滚。旧备份缺这两项仍视为空数组，必须通过 `isValidExportData`。记忆继续走 `memoryStore.addMemory`，设置继续走 settings-store。
- 允许修改：共享备份类型、database schema v16、`ipc/data-export.ts`、正式设置与 Playground 数据页说明、Renderer 声明、`security-boundaries` Unit 与 `onboarding` Electron 测试，以及对应模块 / 质量 / 账本文档。
- 明确不碰：人物 starter 来源复核、MCP / OAuth、Playground fixture、凭据、权限规则、项目路径、朋友圈互动备份、用户旧数据兼容层。当时未覆盖六面正式入口 Electron，现已由后续 R12 批次验收。
- 验收：Unit 覆盖旧备份兼容、非法 kind / 超长名拒绝、id 合并和 trigger 失败回滚；Electron 在独立数据目录验证真实导出导入往返、二次导入不覆盖。该证据不把 R07 整项或全产品标为 adopted。

### R05 编辑与异步恢复验收（2026-09-16）

- 敏感新增确认补验：已把待确认对象改成正文、分类和敏感类别快照；确认只提交该快照。修改正文、切分组或取消新增会撤销旧确认；失败保留同一草稿和确认，成功关闭。Playground 候选不走真实 memory IPC。复用 `ConfirmPanel`，不改 IPC、存储或检测规则。正式入口覆盖改稿失效、连点、失败重试和候选隔离。

R05 整页回流施工范围：正式 `MemoryPanel` 与 `SurfaceBaselinePanel` 故事共用四类导航、搜索、清单和列表后新增行，基础控件来自 TabStrip / TextField / IconButton / ActionButton。删除正式旧类别筛选、顶部表单、关闭入口和底部技术说明；不删除记忆或后端能力。展示映射由 `src/shared/memory-groups.ts` 唯一维护：identity / fact → 身份信息，workflow → 工作方式，voice / preference → 沟通偏好，feedback → 我们之间；这是既有画像语义的确定性投影，不推测文本、不做存储迁移。“我们之间”新增继续使用当前 roleId，其他分组按 identity / workflow / voice 写入。候选 fixture 的旧存储类别不是生产事实，随所属展示分组归一化，不改变样张正文。

允许修改：上述共享映射、MemoryPanel、SurfaceBaselinePanel、记忆分组 Unit、正式 / 候选 UI 与 onboarding E2E、复用门禁及对应模块 / 质量 / 账本文档。明确不碰：IPC / 主进程 / Prompt / 数据结构、MCP 与其他未提交工作。分组切换保留新增与编辑草稿；搜索只筛当前分组、清除后恢复；数量来自真实列表；新增 / 删除后同步数量。四主题宽窄、IME 不误提交、搜索空态、旧六类可达、真实 IPC 重启归属及失败恢复均为必测项。

- 整页验证：Unit 显式串行 152 文件 / 883 项通过；根 tsc / build、资产检查通过；Electron 9 项通过、4 项外部模型测试跳过。真实记忆用例已扩展四类写入、完整重启、category / roleId / 内容恢复和删除。源码符号门禁覆盖正式 / 故事共用管理流程及 Foundation，保留未使用导入 / 同名遮蔽负例。两轮完整 UI 各 149 通过 / 1 模型套餐样张因重载中断；独立原断言 trace 3 次通过。受控实验确认文档写入可触发 Vite full-reload，当前未改 watcher，记录于 WISH-042。
- 最终完整 UI：停止仓库写入后原断言 150 项全部通过，证据 `var/verification/memory-management-no-writes`。R05 的正式整页回流与真实四类 CRUD / 重启恢复已验收；该结论不外推为全产品完成，不关闭文档监听重载或其他设置页面差异。

首批卡片与 CRUD 历史证据（整页状态以上文为准）：

- 范围：`MemoryPanel` 的长文编辑器、增删改请求与读取生命周期、共享固定尺寸图标操作；未改分类存储、IPC、向量召回或敏感检测策略。该批当时尚未回流旧页导航，不以卡片修复替代整页采用。
- 证据：Unit 串行 150 文件 / 880 项、正式与候选 UI 全量 142 项、Electron 9 项通过（4 项外部模型测试跳过），根 tsc / build 与资产检查通过。新增 Electron 用例通过真实 preload / memory IPC，在独立数据目录完成增改、完整退出重启恢复和删除；不代表备份或向量召回验收。
- 正式 Renderer 回归覆盖四主题、1166 / 600px、长文删短、多行焦点、hover / pending 操作槽几何、失败保留草稿、重复点击、刷新重试与离页迟到响应。截图位于 `var/verification/memory-rollout-ui`。默认并发 Unit 的既有 MCP 30ms 超时保留在 WISH-042，未修改断言掩盖。

### 3.1 当前回流状态快照（2026-09-15）

| 回流面 | 当前状态 | 已有正式证据 | 仍缺的硬证据 |
|---|---|---|---|
| 对话与导航 | `production-ready`，待完整入口验收 | 正式 `App` / Sidebar / Chat / Right Dock 调用链与既有 Electron 回归 | 四主题、窄宽、跨页草稿与任务恢复的正式入口证据 |
| 人物世界 | `production-ready`，部分 `adopted` | 角色架、文化角 / 家居 / 足迹真实资产链、正式增改删与 Electron create 覆盖、通讯录列表忙闲预检、朋友圈真实赞评、生活资产真实备份、六面正式入口 Electron、文化 starter 无证据数量文案、无 world.default 时世界态 / Catch-up / Prompt 回退为未设定 | 衣柜 / 文化分味播种仍不是已确认人物事实；全产品 adopted 仍未完成 |
| 设置与人物设置 | `user-approved`，正在回流 | Playground 候选、正式 `SettingsPanel`、共享导航 / 卡片基础层；R11 关于页开发者模式已有正式入口与 Electron 持久化证据；R06 正式模型发现走主进程 `/v1/models`；R10 异常断开 UI 已接入设置页 | OAuth 首次登录已有独立 Electron 流程；后续登录保持见 WISH-045；编程套餐真实调用仍见 WISH-027；不把 Playground 夹具当真实发现 |
| 记忆 | 整页已回流 | 共享四类 / 搜索 / 新增行；正式长文、固定槽、四主题宽窄、失败恢复及真实四类重启 CRUD | 本项不替代其他设置或备份 / 向量召回的验收 |
| 主题与基础组件 | `production-ready` | Foundation 主题资产、共享设置卡片 / 行组件、基础复用门禁、共享 Prism 主题清洗 | 全产品 Markdown / Diff 仍未标 adopted；OAuth 后续生命周期已明确后置，工作区跨页状态仍待收口 |
| 工作区工具 | `production-ready`，部分 `adopted` | 正式 Right Dock 五工具、共享面板布局与 Electron 回归 | 浏览器 / 文件 / 审阅 / 终端跨页状态和完整错误路径 |
| MCP / 模型等后端 | `in-progress` | MCP 测试连接生命周期、资源 / elicitation 接管、配置锁专项 Unit、异常断开 in-place 重连与设置页订阅 | 首次 OAuth 已有独立 Electron 数据目录证据；第三方兼容按需验证，真实生图及全产品最终验收仍未完成 |

本快照只记录当前证据，不把 `Playground` fixture、Renderer 替身或局部右坞验收升级为全产品 `adopted`。设置回流允许移除旧 UI 壳和重复入口，但必须保留真实数据、权限和安全边界；每次删除旧展示层都要在对应测试与变更记录中说明。

## 4. 影响范围与不碰项

### R08 文件规则执行链补齐

审计发现：候选的修改文件 / 删除文件尚未接入执行侧，旧 path 类型也只有载入定义，没有消费入口。本次先完成这一真实能力，再回流规则表单；不把能保存 JSON 当作规则生效。新增 file-write / file-delete 类型，复用既有受限正则加载，文件操作同时检查旧 path 规则。范围限原生 file_read / file_write / file_edit / file_delete / apply_patch；Shell、MCP 和目录搜索不是这些文件规则的替代执行入口，仍按各自权限契约管理。

允许修改：共享权限类型、补丁目标解析、permission-engine、文件规则检查器、ToolContext 内部确认凭据、ToolRegistry、Loop、Debug 工具预检、apply_patch 的纯解析调用及相关 Unit / Electron 测试、权限资产来源与模块 / 质量 / 账本文档。明确不碰 IPC 频道和载荷、存储迁移、Shell / MCP 后端及其当前未提交工作。补丁路径解析提取为单一事实源，不改变原有最后一条 +++ 目标的解释行为。

文件规则匹配规范化的逻辑路径与真实目标路径，任何匹配 deny 优先于 ask，再到 allow；沙箱硬边界在规则之前，不因 allow 跳过。Loop / Debug 展示确认，执行前再次检查规则和真实路径；确认授权绑定当次参数、会话、规则快照及目标，仅使用一次，不从 Renderer 接受授权对象。直接执行或无交互调用命中 ask 时拒绝，不假装已确认。必测：三种处理方式、写入与删除隔离、别名与补丁隐式目标、拒绝后文件未变化、失效与重复授权、规则热变更、symlink / 越界及真实重启载入。全产品目标及 R08 页面回流仍保持进行中。

后端验证：Unit 153 文件 / 904 项通过，含真实文件、Loop/Debug、目录扫描与跨 callId 复用反例；Electron 10 项通过、4 项外部模型跳过，新用例经过真实 preload / settings IPC / Registry，在独立目录验证热更新、确认和完整重启后拒绝删除。根 tsc / build、Eval 23 + 1 项及 UI 150 项（var/verification/file-rule-ui）通过。主进程独立检查的既有 70 条错误前后无新增，依赖审计仍为全部 7 项 / 生产 4 项；分别保留 WISH-043 / WISH-044，不修改门禁掩盖，也不把后端证据视为 R08 页面采用。

允许按编号逐项认领：App、正式产品与 Foundation 组件、共享类型 / 资产注册、对应 Playground 故事、必要的主进程服务 / IPC / preload、测试及对应文档。不授权任意重构；每次动手前仍列精确文件范围。

不改无关临时文件、未授权人物内容、凭据或无关 Runtime 策略与 Prompt。按 DEC-042，旧设置入口和相关开发数据可以随新结构直接替换 / 重建，不必另造兼容入口或迁移层；仍需记录具体移除范围与回归，不顺手删除其他调用方依赖的共享后端。依赖变更单独说明。

### R14 Markdown / Diff 共享主题清洗

共享 `CodeBlock` 现在只消费清洗后的 Prism 主题：容器级 `code[class*="language-"]` / `pre[class*="language-"]` 不再携带 oneLight 白底，内部 token 透明，Diff 的 inserted / deleted / selection 高亮保留。正式审阅、文件预览、Foundation Markdown / Diff 与 Playground 工作区审阅共用同一入口；本批不把全产品标 adopted。

### R08 权限页面回流

本批按已确认 demo 替换正式权限页：默认审批卡、自定义规则折叠、独立规则卡、列表后固定添加 / 取消槽及向下展开的草稿。正式和 Playground 共用 PermissionSettingsContent / PermissionRulesEditor；Playground 只更新本地规则。删除旧铺开字段和高级 JSON UI，不删除旧 tool / path 规则数据或执行能力。新增只提供命令 / 修改文件 / 删除文件，已有其它类型保留可编辑、停用与删除。正式入口已覆盖添加 / 取消 / 保存、保存失败保留草稿和原规则、重试不重复写入，以及四主题宽窄与 hover / 取消几何不跳。

允许修改：上述组件、SettingsPanel 和 SettingsExperienceCandidate 接入、Foundation SelectField 与既有选择故事 / 注册来源、permission-rules 表单解析、permission-engine 的纯校验 / 载入复用、settings IPC 写盘前校验、对应 Unit / UI / Electron 测试及模块 / 质量 / 账本文档。不改 IPC 形状、MCP、存储迁移或执行优先级；无新依赖。新增草稿不进入自动保存队列，保存失败保留草稿与原规则，重试不重复写入。主进程在写盘前拒绝超量、重复 ID、无效或不安全正则；旧载入仍兼容容错。验证覆盖正式入口、候选隔离、四主题宽窄、hover 几何、添加 / 取消 / 编辑 / 停用 / 删除、失败和重启恢复。


## 5. 测试与完成标准

### R09 Skills 完整回流执行边界（2026-09-16）

- 来源：`playground-skills-detail-v1.md`、设置候选 Skills 单个 / 多个 / 详情故事；正式落点为 Settings → Skills。
- 展示：提取列表和详情共享组件，正式与样张共用；名称与启停开关、触发条件、描述、作者 / 版本 / 来源 / 状态、限高文件正文。删除正式旧双栏和未使用的创建 / 历史 / 回滚 / 试跑状态，不删除其他调用方仍依赖的后端服务。
- 数据：新增真实启停 IPC，持久化到本机 Skill 状态；禁用后从新 Prompt 摘要与可调用工具中移除，并拒绝旧工具引用再次激活。`disable_model_invocation` 仍只表示禁止模型主动调用，不冒充停用；已进入历史消息的正文不追溯擦除。
- 边界：内置正文只读，用户正文校验后保存，不通过改名隐式另建文件；删除走应用内确认，失败保留详情与重试；迟到响应不覆盖新页面或草稿。同一变更在主进程串行，写盘失败不发布新启停状态。
- 文件范围：`SkillsPanel`、共享 Skills 展示、设置候选、ConfirmPanel / 对应故事、Skill 共享类型 / preload / 声明 / IPC / registry / loader / 状态存储、相关 Unit / UI / Electron 测试与模块及账本。无新依赖，不修改其他存量工作。
- 真实 Electron 验证发现 `getBuiltinSkillsDir` 在 ESM 主进程引用未定义的 `__dirname`；本批同步修复为主入口 `APP_ROOT` 资源定位，并在 `electron-builder.json` 包含内置 Skill 目录。不新增依赖或旧路径兼容层。
- 验证：列表→详情→返回、真实内置正文、四主题宽窄和内部滚动、启停重启恢复及旧工具拒绝、取消 / 保存失败 / 删除失败 / 重试 / 重复点击 / 迟到响应、确认按钮 pending 几何。UI IPC 替身与真实主进程验证分开报告，整项未经证据不得标 adopted。
- 本批证据：默认并发全量 Unit 155 文件 / 914 项通过；根 tsc 与 build 通过；Eval 23 + 1 项通过；全量 UI 160 项通过（`var/verification/skills-final-ui`）；Electron 12 项通过、4 项缺外部模型凭据跳过（`var/verification/skills-full-electron`）。资产检查 6 文件 / 20 项通过，新增共享符号门禁和确认故事实际交互均已运行。R09 本批列表 / 详情 / 管理与启停链路已进入正式调用链，全产品合同继续进行中。
- 限制：主进程独立 tsc 对比 HEAD 与本批均为 70 条既有诊断，按主诊断正文比较无新增，仅附带导入来源清单变化；继续由 WISH-043 管理。仓库未配置独立 lint 命令，不将 build 当作 lint；本次未产出安装包。npm audit 两种范围请求均在 TLS 建连阶段失败，未获得本轮新审计结果，WISH-044 不关闭。

- 自审先查真实调用点与数据，不只看样张或 sourcePaths 字符串。复用门禁验证实际渲染引用，并有绕过 / 未使用 import 负例。
- Unit 覆盖转换、校验、持久化、失败与取消；Renderer E2E 从正式 App 导航进入各页，不通过 Playground 代替正式入口。
- UI 覆盖四主题、宽窄、长记忆 / 长 Skill / 长代码、独立滚动和溢出；hover / focus / 操作替换比较几何尺寸。
- Electron E2E 用独立数据目录验证真实 IPC、保存后重开、换主角、取消 / 失败恢复与数据归属。Renderer IO 替身和本地协议替身的证明范围单独说明。
- 按项目顺序执行自审、Unit、类型检查、适用 E2E、build、资产和文档门禁。根 tsc 仅覆盖 Renderer；主进程修改须报告检查范围与 WISH-043 的真实诊断。
- 每个编号 adopted 前须有正式调用点、数据链路、可重复测试和文档证据；R12 六面逐一验收。R13 通过不能代替其余编号。
- 所有产品项和必要后端闭环完成，才可结束目标。依赖外部授权的项保持未完成，不能悄悄缩小目标后收口。

## 6. 风险与权衡

### R06 连接配置装配边界

本批高级区验收：Unit 1054、完整 UI 229、Electron 20（4 个外部模型用例条件跳过）、资产 27、Eval 23 + 1 通过。UI 证据 `var/verification/model-advanced-ui-full`，Electron 证据 `var/verification/model-advanced-electron`。主进程同编译器对照 75 → 75 无新增。最后复跑发现根 project reference 对新增 composite 共享文件要求声明产物，已移除根到主进程的引用，保留各自源码检查及主进程独立入口；不得把此调整当作 WISH-043 已完成。依赖未改，审计仍全量 7 / 生产 4。

高级设置回流范围：候选预算 / Temperature / 连接测试抽为共享 ModelAdvancedSettings，正式与候选统一使用 Foundation ActionButton / TextField；折叠默认关闭，结果不改变测试按钮尺寸。正式旧 Top P / 最大输出控件及其隐藏表单同步移除，存储与运行时字段不在本次删除范围。高级测试明确指向已保存主对话首选连接，复用现有 settings:test-connection，不创建第二套请求协议；把配置工厂的纯用途筛选提到 shared，供正式选择测试目标与主进程同源使用。候选仍使用隔离目标与测试结果，不触达 IPC。参数输入允许临时无效草稿，但无效 Temperature / 预算不得自动保存或离页丢失，主进程重复校验；Temperature=0 必须进入配置而非被 || 丢弃。测试结果绑定配置身份，配置变化 / 卸载不发布旧结果；保存失败保留草稿与重试入口。允许修改共享组件 / 纯函数、两处调用方、配置工厂与 settings 校验、注册表及 Unit / UI / Electron / 文档；不改 IPC 形状、权限、MCP、生图或多窗口契约。必测四主题宽窄、默认折叠、hover / pending 操作槽、参数非法值与零值、真实保存重启和请求参数、主用途目标与失败重试、迟到隔离、候选零写入。此为已批准回流的候选复用及必要后端补齐，不将本项等同于 R06 整页完成。

空配置批次验收：Unit 1038、完整 UI 221、独立目录 Electron 20 通过（4 外部模型条件跳过）、根 tsc / build、Eval 23 + 1、资产 26 通过；证据 `var/verification/model-empty-ui-verified`、`model-empty-electron-verified`。真实错误诊断证据保留于 `model-empty-event-order`，临时日志已移除。主进程 Compiler API 对照仍为 75 条存量诊断，无新增；审计全量 7 / 生产 4 未清零，无独立 lint 命令。外部模型脚本仍需更新旧选择器及数据隔离，已记 WISH-042；此批不代表模型整页或全产品 adopted。

空配置审计同步 Debug 系统快照：`debug-system-info.ts` 的 model / baseUrl / hasApiKey 改从配置工厂读取，保持既有脱敏字段形状，不新增 IPC；对应 Unit 覆盖真实路由身份和空配置不显示旧全局身份。否则删除连接后的 Debug 会继续呈现已失效配置，违背生产真相边界。

真实空配置验收补充：诊断捕获 chat.send invoke-finally 先执行，而独立事件订阅随后收到 error / done，数据库没有本轮消息，界面仅有乐观用户消息。App 发送流程改为调用回执与终止事件双完成后解除监听，失败不以无错误的会话库覆盖界面；invoke 拒绝无需等待 done，显示安全重试文案。只修该生命周期，不改 IPC / Runtime 终止协议。UI 用受控时序覆盖两种完成顺序、拒绝和重试；Electron 删除全部连接、完整重启后验证错误可见、请求计数不变以及重新配置成功。

空配置与旧入口收口：用户已明确不需要旧能力兼容和开发数据保留。删除 ModelRoutingSettings 的 legacy-primary 合成及默认用途，主配置工厂只从已保存连接与 primary 用途装配；无有效主用途返回空身份，不读取旧 llmApiKey / llmBaseUrl / llmModel 或 LLM_* 环境变量。辅助和图片没有独立有效用途时沿用新主用途，不再读取旧 auxModel。显式一次性连接测试仍可传完整覆盖配置。正式设置去除旧身份表单字段；Chat 删除仅写旧地址的 Provider 快选，采用候选当前模型展示，并在配置清空后清空显示；Runtime 对未配置给出友好提示，不请求旧端点。范围为共享工厂、Runtime、正式设置 / Chat、对应 Unit / UI / Electron、资产门禁和文档；无新 IPC 或依赖。不删除仍被独立嵌入配置等链路引用的存储字段，不将本项宣称为所有旧键物理清理。必测带旧字段和环境变量的空配置、无效 / 停用用途、辅助 / 图片继承与独立用途、显式测试覆盖、删除最后连接及重启空态、真实无请求和重新配置。

连接清单外层回流：候选标题右侧添加、连接数量和空态抽为 `ModelConnectionList`，正式与候选共用，添加操作采用 Foundation ActionButton。删除正式旧 SettingRow 外层和候选重复清单 JSX；不修改连接存储、默认连接生成、请求或模型协议。正式编辑 / 保存中禁止重复添加，候选新增 / 编辑中保持同样入口禁用。范围为共享清单、两处调用、注册表、Unit / UI 及相关文档；四主题宽窄覆盖同排布局、hover / disabled 几何、添加取消、编辑禁用、删除最后一项后的空态和再次添加。此项为用户已批准全产品回流的直接 UI 子项，无新依赖、IPC 或后端契约。

连接卡片回流：提取候选的头部编辑 / 获取 / 测试、三列连接摘要、模型清单、手动添加和发现候选为 `ModelConnectionCard`，正式与候选共同使用 Foundation 控件。测试 / 获取按钮使用固定槽，不再在成功态替换成窄图标或失败态插入头部重试挤动布局；原测试按钮即可重试。正式必要的删除连接操作保留可选固定槽，仍调用既有真实删除流程；候选不伪造生产删除。正式保存、迟到响应、草稿保护和凭据装配不迁入展示组件，候选状态保持隔离。删除两套重复卡片 JSX 和旧头部状态分支，保留所有真实失败信息和发现重试。范围：两处调用方、共享卡片、资产与复用门禁、UI / Electron 和文档；必测四主题宽窄、长连接与模型名、idle / pending / 成功 / 失败几何稳定、编辑取消、模型增删启停、保存失败 / 重试、迟到响应、候选零写入。无需变更 IPC 或依赖。

共享连接表单实施范围：从已确认候选抽取 `ModelConnectionForm`，新增 / 编辑复用同一 Foundation 字段与操作控件；来源分类、预设默认值与协议映射放共享纯函数。ModelConnectionProfile 增加可选 source / presetId，原 JSON 存储承载字段，不做旧数据迁移；LLMConnectionTestInput 补 provider 并同步 preload、Renderer 类型及主进程验证。更换端点 / 协议时不继承旧密钥，保存与读取已存 Key 都核对连接身份。候选只持有内存草稿，不触发 IPC。

允许修改共享类型 / 表单纯函数、共享业务表单、正式 ModelRoutingSettings / SettingsPanel、候选 ModelPage、settings IPC / preload / Renderer 声明、组件注册表、对应 Unit / UI / Electron 及文档。删除两套正式简化表单和候选重复字段，正式新增改为候选的独立卡片；测试 / 获取模型保留在已保存连接卡片，不再留旧新增表单内的重复入口。验证来源切换清空临时 Key、自定义协议、保存失败保留、原位编辑保留模型 / 用途、正式重开与协议请求。原子保存、备用路由、生图、本地无 Key 请求及其余卡片结构仍按上表继续，不以本表单完成关闭 R06。

整页回流核对表（逐项保留完成证据与剩余缺口，不是新的排除项）：

| 候选动作 / 内容 | 当前正式差异 | 必须接通的事实源 / 证据 |
|---|---|---|
| 五类来源、服务商预设与自定义协议 | 已共用来源纯函数与 ModelConnectionForm，source / presetId 随连接保存 | shared 注册表为唯一预设源；正式 UI 四主题宽窄与 Electron 保存 / 重载，不复制 fixture |
| 新增独立卡片、原位编辑同一表单 | 已删除两套正式简化字段和候选重复 JSX，正式 / 候选同时渲染共享表单 | Foundation 字段与共享表单真实符号门禁；编辑保留模型和用途，失败保留草稿 |
| 自定义 Anthropic / Gemini / OpenAI Compatible | provider 已经过共享校验 / preload / handler 到配置工厂 | Unit 三协议校验与主进程透传；Electron 本地 Anthropic 请求验证，真实厂商及其余协议组合仍按全链验收 |
| 本地模型 | 本机回环兼容无 Key 校验、主进程测试 / 发现、Runtime 与实际主用途启动判断已接通 | 独立 Electron 正式配置、发现、测试、完整重启后的真实流式对话和 401 后补 Key；不外推为实际型号 / 默认嵌入模型兼容 |
| 用途优先级 | 三用途按保存顺序装配独立备用链，辅助策略逐目标计算；取消和部分输出后停止切换 | Unit 装配 / 失败边界；独立 Electron 正式添加与排序、重启、503 后备用请求及不同认证头验收 |
| 用途安排布局与基础复用 | 正式与候选实际渲染 ModelUsageArrangements；数据和保存适配器保持各自边界 | TypeChecker 真实绑定与负例；四主题宽窄、长名 / hover / pending 几何、保存失败重试、候选零写入 UI |
| 连接卡片布局与操作槽 | 正式与候选实际渲染 ModelConnectionCard；正式保留删除及真实请求，候选注入隔离状态 | TypeChecker 真实绑定与负例；四主题宽窄、长名称、全请求状态头部几何、手动与发现模型增删启停、候选零真实调用 |
| 连接清单标题、添加与空态 | 正式与候选实际渲染 ModelConnectionList；新增 / 编辑中禁用重复添加；不合成旧连接 | TypeChecker 基础按钮绑定；四主题宽窄同排、固定几何、添加取消与删除到空态；Electron 完整重启仍为空、未配置无请求及重新配置对话 |
| 高级设置、预算与连接测试 | 正式与候选实际渲染 ModelAdvancedSettings；只保留候选参数，测试正式主用途首选 | TypeChecker 基础绑定；四主题宽窄 / 校验 / 失败恢复 / 迟到隔离；Electron 真实保存重启、主用途测试与 temperature=0 请求 |
| 保存 / 离页 / 发现迟到 | 整组保存失败恢复、请求结果归属隔离及应用内草稿离页保护已接通；关窗 / 崩溃与多窗口冲突未覆盖 | SQLite 故障 / 重开与正式入口 Electron；受控请求逆序、换 Key、取消 / 保存失败及离页结果隔离 UI；宽窄导航拦截与 Electron 草稿未写入检查 |

多连接表单回流前，先保证 `aux-config.ts` 的主 / 辅助 / 图片理解用途都将端点、密钥、协议、模型作为同一连接的配置传递。合成配置红测已确认：目标连接缺密钥时会借用全局 / 主连接密钥，显式 provider 也会丢失。移除这种字段级凭据回退；有路由时保留目标连接的空密钥与显式协议，无协议则按目标端点自动检测，没有有效用途路由时才整体回退主模型。一次性测试更换端点也不得继承主连接密钥和协议。

允许修改配置工厂及 `model-routing` 单测，不新增 IPC、存储字段、依赖或外部请求。必测主 / 辅助 / 图片三个用途的空密钥隔离、显式协议、无协议与整体回退，以及一次性配置覆盖。此为 R06 真实调用链必要修复，不等于五类连接表单、协议选择 IPC、生图能力或整页回流完成。

### R06 用途备用链实施边界

用途安排界面回流：将候选的安排卡片、分隔、行密度、固定操作槽和启停语义提取为 `ModelUsageArrangements`，正式 ModelRoutingSettings 与候选 ModelPage 共用。选择、按钮与图标按钮来自 Foundation，不复制控件皮肤；数据列表和动作由调用方注入，正式保持整组保存、保存失败不更新与 pending 防重入，候选保持内存隔离。删除两处重复用途 JSX，不改真实 IPC、配置存储或调用顺序。候选「生图」与正式「图片理解」暂保留各自语义，不以复用消除未决能力差异。范围为共享组件、两处调用方、注册表、Unit / UI / Electron 及本文档链；四主题宽窄、长标签、排序 / 启停 / 移除、失败恢复与候选不写 IPC 为必测。整体模型卡片及全产品回流继续按原目标推进。

落地记录：已接入现有 failover 引擎；首选缺 Key 但备用已配置时允许启动，每次调用仍独立检查当前目标，禁止向未认证远程端点发请求。顺序切换生产资产版本为 1.1.0。独立 Electron 已验证正式添加 / 排序、完整重启、故障首选 503 和带独立密钥的备用回答；全产品目标及模型整页剩余差异不随此项关闭。

配置工厂按同用途有效路由顺序装配首选与 fallbackModels，跳过停用连接 / 路由 / 模型及缺失引用，去重相同连接模型。每项显式绑定自身端点、Key（允许为空）和协议，不把主用途备用链带进独立辅助 / 图片用途。辅助 Thinking 按每个目标分别应用既有策略；一次性改地址 / 协议 / Key / 模型的测试不继承已保存备用链。无需新增 IPC。

启用正式备用链的前提：取消后不再尝试备用；已经向消费者交付正文、思考或工具增量后发生错误，不把另一模型接在其后；所有备用失败时保留失败。保留现有流式切换提示及 Debug 请求 / 资产证据；chatComplete 丢弃流式事件，只使用最终返回值，不应误判提示污染辅助 JSON。允许修改 aux-config、failover、统一 streamChat、备用配置共享类型、相关测试与文档；不重做 UI，不改 Provider 重试、工具执行或模型费用授权。验证三用途顺序、禁用过滤、凭据隔离、一次性测试隔离、辅助策略、取消和部分输出；真实本地协议服务验收顺序失败转移，不将合成服务等同供应商可用性。

### R06 本地连接全链验收边界

落地记录：认证判断和 Provider 自动检测归 `src/shared/llm-connection-test.ts`，原 Router 重导出同一规则；候选与正式表单共用可留空状态。Settings 安全视图新增主配置工厂派生的就绪状态与实际模型 / 地址，四处契约同步，App 首启和顶栏读取派生值。Runtime、标题重生成、已有生活辅助调用和 Playground 真实试验共用判断；不改触发时机与回退。OpenAI 对话、发现及单条 / 批量嵌入不发空 Bearer。独立 Electron 目录已经覆盖无 Key 全链与认证失败恢复；实际型号兼容、嵌入模型选择及 RAG / 手动记忆向量门控另列 WISH-045。Provider 自动检测资产更新为 1.1.0，认证样例从生产纯函数派生。下段保留修复前定位证据。

当前证据：直接调用生产 `validateLLMConnectionTestInput` 与 `validateLLMModelFetchInput`，对 `http://localhost:11434/v1`、`http://127.0.0.1:1234/v1`、`http://[::1]:11434/v1` 输入空 Key，三者均返回「请先填写 API Key」，发现原因均为 `missing-key`。继续沿调用链读取确认 `settings.ts` 两个 handler、`model-discovery.ts`、`AgentRuntime.chat` 仍有空 Key 拦截；`App.tsx` 首启只按全局密钥存在与否跳设置，没有判断实际主用途连接是否可用。OpenAI 请求构造器和发现请求还会无条件拼接 Bearer。不能以测试 / 发现按钮单独成功作为本地模型完成证据。

实施要求：认证是否必需从共享纯函数判断，正式表单、主进程及运行入口复用，不将来源标签或空 Key 自动等同于可用连接；明确 HTTP(S) 回环地址与协议边界，拒绝伪装本机的域名后缀、URL userinfo 和不支持协议。有 Key 的连接继续发送自身凭据；无 Key 的本地兼容连接不得发送空 Bearer 或借用全局 Key。首次启动按真实主用途配置判断，不能因全局 Key 缺失而否定有效本地连接。现有错误反馈与失败重试保留，不改变权限或 MCP 认证策略。

允许修改共享连接认证判断、测试 / 发现校验、settings handler、配置可用性判断、Runtime / 首启入口、请求构造及相应 Unit / UI / Electron 和文档。若新增 IPC 载荷，遵守四处同步。验收必须含空 Key 回环三种地址、远程无 Key 仍拒绝、提供 Key 时保留认证、服务要求认证时失败可编辑重试，以及独立 Electron 数据目录从正式表单保存本地连接、发现模型、测试、设为主用途、完整重启后实际流式对话。辅助用途和 Playground 真实测试入口也须核对，不把隔离 fixture 或本地协议服务成功外推为所有真实型号兼容。

### R06 保存反馈实施记录

草稿离页边界（2026-09-19）：ModelRoutingSettings 提供当前可离开检查，SettingsPanel 的分区切换、返回及已有 App saveBeforeLeaveRef 共用检查。新增连接表单、已修改的编辑连接、非空手动模型 ID 和进行中的整组保存阻止离开，使用已有 Toast 提示先保存 / 取消 / 清空；仅打开未修改的已有连接可离开。草稿不自动持久化，不写浏览器存储；普通设置防抖保存不触发模型草稿提示。允许修改这两个正式组件、对应正式入口 UI / Electron 回归与文档，不改变候选布局、IPC 或真实保存契约。验收宽窄布局、内部切页、返回、Escape / 新对话 / Debug / Playground 快捷键、保存中、保存失败、成功保存及取消恢复；窗口关闭 / 崩溃恢复不包含在该导航保护中，仍单列缺口。

请求结果生命周期边界（2026-09-19）：ModelRoutingSettings 为每个连接的测试和发现分别持有请求令牌；卸载清除令牌，同连接重复动作在请求未结束时拒绝。整组保存成功后，删除、端点 / 协议 / 凭据变化或连接启停使对应令牌与已完成结果失效；首个被测试模型变化仅使测试失效，添加模型不清空发现列表，以支持连续添加。仅改名称或用途路由不使连接结果失效。失败保存不改变已保存连接身份。返回成功、业务失败和 IPC rejection 均先核对令牌；异常显示可重试错误，不留下永久 loading。允许修改组件、正式入口 E2E、相关文档；用受控 Promise 复现旧结果晚到、新旧反序、异常恢复、取消编辑与离页重开，不能把 Renderer 隔离证据当作底层请求取消。草稿离页保护独立按上段验收。

整组保存实施边界（2026-09-19）：正式 SettingsPanel 改用专用 `settings:save-model-configuration`，同一载荷包含 connections / routes 两个有长度上限的 JSON 数组；共享类型、preload、Renderer 声明、handler 四处同步。主进程校验载荷、串行合并同端点凭据后调用 settings-store 专用双键保存；先准备密文，再在无 await 的同步段更新两键并一次 persist，SQL 或落盘失败恢复两键的原始值（原本缺失则删除）。复用 Skill 启停的失败补偿模式，不在未提交 SQL 事务中 export。只替换正式模型页原先两次 set，不改变其他设置保存、权限、用途语义或 Playground 隔离。允许修改上述文件、相关 Unit / UI / Electron 和文档；验证真实 SQLite 的写入故障、落盘故障、密文、重开恢复及重试，正式 UI 失败保留和真实 Electron 整组 IPC。此步不解决多窗口旧快照冲突、独立草稿离页或发现迟到响应。

原子保存底层前置（2026-09-19）：`database.atomicWriteFileSync` 在 rename 失败时退回 copy 覆盖旧库，不能支持失败后旧快照完整的保证。允许修改该写盘函数和 `database-persist` 故障注入测试，删除覆盖复制分支；临时写入或替换失败均保留目标文件，清理临时文件并向调用方抛出友好错误。正常新建 / 覆盖、部分临时写失败、替换失败、清理失败及重试都需验证。不改 schema、数据库单例或其他存储业务。此步只是后续模型整组保存的必要保障，不能关闭原子配置保存缺口。另已实测 sql.js 在未提交事务内 export 会结束事务并导出旧值；后续整组保存须先提交，再持久化，并为落盘失败设计内存恢复，不得在未提交事务内直接 persist。

正式 ModelRoutingSettings 的保存回调失败前已关闭草稿、清空手动输入并更新连接 / 路由列表，正式入口红测确认。移除这些提前更新分支，统一等待 persist 成功；失败保留草稿并通过共享 Toast 提示，保存中阻止重复写入和编辑，卸载后不回写组件。此修复只涵盖 Renderer 保存反馈，不冒充连接与路由的后端原子保存，也不涵盖离页草稿保护及模型发现迟到响应。模型来源分类与添加表单回流见上方核对表，原子持久化须补主进程合同与失败恢复证据；R06 保持未完成。

### R06 / R10 基础输入复用核验

替换 `ModelRoutingSettings` 的原生文本输入 / 用途选择及 `McpConnectionForm` 的原生认证选择为已有 TextField / SelectField；保留业务回调、输入类型、模型路由及测试后保存契约。正式与候选共用这些业务组件，未新增独立皮肤或修改基础组件默认行为。Unit 使用真实 JSX 符号检查并覆盖未使用导入与同名遮蔽，正式 MCP 增加 Bearer 输入 / 载荷 / hover 几何证据。此边界不包含复选框、回答方式选项与其余设置控件，不能据此认定全产品 Foundation 审计完成。

### R06 真实生图链路（已批准后端补齐范围，2026-09-19）

最新验证补充：媒体备份已接真实 data:export / data:import，17 项专项覆盖原图缺失 / 篡改、路径伪造、坏 PNG、规模限制、重复导入、写盘失败和会话事务失败清理。正式 Electron 从设置导出，删除原会话 / 图片后导入，完整重启显示和定位通过；新会话消息 ID 冲突整笔失败，不静默丢失配对。Windows electron-builder --dir 产物明确退出 0，包内 sharp 0.35.4 原生模块 / DLL 存在，打包后 My Agent.exe 同一生图与备份恢复流程通过。证据 `var/verification/generated-image-packaged-complete`；这不是安装向导、签名发布或外部厂商生成质量验收。下方早期施工记录的媒体 / native 缺口已由此补充推进，整体合同仍未冻结。

施工记录：已注册 `image_generate` 并统一两处用途定义；附图继续走主对话，生图只用独立配置。共享图片展示已接正式 App、侧边聊天与隔离故事；四主题宽窄、迟到读取 / 定位、重试和侧聊天生命周期共 13 项 UI 专项通过。独立 Electron 已从正式连接与用途设置到审批、一次生成请求、真实 PNG 文件、会话持久化和完整重启图片恢复通过，并覆盖主 / 侧聊天定位与关闭侧聊天后保留项目文件；这是本地协议证据，不是外部模型质量验收。付费请求前权限复核和连续工具批次索引覆盖修复均有先红后绿证据。定位复用读取校验，主框架异步等待期间销毁 / 导航 / 脱离会拒绝唤起系统文件管理器；相关 Unit 覆盖拒绝与失败重试。备份媒体恢复和安装包 native 验收仍未完成，不冻结本合同。

用户明确要求“生图是真的生图，可以看看 Alice 是怎么干的”。此项是既有回流目标的后端缺口，不以图片理解、图片输入或候选状态演示替代。当前状态为生产改造前审计已完成、实现未完成，不能标记 adopted。

#### 开工时证据与参考边界（变更前快照）

- `src/components/settings/ModelRoutingSettings.tsx` 的 image 用途仍是图片理解；`electron/main/llm/aux-config.ts` 的 `loadImageLLMConfig` 选择 image 路由，`electron/main/agent/runtime.ts` 只在用户消息携带图片时调用它。因而现有 image 路由真实作用是看图，不是图片输出。
- `src/shared/types.ts` 中 `ToolDefinition.execute` 返回 `Promise<string>`，`ToolResult` 只有文本，`tool_end` 也只有文本。仅增加请求工具或把 base64 塞进文本都不能形成可验收的结果展示与重启恢复链路。
- `electron/main/tools/builtins/index.ts` 当前没有生图工具注册。注册表存在 image 用途或模型名不能作为生图能力证据。
- 本地 Alice 0.3.168 的 `main-chunks/query-B_tFgAOJ.js` 约 6170–6440 行包含图片 generations / edits 请求、base64 或 URL 结果读取；约 6390 行起的 image_gen 工具有参考图参数、对话展示和工作目录 images 落盘契约。借鉴配置驱动、真实结果与文件关联，不复制 Alice 人设、供应商价格、默认模型清单或私有代理。
- Alice 将 image_gen 声明为只读且免确认，但其工具说明同时承诺写文件；本项目不能据此跳过费用、文件写入及外发图片的权限边界。参考图编辑失败也不得静默改成纯文生图，否则返回的是另一项用户任务。

#### 完整交付边界

1. 设置仍沿已批准的主模型 / 辅助 / 生图三用途候选，通过现有共享用途组件与正式保存链路选择连接和模型。image 的生产语义改为生成；图片输入归主对话模型的多模态能力，不再因用户附图触发生图路由。开发阶段不保留旧图片理解用途兼容 UI，不把原有 vision 模型自动认定为生成模型。
2. 主进程配置仍由 `aux-config.ts` 统一装配，生成有独立明确的调用入口与协议适配器，不能将 images 请求伪装成 chatComplete。未配置、协议不支持或模型不支持时提供可操作错误，不回退主对话凭据，不用本地假图冒充结果。参数与返回载荷须按实际支持的协议验证，供应商特有功能不能只因模型名字相似就启用。
3. Agent 通过正式注册的生图工具调用；参数、来源、版本、指纹、权限和取消链路纳入既有生产资产与 ToolRegistry。外发参考图须经过本地读取沙箱，写出位置须经过写权限和真实路径校验；拒绝发生在网络请求或文件副作用前。对已发出且是否计费未知的请求，不无条件跨供应商重试或取消后重试。
4. 工具结果增加结构化生成图片引用，贯穿 Registry、Loop、流式事件、会话持久化与 Renderer。模型上下文仅接收受限文字摘要及必要引用，不能把整段 base64 混进普通工具文本、日志或 Token 预算。已有文本工具不受影响；生成的媒体与 sessionId / callId 绑定，重载后仍能展示，切换会话不能串图。
5. 正式对话展示真实图片及生成中、失败、取消状态，支持查看和定位已保存结果；复用图片展示与 Foundation 操作控件。若需要新的结果组合样式，先补 Playground 隔离故事并实际验收，再按现有许可回流；不得把候选夹具当作真实输出。文件保存使用应用认可的工作目录和安全文件名，不允许模型任意指定磁盘目标。
6. 图片输入与返回都要有字节数、像素与数量上限；校验真实格式而不只信 MIME / 后缀，拒绝 HTML、SVG 或伪装内容。远程结果下载不可携带生成服务的 Authorization，不自动信任供应商返回的内网 URL / 重定向。取消、超时、窗口关闭和会话删除回收任务及临时文件，不把半张图当成功；保留已提交结果的归属与清理规则。

#### 修改范围与验证顺序

图片处理实现约束：新增并精确锁定 sharp 0.35.4，复用成熟 libvips 解码，不自行写格式解码器。仅 PNG / JPEG / WebP 静态输入，原始与归一化文件均限 8MB、像素限 16×1024×1024、单边限 8192；完整解码后转为无原始元数据的 PNG，不静默缩小超限返回。生成文件严格限工作区 images/ 下简单文件名，只新建、不覆盖，路径及权限在付费请求前与提交前复核；临时文件同目录排他创建，硬链接提交避免覆盖竞态。图片读取 IPC 只接 sessionId / imageId，主进程从已保存工具消息取路径，复核普通文件、大小及 SHA-256，不能根据 Renderer 自由路径读盘。工具结果发布须晚于引用持久化，保证首次读取可用。新增 native 依赖须检查 Electron 及安装包；Vite 8 主进程配置使用 rolldownOptions，避免 Electron 插件预置同名项遮蔽旧 rollupOptions 中的 external 声明。

允许修改：共享模型用途 / 工具结果 / 事件类型、模型配置工厂及独立生成适配器、内置工具与 Registry、Loop / Runtime、会话图片存储、正式 Chat 事件处理和结果展示、共享模型用途组件的调用方、生产资产注册、对应 Unit / UI / Electron 与本文档链。若新增媒体读取 / 定位 IPC，四处同步并校验主框架、会话归属和路径；不开放任意文件读取。明确不碰 OAuth 生命周期、完整 PTY、备份原子性或角色自动换装规则；这些既有目标与缺口不会因本项被宣布完成而关闭。

施工顺序：先固定生成与输入的路由契约并补红测；再接真实生成协议、权限与文件提交；随后打通结构化结果的流式 / 存储 / 展示；最后从正式模型设置到正式对话端到端验收。允许过程态存在，但只有整条链完成后才能作为生图功能交付，不能把新增 loader 或纯工具测试单独称为完成。

工作区保护：`ToolContext.workspaceRoot` 由主进程注入用户实际选中的项目，不能由 Renderer 或模型参数指定。生图要求它与 workdir 的真实路径一致；缺少项目时，其他工具沿用的 process.cwd 回退不能被生图当作输出许可。配置装配异步等待结束后、生成请求之前，以及图片提交之前，都须复核目标与当前权限，任何变化都停止当前请求或提交。

2026-09-19 独立验收：用户主动生图与媒体恢复已贯通正式入口，Unit 176 文件 / 1161 项、根 tsc / build 通过；完整 UI 267、Electron 22 通过 / 4 外部条件跳过。追加在途 Stop 与同名目标并发出现回归，真实 Electron 和 Windows 未签名目录产物各通过 1 条完整流程；取消关闭请求且不落盘、不自动重发。真实 sharp native 解码和恢复已在打包产物中验证。主进程诊断对照 75 → 75 无新增，存量债未解决；不宣称外部付费模型质量、安装向导或签名发布完成。稳定事实已同步运行时、权限、记忆模块卡及 architecture / quality；仅此子项收口，R06 生命周期、R07 和整个产品体验施工合同继续进行中。

媒体备份子项（R06 / R07 交界，2026-09-19）：复用现有 JSON 备份、单操作租约和会话事务，补齐工具调用配对及生成图片。备份内只携带安全文件名、摘要、尺寸和图片字节，不携带可用于恢复写盘的绝对路径；导入前验证引用完整性、摘要、PNG 完整解码及尺寸，重新归一化后写入应用 userData 下新建的专属目录，不覆盖原项目或现有会话。缺失 / 篡改图片使导出明确失败，不静默丢图；图片准备或会话事务失败清理本次新建文件，已完成会话事务后的记忆 / 设置失败不得反向删除被引用媒体。沿用整份备份 25MB 上限，媒体另限 32 张、原始总量 16MB、单图 8MB，超限在写出 / 写库前明确失败。允许修改 data-export、媒体备份 storage helper、相关 Unit / Electron 与文档；不新增依赖，不改变共享页面布局，不声称解决 R07 跨存储原子性。验证须覆盖删除原图后真实导入、重启显示 / 定位、再次导出、重复导入不覆盖、路径伪造 / 缺图 / 超限 / 损坏与事务失败清理。

必测：正式设置保存与重启、模型 / 凭据不串用、附图不会误调用生成、权限拒绝零副作用、真实本地协议请求与图片字节、非法返回与下载越界、取消及迟到结果、保存失败清理、重载恢复和会话隔离；四主题宽窄与固定操作槽；真实模型生成需另行记录实际供应商证据，测试服务的固定图片不能证明模型生成质量或厂商兼容。全量 Unit、类型、build、UI、Electron、资产和文档门禁完成后再推进生命周期。

### R10 OAuth 首次登录闭环（用户已批准缩小范围，2026-09-19）

最新用户指令覆盖下文原全生命周期提案：“打开浏览器、授权、回到应用、连接成功，做成这样就行，后面再说”。本次交付只包含用户主动发起的一次远程 Streamable HTTP 授权、回环回调、真实连接与工具发现，并经现有工具许可流程接管连接。Token / verifier 仅驻留主进程当前授权会话，不写入普通配置、Renderer、日志或备份；不承诺跨重启登录恢复。未保存取消、关闭、删除与退出清理当前授权；过期或失效进入需重新登录状态，不自动弹浏览器、不无限重连。授权码单次消费、state / PKCE、取消、超时、窗口归属与受限网络请求属于首次登录的最低安全要求，不推迟。

后续独立计划：跨重启凭据安全持久化、自动刷新与刷新竞争控制、多服务账户管理、更多供应商注册互操作、SSE OAuth；登记 WISH-045，须按实际服务需求再开工。本次支持 SDK 可用的动态注册及显式配置的公共客户端身份；不支持的注册方式给出明确错误，不伪造连接成功。真实第三方账户授权由用户自行完成；开发测试使用本地协议服务，不代表第三方互操作验收。

Alice 参考结论：本地 alice-source/package.json 为 0.3.168；query-B_tFgAOJ.js 的 image_gen 具备真实生成 / 参考图编辑 / 结果事件与文件保存，但 client-Dfz_cafu.js 的 MCP transport 仅传 headers，没有 authProvider。main-index.js 的 cliproxy:startOAuth 属于代理账户登录，不作 MCP OAuth 证据。首次登录实现参考本地 Claude Code services/mcp/auth.ts 与已安装 SDK OAuthClientProvider / finishAuth；在线规范读取未返回可用正文，未声称已核验最新规范。

以下执行约束已按首次登录范围更新；后续生命周期以 WISH-045 为准：

开工前依据：共享表单仅有 none / bearer，候选待登录没有真实动作。现已接入共享 OAuth 入口、auth 状态、真实浏览器回调及主进程连接，本地协议与正式 Electron 已有证据。Bearer 完整重启证据不覆盖 OAuth。参考本地 CC `services/mcp/auth.ts`、`services/oauth/auth-code-listener.ts` 与已安装 MCP SDK 的 `OAuthClientProvider`；Alice 的 MCP 章节不能证明其登录生命周期。本轮外部规范页面未返回可用内容，不据此宣称已完成最新规范复核。

原研究目标为登录、取消、保存、重新登录和重启恢复的完整生命周期；现按用户缩小范围，只实现首次登录闭环。复用 SDK 的发现、PKCE 与授权码交换，不自行编写 OAuth 协议。R10 首次登录已经实现，后续生命周期不再阻塞本次回流验收。

2026-09-19 验收记录：Unit 169 文件 / 1096 项、完整 UI 258 项、Electron 21 通过 / 4 外部模型条件跳过、框架 Eval 23 与 Skill Eval 1、资产检查 31、根 tsc / build 通过。主进程 Compiler API 与 HEAD 对照 75 → 75 无新增诊断，仍非全绿；无独立 lint，未改依赖。最终证据 `var/verification/mcp-oauth-ui-full`、`mcp-oauth-electron-full`；已检查深色窄屏与浅色宽屏截图。Electron 使用真实本地 OAuth / MCP 服务、IPC、存储及工具注册调用，只替换系统浏览器启动与原生确认入口，不使用第三方账户或付费模型。首次定向 Electron 测试的窗口获取顺序修正后通过，最终完整回归通过。登录保持与第三方互操作仍按上述后续计划管理，整个产品体验合同不因此冻结。

- 交互：远程连接支持浏览器登录；明确点击才打开系统浏览器，展示服务及授权站点。应用启动、后台重连和工具执行不得自行弹浏览器。待登录、登录中、取消、拒绝、超时和失效后重新登录共用正式与候选服务卡，新增状态先在 Playground 验收。
- 回调：主进程短期回环监听，绑定窗口、服务、端点和请求；随机 state 与 PKCE verifier 只归属当前尝试。严格校验路径、方法、state、单次 code 和请求大小；拒绝重复参数及跨请求回调。取消、超时、导航、窗口销毁、删除服务均撤销归属并关闭监听，迟到回调不能写盘或注册工具。
- 网络：认证发现、授权 URL、注册与 token 端点单独校验；只允许安全协议，禁止服务提供的元数据绕过私网及重定向保护。明确授权的本机服务可使用回环 HTTP，不因此放宽远程服务指向本机的发现地址。响应大小与总耗时有界，日志不记录 code、token 或 verifier。
- 凭据：本次 client 信息和 access token 只保存在主进程内存，按服务、端点与授权尝试隔离；不落盘、不向 Renderer / 备份 / 日志暴露，不实现自动刷新。未保存连接的凭据仅属于测试会话；保存成功后才接管，保存失败保留有界可重试状态。端点变化不复用旧授权，未保存取消与关闭及时清理；重启或凭据失效后需用户主动重新登录，后台不得弹浏览器或无限重连。
- 修改范围：MCP transport / client / connection-tests / config-security、专用授权及凭据模块、共享类型、MCP IPC、preload、Renderer 声明、共享表单与服务卡、设置适配器、隔离候选及测试。IPC 四处同步；不改权限引擎、LLM 配置工厂或受限工作区浏览器，不新增云端中转，不要求用户提供第三方密钥才能完成本地协议测试。
- 验收：真实本地授权服务器验证 PKCE、state 错误、拒绝、取消、重放、超时、恶意发现和并发删除；真实 Electron 验证正式入口打开浏览器、授权回调后返回发起窗口、发现工具、按许可保存并完成真实工具调用，以及凭据不进入普通配置 / Renderer。重启后允许要求重新登录，不要求登录恢复或刷新；第三方授权由用户完成，不能用本地测试宣称全部供应商互操作。不支持的客户端注册方式必须明确失败，不能伪造已登录。

实施依赖：先确定注册方式及网络安全契约，再完成主进程授权与凭据生命周期，随后接共享 UI 和正式入口，最后运行完整门禁。各层过程态可以存在，但整条登录旅程通过之前不得宣布 R10 adopted。

最大风险是把文档已落地、fixture 可交互、注册表标记和局部测试混为全产品完成，用逐项正式入口证据约束结论。模型 / MCP / 记忆 / 生活数据的生产契约比视觉迁移更大，保留既有安全及持久化边界，按完整业务单元补齐，不为视觉统一绕过后端。长期上下文恢复从本合同与 Progress 开始，不能只挑最近工作区提交继续。

- 2026-09-14 R12 文化角批次：复用 `companion_assets` 的 `role_id` 隔离链路，新增 `culture` kind 与稳定 starter 资产（读书 / 音乐 / 电影 / 摄影），正式 `WorldDetailsPanel` 通过真实 `companion:get-assets` 读取；未新增第二份文化数据库。家居与足迹仍保留为已有世界状态 / 生活事件的只读派生面，尚未宣称独立后端完成。
