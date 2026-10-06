# 伙伴世界（Companion）

人物世界身份区由 WorldProfileHeader 共享呈现；正式 App 传入当前角色名称 / 简介，Playground 传入隔离 persona。姓名首字仅作头像占位，空简介不填编造人设；返回沿用 Foundation IconButton。不新增头像上传或角色存储。

## 一句话

同宇宙多主角架构下，**唯一活跃主角**接管聊天、生活世界、朋友圈与衣柜；文案资产化，组装器只拼装。

## 边界

**做**：Role Pack / 单活跃门控 / MUTABLE 版本与自动反思 / LifeEngine（暂停·剧本·tick）/ Catch-up≤7×24h / Moments·Assets 截面 / 名册浅注入 / 冷启动在场 / 召唤子会话与忙闲婉拒。  
**不做**：会话中途换角；非活跃后台养成；多宇宙并行；自动生成朋友圈内容（视觉资产生图已接入，但不自动替动态生成内容）。

## 短 Why

只有 Prompt 换皮是工具；有暂停的生活世界与派生截面，才是「同一个人」的伙伴感。

## 主入口

| 类型 | 位置 |
|------|------|
| UI · 生活面 | 侧栏「人物世界」（`WorldHub`：朋友圈 / 衣柜 / 文化角 / 家居 / 通讯录 / 足迹）；角色架归设置 |
| UI · 工具面 | 设置「伙伴与相处」：回答方式、相处补充说明、生活提醒、主动问候、角色架；旧 MUTABLE / 反思表单不再保留为设置入口，后端服务仍保留 |
| IPC | `companion:*`（list / switch / moments / toggle-moment-like / add-moment-comment / assets / roster / catchup-status(+presence) / start-summon / reflection…） |
| Prompt | `prompt-builder` + `orchestrator.loadRoleAssembleInput`（管线见下方「Prompt 组装」） |
| 资产 | `electron/main/companion/universes/default/` |
| 契约 | `docs/requirements/companion-*.md`；前端方案 [frontend-companion-surfaces.md](../requirements/frontend-companion-surfaces.md) |

### 前端 View 映射

| View | 组件 | 说明 |
|------|------|------|
| `chat` | App + CompanionSceneBackdrop | 对话；弱场景随地点 |
| `world` | WorldHub | 人物世界口袋（内页 tab） |
| `moments` | MomentsPanel（经 WorldHub） | 朋友圈卡片时间线 |
| `assets` | AssetsPanel | 衣柜（P1 加厚主视觉） |
| `cast` | CastPanel | 通讯录 / 召唤（≠换活跃） |
| `settings` | SettingsPanel + CompanionSettingsContent | 相处偏好 / 提醒 / 角色架；与 Playground 共用业务组合，数据隔离 |

## 依赖

- **依赖**：settings-store、SQLite、streaming-gate、LLM（反思 / 日后剧本生成）、task-queue  
- **被依赖**：runtime 聊天组装、Eval C01 / B01–B07、设置页、CastPanel

## 不变量

- 同时仅一个 `activeRoleId`  
- 流式进行中 `requestSwitch` → `SESSION_ACTIVE`  
- 非活跃不 tick、不生成剧本/事件  
- 名册只注入 summary/关系短句，不注入他人全文 protected  
- 召唤不改 active、不推进对方生活世界  
- 朋友圈/衣柜为事件与资产的派生截面，非第二真相库  

## 必读文件

- `electron/main/companion/orchestrator.ts`
- `electron/main/companion/life/engine.ts`
- `electron/main/companion/cast/roster.ts`
- `electron/main/companion/growth/reflection-service.ts`
- `electron/main/agent/prompt-builder.ts`
- `electron/main/agent/runtime.ts`（组装 + 召回 + 反思调度）
- `docs/requirements/companion-tech-spec.md`

## 必测点

- 换角门控、Catch-up 7 日边界、名册无他人 protected、资产按 role 隔离  
- 住所 / 常去地点初始化并发幂等、事务失败回滚、已有资产优先、删空后重载不复活；正式列表刷新失败保留旧内容，跨主角响应不混合
- 召唤不改 active；反思门闸 / 召唤跳过  
- Eval：`evals/scenarios/c01-companion.ts`；语气基线 `b01-persona-tone.ts`；主角行为 `b02-protagonist-behavior.ts`（真实模型判断需 key）

