# 质量总控

S4 保存调用方补充回归：生图、索引恢复有 Key / 无 Key、模型诊断共 4 项通过（`s4-credential-dependent`）；同批本地连接旧 5 秒等待失败，现场仍为保存中，调整首次成功等待后独立通过（`s4-credential-local-final`）。未重跑 OAuth 专项，不恢复已暂缓范围。

S4 首次敏感设置持久化：Unit 验证 Local State 缺失 / 无密钥 / 损坏 / 超限 / 加密不可用、等待合并、超时后重试、不缓存成功；真实 SQLite 验证双键 / 单键 / 同步备份准备失败零提交。正式 Electron 在全新目录经模型表单保存随机凭据，成功即 taskkill 自有进程树，重启后真实模型发现收到正确认证，SQLite 不含原文；旧构建明确失败，见 `s4-credential-first-save-red`。最终凭据 / onboarding / 备份恢复 22 项通过，证据 `var/verification/s4-credential-final`。首次新回归与备份测试曾在 5 秒时仍处于保存中，按生产 15 秒上限调整首次成功等待为 20 秒，未删除恢复 / 内容 / 认证断言。Unit 1235、根 tsc / build 通过；主进程同树仅替换本批生产文件对照 71 → 71 无新增，非全绿。未改 UI / 依赖，无独立 lint，已有构建警告保留；不代表 S4 全部边界或全产品完成。

S5 工作区独立验收：onboarding 的文件 / 侧聊关闭、终端进程树、主会话切换三项各自提交本地模型路由，创建独立临时项目，并经正式项目选择入口打开右坞；不再借用前序配置。侧聊单跑红测现场确认未配置模型、未选择项目、右坞缺失；修复后三项分别在新 Electron 数据目录单跑通过，完整 onboarding 19 项通过。证据 `var/verification/s5-workspace-independent-red`、`s5-workspace-*-alone`、`s5-workspace-onboarding`。Unit 1227、根 tsc / build 通过；未改生产代码或依赖，无独立 lint，既有构建警告保留。此证据不证明整套用例已完全独立或外部供应商可用。

S5 文档监听门禁：dev-server-watch 使用真实 Vite 服务和真实临时文件，覆盖 docs / methodology / agent-skills / .agents/skills 的 HTML 与 Markdown 创建不进入 watcher、不发送 WebSocket 消息；两次应用入口 HTML 修改仍发送 full-reload，src/content/prompt.md 仍进入 watcher。不全局排除 Markdown / HTML。本批 Unit 1227、根 tsc / build 通过，未改界面或主进程，不重复跑完整 UI / Electron；无独立 lint 脚本，已有构建拆包警告保留。

S3 生活资产来源回归：lin / zhou / xia / hang / 未知角色无定义时保持空态，真实 SQLite 验证初始化不写样张；衣物引用测试显式创建资产，世界默认与用户 CRUD / 事件授予仍覆盖。Unit 1227、Eval 23 + 1、根 tsc / build 通过，主进程仅替换本批 assets.ts 对照 72 → 72 无新增，非全绿；未改 UI / 依赖，无独立 lint。正式 Electron 文化更新及六面定向 2 项、最终 onboarding 19 项通过，证据 `var/verification/s3-living-source-focused` 与 `s3-living-source-final`，文化长笔记截图已检查。前两轮 14/19、15/19 的失败保留，分别暴露默认作品依赖、笔记定位与空类型断言；后续工作区失败随 worker 重建失去前置，套件独立性仍归 S5，不能以最终通过关闭稳定性问题。

本批提交前完整 Renderer UI 回归 267 项通过（7.6 分钟），资产审计及注册表测试 31 项通过；Renderer IO 替身证据不替代上述两项真实 Electron 索引恢复证据，也不关闭全产品 S6 验收。

S2 配置提交批次未变更依赖；全量与生产范围 npm audit 均因审计端点 HTTP 400（Invalid package tree）未取得结果，不能据此更新漏洞数量或声称审计通过；既有依赖风险仍见 WISH-044。

本批主进程 Compiler API 对照在同一工作树中仅替换本批四个生产文件：基线与当前均 72 条诊断，新增 0；根 tsc 通过不代表主进程全绿。

模型配置提交恢复回归：真实 SQLite / Vectra Unit 覆盖保存后唤醒、旧请求取消与迟到结果隔离、失败单键回滚、观察者异常隔离，以及零记忆备份只在成功落盘后通知。独立 Electron 在正式模型页切换端点并显式填写该端点 Key，验证无需重启重建两个镜像；有 Key / 无 Key 两项均通过。证据 `var/verification/s2-model-save-index-electron`；本批 Unit 1222、Eval 23 + 1、根 tsc / build 通过，无独立 lint 脚本。

向量空间隔离门禁：真实 Vectra 红测证明跨端点和不同维度仍可能返回相似度 1；修复后按生产身份过滤。memory-index-recovery 覆盖切换端点重建结构化源、保留旧对话、未知身份拒绝、无配置不清理、不同维度 / 返回模型拒绝及重复核对零生成；rag-search 覆盖文档端点 / 维度隔离和源记录保留。embedding-auth 验证身份不含凭据 / 端点原文、不受聊天模型或密钥轮换影响。全量 Unit 1215、Eval 23 + 1、根 tsc / build 通过，主进程对照 71 → 71 无新增；既有 Electron 有 Key / 无 Key恢复 2 项通过（s2-vector-space-electron），不以此代替新配置 UI 或跨模型切换正式验收。

RAG 检索回归：rag-search 使用真实 SQLite 表与磁盘 Vectra，仅替换 Embedding 服务和配置工厂；导入两份文档后验证 topK、正文、模块重载后重新打开磁盘索引，以及无 Key 工具调用。空端点 / 模型拒绝且零嵌入请求；服务失败仍沿既有空结果行为。4 条测试先红后绿，全量 Unit 1210 条通过；不证明外部服务兼容、向量模型切换或整应用重启。

S2 嵌入可用性门禁：embedding-auth 覆盖空认证头、端点 A 404 后端点 B 不受影响、A 恢复后同进程可重试；memory-index-recovery Unit 验证无 Key 提交仍生成真实 Vectra 镜像；rag-config 验证统一工厂透传、取消零导入、空端点 / 模型即使有残留 Key 也拒绝。旧判断出现 5 条确定红测，修复后全量 Unit 1206 条通过。独立 Electron 恢复测试按有 Key / 无 Key 参数化，两者均走正式设置、备份提交强退、服务失败与重启恢复，并核验实际 HTTP Authorization；本地服务只证明协议与持久化链，不证明任意嵌入模型或外部供应商。未以这两项代替 S6 全产品验收。

模型诊断生命周期门禁：settings-security 受控暂停配置装配，先红后绿验证主文档导航后零网络调用；覆盖子框架零凭据读取、在途取消信号、迟到成功拒绝及成功 / 异常监听清理。model-discovery 覆盖取消传播与预先取消零请求。独立 Electron `model-diagnostic-lifecycle` 从正式模型表单保存本地连接，分别在真实 GET / POST 等待中重载，服务端观察 HTTP 关闭，再从正式入口成功重试；不使用外部付费服务，不证明普通 React 子页卸载已取消网络。

朋友圈备份门禁：moment-backup Unit 使用真实 SQLite 与生活服务，覆盖导出 / 清空 / 导入 / 重开、重复导入不覆盖、关联与规模拒绝、SQL 和落盘失败回滚。独立 Electron 从正式数据页导出真实赞评，在新目录恢复并完整重启，检查正式人物世界中的动态、点赞和两条用户评论；重复导入保留恢复后新增评论。此次完整 Electron 25 通过 / 4 外部模型条件跳过，UI 落盘结果 passed；不将本地协议测试等同于外部服务验收。

整份备份恢复门禁：backup-atomicity 使用真实 SQLite / 临时文件与生产原子写入函数，设置 trigger 失败和快照 rename 失败时内存各表、重开快照保持原样，向量不提前发布，重试一次落盘；同时覆盖语义去重、设置密文及重复导入不覆盖。generated-image-backup 验证最终 persist 失败撤销会话和本批媒体。backup-recovery Unit 核验提交前 / 后目录、管理标记、链接与损坏引用。独立 Electron 从正式数据页导入，在 my-agent.db 替换前 / 后 SIGKILL 主进程，再真实重启验证核心数据和媒体全无 / 全有。memory-index-recovery 使用真实 SQLite / Vectra 与本地 HTTP Embedding 服务，验证未发通知的源恢复、失败退避、删除 / 改写竞态、稳定 id、分类 / 角色、原子索引快照和实际检索；独立 Electron 在备份提交点强退，服务先 503 后恢复，验证镜像补齐且第二次启动不重复请求。首轮动态 import 与 process 句柄不适配当前驱动，后改退出事件；process.exit 未稳定停在注入点，最终使用 SIGKILL 并留下证据标记，不调整产品断言。此测试不证明断电耐久性、外部供应商 Embedding 或未保存凭据强退恢复。

用户主动生图门禁：image-generation / generated-image-codec / image-generate-tool 覆盖真实本地协议、受限下载、完整解码、规模上限、取消、项目路径与请求前 / 提交前权限复核；并发出现目标文件不得覆盖。generated-image-session / generated-image-ipc / runtime-tool-persistence 覆盖持久化后才发布、归属 / 摘要 / 主框架校验及异步窗口失效。generated-image-backup 使用真实 SQLite 与文件覆盖媒体导出、删除原图后恢复、重开再导出、重复导入、伪造 / 损坏 / 超限及事务失败清理；不证明跨存储原子恢复。

共享图片 UI 回归覆盖固定尺寸、读取重试、会话迟到隔离和主 / 侧聊天。Electron image-generation 从正式设置、审批前零请求、生成 PNG、重启显示 / 定位、侧聊天到正式数据页备份恢复；新增审批后在途请求的 Stop 验证，要求关闭网络连接、不落图且不自动重试。相同测试支持 TEST_PACKAGED_APP，Windows 未签名目录产物已运行真实 sharp native 模块；本地协议图片不证明外部付费模型质量、第三方互操作或安装向导 / 签名发布。根类型检查通过不代表主进程存量类型债已清零。

