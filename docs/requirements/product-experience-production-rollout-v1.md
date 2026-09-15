# 全产品体验正式回流 v1 施工合同

> 状态：进行中
> 生命周期：进行中；全产品 P1 回流，未完成，不以工作区子项完成代替总体验验收。
> 建立日期：2026-09-14
> 用户授权：重新启动目标模式，把 Playground 所有产品体验相关内容回流；缺后端就补后端，补文档，做好管理和测试。
> 最新范围纠正（2026-09-15）：用户明确旧设置能力可以不要，正式设置统一采用当前 Playground demo 的样式与交互。不得以保留旧能力为由增加 demo 中没有的旧页面、表单或次级入口；真实后端、用户数据和安全边界继续保留，只删除旧 UI 壳、重复入口和已被 demo 取代的展示能力。
> 上位设计：[产品体验总图](./product-experience-map-v1.md)。本合同管理正式回流；既有 P0 合同保留候选设计依据，冻结快照不改写为生产完成证明。

## 1. 背景与目标（Why / What）

上一轮把正式右坞五工具的完成误判为全产品回流完成。实际正式 Settings 仍采用旧分组，WorldHub 仍为朋友圈 / 物什 / 名册 / 角色架，MemoryPanel 的紧凑卡片仍由 preview 条件控制。Vite 地址可访问、Playground 截图或右坞测试通过，都不能证明正式产品已采用全部候选。

目标是把用户已验收的产品体验进入正式 App 调用链，并补齐真实数据能力。范围包括 Chat 与导航、人物世界、设置与人物设置、记忆、主题与基础组件、工作区和跨页面状态。不得仅更新导航标签、复制候选页面或接入假数据后宣称回流。

授权覆盖已确认体验的实现与必要后端补齐；不自动扩大为云同步、操作系统控制、完整 PTY、浏览器脚本 / 登录、地图产品或新的生活内容设定。若必须改候选设计、涉及新的外部费用 / 授权或破坏性迁移，记录具体边界再请用户确认，不静默取消原目标。

## 2. 回流映射与验收单位

下表是施工范围，不是已落地能力目录。所有行初始结论为**待正式验收**；部分已有真实实现需保留。每行施工前继续细化到具体控件、动作与数据字段，记录生产调用点和测试文件后才能推进状态。