## 已落地能力

- Playground 影视观后感与音乐听感在列表和详情共用正文：列表两行截显 `detail`，详情展示完整同一内容；只有摘要时两处共同使用 `summary`，没有感受时隐藏。书籍、摄影与正式默认分支未改。

- 衣柜 Playground 候选取消添加、编辑与删除入口，保留分类、预览和换上；单行“正在穿着 | 全部 / 套装 / 上装 / 下装 / 外套 / 鞋履”复用 Foundation 标签，默认当前穿搭与库存分类互斥展示，换上成功返回当前穿搭、失败留在库存。套装独立引用三套组合，不计入 9 件单件库存，换上一次替换所有槽位，未指定外套清除旧外套，失败不发布部分穿搭。当前穿着采用居中全身图、下方衣物信息，无重复标题或右侧“当前这一套”，主图上限 240 × 320px。小林日常、通勤、运动三套隔离初始组合与 9 件库存均有真实生成样张；其他角色不复用小林全身图。换装后旧图退出展示，恢复已知组合可复用；保留无图、生成中 / 失败状态。正式衣柜维护入口、Role Pack 播种、Agent 资产动作和真实穿搭生图尚未按新合同实施。
- 文化角影视 / 音乐 / 摄影候选完成分类特有信息层级：影视和音乐详情为小海报 / 方封面与资料并排，状态用共享徽标，感受区与资料分开，无摘要时隐藏；剧集进度只展示已有数据，无播放控件。摄影以作品图为主，保留横竖比例，详情图片高度上限 320px，地点 / 描绘日期弱化，创作说明内部滚动，不重复显示“作品”徽标。精简信息与长文样张只用于 Playground，不改变正式文化页或数据存储。

- 衣柜与记忆的 Playground 状态样张共用 `PlaygroundStateSwitcher`，基础故事筛选同样复用该入口；选中呈现只来自 `state-switchers.css`，不使用业务 `ActionButton` 内联颜色或设置选项样式覆盖。正式衣柜和记忆业务操作不受影响。

- 人物世界 Playground 六面导航与 Foundation 标签样张统一使用 `TabStrip` 的 surface 呈现，选中靠底色而非下划线；hover 不改几何、键盘焦点和方向键行为保留。正式导航仍保持既有呈现，候选通过显式 preview 配置隔离。

- 衣柜新增 Playground-only 图片优先候选：当前穿搭按上装 / 下装 / 外套 / 鞋履展示，库存按分类筛选，卡片只展示图片、名称及固定尺寸换上操作；局部换装保留其他槽位，失败保留原穿搭。完整 / 部分 / 空衣柜 / 换上失败使用隔离夹具，服饰图采用真实生成样张；包、相机、雨伞归入家居样张。字段、枚举、默认值和写入责任见 `wardrobe-clothing-system-v1.md` 施工合同；正式换装及数据库链路尚未回流，不视为已落地生产能力。

- 角色架正式与候选共用 CharacterShelfContent，两列角色卡 / 窄屏单列、当前主角固定标记和 Foundation 按钮统一；正式 CharacterShelfPanel 提供真实角色列表与 requestSwitch，流式拒绝仍来自主进程。读取失败可刷新，切换失败保留当前角色，在途禁止重复切角，离页后不显示迟到结果。候选仅更新共享 persona，不读写生产 IPC。正式点击切角、侧栏身份和重载保留已有独立 Electron 证据。

- 角色架入口由 App 统一管理：侧栏头像和通讯录快捷操作进入 SettingsPanel 的伙伴与相处页，不再通过人物世界隐藏 shelf 分区渲染；快捷入口记录来源视图，关闭设置后返回原聊天或通讯录，切角仍由 CharacterShelfPanel 和主进程门控负责。

- ChatMessageFrame 共享正式与候选的用户 / 助手排列、头像、身份行和气泡；正文、工具及操作由原业务注入。正式按会话 roleId 映射主角 / 召唤伙伴名称，未知角色显示「伙伴」，合法时间来自消息记录，未知时间省略。候选固定时间只经显式 previewTimeLabel 注入；hover 不改变消息尺寸，长名称和正文可换行。