MCP OAuth 门禁：`mcp-oauth.test.ts` Unit 使用真实本地授权与 MCP 服务校验 PKCE、state、单次回调、拒绝 / 取消 / 超时、端点绑定、注册方式、过期 / 401、受限发现与响应大小；`mcp-oauth-ipc.test.ts` 验证主框架 / owner、原生确认等待取消、销毁 / 导航 / 配置变化的迟到结果。独立 Electron `mcp-oauth.test.ts` 仅替换系统浏览器启动器与原生确认，授权页在独立 Chromium 操作，经真实 preload / IPC / SDK / 存储 / Registry 调用工具；验证空许可拒绝、开启后调用、取消重试、失效不自动弹窗、重启要求登录及配置不含 token。候选 UI 深浅宽窄检查同一表单、固定槽、无生产副作用，不能替代协议证据或第三方账户授权。

外观同源门禁：ui-component-registry 的 TypeChecker 断言正式 SettingsPanel 与候选实际渲染 AppearanceSettingsContent，后者实际渲染 Foundation ActionButton；未使用导入和局部同名遮蔽不得通过。正式入口 UI 在 1166 / 600px 切换四主题，验证键盘、选中唯一性、hover / 选中前后几何、无横向溢出、三档字号与重载恢复；候选主题 / 字号操作前后 localStorage 不变。截图由 appearance-shared-focused 与 appearance-shared-ui 保存，不代替全产品逐页最终验收。

备份记忆预检门禁：security-boundaries Unit 使用真实存储断言核验 0 / 1 / 2 / 20,000 / 20,001 字符及凭据拒绝；data-export-ipc 验证有效与非法记忆混在同份备份时，数据库获取、SQL、addMemory 与 persist 均未调用，且租约释放可重试。onboarding Electron 从正式数据页依次导入三份非法正文备份，比较会话、记忆、生活资产与相处说明前后完全一致，然后完成合法导入及重复合并。该证据证明非法输入零业务写入，不证明合法输入落盘故障的原子恢复。

备份 owner / 并发门禁：backup-operation Unit 覆盖发起窗口、子框架拒绝、同文档 / 子框架导航不误取消、销毁 / Renderer 退出 / 主框架导航取消准备、旧 finally 与新租约隔离、commit 后持锁。data-export-ipc 受控 Promise 先红后绿覆盖跨请求对话框互斥、迟到导入不写库、迟到导出不写文件、写文件与对话框异常释放及非法 JSON 无事务。Electron 用真实 preload / handler 在导出对话框 pending 时发起导入，断言 busy，取消后从正式页完成真实文件往返。四主题 UI 检查 busy 的中文可重试提示；不能把上述互斥证据当作完整导入事务或其他写入服务的全局锁。

备份正式入口证据：Electron 生活资产往返测试从 Settings → 数据与隐私实际点击导出 / 导入，仅替换系统文件选择框的返回路径，不替换备份 IPC；检查真实 JSON 中的生活资产及播种标记、独立目录恢复正文，并再次导入确认不重复。此测试不证明跨窗口并发或崩溃时的原子性。

数据页门禁：TypeChecker 验证正式 SettingsPanel 与候选实际渲染 DataSettingsContent，并验证其操作来自 Foundation ActionButton；未使用 import 和同名遮蔽不能通过。UI 四主题宽窄覆盖重复点击只有一次调用、处理中两个操作禁用且按钮几何不变、取消无错误、IPC rejection / 结构失败的安全提示与重试、成功数量，以及跨设置子页 pending 保留、迟到结果隔离、候选零正式备份调用。真实备份格式和恢复仍由既有 data-export Unit 与独立 Electron 生活资产备份往返验证，不能以 Renderer 替身代替数据库证据。

快捷键导航门禁：`chat.test.ts` 使用受控 settings.set Promise，先发 Ctrl+n，再用 Ctrl+b 触发 App 重渲染并重复 Ctrl+n；释放保存后必须离开设置、保留写入值且只创建一次会话。原实现该用例先红，修复后转绿；既有保存失败保留草稿测试继续执行。另覆盖连续五次 Playground 往返和搜索 Escape 关闭 / 清空，不能用固定等待代替视图断言。UI-e2e 跳过开发者权限读取，正式 gating 仍由独立 Electron 的关于页开关与重启恢复验证；不得将这个已复现竞态等同于全部历史偶发失败。

复选框门禁：McpServiceCard / McpConnectionForm 通过 TypeChecker 绑定到 Foundation CheckboxField，输入扫描不再豁免原生 checkbox；基础故事也检查真实引用。`checkbox.test.ts` 显式纳入 UI project，四主题宽窄覆盖已选 / 未选 / 禁用、点击标签、Space、16px 固定尺寸与 hover / 切换无位移。MCP 正式服务卡补键盘切换，向导补保存失败保留、保存中禁用和空 allowedTools 准确传递；这些 Renderer 替身证据不替代真实 MCP 授权链测试。

伙伴设置基础绑定门禁：CompanionSettingsContent 纳入 TypeChecker 的正式 / 候选实际调用与 Foundation ActionButton / TextField 绑定检查，禁止重新出现原生 button / input / select。正式四主题宽窄验证键盘选中、hover 前后 boundingBox 不变、三个提醒数字字段保存及重新进入恢复，原有长文失败保留 / 重试继续覆盖。候选字段可编辑且 settings.set 观察器无写入；普通浏览器候选没有 preload，测试需显式提供观察器而非假定 electronAPI 存在。

根 `tsconfig.json` 直接检查 Renderer 及其引用的共享源码，不再引用需要预生成声明产物的主进程 composite 工程；构建仍先执行 `tsc --noEmit`。主进程独立检查入口仍是 `tsc -p tsconfig.node.json --noEmit`，本批共享文件显式纳入该工程；不能用根检查通过代替主进程检查，存量诊断继续由 WISH-043 管理。

模型高级区门禁：TypeChecker 校验正式与候选实际绑定 ModelAdvancedSettings，其输入和按钮实际绑定 Foundation，未使用 import / 遮蔽不能通过。四主题宽窄覆盖默认折叠、三个候选字段、旧 Top P / 最大输出 UI 不存在、非法值不保存且离页保留、保存失败与重试、测试目标载荷、hover / pending / 成功失败尺寸相等，以及换 Key / 停用路由后的迟到结果隔离。候选修改预算 / Temperature 和测试连接均不得触发真实 settings / 模型调用。截图确认移除重复 Toast 后控件不被遮挡。

参数链路门禁：工厂红测证明 Temperature='0' 原来变为 undefined，修复后保留零值；settings IPC 对空串、非数、无穷、越界、小数预算和超过安全整数的值在写盘前拒绝，合法零值和小数 Temperature 可保存。独立目录 Electron 经正式高级区填写预算 / Temperature、触发主用途测试，重启恢复后检查真实本地协议对话请求中的 temperature=0；越界 IPC 被拒绝。此为本地协议证据，不保证每个外部型号接受所有生成参数。

外部模型条件测试限制：`electron.test.ts` 的四项测试目前因无测试凭据跳过，且源码仍依赖旧表单 / 消息选择器、未隔离数据目录，已记入 WISH-042；不能把跳过表述为真实供应商已验收。当前独立目录的本地协议 Electron 用例证明生产 IPC、配置、存储和流处理，不证明外部型号兼容性。

连接清单门禁：正式与候选必须真实绑定 `ModelConnectionList`，添加操作来自 Foundation。四主题宽窄检查添加与清单标题同排，hover / 新增禁用时按钮 boundingBox 严格不变；编辑中禁止再次添加，取消恢复；删除最后一项检查持久化空数组、空态、再次添加入口及切页重挂载仍为空。UI 替身在 reload 时会重新安装初始数据，不能把 reload 冒充真实存储重启。

空配置门禁：`model-routing` 覆盖旧字段 / 环境变量不被三用途读取、停用 / 缺失 / 非法路由不复活旧身份、辅助 / 图片沿用新主用途以及完整单次覆盖；Debug Unit 检查同一工厂身份。`local-model.test.ts` 用独立 Electron 目录删除所有连接、写入旧字段并完整重启，检查空清单、空有效身份和聊天提示；请求计数不得增加，重新配置后恢复真实本地协议对话。

Chat 完成时序门禁：真实 Electron 诊断复现 invoke 回执先到并移除监听，随后 error / done 丢失。受控 UI 分别覆盖回执先到、事件先到与 invoke 拒绝，检查等待期间发送锁、最终错误保留、无私有错误泄露、订阅释放及再次发送。流错误不可被无错误记录的数据库历史覆盖；成功流仍与会话库同步。临时诊断日志在定位后移除。

连接卡片共享门禁：TypeChecker 检查正式与候选实际绑定 `ModelConnectionCard` 及其 Foundation 控件，不接受未使用导入或同名遮蔽。四主题 1166 / 600 宽度覆盖超长名称、输入边框、按根字号计算的按钮间距，以及 hover、测试等待 / 成功 / 失败、模型发现等待 / 失败 / 成功时所有头部按钮 boundingBox 严格相等。候选获取、测试、手动添加、启停与移除不得调用真实 settings 保存或模型接口。

用途安排共享门禁：TypeChecker 检查正式与候选 JSX 实际绑定 `ModelUsageArrangements`，以及该组合实际绑定三个 Foundation 控件；未使用导入和同名参数遮蔽为负例。四主题 1166 / 600 宽度覆盖长连接名、无横向溢出、hover / pending / 启停操作槽严格 boundingBox 相等、排序、删除失败保留、重试、空态再添加和切页恢复；候选排序启停删除后设置写入次数必须为零。Renderer 替身只证明交互与载荷边界，真实保存及失败转移仍由独立 Electron 回归覆盖。

用途备用链门禁：`model-routing` 覆盖三用途顺序、停用与缺失引用过滤、去重、独立凭据 / 协议、独立用途不继承主备用池、一次性覆盖隔离和逐目标 thinking；`llm-failover` 覆盖取消、文本 / 思考 / 工具增量后断流不切换、远程缺 Key 跳过且本机备用不带空认证头。`local-model.test.ts` 从正式表单添加连接并排序，完整重启后让首选服务返回 503，断言后续备用端点及其独立认证头，并检查聊天切换提示；协议服务是本地测试替身，不代表真实供应商可用性。当前主进程 Compiler API 相对 HEAD 对照 75 → 75，无新增诊断，仍不代表独立主进程类型门禁通过。

