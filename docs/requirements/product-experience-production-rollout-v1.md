# 全产品体验正式回流 v1 施工合同

> 状态：进行中
> 生命周期：进行中；全产品 P1 回流，未完成，不以工作区子项完成代替总体验验收。
> 建立日期：2026-09-14
> 用户授权：重新启动目标模式，把 Playground 所有产品体验相关内容回流；缺后端就补后端，补文档，做好管理和测试。
> 最新范围纠正（2026-09-15）：用户明确旧设置能力可以不要，正式设置统一采用当前 Playground demo 的样式与交互。不得以保留旧能力为由增加 demo 中没有的旧页面、表单或次级入口；真实后端、用户数据和安全边界继续保留，只删除旧 UI 壳、重复入口和已被 demo 取代的展示能力。
> 最新授权（2026-09-16，覆盖上条保留要求）：当前仍在开发阶段，不需要旧界面、旧接口或旧开发数据兼容。回流以已确认 demo 为唯一产品形态；发生结构冲突时可重建相关开发数据，不为保留旧数据增加迁移层。此授权不等于批量清空无关文件、凭据或其他项目，也不取消权限、路径与凭据安全边界。
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
| R03 外观 / `foundation-design-language-v2.md` | 设置外观、`src/index.css`、共享设计资产 | 四主题与全局主题共用资产；旧开发主题值不要求兼容映射 | 生产改造后回流；瓷青 / 曜石 / 松烟 / 绛紫同源，当前设置重启恢复、Markdown / Diff 各入口 |
| R04 伙伴与相处 / 设置候选 | 正式伙伴设置、`CharacterShelfPanel` | 既有角色切换、提醒、反思与 settings；候选补充说明写入链路待核实 | 生产改造后回流；设置内角色架、真实偏好保存与生效、流中禁换角、跨页同一主角 |
| R05 记忆 / `SurfaceBaselinePanel.tsx` 的 MemorySurface | `MemoryPanel`、正式设置记忆页 | `memory:*`、memory-store / vector-store；正式与故事共用四类导航、搜索、紧凑卡片及列表后新增行；六种历史类别按共享映射唯一归属 | 整页已接入；四类真实写入与重启、搜索 / 草稿 / 几何及失败恢复证据见 R05 记录 |
| R06 模型 / `playground-model-and-workspace-v2.md` | 正式模型设置、LLM 配置工厂 | 已有 settings、连接 CRUD、用途路由与 `settings:fetch-models`；Playground 获取仍是隔离 fixture | 生产改造后回流；连接 CRUD、发现与手动模型、用途路由、凭据安全存储、旧配置迁移、真实调用与失败恢复。本批收口主进程发现与认证失败恢复；不把 Playground 夹具当真实请求，也不把全产品标 adopted |
| R07 数据与隐私 / 设置候选 | 正式设置数据页及导入导出服务 | 复核实际导入 / 导出 / 备份字段与隐私边界；不按候选文案假定已包含所有数据 | 直接回流已有流程，缺失能力改造；取消、无效备份、失败提示、实际恢复一致性 |
| R08 权限与自动化 / 设置候选 | 正式权限设置、`PermissionRulesEditor` | 既有 executionMode / permissionRules 与执行侧规则引擎 | 直接回流既有规则能力；默认收起、独立规则卡、列表后添加、原位取消、保存及执行侧生效；硬边界优先 |
| R09 Skills / `playground-skills-detail-v1.md` | 正式设置 Skills、共享 `SkillViews` | 真实 list / get / validate / save / delete / set-enabled；registry 与 SQLite 启停状态 | 列表、独立详情、限高 SKILL.md 全文、真实启停与错误恢复；试跑不回流正式页，证据见 R09 执行记录 |
| R10 MCP / `playground-mcp-scenarios-v1.md` | 正式 MCP 设置、MCP 服务及 IPC | WISH-040 记录协议 / OAuth / 逐工具启停缺口；不能以保存配置当连接成功 | 生产改造后回流；连接 / 断开 / 重试 / 删除、认证取消、工具开关持久化与执行侧校验；需细化安全契约 |
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
| 设置与人物设置 | `user-approved`，正在回流 | Playground 候选、正式 `SettingsPanel`、共享导航 / 卡片基础层；R11 关于页开发者模式已有正式入口与 Electron 持久化证据；R06 正式模型发现走主进程 `/v1/models`；R10 异常断开 UI 已接入设置页 | MCP OAuth 登录生命周期；编程套餐真实调用仍见 WISH-027；不把 Playground 夹具当真实发现 |
| 记忆 | 整页已回流 | 共享四类 / 搜索 / 新增行；正式长文、固定槽、四主题宽窄、失败恢复及真实四类重启 CRUD | 本项不替代其他设置或备份 / 向量召回的验收 |
| 主题与基础组件 | `production-ready` | Foundation 主题资产、共享设置卡片 / 行组件、基础复用门禁、共享 Prism 主题清洗 | 全产品 Markdown / Diff 仍未标 adopted；MCP OAuth 与工作区跨页状态仍待收口 |
| 工作区工具 | `production-ready`，部分 `adopted` | 正式 Right Dock 五工具、共享面板布局与 Electron 回归 | 浏览器 / 文件 / 审阅 / 终端跨页状态和完整错误路径 |
| MCP / 模型等后端 | `in-progress` | MCP 测试连接生命周期、资源 / elicitation 接管、配置锁专项 Unit、异常断开 in-place 重连与设置页订阅 | 独立 Electron 数据目录的 OAuth / 第三方认证；不得把异常断开证据写成整项 R10 adopted |

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