- Chat 输入卡片由 ChatComposer 共享，内部使用 Foundation TextField / IconButton；正式 App 保留附件读取、图片粘贴、文件引用、中文输入法、发送和停止回调。输入高度 64–120px、长模型名截断、发送与停止共用 28px 操作槽；候选只保留选中文件名和内存消息，不调用生产 API。审批呈现由 ChatApprovalControl 共享，写入回调仍由 App 持有；消息外框已共享，整项 Chat 仍待组合验收。

- Chat 欢迎区由 ChatWelcome 共享呈现，正式 App 使用 buildColdStartCopy 的当前角色文案及原有 sendMessage / 人物世界导航，候选仅传 persona 与内存场景回调。三个动作复用 Foundation ActionButton，长名称 / 简介换行，hover 不改尺寸；不将输入区、消息流或整项 Chat 体验一并宣称完成。

- 通讯录产品体验样张复用正式 CastPanel，不再维护独立姓名行；previewData 显式提供隔离名册与忙闲，摘要在内存查看、刷新恢复样张，开聊禁用且处理器二次阻断。预览不读取名册、不订阅真实切角、不创建会话；正式 roster / availability / summon 链路保留。共享呈现不等于通讯录最终视觉验收完成。

- 正式与 Playground 共用的动态、近期穿着空态和书架说明只展示用户状态，不显示 tick / Catch-up、引用或派生等内部实现术语；未生成动态不承诺具体出现时间。

- 人物世界六面导航与身份头部由 WorldHub / WorldProfileHeader 统一复用 Foundation TabStrip / IconButton，正式与 Playground 使用同一份标签定义（含足迹 MapPin）和同一身份呈现。正式传入当前角色真实名称 / 简介，候选传入隔离 persona；支持方向键、Home / End、单一 Tab 焦点、窄屏标签内滚动，返回按钮固定 28px。六面数据和入口已完成正式采用验收；候选仍只使用隔离 persona 和 fixture。

- 伙伴相处说明等普通设置沿用串行自动保存；有待保存内容时重载和退出会留页提示，失败仍保留修改并可重试。同字段保存中继续编辑不会被旧请求清掉，新值落盘后才允许离开。

- 新增生活资产必须提交页面已展示角色的 roleId；companion:create-asset 在主进程校验与当前活跃角色一致，缺失 / 无效 / 过期角色拒绝，不自动改写归属。受理后以固定 roleId 写入，编辑 / 删除继续核对既有资产归属。真实 Electron 延迟切角广播覆盖四页过期表单拒绝、当前角色成功新增与重载、跨角色编辑删除拒绝；不依赖 Renderer 自觉清草稿保护数据库。

- 衣柜、文化角、家居和足迹的新增 / 编辑 / 删除按写入代次隔离：角色变化后释放旧界面锁，旧响应不能清新草稿、显示旧错误或解开新写入的锁。已发出的后端操作不因此取消；此处隔离 Renderer 回调，不改变资产归属和数据库提交契约。

- 文化角、家居、足迹共用的 WorldDetailsPanel 订阅正式角色变化，立即清除旧主角的展示与未提交草稿，再读取新角色；旧请求不覆盖新内容，预览不订阅生产事件。真实 Electron 从四个资产页面（含衣柜）验收 requestSwitch / 广播 / 当前角色存储链，切换来回与重载后各角色资产保持隔离；此证据不代替跨角色在途写入竞争验证。

- 衣柜读取按请求序号发布最新结果，并校验 active、assets、moments 的角色身份；切角立即清除旧列表、穿着和草稿，迟到响应不能覆盖新主角。普通刷新失败保留已加载内容并提示重试；角色不一致清空混合结果。重试复用原刷新按钮尺寸，深浅宽窄与受控迟到响应回归已覆盖；不改变资产写入和存储契约。

- 生产初始化不再生成服务内置的衣物、书籍、歌单、电影与摄影记录；当前角色未定义这些初始资产时展示真实空态。Role Pack 世界默认、用户创建和已发布事件资产不受影响；Playground 样张仍隔离。此次不批量删除旧数据库中的历史记录，不把已有记录当成角色设定已确认的证据。

- 伙伴设置的回答方式、相处补充说明和提醒数字输入均组合 Foundation ActionButton / TextField；正式与 Playground 使用同一 CompanionSettingsContent，不再在业务组合中复制原生按钮 / 数字输入。候选的勿扰时段、次数及补充说明可在隔离内存中编辑，不再使用空回调；正式保存链路不变。绑定门禁检查真实 JSX 符号而非 import 声明，正式入口覆盖四主题宽窄、键盘选中、hover 尺寸与保存失败恢复。