本地模型无 Key 门禁：生产校验红测覆盖 localhost / IPv4 / IPv6 回环，负例包含域名后缀伪装、userinfo、非 HTTP(S)、局域网与非兼容协议。`llm-auth`、`settings-security`、`model-discovery` 和 `embedding-auth` 验证认证头、省略空 Key、凭据不借用以及设置就绪状态。`local-model.test.ts` 使用独立 Electron 数据目录和本地协议服务，从正式表单保存无 Key 连接，发现 / 添加模型、测试、选择主用途，完整重启后检查聊天顶栏实际模型并发送流式对话；401 后编辑 Key 可重试。首次执行发现 `/v1/embeddings` 带空 Bearer，保留路径和布尔诊断后修复，未放宽断言。此测试不证明真实型号的工具、图片、结构化输出或默认 Embedding 模型兼容性。UI 替身显式提供 `llmConnectionReady`，不再伪造旧全局 Key 作为就绪证据。

模型草稿离页保护从正式设置入口覆盖 1166 / 600 宽度：切页、返回、Escape 与应用导航快捷键不得丢失连接名称 / Key 或隐式新建会话；保存失败继续保护，保存中不能离开，成功、取消及清空手动模型输入后可离开，未修改编辑不阻挡。红测复现切页卸载表单；窄屏首轮误点隐藏桌面返回按钮，修正为移动端入口后通过，不调整产品布局。Electron 验证拦截前后真实 modelConnections 设置完全不变，再走保存与重启流程；这不覆盖关窗 / 崩溃或多窗口旧快照。

Electron 失败附件除主进程日志外，还记录 Renderer 当前 Chat / Playground 可见状态，以及测试订阅到的终端 stdout / stderr 长度和退出事件数量；不采集输出正文。进程重启可能使原主进程日志流不再覆盖新进程，不能只凭旧日志缺少记录推断后续事件未发生。

模型请求生命周期从正式设置入口用受控 Promise 验证：旧端点请求期间保存新端点，发起新请求后逆序返回，旧错误 / 模型列表不得覆盖新结果；取消和保存失败保留已完成结果，成功换 Key 清理；IPC rejection 不泄露原错误且可重试，离页重开不接收旧结果。红测截图确认新 URL 已显示但旧请求仍锁住两按钮。首轮因测试按钮名称错误未触及目标，修正为稳定 test id 后才取得有效红测；不以测试替身冒充网络取消证据。

模型整组保存由 `model-configuration-storage` 使用真实 SQLite 覆盖单次落盘、密文、重开恢复、第二条 SQL 故障、persist 故障、真实 export 后 rename 故障、原键不存在及重试。IPC Unit 覆盖非法载荷先拒绝、密钥合并与串行失败释放；正式 UI 替身禁止模型单键 set，保留失败草稿回归。Electron 由正式表单添加连接及辅助路由，拒绝非法整组请求后完整退出重启，验证两者恢复，删除后两者同时移除。此证据不覆盖多窗口旧快照冲突和离页草稿保护。

`database-persist` 使用真实临时文件验证新建与覆盖，注入部分临时写失败、rename 失败和临时清理失败，要求旧文件完整、错误可见、禁止 copy 回退且重试可成功。该底层门禁不证明模型连接 / 路由已原子保存，也不覆盖断电或跨进程写入。

模型共享表单由 TypeScript 符号检查确认正式与候选实际渲染 ModelConnectionForm，其内部输入 / 选择来自 Foundation。正式 UI 覆盖四主题宽窄、五类来源、临时 Key 清理、hover 几何、来源 / 协议保存重开及编辑不改用途；Electron 从正式表单保存自定义 Anthropic，重载后通过真实 preload / IPC 向本地协议服务发送 `/v1/messages` 和连接自己的认证。此为本地协议证据，不等于真实厂商可用性。IPC Unit 拒绝凭相同 id 将旧密钥发往新地址 / 协议。首次窄屏测试因误点隐藏桌面导航失败，改用当前可见标签后完整 UI 通过；不改产品布局和断言容差。

`model-routing` 新增直接调用生产配置工厂的回归：主 / 辅助 / 图片用途各自验证空密钥隔离、显式协议和目标模型，覆盖无独立路由整体回退、目标端点自动协议与一次性覆盖。红测以合成凭据复现了跨连接借用和协议丢失；测试不发网络请求，不证明真实厂商认证、无 Key 本地服务或设置页协议选择已接通。主进程类型采用同一工作树、内存覆盖 HEAD 版 `aux-config.ts` 的 Compiler API 对照，修改前后均为 75 条诊断，无新增；独立主进程门禁仍未通过。

模型保存回归从正式设置入口注入 settings 写入失败，红测复现新增草稿消失；绿测检查名称与密钥保留、手动模型 ID 保留、路由移除 / 连接删除失败不提前改可见列表，延迟保存期间输入与其他写操作禁用，成功重试才应用。Renderer 替身不证明两个 settings 字段的数据库原子性或离页草稿恢复。

模型 / MCP 输入复用门禁使用 TypeScript 符号解析确认 TextField / SelectField 的声明来自 Foundation，并拒绝所审计表单内的原生文本输入与选择器；复选框属于独立控件边界，不被此检查冒充覆盖。正式 MCP 四主题宽窄回归实际选择 Bearer、填写密码输入并断言提交字段与选择器 hover 几何不变；共享候选及模型配置流程继续由完整 UI 回归验收。

产品体验注册表的正式入口、真实数据路径及测试导航由 Unit 校验非空、路径存在和目录边界；正式入口不得指向 Playground / fixture。这是防止清单失联的结构门禁，不证明调用链已执行，也不自动推进 adopted。行为证据仍按全产品合同逐项审查并运行。

开发者模式门控必须用生产构建的真实 Electron 验收，不能用始终开放入口的 ui-e2e 模式代替。`onboarding.test.ts` 在设置内及返回聊天后验证关闭态 Ctrl+Shift+D/P 均不能进入，重新开启并完整重启后验证两者进入与返回；已有侧栏隐藏断言继续保留。红测已证明旧实现仅隐藏入口但快捷键仍会打开 Debug。

设置离开回归从正式 App 输入相处说明并让 settings.set 失败，逐个触发设置切换、Playground、Debug、记忆、朋友圈、Skills、新对话和 Escape，检查设置仍挂载、草稿不变且没有新建会话；恢复保存后验证新建一次和重开恢复。测试与已有返回按钮 / 高级参数自动保存一起运行，不将此证据外推为窗口关闭保护。

Renderer UI 回归使用独立 `ui-e2e` 构建与 5175 静态预览，不复用 5174 开发服务器，不连接 HMR；构建产物位于 `var/verification/ui-dist`。`retries: 0` 配合 `retain-on-failure` 保留真实失败 trace。此隔离防止开发源码变化打断测试，不代表已修复开发服务器重载来源；生产 Electron 验证仍单独运行。

R13 最终静态 Renderer 回归 188 项通过；此前开发服务器回归的失败记录继续保留。Markdown 独立 HTML 夹具作为 ui-e2e 专用构建入口，正式 dist 不包含；动效样张的时长读取兼容压缩后的 `.15s`，不依赖开发 CSS 原文恰好是 `150ms`。

正式 Electron MCP 添加向导使用随机临时 Bearer Token、本地 SDK 服务和独立数据目录：无认证请求必须 401，保存后 SQLite 记录具有 enc:v1: 包络且文件不含 Token 原文，Renderer 只返回哨兵，完整关闭并重启后服务端再次收到正确认证且连接发现一个工具。safeStorage 不可用时测试失败而非跳过。异常断开另有恢复回归；此证据不覆盖 OAuth、第三方服务或模型连接凭据。

人物世界布局验收保持评论槽完整 boundingBox 相等断言，移除共享卡片 hover 位移而不增加容差；衣柜删除从具体条目的无障碍按钮进入，验证脱敏错误、确认保留、防重入与重试成功。Renderer 夹具补齐人物世界初始挂载的 catchupStatus 接口，不改生产调用。

R13 正式入口 E2E 直接检查侧聊发送载荷：文件 A / B 乱序读取、缓存切换和关闭来源；审阅失败、清空失败重试、成功清空后的迟到 diff、多实例切换及不同主会话隔离。测试生成独立主会话 ID，不能用固定 ID 冒充切换；Renderer 替身只负责 IPC 边界，不替代真实 Electron 服务验证。浏览器地址栏不再重复显示标签图标。本轮完整 UI 187 通过 / 1 个 Playground 样式读取超时，带 trace 原样复跑通过但根因未明，记录在 WISH-042；不把定向通过写成完整门禁通过。

R10 异常恢复时序回归覆盖停止期间禁止启动替换连接、旧关闭不能删除新连接、旧握手失败不能覆盖新连接，以及 Renderer 迟到状态查询不得覆盖新推送。朋友圈共享样式移除 hover 位移后仍使用完整 boundingBox 相等断言，不通过放宽容差掩盖布局变化。Foundation Markdown 的一次图表超时在定向复跑中未重现，仍由 WISH-042 管理。

Electron 首启测试通过正式界面先保存连接、添加命名模型、配置主路由并移除旧路由，读取真实设置确认优先级，再断言本地服务收到的模型与认证。MCP stdio 验收脚本从测试模块解析绝对 SDK 路径，不依赖此前项目切换留下的主进程 cwd；仍使用真实子进程、真实 preload / IPC 和断开重连。2026-09-18 全套 Electron 18 项通过、4 项外部模型条件跳过，Renderer 186 项通过。
> 质量维入口：定义 Unit / Eval / E2E / 安全审计的分层和必跑条件。具体 Case、测试文件和当前通过数量以仓库代码及命令输出为准，不在本文维护动态总数。
> 深 Why：`methodology/m17-testing-architecture.md`、`methodology/m18-eval.md`。

## 一、完成门禁

Skills 回流门禁分三层：`skill-views` Unit 用 TypeScript 符号验证正式页和候选真实渲染同一列表 / 详情 / 正文组件，并包含未使用 import 和局部同名遮蔽负例；`skill-state` 使用真实临时 SQLite 验证启停、并发、写盘失败、重载 / 关闭数据库恢复、工具碰撞和旧引用拒绝。Renderer 回归通过 IPC 替身覆盖四主题宽窄、正文内滚动、编辑取消 / 保存失败、启停失败、删除取消 / 失败 / 重试 / 防重复、离页迟到响应及确认按钮尺寸。Electron 回归使用独立目录与真实 preload / IPC，验证内置资源、编辑、完整进程重启后停用恢复和删除；不冒充真实模型服从性或安装包验收。