| 编号 / 候选来源 | 正式落点 | 数据路径与已知差异 | 迁移分类 / 必须验收 |
|---|---|---|---|
| R01 Chat / `product-experience-journeys-v1.md` | `src/App.tsx`、`src/components/shell/PrimarySidebar.tsx` | 既有会话与 chat IPC；逐态对照欢迎、会话、处理、失败、导航及右坞分隔 | 直接回流已有流程，缺失行为先改造；离开 / 返回不丢会话、草稿或任务 |
| R02 设置骨架 / `SettingsExperienceCandidate.tsx` | `src/components/SettingsPanel.tsx` | 既有 `settings:get/set` 自动保存；正式仍为旧 IA | 生产改造后回流；日常 / 高级分组、九个内容入口、嵌入记忆 / Skills / 角色架、窄宽及返回 |
| R03 外观 / `foundation-design-language-v2.md` | 设置外观、`src/index.css`、共享设计资产 | 候选四主题与全局主题、持久化旧主题尚需映射；不得丢用户设置 | 生产改造后回流；瓷青 / 曜石 / 松烟 / 绛紫同源，重启恢复、旧值兼容、Markdown / Diff 各入口 |
| R04 伙伴与相处 / 设置候选 | 正式伙伴设置、`CharacterShelfPanel` | 既有角色切换、提醒、反思与 settings；候选补充说明写入链路待核实 | 生产改造后回流；设置内角色架、真实偏好保存与生效、流中禁换角、跨页同一主角 |
| R05 记忆 / `SurfaceBaselinePanel.tsx` 的 MemorySurface | `MemoryPanel`、正式设置记忆页 | `memory:*`、memory-store / vector-store；正式卡片已共用紧凑布局；页面仍按存储类别筛选，无候选同行搜索和底部新增行 | 生产改造后回流；四类稳定归属、搜索、真实 CRUD、长文、敏感提示、固定日期操作槽、失败不丢稿 |
| R06 模型 / `playground-model-and-workspace-v2.md` | 正式模型设置、LLM 配置工厂 | 已有 settings 与连接测试；候选多连接 / 用途路由 / 模型获取含 fixture | 生产改造后回流；连接 CRUD、发现与手动模型、用途路由、凭据安全存储、旧配置迁移、真实调用与失败恢复 |
| R07 数据与隐私 / 设置候选 | 正式设置数据页及导入导出服务 | 复核实际导入 / 导出 / 备份字段与隐私边界；不按候选文案假定已包含所有数据 | 直接回流已有流程，缺失能力改造；取消、无效备份、失败提示、实际恢复一致性 |
| R08 权限与自动化 / 设置候选 | 正式权限设置、`PermissionRulesEditor` | 既有 executionMode / permissionRules 与执行侧规则引擎 | 直接回流既有规则能力；默认收起、独立规则卡、列表后添加、原位取消、保存及执行侧生效；硬边界优先 |
| R09 Skills / `playground-skills-detail-v1.md` | 正式设置 Skills 与既有组件 | 既有 Skill 加载 / 校验 / 管理路径；逐个核实候选按钮 | 生产改造后回流；列表、启停、文件树、受限高度正文、真实错误；试跑遵循既有隔离与费用边界 |
| R10 MCP / `playground-mcp-scenarios-v1.md` | 正式 MCP 设置、MCP 服务及 IPC | WISH-040 记录协议 / OAuth / 逐工具启停缺口；不能以保存配置当连接成功 | 生产改造后回流；连接 / 断开 / 重试 / 删除、认证取消、工具开关持久化与执行侧校验；需细化安全契约 |
| R11 关于与开发模式 / 设置候选 | 正式关于页、开发入口、App 导航 | 核实 developer mode 配置、重启与入口门控，不仅隐藏单个按钮 | 生产改造后回流；普通模式隐藏 Debug / Playground 入口；「关于 My Agent」中的开发者模式真实持久化控制入口可达，关闭安全返回且不删除数据 |
| R12 人物世界 / `playground-world-living-dimensions-v1.md`、`SurfaceBaselinePanel.tsx` | `WorldHub`、`MomentsPanel`、`AssetsPanel`、`CastPanel`、`WorldDetailsPanel` 及共享 `WorldLivingContent` | 六生活面入口已接通；文化角 / 住所 / 常去地点复用角色隔离的 assets，足迹动态来自 moments；样张仍隔离 | 生产改造后回流；六面逐项完成下表的数据与展示、编辑及换主角隔离，不复制生活样张为生产事实；合并原重复 R06 人物世界行，R06 仅指模型 |
| R13 工作区 / `playground-workspace-five-tools-v1.md` | `ChatRightDock` 及五工具 | 已有真实 project / session / terminal / browser / chat IPC，保留已验证实现 | 对照候选补差，不从头重写；重复图标、滚动、任务上下文、关闭 / 取消 / 失败恢复 |
| R14 Foundation 与业务状态 / `foundation-reuse-enforcement-v1.md` | 共享基础组件及以上消费者 | 部分工作区已有符号复用检查；不能外推为所有体验覆盖 | 同源复用与门禁；加载、空、错误、确认、hover/focus、长文、禁用、深浅宽窄 |

R12 必须拆成六个独立验收面：

| 生活面 | 复用起点 | 必补核验 |
|---|---|---|
| 朋友圈 | MomentsPanel、生活事件 | 真实动态 / 媒体 / 时间地点；候选互动存在时必须核实后端，不挂空操作 |
| 衣柜 | AssetsPanel、wardrobe 资产 / 当前穿着 | 当前与最近穿着来源、切主角隔离、真实编辑及空态 |
| 文化角 | bookshelf 与资产 / 生活事件 | 阅读 / 笔记 / 音乐 / 电影 / 摄影的真实类型与关系；缺 schema / 服务则补齐 |
| 家居 | 世界状态 / Role Pack / 资产 | 当前空间与物件的真实读取和必要持久化；不是设备控制 |
| 通讯录 | roster、CastPanel、召唤会话 | 联系人与关系、最近互动、召唤忙闲门控；不是切主角入口 |
| 足迹 | 地点与生活事件 / 世界状态 | 去过 / 常去 / 想去及地点记忆的归属与持久化；不是地图服务 |

统一留在 Playground：场景 / 宽度 / 主角夹具切换器、源码路径、基础引用说明、比较控件、采用标记、模型与生活假记录、故障注入开关、实验会话。真实数据为空必须显示真实空态；空态不能代替必要后端实现。

## 3. 技术与管理方案（How）

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
- [待确认] 全局快捷键离开设置仍由 App 直接切换视图，未统一进入本批返回按钮的保存成功门控；后续 R01/R02 需复现保存失败时的跨入口草稿行为。当前证据只保证设置内重试与返回按钮，不外推为所有离开路径均已覆盖。

- 主进程独立类型诊断复核：对照上一提交的内存源文件，前后各 72 条；按文件、错误码和主错误信息比较无新增诊断（不比较行号和 import 链条明细）。这是无新增问题证据，不代表 `tsconfig.node.json` 门禁通过；历史问题仍由 WISH-043 管理。