- 生活剧本、朋友圈润色、Catch-up 摘要与显式反思入口用共享连接认证判断，允许已配置的本机兼容无 Key 辅助模型；仍保留原有 preferLlm、数据校验和失败回退，不更改主动调用时机、反思门闸或角色隔离。协议可连接不代表任意本地型号能正确生成结构化生活内容。

- 朋友圈正式页与 Playground 共用卡片样式，hover 只改变颜色，不再通过 translateY 移动整张卡片；评论槽在展开前后保持相同尺寸与位置。衣柜删除失败保留确认、原条目与重试入口，测试按真实无障碍按钮名称及脱敏错误提示验收。
- 正式人物世界的朋友圈、衣柜、文化角、家居和足迹图片统一复用 Foundation `ImageViewer`；衣柜真实 `payload.image` 通过 `companion.readAssetImage` 读取，生活面图片保留原有重试 / 定位链路，Playground 静态样张不进入生产。Chat 附件、生图结果、Markdown 图片和工作区图片也复用同一预览器，预览层使用 Portal、Esc / 背景关闭、缩放拖动与固定尺寸工具栏。
- 人物世界正式入口提供六个生活面：朋友圈、衣柜、文化角、家居、通讯录、足迹。朋友圈、衣柜和通讯录读取现有 companion IPC；正式通讯录列表会先读取既有 `check-cast-availability` 展示方便 / 忙碌，开聊仍走 `startSummon` 二次判定。文化角、家居和足迹复用按主角隔离的 `companion_assets`，其中家居与常去地点仅在 Role Pack 提供真实 `world.default` 时幂等播种；小林当前没有该资产，正式家居 / 常去保持空态。没有 `world.default.json` 时，运行态 `world_json`、Catch-up 和 Prompt 切片的居所 / 当前位置回退为「未设定」，不再写入城西小公寓、日常住处或家。生活动态地点作为足迹的近期补充，不把 Playground fixture 当作生产数据源。衣柜、书架和文化角不再从服务硬编码默认值生成作品、穿着或阅读经历；无 Role Pack 定义时为空。
- 家居与足迹的正式页、Playground 使用同一 `WorldLivingContent` 纯展示组件；家居保留住所结构和生活物件，足迹分开常去、显式想去记录与实际动态，不用资产初始化时间伪造访问日期，同地点不同动态保留各自正文和日期。正式刷新失败保留内容并可重试，响应主角不一致则清空并提示重试。
- 新住所 / 地点的初始化标记与资产在同一 SQLite 事务内写入 `companion_asset_seeds`；仅真实 Role Pack 提供默认数据时初始化，不覆盖已有记录，删除后重载不补种。文化角 / 衣柜 / 书架沿用既有初始化语义，不外推该删除保证。
- 文化角通过 `WorldCultureContent` 同源展示四类文化卡片、书架阅读内容和关联读书笔记；`detail` 与 `note` 同时存在时均保留，重名作品按资产 ID 区分，未知类型保留为文化记录，空数据不生成作品。正式页沿既有资产 IPC 读取，并通过 `companion:create-asset` 与既有 update / delete 编辑衣柜、文化、家居物件和足迹地点；Playground 只传隔离 props 并改内存预览。
- 文化角新增显式 `culture-gallery` Playground 候选：书籍 / 影视 / 音乐 / 摄影四分类，无“全部”或维护表单；封面竖图、音乐方图、摄影按比例预留空间。标题进入页内只读详情，完整感受和笔记有高度上限与内部滚动，返回恢复列表焦点与位置，图片继续使用 Foundation 预览。四张新配图是明确的示意 / 虚构作品夹具，不进入生产；无图 / 生成中 / 失败 / 空 / 读取失败 / 长文故事均隔离。正式混排与 CRUD、数据库和 Agent 动作仍未按新文化角合同调整。
- 书籍 Playground 候选进一步区分作者文字、Foundation 阅读状态徽标与最新笔记摘录；详情改为小封面 / 书目信息并排，下方整体感受与多条独立笔记，时间、页码与章节仅由夹具明确提供，无笔记有独立空态。Badge 与基础故事共享实现但保持 Playground 生命周期，体验注册表用 `playgroundUsesFoundation` 区分候选依赖，不提升正式采用状态；多笔记服务和数据库仍待合同真实数据阶段。
- 文化 / 书架资产更新中的 `note`、`detail`、`description` 支持最多 4000 UTF-16 代码单元，保留换行，超限或错误类型在写入前拒绝整次修改，不再按衣柜标签截为 24 字。书架进入 Prompt 仍只取 24 字笔记摘要；其余资产短标签规则不变，历史已截断正文无法自动恢复。
- 正式设置「数据与隐私」的导出 / 导入覆盖 `companion_assets` 与 `companion_asset_seeds`；资产 `payload.image` 与会话生成图片共用 PNG 媒体校验、摘要和受控恢复目录，导入新增资产时会回填新路径。按稳定 id / 播种键合并，不覆盖现有记录。会话与生活资产同一事务，失败整笔回滚。旧备份缺这两项仍可导入。记忆继续走 `memoryStore.addMemory`。不导出朋友圈互动、MCP、权限、API Key 和本机项目路径。