文件规则验收使用真实临时文件和正式 Registry，验证写入 / 编辑 / 补丁 / 删除 / 读取、别名与补丁目标、目录子项与扫描上限、symlink、越界、无交互拒绝、确认后参数 / 规则 / 会话 / callId 变化与重复确认。Loop 只替换模型，真实文件执行和权限不替换。Electron 用独立数据目录验证真实 settings IPC 热更新、原位确认后删除文件以及重启后拒绝删除。这些执行链证据不替代页面验收；规则卡片与新增草稿现已有正式入口 E2E。

MCP 传输验证使用真实 SDK 服务和正式 Manager：回环 Streamable HTTP 覆盖初始化、Bearer / 无认证、工具发现与调用、许可拒绝、资源读取、无工具能力、发现失败、401 和 307 不跟随；stdio 启动真实测试子进程，验证继承凭据过滤及显式 env。安全 Unit 另覆盖令牌长度 / Header 注入、HTTPS / 回环校验、脱敏、同端点恢复与换端点拒绝、设置合并及 safeStorage 包络。该证据不代表第三方认证、OAuth、隔离测试取消、真实 Electron 保存 / 重启恢复或完整添加向导验收。

正式添加向导 Renderer 回归覆盖四主题 × 1166 / 600px：填写远程 URL、测试成功不提前取消、空白名单保存、持久化失败重试；另测取消失败恢复、迟到响应隔离、修改后失效、重新测试、固定按钮尺寸，以及已保存但刷新失败仅重试刷新。IPC 使用受控替身，不能替代真实 Electron 链路。Playground 通过 `McpConnectionPreview` 注入隔离 actions，实际渲染同一 `McpConnectionForm`；注册表测试核验 JSX 调用，未使用 import 和本地假同名组件均不能通过。

`mcp-connection-form` Unit 覆盖草稿校验与本地参数 / 环境值保真；`mcp-connection-tests` 使用真实本地 SDK 服务覆盖确认拒绝、工具发现、资源发现与接管读取、白名单拒绝、保存失败重试、保存响应重放、接管失败重放、同窗口互斥、跨窗口取消、确认迟到、超时、结果过期、保存中取消、窗口销毁和 stdio elicitation 能力移交。配置并发 Unit 覆盖整表设置、向导新增和工具许可共用锁，以及写盘失败不更新活动许可。确认与持久化回调仍是测试替身，不代表原生确认、safeStorage、完整重启恢复或第三方服务认证均已验收。

正式 MCP 的 Streamable HTTP 配置展示需从 App 设置入口验收四主题、1166 / 600px、零工具与令牌不出现在卡片文案中；使用 Renderer IO 替身的展示证据与上述真实协议证据分开管理。

Vite 开发 watcher 必须排除 `var/verification` 和 `test-results`，避免截图 / trace HTML 产物触发验收页重载；不能通过关闭全部 HMR 规避。`dev-server-watch.test.ts` 读取实际 Vite 配置，在临时目录启动真实 watcher，同时验证源码事件存在、产物事件缺席。

Foundation 复用的符号检查只载入显式调用者、定义文件和负例夹具，不解析无关外部类型图；精确根文件集合与实际 TypeChecker 符号、别名 / 遮蔽负例必须同时保留。该有界检查不替代全项目 tsc，也不通过延长测试超时掩盖范围失控。

MCP 服务卡片 Unit 覆盖未知 / 零工具、文本转义、内部滚动和无回调不生成操作；正式 Renderer 从 App 设置入口覆盖四主题宽窄、连接失败重试、忙时固定操作槽、许可保存失败、状态读取失败恢复、禁用 / 删除保存失败不得先断开，以及异常断开订阅后显示连接失败 / 重试。缺少 `onStatusChanged` 的 Renderer 替身不得让设置页崩溃。主进程 Unit 覆盖意外关闭保持快照、手动断开移除快照、重连失败不闪成缺失行。Electron 用本地 stdio 服务验证杀掉进程后卡片进入可恢复失败并自动重连；该证据不覆盖 OAuth。Playground 场景回归验证同一组件的确认、停用与取消。

相处偏好回归覆盖独立字段、空值清除、输入 / IPC / 备份限长、动态资产来源和 Prompt 身份边界；正式 App Renderer 测试覆盖深浅 / 宽窄、保存失败重试固定槽、重开恢复及保存过程中继续编辑，伙伴页内联错误不重复弹出遮挡操作的 Toast。Electron 用独立数据目录验证真实 preload / settings IPC 与重载恢复，并通过本地协议服务核验主对话实发包含偏好、workspace 实发排除偏好；不把这些测试当作真实模型服从性 Eval。

全产品回流验收要求见 [全产品回流施工合同](./requirements/product-experience-production-rollout-v1.md)：逐项区分 Playground 候选证据、正式 App 入口的 Renderer 证据和真实 Electron / 持久化证据。仅右坞、Vite HTTP 200、注册表状态或 Playground 测试通过，不得推导全产品已回流。正式设置已接共享导航，但各内容仍按 R03–R11 单独验收；例如 MCP 服务卡片共享不代表添加向导与远程协议完成。人物世界六入口已有 Renderer 证据；文化角、家居与足迹已接 `companion_assets` 真实增改删，Electron 覆盖 create / 重载 / 超限拒绝 / 删除清理。正式通讯录列表读取既有忙闲 IPC，忙碌卡在开聊前可见且仍可进入强制确认。正式朋友圈赞 / 评论已落独立用户表，Renderer 覆盖正式入口互动、IME / 失败保留草稿和评论槽几何；Electron 覆盖真实 IPC 重载保留与空值 / 超长拒绝。生活资产备份已有独立目录真实导出导入证据；六面正式入口 Electron 已覆盖真实 IPC 读取与文化 starter 无证据数量文案。R11 关于页开发者模式已有正式入口、候选隔离与 Electron 独立目录开关 / 隐藏入口 / 完整重启证据；UI E2E 的 `ui-e2e` 模式仍显式保留开发入口，不能当作正式默认。人物 starter 来源复核已锁住：无 `world.default.json` 时默认世界态 / Catch-up / Prompt 切片不得出现城西小公寓或日常住处；衣柜 / 文化分味播种仍不是已确认人物事实，不能把入口可见当成人物设定授权。

家居 / 足迹的 Unit 验证同库初始化标记、并发幂等、用户修改保留、删空后数据库重载、插入失败事务回滚及角色隔离。正式 App Renderer 回归覆盖四主题 × 1166 / 600px、长文内部滚动、失败保留内容、重试固定操作槽、同地点多次访问和不同主角响应拒绝；此处 IPC 使用测试替身，不是 Electron 后端证据。Playground 与正式共用 `WorldLivingContent`，样张还需验证“想去”不会进入“常去”。生活资产备份由 `security-boundaries` Unit 覆盖旧备份兼容、非法 kind / 超长名拒绝、id 合并和失败回滚；`onboarding.test.ts` 用独立数据目录验证真实 `data:export` / `data:import` 往返与二次导入不覆盖。该证据不覆盖朋友圈互动、MCP、凭据或项目路径备份。

记忆 Playground 的背景回归覆盖深浅主题、1166 / 600px 宽度，以及清单、编辑、空态新增截图；清单不得再嵌套独立页面预览框，内容区域保持透明且无横向溢出。

文化角共享展示由 `world-living-content.test.ts` 验证四类中文标签、书架兼容、同名资产不丢失、摘要与笔记并存、未知类型、错误字段、文本转义和编辑插槽几何；`chat.test.ts` 从正式入口覆盖四主题宽窄、长笔记内部滚动、Playground 内存增改删不写 IPC，以及正式新增失败保留草稿。`onboarding.test.ts` 通过真实资产 IPC 更新既有作品，并新增文化 / 家居物件 / 想去地点后重载核对，超限拒绝后删除清理；另覆盖正式生活资产经真实备份导出导入后保留且不覆盖现有记录。该 Electron 测试使用独立用户目录，不覆盖整个应用重启或默认人物内容是否已获批准。

文化正文持久化回归必须覆盖 4000 字符边界、4001 字符拒绝、错误类型拒绝、无部分名称更新、清空、跨角色拒绝和衣柜短字段兼容；存储全文与书架 Prompt 笔记摘要预算分开测试。Electron 必须断言真实 updateAsset 返回的完整正文及超限错误，不能只看 DOM 存在。

所有代码任务在声称完成前按顺序执行：

1. 对照 `agent-skills/code-review.md` 自审；
2. `npm run test`；
3. `npx tsc --noEmit`；
4. 涉及 import、主进程或打包结构时运行 `npm run build`；
5. 涉及 UI 时运行 `npm run test:e2e` 并做深色 / 浅色、溢出和主要交互检查；
6. 涉及产品能力或横切契约时更新对应模块卡、Progress 和 Changelog；
7. 运行 `npm run docs:validate`，确认 staged 变更影响也已收口。

真实模型、真实 API Key 和会产生费用的 Eval 不是默认门禁，只有任务明确涉及真实模型行为时才运行。

Electron 回流回归已覆盖首启模型路由、真实伙伴偏好保存/重载、Debug 资产审阅、workspace 文件与侧聊关闭、Windows 终端进程树回收和主会话切换；测试使用独立数据目录与本地协议服务，外部模型凭据用例明确跳过。

正式模型设置回归覆盖高级设置折叠/展开、运行预算与 Temperature / Top P / 最大输出 Token 的可见性，并确认这些控件仍落在正式设置页面；真实保存链路另由设置自动保存与 Electron 测试覆盖。

正式数据与隐私页回归覆盖导出/导入动作卡的说明、固定高度、生活资产备份文案和正式设置入口；真实 IPC 的取消、无效备份、生活资产往返与失败恢复由 Electron 数据测试覆盖。

MCP 工具许可回归覆盖旧配置兼容、工具名唯一性/长度校验、设置页真实工具清单入口以及 Registry/执行前双重过滤；异常断开 UI 恢复已有本地 stdio Electron 证据，OAuth / 第三方认证仍需后续服务证据。

## 二、测试分层