共享连接表单实施范围：从已确认候选抽取 `ModelConnectionForm`，新增 / 编辑复用同一 Foundation 字段与操作控件；来源分类、预设默认值与协议映射放共享纯函数。ModelConnectionProfile 增加可选 source / presetId，原 JSON 存储承载字段，不做旧数据迁移；LLMConnectionTestInput 补 provider 并同步 preload、Renderer 类型及主进程验证。更换端点 / 协议时不继承旧密钥，保存与读取已存 Key 都核对连接身份。候选只持有内存草稿，不触发 IPC。

允许修改共享类型 / 表单纯函数、共享业务表单、正式 ModelRoutingSettings / SettingsPanel、候选 ModelPage、settings IPC / preload / Renderer 声明、组件注册表、对应 Unit / UI / Electron 及文档。删除两套正式简化表单和候选重复字段，正式新增改为候选的独立卡片；测试 / 获取模型保留在已保存连接卡片，不再留旧新增表单内的重复入口。验证来源切换清空临时 Key、自定义协议、保存失败保留、原位编辑保留模型 / 用途、正式重开与协议请求。原子保存、备用路由、生图、本地无 Key 请求及其余卡片结构仍按上表继续，不以本表单完成关闭 R06。

整页回流核对表（逐项保留完成证据与剩余缺口，不是新的排除项）：

| 候选动作 / 内容 | 当前正式差异 | 必须接通的事实源 / 证据 |
|---|---|---|
| 五类来源、服务商预设与自定义协议 | 已共用来源纯函数与 ModelConnectionForm，source / presetId 随连接保存 | shared 注册表为唯一预设源；正式 UI 四主题宽窄与 Electron 保存 / 重载，不复制 fixture |
| 新增独立卡片、原位编辑同一表单 | 已删除两套正式简化字段和候选重复 JSX，正式 / 候选同时渲染共享表单 | Foundation 字段与共享表单真实符号门禁；编辑保留模型和用途，失败保留草稿 |
| 自定义 Anthropic / Gemini / OpenAI Compatible | provider 已经过共享校验 / preload / handler 到配置工厂 | Unit 三协议校验与主进程透传；Electron 本地 Anthropic 请求验证，真实厂商及其余协议组合仍按全链验收 |
| 本地模型 | 共享测试 / 发现校验、主进程二次校验、发现服务及主对话 Runtime 均拒绝空 Key；App 首启也会误导回设置 | 本地端点认证策略必须贯穿配置可用性、首次启动、发现、测试和真实流式对话；真实本地服务请求与失败测试，不伪造 Key 绕过 |
| 用途优先级 | 工厂仅 find 第一有效路由，尚未将后续项映射 fallbackModels | 接入已有 failover 执行链；每个备用连接独立凭据 / 协议，实际失败转移顺序验收 |
| 保存 / 离页 / 发现迟到 | 整组保存失败恢复、请求结果归属隔离及应用内草稿离页保护已接通；关窗 / 崩溃与多窗口冲突未覆盖 | SQLite 故障 / 重开与正式入口 Electron；受控请求逆序、换 Key、取消 / 保存失败及离页结果隔离 UI；宽窄导航拦截与 Electron 草稿未写入检查 |

多连接表单回流前，先保证 `aux-config.ts` 的主 / 辅助 / 图片理解用途都将端点、密钥、协议、模型作为同一连接的配置传递。合成配置红测已确认：目标连接缺密钥时会借用全局 / 主连接密钥，显式 provider 也会丢失。移除这种字段级凭据回退；有路由时保留目标连接的空密钥与显式协议，无协议则按目标端点自动检测，没有有效用途路由时才整体回退主模型。一次性测试更换端点也不得继承主连接密钥和协议。