- 生活切片链路已接通第一版：`companion:get-life-slice` 以 `companion_events` 为事实源，按 `role_id` 返回对应 Moment、`source_event_id` 资产和 `companion_event_links`；跨角色事件返回空，不允许 Renderer 自行跨表拼接。正式朋友圈已可进入局部滚动详情并返回，结构化关联以用户态中文线索呈现；事件关联随朋友圈历史备份恢复，导入失败会与事件 / Moment 一起回滚。

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 用户入口 | 落点 |
|------|------|----------|------|
| 用户相处补充说明 | 已落地 | 设置 → 伙伴与相处 | 独立 `companionResponseNote`，默认空、最多 4000 UTF-16 代码单元；仅保存实际修改，失败保留草稿并提供固定操作槽重试。作为 L3 偏好用于下一轮主对话 / 召唤，workspace 排除；不迁移或覆盖旧 `systemPrompt`，不改变角色身份和工具权限。备份白名单包含该字段，导入前同样限长 |
| 生活资产与朋友圈备份往返 | 已落地 | 设置 → 数据与隐私 | `data:export` / `data:import` 覆盖生活资产、播种标记、已发布事件、动态快照及用户赞评；按稳定身份合并，同一事务失败回滚。旧备份缺字段仍可导入。不包含未来事件、日剧本、当前世界态、MCP、权限、凭据和项目路径；恢复历史不重放奖励 |
| Universe + Role Pack（三槽：lin / zhou / xia） | 已落地 | 角色架 / 设置 | `universes/default/` · 文案见 [companion-cast-content](../requirements/companion-cast-content.md) |
| 主角候选结构化档案（Role Profile） | 已落地 | Debug「世界态」/ Prompt L1 | 当前仅小航 `profile.json`；行为边界与五维表达基线已定，人物故事字段待定 |
| 伙伴生产资产目录 | 已落地 | Debug「提示词管理器 → 伙伴世界」 | `companion/asset-registry.ts`；manifest / profile / 默认世界 / 场景 / 衣柜书架 starter 使用稳定 key、版本、指纹、来源和依赖 |
| 生活资产来源边界 | 已落地 | 衣柜 / 文化角 / 家居 / 足迹 | 衣柜、书架、文化默认样张不再播种；住所 / 地点 / 物件沿用真实 world.default，用户 CRUD 与已发布事件授予保留。已有数据库不批量清空 |
| 日剧本 LLM（当日）+ 哈希回退 | 已落地 | （隐式）Life ticker | `resolveDayScript` · aux-config |
| 世界状态薄片（居所/时区/情境/心情/精力/当前位置与活动） | 已落地 | （隐式）Assemble L3 | schema v1 `world_json` · `## World slice`；无 Role Pack 世界默认时 home / currentLocation 为「未设定」 |
| 主角候选默认世界结构 | 已落地 | Debug「世界态」/ 世界初始化 | 当前仅小航 `world.default.json`；城市、住所、地点、物品与作息均待定 |
| 主角候选行为人格验收 | 已落地 | Playground「人格验收」/ `npm run eval:persona` | 七个中性故事格 + B02–B07 DeepSeek `pass^3`；自动门禁已过，人工语气审美待本地验收 |
| 伙伴 Prompt 自有框架文案统一中文 | 已落地 | 人物档案 / 世界 / 关系阶段 / 里程碑 / 召唤任务工动态注入；Role Pack 原文继续作为单一事实源 |
| Catch-up 概况 LLM + 模板回退 | 已落地 | （隐式）换角追赶 | `resolveCatchupSummary` · catchup.ts |
| 聊圈薄一致性（近 Moment 锚点） | 已落地 | （隐式）Assemble L3 | `moment-consistency` · `## Recent moments` |
| Moment LLM 润色（绑 event） | 已落地 | （隐式）tick 发布 | `moment-polish` · 规则回退 |
| 单活跃 + 流式换角门控 | 已落地 | **角色架（主）** / 设置（次） | `orchestrator` · `streaming-gate` · `requestSwitch` |
| 会话绑定 `role_id` | 已落地 | （隐式）Chat 顶栏徽标 | `runtime` · `assertSessionRole` |
| MUTABLE 分桶版本 + 回滚 | 已落地 | 设置 | `mutable-store` · Settings |
| 自动反思写 MUTABLE | 已落地 | 设置「立即/强制反思」 | `reflection-*` · task-queue |
| 成长时钟按 role 分桶（72h） | 已落地 | （隐式）反思门闸 | `companionGrowthStartedAtByRole` |
| feedback 记忆按 role 分桶 | 已落地 | （隐式）反思 / L3 画像 | `memories.role_id` · `listFeedbackForRole` |
| MUTABLE 结构性防退化（G3） | 已落地 | 设置保存 / 自动反思 | `mutable-validate` · setMutable 门闸 |
| 反思吃生活薄信号（G4） | 已落地 | （隐式）自动/手动反思 | `life-signals` · Moments + Catch-up |
| LifeEngine（暂停 · 剧本 · tick） | 已落地 | （隐式）presence / Prompt | `life/engine.ts` |
| Debug 计划 / 发布状态时间线 | 已落地 | Debug「世界态」只读视图 | `debug-world-snapshot` 有界读取 planned / published 事件；不提供生活世界写操作 |
| Catch-up ≤7×24h | 已落地 | 朋友圈暖色条 / Prompt | `life/catchup` · `catchup-status` |
| 此刻 presence | 已落地 | Catch-up / Prompt | `describeCastPresence` · `catchup-status.presence` |
| Moments（朋友圈） | 已落地 | 人物世界 / 欢迎屏 → 朋友圈 | `get-moments` · `toggle-moment-like` · `add-moment-comment` · MomentsPanel · 卡司互动 meta；正式页真实赞 / 评论落独立用户表，不改 moment.text；Playground 可用只读 Moments / Catch-up 样张、可选本地图片内容位且跳过 IPC |
| 正式人物世界朋友圈流默认态 | 已落地 | `WorldHub` 默认 `alice-feed` 并隐藏重复标题；保留真实动态、时间 / 地点、真实赞评和近期窗口说明 |
| Assets（物什） | 已落地 | 人物世界衣柜 / 文化角 / 家居 / 足迹 | wardrobe/bookshelf/culture/home/footprint/furniture · `get/create/update/delete-asset` · AssetsPanel / WorldDetailsPanel / WorldAssetEditor |
| 名册浅注入 | 已落地 | （Prompt） | `cast/roster` |
| CastPanel（通讯录 / 召唤） | 已落地 | 人物世界 → 通讯录 | CastPanel · `start-summon` · 场景 prompt |
| 召唤子会话 | 已落地 | 通讯录「开聊」 | 不改 active / 不 tick；可 delegate（任务工） |
| 召唤忙闲婉拒 + force | 已落地 | 通讯录列表预检 / 开聊前 | `check-cast-availability` · CastPanel 卡片展示 |
| 衣柜删除与强制开聊确认恢复 | 已落地 | 人物世界衣柜 / 通讯录 | 复用 `ConfirmPanel`；删除物什或强制召唤在成功前不关闭确认，失败可重试，处理中禁止取消和重复提交 |
| 冷启动在场文案 | 已落地 | Chat 空态欢迎屏 | `companion-presence.ts` |
| 角色架 UI | 已落地 | 设置「角色架」 | CharacterShelfPanel · `shelf` |
| 物什主视觉（衣柜穿着中 + 书架分栏） | 已落地 | 人物世界 / 欢迎屏 → 物什 | AssetsPanel · Moment.assetId/outfit |
| 名册关系卡 + 最近召唤互动 | 已落地 | 人物世界 → 通讯录 | CastPanel · sessions(summon) |
| 场景弱背景（Chat 氛围） | 已落地 | Chat 消息区底层 | `CompanionSceneBackdrop` · `companion-scene.ts` |
| 前端视觉语言（token / 设置 IA / Chat 气质） | 已落地 | 主题·设置·侧栏身份·空态 | `frontend-visual-language` Phase1–3 |
| Alice 壳 Phase A（大气侧栏） | 已落地 | Primary/底栏宫格只保留人物世界与设置；记忆与 Skills 从 Settings 进入 | `PrimarySidebar` · `frontend-alice-shell` |
| Chat 侧栏会话搜索与收起动效 | 已落地 | Primary Sidebar 顶部搜索 / Ctrl+B | `PrimarySidebar` · `App` · `sidebar-transition` |
| Chat 消息区大气化（Phase B 留白） | 已落地 | 消息流 `space-y-8`；工具卡见 agent-runtime | `frontend-alice-shell` Phase B |
| 人物世界口袋（对齐 Alice `/moments`） | 已落地 | 侧栏一入口 + 内页 tab | `WorldHub` |
| 伴侣状态条（展厅故事格） | 已落地 | Playground UI · 状态条 | `CompanionStatusBar` · Chat 顶栏已撤 |
| 自动生成朋友圈内容 / 多宇宙并行 | 缺口 | — | wishlist / 明确非本阶段 |
| 人物世界视觉资产引用 | 已落地 | `image_generate` 可将真实生成结果绑定到当前角色生活资产；Chat 与 WorldDetailsPanel 复用受控读取 / 定位预览；生成入口、媒体备份恢复和正式页面回流已完成。自动生成朋友圈内容仍不在本阶段 | `image-generation-product-integration-v1.md` |
| 非活跃后台养成 | 缺口 | — | 产品明确不做 |