差异复用门禁：foundation-story-registry.test.ts 使用 TypeScript 符号检查三层消费者渲染共享 DiffViewer / DiffViewControls，并验证 DiffViewer 渲染真实 CodeBlock；输入故事和正式工作区地址栏、命令控制台、侧边聊天必须引用同一 Foundation TextField；未使用 import、局部同名/遮蔽和别名负例一起保留。Renderer 回归覆盖空 before/after、并排后切无旧稿回退、原文复制/溢出，以及基础长文件、键盘切换和固定尺寸按钮的深浅宽窄截图。基础层不计算 diff；真实 before/after 安全读取仍由主进程既有测试验证。
IconButton 复用门禁检查正式文件浏览器、右坞浏览器、终端、侧边聊天、正式审阅和 Playground 工作区候选的真实 Foundation 引用与渲染调用；TextField 门禁同时覆盖文件搜索；UI 回归覆盖添加菜单、刷新/运行/终止/发送/停止、复制/关闭及开关入口，固定尺寸在 hover/disabled 状态保持不变。业务文字按钮和菜单项不纳入该门禁。
Markdown 代码块复制槽复用门禁检查 `MarkdownRenderer` 的实际 `IconButton` 渲染调用，保持复制失败提示和固定 28px 操作槽。
ActionButton 复用门禁检查正式浏览器、审阅、侧边聊天和 FileBrowser 的真实 Foundation 引用；故事覆盖强调、中性、危险、禁用和固定高度，避免恢复动作在 hover/disabled 时改变布局。
正式工作区 Foundation 控件审计由 `workspace-foundation-control-audit.test.ts` 覆盖：正式五功能及 Markdown/FileBrowser 不得依赖 Playground 或 `settings-option` 局部皮肤，固定操作和文字恢复动作必须绑定 Foundation；测试同时锁定 ChatRightDock、文件、审阅、终端、浏览器、侧聊、FileBrowser 和 MarkdownRenderer 的通用控件绑定清单，防止后续局部 JSX 控件漂移。
受限浏览器生命周期门禁同时检查 `browser:load` / `browser:cancel` 的 preload、Renderer 类型和主进程实现，避免关闭面板后留下无主网络请求；该门禁不扩大为脚本或登录浏览器。
命令控制台回归还覆盖当前实例命令历史：完成两次命令后上下键按最近优先回看，越过首尾回到空输入，运行中不响应历史导航；历史只存在 Renderer 实例，不进入会话或 Agent 上下文。 状态栏回归同时验证运行中与成功终态，退出码非零由正式面板显示为失败。
正式工作区后端调用链门禁由 `workspace-backend-contract.test.ts` 覆盖：文件、审阅、终端、浏览器和 workspace 侧聊必须分别绑定真实 project/session/terminal/browser/chat IPC；正式面板不得直接依赖 Playground fixture 或候选页面；项目选择 IPC 必须绑定主进程当前工作区根，Runtime 的 `ToolContext.workdir` 必须继续取该根，不能把 Renderer 传入的上下文路径升级为工具执行边界。该静态门禁只证明入口绑定，不替代真实 Electron 生命周期和安全边界测试。
SegmentedControl 复用门禁检查 Foundation 故事与正式 `FileBrowser` 的真实引用和渲染调用；HTML 预览/源码的选中态必须由同一基础组件提供，不把页面级 Tabs 或 Playground fixture 带入文件预览。
WorkspaceToolMenu 复用门禁检查正式右坞和候选的共享菜单调用；UI 回归覆盖添加后实例切换、ArrowUp/Down、Escape、失焦和选择后焦点恢复，防止两层菜单行为重新分叉。

共享 Markdown 的 UI 测试由 playwright.config.ts 的 UI 项目显式匹配 markdown-theme.test.ts：覆盖 Foundation 实际故事、四个局部主题同屏、根主题交叉、1166/600px、真实 WorkspaceFilesPanel 预览调用、语法恢复、快速更新与图内配置不能覆盖安全主题。Mermaid adapter Unit 覆盖配置/绘制串行、失败释放队列、取消丢弃结果和测量节点清理。该 Renderer 夹具不替代真实文件 IPC 安全测试，也不代表其它 Foundation 控件已完成复用。

真实 Electron 引导 E2E 必须使用当前正式设置入口和可见控件契约，覆盖连接测试自动保存、返回聊天以及 Debug 入口；测试不得依赖已移除的旧按钮或旧 placeholder。

真实 Electron workspace E2E 在独立 user-data-dir 和本地 SSE 服务下覆盖会话创建/列表排除/删除，以及正式 Dock 的真实文件读取、流中关闭侧聊、服务端连接终止、存储删除和重开发送。只替换系统目录选择器结果，不替换 preload、项目/聊天 IPC、Runtime 或存储；失败保留脱敏主进程日志。Windows 终端用临时脚本和仅允许两条固定命令的隔离权限规则验证拒绝后重试、2 万字符完整输出、退出去重，以及停止/关闭标签后真实父子进程在 5 秒内退出；不替换 terminal IPC，不按进程名清理用户进程。该证据不涵盖 Unix OS、完整 PTY 或外部浏览器网络。

聊天生命周期 Unit 直接注册 chat/session handlers，覆盖 done 之后仍等待生成器收尾、重复发送/删除、异窗中断/删除/确认、待确认工具取消、销毁窗口与删除失败重试。Runtime Unit 覆盖首次配置等待期间取消，以及 span 创建前组装失败返回单一终态并释放运行锁。

类型覆盖边界：根 `tsconfig.json` 的 include 仅 src；默认 `npx tsc --noEmit` 和 npm build 中的 tsc 不代表主进程检查。主进程改动需额外运行 `npx tsc --noEmit -p tsconfig.node.json` 并报告结果，当前仍有跨项目 include/composite 和存量类型错误（WISH-043），不能隐去失败或用 Renderer 测试替代。

正式工作区生命周期的 Renderer E2E 必须覆盖：后台终端独立输出、切换标签／折叠／设置与 Playground 导航保持 DOM 实例，关闭最后标签后重开、切换与取消项目释放订阅及命令；pending 关闭后的迟到响应补发终止、pending 取消、启动拒绝和业务拒绝恢复、终止拒绝／失败重试，以及旧终止响应不改变新运行。运行／终止／取消等待使用同尺寸操作槽。测试可替换 Electron IO，但不能据此声称真实进程树清理、早到事件或完整 PTY 已验证；终端主进程单测覆盖窗口归属、并发终止合并、taskkill 失败/超时后重试、仅 close 退出、握手前输出/退出顺序、无握手到期、窗口销毁、命令超时和累计输出上限。真实 Windows 进程树证据来自上述 Electron 流程。

正式审阅 Renderer E2E 必须覆盖真实 `before/after` 驱动的 unified／并排切换、无旧稿时禁用并排、列表与 diff 读取失败的可见重试，以及快速选择文件时过期 diff 不得覆盖当前文件。主进程测试还需覆盖旧稿与新稿长度上限；Renderer 替身不能代替文件读取安全边界验证。

正式浏览器 Renderer E2E 必须覆盖地址提交、Esc 恢复、加载中、失败重试、固定操作槽和 sandbox 脚本不执行；主进程测试必须覆盖 HTTP(S) 校验、内网/DNS 拒绝、重定向拒绝、超时和响应大小上限。该查看器不等同于完整浏览器，不能用 Renderer 替身证明网络安全边界。

正式侧边聊天 Renderer/Electron E2E 必须覆盖 workspace 会话不进入主列表、发送时传递父会话/项目/焦点上下文、流式文本、错误后真正重试、停止、错误 session 事件隔离、工具确认归属和卸载删除；主进程测试必须覆盖 `session_kind=workspace` 的创建、读取与列表排除、确认事件携带正确 sessionId，以及 workspace 不触发长期记忆副作用。不得用主会话复用证明侧边聊天归属正确。

侧边聊天上下文回归补充：无活动主会话时父会话 ID允许缺省，但 Renderer 仍必须传递 workspace 上下文对象；文件或审阅焦点只允许作为有长度上限的本轮参考内容传递，不进入 workspace 历史或长期记忆。错误事件后 E2E 必须确认重试按钮再次调用 `chat:send`；创建失败时则须重新调用 `createWorkspace`。父会话切换需检查旧消息/草稿/确认清空、迟到错误和旧事件隔离，并按实际会话 ID 验证清理，不假定 StrictMode 只初始化一次。真实 Electron 补充流中切换主会话后旧 SSE 断连、旧存储删除、新侧聊独立发送及再次关闭清理；不替换 session/chat IPC 或 Runtime。

记忆卡片由 Playground 背景回归与正式设置入口回归分别验证；不能把前者当作正式采用证据。正式回归覆盖四主题、1166 / 600px、长文删短保持多行编辑、hover 与提交操作槽几何、失败保留草稿和重试。受控 IPC 另验证新增 / 删除防重入、首次读取失败、保存成功但刷新失败只重读，以及卸载后迟到响应不清空新草稿；该层不证明磁盘持久化。正式确认流程补验覆盖敏感新增快照、改稿 / 换组 / 取消失效、失败保留确认、连点防重入，以及衣柜删除与通讯录强制开聊的同等恢复；Playground 记忆候选不写真实 memory IPC。上述证据来自正式入口 Renderer 替身，不替代 Electron 持久化。`onboarding.test.ts` 在独立目录使用真实 preload / memory IPC，验证正式增改、完整进程退出重启恢复和删除；不验证向量召回或备份导入导出。

记忆整页回流门禁：`memory-groups` Unit 覆盖六种历史类别唯一归属和四类新增后的重新读取归属；`memory-foundation-reuse` 按 TypeScript 实际 JSX 符号检查 Settings / Playground → MemoryPanel → 管理控件 → Foundation，含只导入未使用、同名遮蔽与导入别名正反例。正式四主题宽窄 E2E 覆盖分类计数、搜索空态、大小写匹配、Escape 不退出设置、搜索开关几何、IME 防误提交、分组独立草稿、真实长度清单滚动与新增删除计数。Electron 通过正式 UI 新增四类并完整退出重启，复核 category / roleId / 内容后删除；不替换 memory IPC。

工作区代码渲染回归：Foundation story Unit 通过 TypeScript symbol 解析检查 Markdown、文件预览、正式审阅和 Playground renderer 实际调用共享 CodeBlock，含只导入未渲染、同名参数遮蔽及导入别名正反例。`syntax-highlight-theme` Unit 锁住 oneLight 容器底被清掉、inserted / deleted / selection 保留，以及 CodeBlock 不得直接消费未清洗主题。正式审阅、文件预览、Foundation Markdown / Diff 与 Playground 工作区审阅 E2E 断言 `pre` 跟随 `--bg-inset`、`code` / `.token` 不是 `rgb(250, 250, 250)` / `rgb(255, 255, 255)`。此证据不把全产品标 adopted，也不替代 MCP OAuth / 工作区跨页状态。