允许修改配置工厂及 `model-routing` 单测，不新增 IPC、存储字段、依赖或外部请求。必测主 / 辅助 / 图片三个用途的空密钥隔离、显式协议、无协议与整体回退，以及一次性配置覆盖。此为 R06 真实调用链必要修复，不等于五类连接表单、协议选择 IPC、生图能力或整页回流完成。

### R06 本地连接全链验收边界

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

### R10 OAuth 补齐方案（待用户确认）

现状依据：共享表单只接受 none / bearer，运行状态没有 auth；候选服务卡已有待登录展示但没有真实登录动作。Bearer 完整重启证据不覆盖 OAuth。参考本地 CC `services/mcp/auth.ts`、`services/oauth/auth-code-listener.ts` 与已安装 MCP SDK 的 `OAuthClientProvider`；Alice 的 MCP 章节不能证明其登录生命周期。本轮外部规范页面未返回可用内容，不据此宣称已完成最新规范复核。

目标是把登录、取消、保存、重新登录和重启恢复作为一个完整业务单元实现，不先交付孤立登录按钮。拟复用 SDK 的发现、PKCE、授权码交换和刷新，不自行编写 OAuth 协议。新授权边界需用户确认后才能实施；它仍属于 R10 未完成范围，不移出全产品目标。

- 交互：远程连接支持浏览器登录；明确点击才打开系统浏览器，展示服务及授权站点。应用启动、后台重连和工具执行不得自行弹浏览器。待登录、登录中、取消、拒绝、超时和失效后重新登录共用正式与候选服务卡，新增状态先在 Playground 验收。
- 回调：主进程短期回环监听，绑定窗口、服务、端点和请求；随机 state 与 PKCE verifier 只归属当前尝试。严格校验路径、方法、state、单次 code 和请求大小；拒绝重复参数及跨请求回调。取消、超时、导航、窗口销毁、删除服务均撤销归属并关闭监听，迟到回调不能写盘或注册工具。
- 网络：认证发现、授权 URL、注册与 token 端点单独校验；只允许安全协议，禁止服务提供的元数据绕过私网及重定向保护。明确授权的本机服务可使用回环 HTTP，不因此放宽远程服务指向本机的发现地址。响应大小与总耗时有界，日志不记录 code、token 或 verifier。
- 凭据：client 信息、access / refresh token 在主进程按服务和端点隔离并加密存储；Renderer 与备份不获得原值。未保存连接的凭据仅属于测试会话；保存成功后才接管，写盘失败保留可重试状态。端点变化不复用旧授权；刷新串行并校验连接代次，删除或取消后的旧刷新不得重建凭据。重启只静默使用有效凭据，失效转待登录。
- 修改范围：MCP transport / client / connection-tests / config-security、专用授权及凭据模块、共享类型、MCP IPC、preload、Renderer 声明、共享表单与服务卡、设置适配器、隔离候选及测试。IPC 四处同步；不改权限引擎、LLM 配置工厂或受限工作区浏览器，不新增云端中转，不要求用户提供第三方密钥才能完成本地协议测试。
- 验收：真实本地授权服务器验证 PKCE、state 错误、拒绝、取消、重放、超时、恶意发现、刷新失败和并发删除；真实 Electron 验证加密与脱敏、完整重启恢复和正式入口操作。真实第三方授权需另获账户许可，不能用本地测试宣称全部供应商互操作；未注册客户端且不支持自动注册的服务必须明确失败，不能伪造已登录。

实施依赖：先确定注册方式及网络安全契约，再完成主进程授权与凭据生命周期，随后接共享 UI 和正式入口，最后运行完整门禁。各层过程态可以存在，但整条登录旅程通过之前不得宣布 R10 adopted。

最大风险是把文档已落地、fixture 可交互、注册表标记和局部测试混为全产品完成，用逐项正式入口证据约束结论。模型 / MCP / 记忆 / 生活数据的生产契约比视觉迁移更大，保留既有安全及持久化边界，按完整业务单元补齐，不为视觉统一绕过后端。长期上下文恢复从本合同与 Progress 开始，不能只挑最近工作区提交继续。

- 2026-09-14 R12 文化角批次：复用 `companion_assets` 的 `role_id` 隔离链路，新增 `culture` kind 与稳定 starter 资产（读书 / 音乐 / 电影 / 摄影），正式 `WorldDetailsPanel` 通过真实 `companion:get-assets` 读取；未新增第二份文化数据库。家居与足迹仍保留为已有世界状态 / 生活事件的只读派生面，尚未宣称独立后端完成。