### Prompt / 召回组装管线（聊天一轮）

主路径：`AgentRuntime` → `loadRoleAssembleInput` → `buildSystemPrompt` → Loop。

```text
用户发消息
  → assertSessionRole(session.role_id)          # 禁止偷换人设
  → loadRoleAssembleInput(roleId)               # Pack + MUTABLE + catchup + worldSlice + recentMoments + roster
  → detectReplyStance(lastUser)                 # M27-G1 问/做/安慰/推回 hint
  → resolveToneControl(stance, mode, text)      # M27-G3 紧/软/中性 + aside 策略
  → resolveRelationshipStageForRole(...)        # M28-G1/G2 阶段 + 交心/干活 lean
  → memory.buildUserProfile()                   # 结构化画像
  → safeVectorSearch(lastUser)                  # 向量语义召回 → L3 memories
  → yield memory_citations                      # M29-G1 UI 芯片
  → buildSystemPrompt({
        L1: PROTECTED + MUTABLE
        L2: 工具/aside/stance/tone/relationship/skill 摘要
        L3: 画像 + memories + catchup + worldSlice + recentMoments + roster
        L4: 动态（时间等）
     })
  → Agent Loop（流式）
  → 后台：profile-extract / smart-title / vector-index-user
  → scheduleReflectionAfterChat（召唤会话跳过）
```