Playground 状态切换回归逐页比较共享控制器的计算样式（高度、字号、行高、内边距、圆角和描边），验证可换行与选中反馈；深浅主题、1166/600 宽度覆盖 Chat、记忆、模型、Skills、MCP、工作区和基础故事，并确认可关闭工作区标签仍无常驻描边。

正式右坞回归验证 PanelRight 收起／打开、文件预览保留，以及终端输入 DOM 始终连通、草稿不丢失；当前不覆盖切换 Tab／项目／一级页面的生命周期，也不证明终端进程执行成功。Playground 工作区标签回归补充常驻关闭按钮、关闭后台标签不切换当前内容、无重复收起入口；地址栏验证居中、无效协议、未知样张、Enter 提交与 Esc 恢复，截图覆盖无边框标签和菜单。 终端实例事件过滤与卸载清理已补实现；仍需真实 Electron 事件回归，当前 UI E2E 使用边界替身。

共享标签门禁：registry Unit 用 TypeScript AST 检查 Foundation 故事、工作区候选、正式右坞的 TabStrip import 与 JSX 使用，包含仅导入未渲染、同名本地组件负例；这不是其它控件的全量复用证明。正式 E2E 覆盖常驻关闭槽、hover 尺寸、后台关闭不卸载当前终端、稳定标签编号和 Home／Delete 后焦点；Foundation 验证方向键，Playground 继续深浅／窄宽文件标签验收。 正式文件工作区另有 E2E 覆盖两个文件乱序返回、重复选择去重、左右布局、关闭重开、失败重试和第二个文件实例独立。

工作区 Playground E2E 覆盖五个入口、21 种形态、文件切换、网页与图片实际加载、多终端独立输出、停止、聊天发送与失败重试；另外验证窄栏 Chat、收起恢复、添加菜单、Esc 焦点返回与多实例、左树右预览位置和文件标签去重/关闭。深浅主题、1166/600 宽度及窄栏保存截图并检查溢出。全部使用隔离夹具，不证明真实浏览器导航、Shell 执行或模型调用成功。

Skills 详情布局回归同时检查返回按钮位于标题上方、标题与开关垂直居中对齐。
权限与自动化的已有规则 / 自定义规则折叠、展开、添加表单、保存失败恢复和几何稳定性由正式设置入口 E2E 覆盖；Playground 仍验证隔离样张，不替代执行链验收。

MCP Playground E2E 覆盖 17 个场景直接切换、各场景服务数与工具数、多服务独立开关、确认选择、取消、重试及场景重置；添加表单验证远程 URL/认证、本地环境变量、字段修改使旧测试失效、工具选择保存与取消保留已有服务。深浅主题、1166/600 宽度检查无嵌套服务卡片与横向溢出，并保存截图。全部为隔离状态，不证明 MCP 网络或认证成功。

Skills Playground 的 UI E2E 对照两个内置 SKILL.md 的完整原文，验证独立开关、详情与返回状态、触发条件顺序、标题开关对齐和窄宽溢出；文件正文高度不超过 48vh，完整原文不截断，键盘可滚到首尾，底部继续滚轮不改变祖先滚动位置和详情高度；深浅主题截图保存在 Playwright test-results，仅验证隔离 UI，不代表正式 Skill 执行效果。

| 层 | 证明什么 | 命令 | 触发条件 |
|---|---|---|---|
| Unit | 纯逻辑、状态机、边界和回归 | `npm run test` | 所有代码任务必跑 |
| Framework Eval | Agent Loop、工具、权限、错误和伙伴行为 | `npm run eval:run` | Agent 行为契约变化时 |
| Skill Eval | Skill 触发、指南注入、工具边界和回复证据 | `npm run eval:skill` | Skill 运行链路变化时 |
| Persona Real Eval | 真实 LLM + Judge + pass^k | `npm run eval:persona` | 人格 Prompt、Judge 或评分标准变化且用户允许费用时 |
| Renderer E2E | UI 页面、交互和布局 | `npm run test:e2e` | UI 变化时 |
| Electron E2E | 首次配置和可选真对话 | `npm run test:e2e:electron` | Electron 生命周期、首次配置或真对话链路变化时 |
| 文档一致性 | 链接、合同状态、DEC、Wishlist ID 和 canonical source | `npm run docs:check` | 文档或规则变化时 |
| 变更影响 | staged 代码与必须复核文档映射 | `npm run docs:impact` | commit 前；由 pre-commit 自动运行 |
| 周期复盘 | 最近提交、重复真相源候选和维护债务 | `npm run docs:self-review` | 每周或重大施工后；只读生成报告 |

UI 组件 / 图标语义注册表、Foundation 故事注册表、Playground 目录或故事发生变化时，Unit 必须验证稳定 key、分类、来源和生命周期，并验证 story key → assetKey → renderer → viewId 关系，Renderer 必须运行 `npm run test:e2e` 验证入口与筛选；不改变 Agent 行为契约时，不要求运行真实 Persona Eval。Foundation / Experience 边界变化时，Unit 还必须验证产品体验的 `experienceParts`、`usesFoundation`、层级和生命周期约束；Foundation 故事导航当前由注册表派生为 13 个任务入口；本轮新增的 IconButton、Card、Badge、Tag、Divider 必须有对应 assetKey、renderer、隔离可见预览和 E2E 入口证据，生命周期保持 `playground`，不得以样张冒充 `adopted`；Foundation 工作台必须覆盖所有已建故事并提供真实可见预览；本轮批准的 Select、Form Field、Checkbox、Switch、Dialog、Popover、Dropdown Menu、Combobox、Command、Context Menu、Scroll Area、Tooltip、Skeleton、Progress、Diff Viewer 也必须有隔离故事；候选和完整资产清单由注册表 / Debug 承担，不要求 Playground 重复渲染无预览登记卡；E2E 必须验证业务 Tab 可切换且 Playground fixture 不触发真实 IPC。布局收口时，E2E 还必须验证每个一级 Tab 有统一页头、主内容宽度稳定，Foundation 故事筛选在一条无分组标题的横向状态切换行中保持故事顺序，且不存在重复的页面级说明块；相近 Foundation story 只减少导航入口，不得减少底层 story 预览；Chat 页头的用途说明与标题同行；所有产品体验的实现来源路径在统一页头基础引用行最右侧，其他一级 Tab 也必须登记可定位的 `.tsx` 来源并与标题说明同行；基础引用必须以实际 Playground 组合中可见的调用关系为准，未在该体验样张中体现的基础资产不得登记为依赖；来源固定宽度省略并可通过 hover 查看，组合样张下方仅保留宽度切换；图标目录数量统计、来源路径和搜索都必须位于目录头部，固定尺寸必须在独立样张卡中展示，自定义滑杆只作用于少量预览图标且可用；圆角滑杆实时更新样张，motion 样张默认播放且提供统一开关（开时持续动、关时停止），不显示“点击播放”，不额外制造独立信息行；分隔线的边界规则必须与分隔线样张合并展示，使用正确 / 不当的可视化对照，不以独立纯文字卡代替预览。

Chat / Sidebar / Settings 页面组合变化时，Renderer E2E 至少覆盖：开发入口与会话区的结构顺序、非 Chat 全页视图不继承空白 Chat 顶栏、设置无手动保存栏，以及自动保存的防抖落盘和离开页面前刷新最后一次修改。自动保存测试可 Mock settings IPC 作为外部 IO，但必须验证真实 Renderer 状态变化与写入参数，不能只断言静态文案。
Debug 入口与壳变化时，Renderer E2E 必须验证侧栏进入全页 `DevPanel`、Chat 不出现 `conversation-debug-toggle` 或 `ConversationDebugAside` 半屏、默认显示只读“运行概览”、概览证据入口可达，以及 Debug 内部分区仍可切换；右坞回归只验证文件 / 预览 / 审阅 / 终端，不得重新引入 Debug 覆盖。运行概览的 Unit 必须覆盖真实来源成功、局部来源失败、全部来源不可用、空 Trace 列表、凭据未配置和仅统计明确 `error` 状态，不能把缺失证据误报为运行错误。
生产导航收口时，Renderer E2E 必须验证 Primary Sidebar 产品区只保留人物世界 / 设置、SecondaryNav 不挂载，记忆与 Skills 仍可从 Settings 的「记忆」/「工具」分区进入。
Sidebar 底部入口应直接呈现，不额外渲染“开发 / 产品”分组标题；这类纯结构文案不应占用导航空间。

Sidebar / IA 的新候选在 Phase P0 只增加 Playground Renderer E2E：覆盖候选入口顺序、底栏贴底、删除态、边缘视口和关键交互；Right Dock / Moments 等样张必须证明在无 Electron IPC 时仍能渲染。不得把尚未获用户确认的候选断言写成正式生产布局契约。
基础与产品体验分层候选还必须验证：基础 / 产品体验 / Agent 实验三个工作域可见；基础组件和业务状态在工作台内筛选；产品体验页面直接进入且不复制基础组件。本轮导航与生活面候选还必须验证：一级入口不出现组件二级导航；Right Dock 默认只有预览且可通过“+”重复添加文件 / 预览 / 审阅 / 终端实例；文件与预览彼此独立；审阅 / 终端不触发真实 IPC；朋友圈不出现生活广播标题或 Catch-up 独立卡；人物世界的朋友圈、衣柜、文化角、家居、通讯录、足迹六个业务 Tab 可以切换，朋友圈候选需验证 Playground 专用人物头图、三条动态卡、相对时间和 Alice 候选样式标识，角色架在设置样张中查看；业务状态页不展示已移除的伙伴状态条故事；记忆只使用三种主色与灰色；图标目录提供 12 / 14 / 16 / 20 固定尺寸与自定义滑杆且搜索默认收起；设计语言 motion token 有可交互动画样张且不提供无实际用途的手动重新读取按钮；Markdown 故事的代码块在浅色主题下不能退化为白底；产品体验页只在统一页头元信息行展示当前 Tab 的 Foundation 基础引用；内容区不再重复渲染依赖卡；页头不重复显示工作域或“隔离实验”徽标。 Chat 壳主内容区不保留独立“新对话”顶部框，但侧栏的新对话入口仍须可见。 Chat 空态不展示主角切换规则说明条或“换个主角”操作，相关规则和入口只在角色架 / 设置上下文出现。

Sidebar 候选获得明确许可并回流正式页面后，Renderer E2E 必须把对应断言从“候选位置”同步为“正式结构位置”，同时保留 Playground 候选态的边缘场景覆盖。