- 伙伴设置已接独立字段、串行增量保存、失败重试固定槽及备份限长校验；证据落在 `prompt-builder`、`prompt-assets`、`settings-security`、`security-boundaries` Unit 与 `chat` / `onboarding` E2E。R04 整体仍待角色架等正式流程统一验收，不将该字段闭环等同全部伙伴设置完成。
- 修正上次误登记的 Foundation 故事：`foundation.settings-layout`、`foundation.setting-card` 没有对应基础 renderer，移除这两条错误故事记录，将实际组件登记为 Experience；组件本身保留，不删除任何已存在基础控件能力。
- 历史定位时正式仍为七个旧主题；2026-09-15 已切为四主题同源及旧值归一化，该旧诊断不再代表当前代码。正式模型、记忆、Skills、MCP 等内容不能因已嵌入九区导航而标为采用完成。

## 当前收口记录（2026-09-15）

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
- R06 已补齐真实连接 CRUD、用途路由、密钥安全存储与主对话消费；正式选择用途时替换旧兼容路由，后续路由保存不会清空已保存密钥。模型发现、认证失败恢复仍未完成。
- R06 之外，R10 MCP 真实连接恢复，以及全产品逐项 adopted 证据仍未完成；R12 家居 / 足迹已接入 `companion_assets` 事实链，但编辑体验与逐项正式验收仍需继续补证，本合同继续保持进行中。

### R05 编辑与异步恢复验收（2026-09-16）

- 范围：`MemoryPanel` 的长文编辑器、增删改请求与读取生命周期、共享固定尺寸图标操作；不改分类存储、IPC、向量召回或敏感检测策略。旧页导航仍待回流，不以本批修复替代整页采用。
- 证据：Unit 串行 150 文件 / 880 项、正式与候选 UI 全量 142 项、Electron 9 项通过（4 项外部模型测试跳过），根 tsc / build 与资产检查通过。新增 Electron 用例通过真实 preload / memory IPC，在独立数据目录完成增改、完整退出重启恢复和删除；不代表备份或向量召回验收。
- 正式 Renderer 回归覆盖四主题、1166 / 600px、长文删短、多行焦点、hover / pending 操作槽几何、失败保留草稿、重复点击、刷新重试与离页迟到响应。截图位于 `var/verification/memory-rollout-ui`。默认并发 Unit 的既有 MCP 30ms 超时保留在 WISH-042，未修改断言掩盖。

## 4. 影响范围与不碰项

允许按编号逐项认领：App、正式产品与 Foundation 组件、共享类型 / 资产注册、对应 Playground 故事、必要的主进程服务 / IPC / preload、测试及对应文档。不授权任意重构；每次动手前仍列精确文件范围。

不改用户临时文件、真实会话和私有数据、未授权人物内容、生产凭据、无关 Runtime 策略与 Prompt。旧设置入口可以依最新授权移除，不必另造兼容入口；仍需记录移除范围和回归，不顺手删除共享后端。依赖变更单独说明，破坏性数据迁移另行确认。

## 5. 测试与完成标准

- 自审先查真实调用点与数据，不只看样张或 sourcePaths 字符串。复用门禁验证实际渲染引用，并有绕过 / 未使用 import 负例。
- Unit 覆盖转换、校验、持久化、失败与取消；Renderer E2E 从正式 App 导航进入各页，不通过 Playground 代替正式入口。
- UI 覆盖四主题、宽窄、长记忆 / 长 Skill / 长代码、独立滚动和溢出；hover / focus / 操作替换比较几何尺寸。
- Electron E2E 用独立数据目录验证真实 IPC、保存后重开、换主角、取消 / 失败恢复与数据归属。Renderer IO 替身和本地协议替身的证明范围单独说明。
- 按项目顺序执行自审、Unit、类型检查、适用 E2E、build、资产和文档门禁。根 tsc 仅覆盖 Renderer；主进程修改须报告检查范围与 WISH-043 的真实诊断。
- 每个编号 adopted 前须有正式调用点、数据链路、可重复测试和文档证据；R12 六面逐一验收。R13 通过不能代替其余编号。
- 所有产品项和必要后端闭环完成，才可结束目标。依赖外部授权的项保持未完成，不能悄悄缩小目标后收口。

## 6. 风险与权衡

最大风险是把文档已落地、fixture 可交互、注册表标记和局部测试混为全产品完成，用逐项正式入口证据约束结论。模型 / MCP / 记忆 / 生活数据的生产契约比视觉迁移更大，保留既有安全及持久化边界，按完整业务单元补齐，不为视觉统一绕过后端。长期上下文恢复从本合同与 Progress 开始，不能只挑最近工作区提交继续。

- 2026-09-14 R12 文化角批次：复用 `companion_assets` 的 `role_id` 隔离链路，新增 `culture` kind 与稳定 starter 资产（读书 / 音乐 / 电影 / 摄影），正式 `WorldDetailsPanel` 通过真实 `companion:get-assets` 读取；未新增第二份文化数据库。家居与足迹仍保留为已有世界状态 / 生活事件的只读派生面，尚未宣称独立后端完成。