召唤差异：装载对方完整 Pack；**不**改 `activeRoleId`；**不** tick / catchup 对方生活；Prompt 可带忙闲情境（`describeCastPresence`）。

## 相关决策

- `DEC-034`：同团多 Role Pack、单活跃角色、会话中禁止换角。
- `DEC-035`：主角交付节奏、破坏性重置和 `activeRoleId`。
- `DEC-036`：角色档案、默认世界与表达状态分层。

## 现状 / 缺口

**现状**：W0–W6 主线与人物世界六面正式回流已落地；六面入口、真实生活资产链、角色架、通讯录、朋友圈互动、备份、来源边界、生活切片和正式入口验收均已收口。人物故事仍由 Role Pack 来源治理，未确认的生活事实保持空态；`companion_event_links` 已完成幂等读写、事件发布投影、资产 / 卡司 / 图片关联、生活切片聚合、按角色回放和孤儿清理。
**缺口**：只保留上表「缺口」行和 wishlist 中明确后置的能力。不能把 Debug 世界态时间线当作普通用户 UI；静态属性、动态状态、触发时机和字段映射以已冻结的 `companion-world-model-v1.md` 为准。

### 人物世界当前数据边界

以下内容记录当前代码边界、已批准的施工方向和仍需收口的问题；具体执行以 `companion-world-model-v1.md` 为准：