涉及 fire-and-forget 的主进程后台任务时，生产路径必须提供可等待的 drain 边界；单测 teardown 在关闭数据库或测试环境前先 drain，避免动态 import / 资源访问跨越 Vitest 生命周期。后台任务仍可在正常产品调用中非阻塞运行，drain 只用于生命周期收口。

Mock 只允许替代外部 IO 或构造确定性 Eval，不得 Mock 核心业务后宣称真实产品能力通过。

## 三、Eval 契约

- 普通 Scenario 唯一列表：`evals/scenario-registry.ts`。
- Skill Case 和 Grader 以 `evals/` 生产定义为准；Debug 只读取同一份报告，不在 Renderer 重新评分。
- `ModelBasedGrader` 使用“是否存在违规 / 是否缺失必要行为”的可判定问题；多个维度在一次 Judge 调用中返回结构化证据。
- Mock、Skill 和 Persona Real 必须在命令、报告和 UI 中明确区分，Mock 不能冒充真实人格通过。
- 真实 Persona 报告可以保存 Agent 可见输入、回复、配置和 Judge checks，但不得保存 API Key 或隐藏 reasoning。
- 人工审阅是独立注释层，不修改原始报告，也不改变自动 PASS / FAIL。

## 四、Prompt 与生产资产门禁

- 自有模型可见自然语言保持简体中文；协议 token、代码标识、工具名、JSON key 和外部原文可保留英文。
- 每个生产 LLM 调用必须声明稳定 Prompt 资产 key，或显式声明 promptless 原因。
- Prompt、Role Pack、Memory Strategy、Permission / Sandbox、Tool、Skill、Eval、Provider 和 MCP 资产必须由真实生产注册表提供来源、版本和指纹；Debug 不维护第二套目录文案。
- 用户记忆正文、API Key、MCP secret、工具参数、命令、路径和隐藏 reasoning 不得进入静态资产目录或普通日志。
- 资产运行证据只记录稳定 key、关系、状态和允许的结构化元数据。
- 每次涉及生产资产的提交必须通过 `npm run assets:check`：治理清单、来源路径、ModelContextAssetType 覆盖、主题单一来源和 staged 注册同步均失败即阻断；报告写入被忽略的 `var/asset-audit/`，不作为第二事实源。
- Provider 预设扩充必须由共享注册表驱动 Settings / Chat / Debug；Unit 同时校验入口稳定 key、Provider 身份、分组数量、Provider 快切子集、Provider 卡片不带模型白名单和 Anthropic / Gemini 地址版本归一化，避免把协议入口或非聊天能力误显示为固定模型。
- 动态 Tool / Skill / MCP 明确依赖运行时自动发现；静态 Prompt、伙伴、Memory、Permission / Sandbox、Eval、Provider、SubAgent、Icon、UI、Design 必须有显式注册入口。
- 每个活跃产品体验必须登记真实 source 与 `usesFoundation`；TypeScript 检查 key，Unit 检查依赖存在、foundation 层级、生命周期兼容和 Playground 入口一一对应；反向 usedBy 只能派生。新增 `src/assets/playground/` 媒体夹具时，对应体验必须在 `fixtureAssetPaths` 显式认领，并通过 `assets:check` 的 staged 漏登门禁。
- 图标目录的 adopted 状态必须逐项提供真实 `sourcePaths`；Unit 检查来源存在和状态一致性。禁止把整页、目录或全部图标批量标成已采用。
- Playground 回流正式 UI 必须补 UI 契约证据：正式右坞默认预览、文件 → 预览上下文保持、正式审阅 / 终端未替换为 fixture，并验证深浅主题下 Markdown 代码层级不与页面底色混淆。
- Foundation Design Language 候选主题、圆角和动效只能在 Playground 局部生效；Unit / Renderer E2E 必须证明它们不会污染正式 `design-asset-registry`、`documentElement` 或生产默认主题。
- 设置候选四主题必须与基础主题对照的名称、顺序、色板同源；E2E 在深浅全局主题、宽窄视口中逐一切换，验证局部实际颜色、唯一选中、键盘操作、返回分区保留选择，以及全局主题和 localStorage 不变。
- `design-study` 家族显式治理 Playground 共享色板；新增候选来源仍须通过静态资产登记门禁，不因文件位于组件目录就重复登记为 UI 控件，也不得泛化成 Playground 目录豁免。
- Foundation Design Language 的主题选择只代表当前 Playground 比较状态；Renderer E2E 必须验证选中摘要与候选卡同步、故事 Tab 保持单行轻量导航，且不得新增持久化设置、正式主题写入或第二层导航。主题候选至少覆盖明显不同的色温与明暗方向；更换候选后 E2E 必须同步校验稳定 key 和默认选中摘要。设计语言页重构后，E2E 还必须覆盖形态 / 材质 / 动效入口、圆角滑杆、蒙版“仅浮层”边界和持续动效开关。Foundation 标签样张必须验证每个 tab 可点击并更新内容；产品体验页必须验证统一体验舞台、基础引用和来源省略布局；朋友圈互动行必须验证赞 / 评论靠左、Lucide 图标、赞状态切换和评论选中态，且不触发正式数据或 IPC。朋友圈媒体样张必须验证图片真实可见、存在有意义的 `alt`、单图尺寸受约束、地点位于图片下方左侧，并确认卡片不再显示无信息增量的“生活动态”标签。
- 正式 Chat Sidebar 的 Renderer E2E 必须验证会话搜索在顶部入口行内展开（不得新增独立搜索行），Escape 可关闭并恢复新对话入口；侧栏收起 / 展开必须验证轨道宽度过渡与 ResizeHandle 同步隐藏，不能只验证 DOM 卸载。
- Playground 人物世界候选的 Renderer E2E 必须验证六个并列 Tab 按“朋友圈 / 衣柜 / 文化角 / 家居 / 通讯录 / 足迹”顺序展示，足迹固定在最后；文化角同时展示读书、笔记、音乐、电影和摄影，家居展示当前空间，通讯录展示关系摘要，六个入口共享同一隔离主角；正式 WorldHub 不传候选 Tab 定义时默认入口不变。
- 产品体验 Chat 候选的 Renderer E2E 必须验证初次进入 / 正在聊天 / 处理中 / 需确认 / 已完成 / 未完成六种状态共享同一页面骨架；空态不出现换主角入口；欢迎快捷入口至少能把“看看朋友圈”切换到人物世界；人物世界头图不再提供「看记忆」或「近期生活」，进入记忆走 Playground 左侧设置导航；记忆页能进入设置；设置页不再提供独立「回到 Chat」按钮，回到对话走 Playground 左侧 Chat 导航；只有处理中出现五功能工作区（审阅 / 浏览器 / 文件 / 终端 / 侧边聊天），消息流内不再出现任务进度卡，完成 / 失败也不打开工作区；需确认的全局覆盖层允许 / 拒绝 / 返回、已完成的普通伙伴结果回复、未完成的失败恢复面板重试 / 返回都必须可操作；确认卡不得出现在消息流 DOM 内。角色架入口必须可从 Chat 伙伴身份到达，切换后 Chat、人物世界六个生活面使用同一隔离主角。 Chat 处理中还须验证对话 / 工作区分隔线、右上角 PanelRight 开关、收起恢复后标签与任务状态保留，以及宽窄视口下操作槽不溢出。
- Playground 设置候选的 Renderer E2E 必须验证新的日常 / 高级导航、开关依赖披露、模型高级控制折叠、权限规则样张、MCP 添加状态、数据备份反馈与低频关于入口，且侧栏不得出现 Debug / Playground 导航说明；记忆相处设置必须用可理解的回答例子说明选项，扩展页不得暴露内部归位说明，关于页不得沿用外部品牌标语；候选不得调用真实设置 / 记忆 / MCP / 模型 IPC，也不得把 Debug 变成设置一级导航。权限规则统一为默认收起的“自定义规则”：展开显示已有列表与“添加”，点击“添加”才显示表单；必须覆盖取消、空白禁存、追加保留已有规则、保存后收起表单、数量更新，以及深浅主题和窄宽长路径不溢出。MCP 工具清单必须是独立条目，不得使用 divide-y 内部分割行。Playground UI 改动交付前必须扫设置、记忆、Skills、MCP、权限和当前相关页，确认没有新的“一块回答多个问题”回归。
- 自定义规则的“添加 / 取消添加”使用同一固定尺寸按钮，DOM 顺序和实际位置均在规则列表下方；每条规则须有实际卡片边框和底色，折叠分组外层不得再套卡片。深浅主题、宽窄视口须比较展开、原位取消、表单取消时已有规则和按钮的相对位置及尺寸；保存追加后允许入口随列表向下移动，但首条规则不得移动，入口仍须位于完整列表下方。
- 角色架候选必须嵌入设置壳：左侧设置导航保持可见且“伙伴与相处”为当前项，右侧详情区展示角色列表；不得退化为覆盖整个设置区域的独立全屏样张。
- 设置候选的窄宽门禁还必须验证顶部导航不被内容撑开而保持横向滚动、键盘 Enter 可切换分区、Tab 与当前 `tabpanel` 建立 `aria-controls` / `aria-label` 关联，且内容切换使用既有动效变量。
- Playground 记忆管理候选还必须验证总览统计、搜索、四类归属、添加记忆、编辑、删除、敏感项和 Debug 来源开关；新增 / 修改 / 删除只更新隔离 Renderer 状态，不调用 memory IPC，不把 Chat 动态、任务状态或 Debug 运行记录放入记忆清单。
- Playground 记忆条目还必须验证默认日期、hover / focus 原位替换编辑删除、编辑 / 删除确认不改变右侧槽位置，以及长记忆在深浅主题和窄宽视口下自然换行、不溢出。
- 长记忆进入编辑态必须使用可读的多行编辑区，编辑区高度应随内容达到可操作尺寸；短记忆仍保持紧凑输入，保存和取消操作槽位置稳定。
- 敏感记忆候选必须只显示卡片第一行的单句敏感提示；不得重复显示分类标签或附加编辑 / 删除引导文案。
- 记忆列表布局还必须验证顶部无空白操作区、编辑 / 删除与日期同排，删除在卡片内确认而不是全局层，敏感场景显示保留提示且普通清单不误显示敏感警示。
- Skills / MCP 候选还必须验证 Settings 下两个一级入口、Skills 主行只保留名称与启用开关、Skills 列表行只展示名称与纯开关、不出现重复启用文案或嵌套卡片，并覆盖 Skills“单个 / 多个 / 详情”三种隔离审阅状态；详情开关同行、多个状态独立卡片和触发条件文案也必须通过 UI E2E 验证。 工作区候选必须验证审阅 / 浏览器 / 文件 / 终端 / 侧边聊天五个入口，不出现任务进度或完成结果，且所有交互不调用生产 IPC。
- 设置候选补充能力时还必须验证模型页的空态 / 单连接 / 多连接、添加来源、连接详情和模型用途切换只更新隔离样张；模型 ID 不由 Provider 预设写死，主视图不铺开文本 / 图片 / 工具能力诊断；模型预算输入只更新隔离样张、0 的“不限制”语义可见，Skills 的启用 / 隔离试跑状态可操作且不触发真实 Skill / MCP IPC；回答方式位于伙伴与相处并提供具体例子，记忆单独作为设置入口；作用范围标签只作为用户解释，不得变成新的权限判断来源。
- Playground 记忆 / 设置关系旅程的 Renderer E2E 必须验证“身份信息 / 工作方式 / 沟通偏好 / 我们之间”四类 Tab 与唯一内容归属（样张必须分别验证稳定背景、工作方式、沟通偏好与共同约定，不能跨类兜底）、默认紧凑列表密度、普通模式来源隐藏、隔离 Debug 开启后右上角“查看来源”开关、来源作为正文下一行淡色说明且不带“来自：”标签以及来源不泄露向量、Prompt、召回分数等内部词；“之后会”不再出现；“纠正记忆”必须可在 Renderer 内存夹具中实际保存；伙伴生活事件不进入记忆清单，当前进行中的动作和系统运行记录只在 Chat / 工作区 / Debug 语境出现；从人物世界进入设置时必须选中记忆管理场景和 Settings「记忆」分区；回到对话通过左侧 Chat 导航，而不是设置页内的「回到 Chat」按钮；记忆内容只在设置分区内承载；预览不得触发真实 memory / settings IPC 或改变正式默认分区；正式 MemoryPanel 不传 Playground preview props 时仍保留原有标题、技术分类筛选和 CRUD。

编程套餐连接候选的 UI E2E 覆盖六个套餐的名称 / 专用地址联动、普通 Ark 与 Coding Plan 分组、名称左置、预设不暴露适配器、自定义三协议切换保留地址、保存后空模型清单、获取失败后的手动添加与用途引用、取消重开和 Key 清除；深浅主题各验收 1165px / 520px。该测试只证明 Renderer 隔离交互，不证明套餐真实调用或模型发现可用。

连接卡片 UI E2E 还须验证：连接详情常驻，获取 / 测试按钮在各卡片头部右侧且不与卡片内容折叠耦合；已有连接提供编辑入口，点击后在当前连接卡片内展开同一套表单，保存后保留原模型清单；获取成功展示候选项，点击候选直接加入、不自动批量加入；已添加项禁用并保留勾选标记，手填模型用加号或 Enter 提交，重复项不可提交；不同连接草稿不串用，获取中重置样张不会回填旧结果。深浅主题各覆盖 1165px / 520px 的位置、溢出和截图检查；缺凭据获取失败后仍能手动添加。

## 五、安全门禁

安全任务必须先读 `agent-skills/security-checklist.md`，审查细节以 `agent-skills/code-review.md` 为准。至少覆盖：

- IPC 运行时输入边界和主进程重新确认；
- 凭据、日志、导入导出和 Renderer 数据最小化；
- 文件 realpath / symlink、工作区和 `ToolContext.workdir`；永久删除白名单必须基于工作区相对路径，并覆盖 Linux `/tmp` 工作区回归；
- PermissionEngine、Headless、Shell、Git 和子进程环境；
- URL SSRF、重定向、DNS、MCP 外部内容和资源上限；
- 正则、Prompt、RAG、报告和批量输入的 DoS 边界；
- `npm audit` 与生产依赖审计。

发现剩余风险时先搜索 `docs/decisions.md` 和对应模块卡。明确接受或明确不做的边界，只有触发条件变化时才重新立项。

已完成安全审计快照见 [`../_archive/audits/security-audit-2026-08.md`](../_archive/audits/security-audit-2026-08.md)。

模型配置解耦候选还必须验证：Provider 预设分类必须验证阿里云百炼、硅基流动出现在聚合 / 中转入口而不出现在官方服务商入口；运行预算字段必须明确标注 Token，并说明按输入与输出 Token 合计计算、0 表示不限制；官方、聚合 / 中转和本地入口提供常见预设，连接名称随预设生成默认值且仍可编辑；官方服务商使用官方预设和官网地址，适配器只在自定义连接中出现；三种用途各自支持多模型路由与顺序优先级；连接下可维护多个模型；“获取已有模型”成功后可逐项加入清单，添加连接使用适配器且不要求首个模型 ID；聚合 / 中转 / 统一网关作为同一连接入口。上述交互只能使用隔离 fixture，不得触发真实 Provider、凭据或 Settings IPC。

## 六、模块关系

- 伙伴 / 人格：`docs/modules/companion.md` 的必测点 + 相关 Persona Eval。
- 记忆：`docs/modules/memory.md` 的必测点 + memory Unit / Eval。
- 权限：`docs/modules/permission.md` 的必测点 + permission / security Unit。
- Agent 运行时：`docs/modules/agent-runtime.md` 的必测点 + Loop / Context / Provider / Tool 测试。

## 七、维护规则

- 新增或改变质量分层、门禁条件时更新本文。
- `docs:validate` 是文档收工入口；Git hook 和 GitHub Actions 负责自动触发，人工仍需判断产品语义。
- `docs:self-review` 是周期性只读复盘入口；报告写入 ignored 的 `var/docs-self-review/`，AI 提示词只提出建议，不自动写 canonical 文档。
- 新增 Case 或测试文件时只改代码注册表和测试，不在本文追加数量清单。
- dated audit 完成后归档；有效缺口先迁入 Wishlist 或 Decisions。
- 旧 `testing.md`、`eval-design.md` 和收口前 Quality 全文均已归档，不能作为当前门禁。

- 记忆页回归覆盖统计卡减法、放大镜展开搜索、搜索过滤和添加按钮可达性。

- 记忆页回归确认统计区域已移除，分类、搜索展开、添加和列表流程仍可用。

- 记忆页回归确认边界提示移除后，分类、搜索和列表仍可达。

- 记忆回归覆盖底部新增行的展开、分类选择、保存和新增内容展示。

- 记忆回归覆盖当前分类内联新增行、保存后列表更新和隔离说明顺序。

- 内联新增记忆回归修正：从当前分类底部打开、输入并保存，验证列表更新与无分类下拉。

- 记忆搜索回归覆盖：点击放大镜后入口变成输入框，框内左侧放大镜、右侧清除；清除后收回搜索按钮。

- 记忆页回归确认分类 Tab 下方不再出现分组解释小字。

- 记忆清单回归覆盖独立条目卡、图标编辑/删除和无文字链操作。

- 记忆纠正态输入框必须与展示态正文同为 13px 字号。

- 记忆编辑态必须保持日期位置不变，保存/取消替换底栏图标槽，不得把操作按钮插入正文行。

- 记忆新增行的保存/取消必须使用图标按钮，不得再出现文字「保存」「取消」。

- 记忆新增输入焦点必须使用主题描边，不得叠加浏览器默认黑色 outline。

- 工作区文件预览关闭按钮必须和文件名处于同一标签内，不得再使用独立描边把关闭按钮挤到标签外，也不得再提供独立的「关闭文件预览」。

真实 Electron workspace 回归同时验证主会话列表排除、删除后读取为空；右坞进程级证据现覆盖 Windows 终端停止/关闭及侧聊关闭/切换主会话后的流连接与存储清理，具体边界见上方 workspace E2E 契约，不能外推为完整 PTY 或外部浏览器实测。

- 2026-09-14：设置回流门禁新增正式导航断言：只能出现九个 demo 入口，不得恢复旧参数、工具、开发者等入口；伙伴页正式与候选共用内容组件，E2E 同时覆盖候选隔离 test id、返回行为和窄宽导航。

- 2026-09-14：开发者模式门控新增 UI E2E 回归边界；正式入口默认隐藏 Debug / Playground，UI E2E 通过隔离模式显式开启开发入口。

- 2026-09-17：R11 关于页开发者模式补齐共享内容组件证据。Unit 锁住正式设置与候选实际渲染 `AboutSettingsContent` / `SettingSwitch`；Renderer 覆盖正式开关写入、关闭设置后入口刷新，以及候选开关不写生产。Electron 独立数据目录覆盖开启后入口出现、关闭后隐藏、完整重启恢复且不删除数据。无 API Key 时完整重启会打开设置全屏，必须先返回 Chat 再断言侧栏入口。UI E2E 默认开发入口可见仍是 `ui-e2e` 模式特例。

- 2026-09-14：R12 文化角新增资产播种与注册表回归覆盖；测试验证角色隔离、稳定 starter 类型和防修改副本。
模型连接与用途路由的质量门禁：路由配置必须只选择启用且字段完整的连接，按顺序跳过无效项；连接已有 `models[]` 时只能选已启用模型，空清单仍兼容旧单 `model` 字段；Renderer 和备份不得包含连接密钥，但可以带 `hasApiKey`。相关纯函数、设置安全视图和备份边界必须有 Unit 覆盖。

- 正式模型发现门禁：`settings:fetch-models` 必须在主进程校验并发请求；无 Key 不发请求；已存 Key 只按 `connectionId` 注入，不能用全局 `llmApiKey` 冒充该连接；401 / 空列表 / Gemini 不支持 / 超时只返回结构化原因，不回传凭据或堆栈。Playground 获取仍是隔离 fixture，不能当作真实发现证据。

- 图片理解路由门禁：模型配置单测覆盖 image 路由解析；Runtime 仅对带图片的用户消息选择 image，普通消息和无有效 image 路由均保持 primary 回退。

- UI E2E 设置契约：正式模型页断言 Playground 回流后的「连接与模型清单」、用途安排和折叠高级设置，不再依赖已移除的旧 Provider / 单连接表单。
- 设置候选与正式页的卡片、设置行、范围徽标、标题和开关必须来自 `src/components/settings/SettingsFields.tsx`；禁止在 `src/components/playground/SettingsExperienceCandidate.tsx` 重新实现同类视觉控件。正式权限页的折叠交互使用真实 `PermissionRulesEditor`，候选 fixture 不能作为生产行为证据。