| 生活面 / 数据 | 当前事实边界 | 首版已冻结规则 |
|------|------|------|
| 朋友圈 | `companion_events` 是事件事实，`companion_moments` 是可重建的用户可见投影；正式 UI 展示动态，不展示原始事件表 | 生活切片承接一条或一组 Moment，局部滚动并保持回到 Chat 的路径 |
| 衣柜、文化角、家居、足迹 | 统一使用按 `role_id` 隔离的 `companion_assets`；图片只保存结构化引用，字节走受控媒体存储；事件多对多关联使用 `companion_event_links` | 图片归属、读取、删除、备份恢复和事件关联按角色隔离；视觉资产由真实生图明确触发 |
| 通讯录 | 角色架与 roster 提供关系摘要；召唤会话不切换主角，也不推进被召唤角色生活 | 关系是 Role Pack 静态资料、独立运行时关系状态，还是二者叠加；哪些变化需要用户确认 |
| 运行时世界 | LifeEngine、planned / published 事件、Catch-up 和 presence 已存在，Prompt 只消费组装后的切片 | 静态属性与动态状态的分层、更新来源、版本化和冲突处理 |

暂定的数据流表达为：

```text
Role Pack / 用户确认的稳定资料
  ↓
稳定身份与静态世界
  ↓
planned event / 用户行动 / Agent 工具 / tick
  ↓
published event（事件事实）
  ├─ 更新短期世界状态
  ├─ 投影 Moments
  ├─ 关联生活资产、地点和关系线索
  ├─ 形成 Catch-up
  └─ 供 Chat Prompt 组装消费
```

静态不等于永不变化，而是变化频率低、需要更高确认门槛；动态不等于临时文案，而是必须有来源、时间和生命周期的运行时事实。Prompt 是消费层，不反向充当人物世界数据库真相。

- 2026-09-14：文化角正式使用 `companion_assets(kind=culture)`，按主角隔离并复用既有资产 CRUD / starter 播种；资产 payload 的 `type` 区分 reading、music、film、photography。
- 2026-09-15：家居与足迹接入同一 `companion_assets` 事实链，分别使用 `kind=home` 与 `kind=footprint`；家居读取住所结构，足迹读取角色常去地点，近期动态仅作为补充。
- 2026-09-16：衣柜删除与通讯录强制开聊改为成功后才关闭确认；失败保留同一确认，处理中禁止取消和重复提交。不改 IPC、存储或召唤忙闲判定。该补验不关闭生活面编辑、备份或六面完整验收。
- 2026-09-17：衣柜、文化角、家居和足迹正式页接入用户创建白名单与真实增改删；Playground 只做内存预览。Electron 覆盖文化 / 家居物件 / 想去地点的 create、重载保留、超限拒绝和删除清理。正式通讯录列表读取既有忙闲判定，忙碌仍可开聊并进入强制确认；Playground 通讯录保持静态夹具。正式朋友圈赞 / 评论落独立用户表，重载后保留，不改动态正文或卡司投影。
- 2026-09-17：正式备份覆盖生活资产与播种标记；按 id 合并、失败回滚，旧备份缺字段仍可导入。Electron 覆盖独立目录真实导出导入往返与二次导入不覆盖。朋友圈互动仍不进入备份。
- 2026-09-17：正式人物世界六面可从侧栏入口点开并读取真实 companion 数据；Electron 覆盖朋友圈、衣柜 starter、文化四类、家居空态、通讯录关系卡 / 忙闲和足迹动态地点。文化 starter 去掉无证据数量文案，不新编人物故事。数据库有记录不等于已获确认的人物事实。
- 2026-09-22：人物生活数据来源复核收口。衣柜 / 书架 / 文化角没有 Role Pack 来源时始终为空态；家居 / 足迹只允许从 `world.default.json` 初始化，用户创建和已发布事件资产仍走真实数据链；无世界资产时默认居所、当前位置、Catch-up 和 Prompt 切片均为「未设定」。新增 `companion-source-boundary.test.ts` 固化六角色来源矩阵，防止未经确认的人物事实重新进入服务默认值。
