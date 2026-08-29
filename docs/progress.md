# 项目进度

> **当前状态入口**：只记录项目现在在哪、最近完成、下一步和阻塞项。完整历史见 [`../_archive/ledgers/progress-through-2026-08-16.md`](../_archive/ledgers/progress-through-2026-08-16.md)。

## 人读摘要（约 30 秒）

| | |
|---|---|
| **当前阶段** | 公开 alpha；基础运行时、伙伴世界、记忆、权限、Debug / Playground、生产资产与安全边界主线已落地。 |
| **当前施工** | 产品体验 E0 / E1 正在 Playground 验收；先收 Chat 主旅程，再推进人物世界、设置与工作区。 |
| **产品主线** | 继续打磨伙伴体验、人物故事与 Pack 内容；真实 Persona Eval 结果仍需人工语气与审美验收。 |
| **明确暂缓** | 原生语音输入、Playground Prompt Lab 加厚、生图 Moments。 |
| **明确不做** | 当前威胁模型下不做 OS 级 Shell 强隔离和 Python 嵌入沙箱，见 DEC-037。 |
| **历史** | 完整施工流水和旧测试数字已冻结到归档，不再由本文件重复维护。 |

## 2026-08-29 · 产品体验 E0 / E1 开始：Chat 主旅程候选

- 新增《产品体验骨架与主旅程 v1》施工合同，产品体验从局部页面调整切换为按主任务和用户旅程验收。
- Playground Chat 候选增加“初次进入 / 正在聊天 / 处理任务”三种共享骨架状态；处理任务状态按需显示隔离 Right Dock。
- 首次进入保持轻量，不展示换主角入口；角色架继续由设置承载。

## 2026-08-29 · Playground 朋友圈 Alice 结构候选

- 参考本地 Alice 方法论第十八章与已保存源码，提取“人物身份头图 → 单一生活导航 → 近期动态流”的结构，不复制 Alice 的图片资产或产品文案。
- Playground 人物世界样张新增 CSS 头图 / 当前主角信息、相对时间和更接近社交流的动态卡；正式人物世界保持原有入口和数据边界不变。
- 新增第三条隔离动态夹具并补充 Alice 候选样式标识，便于验收信息密度、卡片节奏和浅 / 深主题表现。

## 2026-08-29 · Chat 空态移除换主角入口

- 首页空态只保留问候和当前主线建议，不再出现「换个主角」操作。
- 换主角统一从设置中的角色架进入，避免在首次进入 Chat 时打断主任务。

## 2026-08-29 · Chat 侧栏搜索与切换动效收口

- 会话搜索改为在 Primary Sidebar 顶部入口行内展开，输入、关闭和收起侧栏保持同一行，不再额外占用下一行。
- 侧栏收起 / 展开改为常驻轨道的宽度、透明度和位移动效；ResizeHandle 与侧栏同步进退，避免卸载 / 挂载造成硬切。
- 新增 Renderer E2E，验证搜索过滤、Escape 关闭、同一行布局，以及侧栏轨道收缩到 0 后可恢复。

## 2026-08-29 · 记忆与 Skills 入口收进设置

- Primary Sidebar 产品区只保留人物世界与设置，不再把记忆作为独立产品宫格入口。
- 底部开发 / 产品分组标题去除，仅保留 Debug、Playground、人物世界和设置四个实际入口。
- 移除 Memory / Skills 的 SecondaryNav 工具列，Settings 的「记忆」与「工具」分区成为统一入口；MemoryPanel、SkillsPanel 能力本身不删除。

## 2026-08-29 · Debug 入口全局化

- 移除 Chat 内 `conversationDebugMode` 与右侧半屏 `ConversationDebugAside`，避免把开发诊断叠进产品对话。
- Debug 统一由 Primary Sidebar / Settings / Chat 辅助入口进入全页 `DevPanel`；请求与运行域继续承载真实 LLM 调用、Trace 和事件。
- Debug 内部不再显示冗余的“Debug”身份行，刷新保留为返回按钮旁的轻量操作。

## 2026-08-28 · Playground 确认内容回流正式 UI

- 用户已明确授权回流；正式 UI 只接收可服务真实流程的视觉规则和交互，不复制 Playground 的来源路径、采用标记、目录、调试滑杆或隔离 fixture。
- Chat 右侧工作坞进入正式模式：默认预览，文件 / 预览 / 审阅 / 终端通过“+”按需添加；文件与预览共享选中文件，审阅 / 终端保持真实组件和真实 IPC 边界。
- Markdown 代码块改用 `--bg-tertiary`，正式人物世界默认使用朋友圈式动态流，正式记忆分类统一为四类语义色。
- 新增 `.agents/skills/playground-to-production`，固化“候选审计 → 选择性回流 → 真实数据边界 → 文档与门禁”的执行流程。

## 2026-08-29 · Playground 交互与产品体验页收口（候选）

- Chat 空态移除主角切换规则说明条，欢迎区回归轻量主视觉。

- 人物世界 Playground 收敛为朋友圈、物什、名册；角色架改放到设置样张，业务状态页移除伙伴状态条。
- 朋友圈样张补充微信式赞 / 评论操作行，并保持交互隔离在 Playground。


- 校准产品体验基础引用：Chat 不再显示未在样张中体现的 Markdown 渲染器；工作区登记其实际文件预览引用。

- 分隔线边界改为同卡内的正确 / 不当使用可视化对照，删除独立纯文字卡。

- 分栏拖拽的最小 / 最大边界说明已并入同一张拖拽预览卡，减少无意义的独立故事层。

- 修复主题比较假按钮：当前主题改为状态标签，其他主题才显示“设为比较”。
- 修复动效样张可见性：使用可观察的轨道内位移动画，并保留开关和真实 token 时长。
- 修复 Foundation 标签样张不可点击问题，补齐 tab 状态和内容切换。
- 产品体验页统一 Chat、人物世界、记忆、设置和工作区的体验舞台与基础引用信息层级，只改 Playground。

## 2026-08-29 · Playground 主题方向重新拉开（候选）

- 用户反馈宣纸与铜版过于接近；主题候选改为瓷青、曜石、松烟、绛紫四个差异更明显的方向。
- 新候选覆盖冷色浅色与莓果深色，避免继续堆叠暖白、铜棕和低饱和棕色。
- 同步更新主题比较 E2E；仍只影响 Playground 隔离样张。

## 2026-08-28 · Playground 高级感视觉收口（候选）

- 主画布增加低对比度主题氛围层，导航、页头、故事块和 token 卡统一材质、圆角与边界节奏；不新增 IA 层级。
- 故事块改为卡片底与细边界，移除可见“边缘”标签；边缘态仍通过 `data-edge` 和无障碍文本保留证据。
- 设计语言 token 卡增加克制的悬停层次；窄屏 Playground 导航选择器同步修正为 `aside`。
- 本轮只影响 Playground P0 候选，不改变正式 UI、生产主题或生产资产。

## 2026-08-28 · Foundation Design Language v2 开始施工

- 补充审美判断原则：层级、对齐、留白、克制、状态可感知和动效服从任务。
- 新增施工合同 `docs/requirements/foundation-design-language-v2.md`，记录 Radix / Ant Design / Primer / Carbon / Mantine / MUI / shadcn/ui 的研究结论与不引入整套依赖的边界。
- Playground 设计语言开始改为颜色角色、4 个主题候选微型界面、圆角角色和 easing 动效展示；Foundation 基础组件增加统一状态检查矩阵。
- 当前仍是 P0 候选施工，不改变正式主题、正式组件和生产页面。

## 2026-08-28 · Playground 视觉减噪与主题比较迭代

- Foundation 故事 Tab 改为轻量横向文字导航，减少灰色容器和胶囊按钮对内容预览的干扰。
- 主题候选增加 Playground 内的当前比较方向和选中反馈，方便在统一微型界面中做审美判断。
- 本轮不新增 IA 层级，不改变正式主题或正式组件。

## 最近完成

### 2026-08-27 · Alice 基础组件对照与 Foundation 补齐（候选）

- 对照 Alice 基础组件 Playground，按当前真实产品契约补入 IconButton、Card、Badge、Tag、Divider 五类通用 Foundation 故事；暂不复制 ToggleRow、NavItem、ThemePicker、划词工具条和 Kbd。
- Foundation 导航收敛为 13 个按任务拆分的入口，入口由 `foundation-story-registry.ts` 派生，仍保留每个底层 story 的真实预览。
- 新增组件资产注册、隔离 renderer fixture、Unit 和 Renderer E2E 覆盖；本轮仍停留在 Playground P0，未回流正式页面。
- 下一步从“补齐目录”切换到 Foundation 统一样式验收：颜色语义、尺寸密度、焦点 / 禁用 / 错误、窄宽和深浅主题。


### 2026-08-27 · Playground 来源与图标尺寸展示收口（候选）

- 页头基础引用与 `.tsx` 来源统一同一行，来源固定宽度、省略并支持 hover 查看完整路径。
- 图标尺寸独立为固定阶梯样张卡，自定义尺寸只影响少量预览图标，目录本身保持稳定视觉重量。
- motion 样张增加统一播放开关，开发者可以随时开启或停止持续动画。
- 基础与 Agent 实验页的来源路径与标题说明同行展示，统一固定长度省略和 hover 查看。
- 故事卡来源补齐可定位的 `.tsx` 路径。


### 2026-08-26 · Playground 控件与故事导航收口（候选）

- 图标目录将来源路径放到搜索按钮左侧，尺寸改为固定值 + 自定义滑杆；移除重复的独立尺寸故事卡和说明文字。
- 设计语言增加圆角实时滑杆，motion 样张改为自动播放，毫秒值与 token 名同行。
- Foundation 基础组件 Tab 按任务合并为按钮、输入与表单、标签与选择、弹层与菜单、状态与反馈、开发基础；底层故事仍完整渲染。
- Chat、工作区等产品体验的来源路径统一移到基础引用行最右侧，支持省略与 hover 查看。
- 其他一级 Playground Tab 同步采用同一页头规则，并登记可定位的 `.tsx` 来源；长路径固定长度省略、hover 查看完整值。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-26 · Chat Playground 页头信息归位（候选）

- Chat 用途说明与标题同行，基础引用行右侧展示真实实现来源路径。
- Chat 组合样张区域不再重复展示 `.tsx` 来源，下面只保留宽度切换与实际页面预览。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-26 · Playground 图标目录头部收口（候选）

- 图标搜索并入目录标题行，展开后使用紧凑的固定宽度输入，不再单独占用内容行。
- 隐藏图标目录中的 `.ts` 源路径；真实注册表、稳定 key 和采用证据仍保留给 AI / Debug 使用。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-25 · Playground 页面组合减层（候选）

- Chat 组合样张移除独立的“页面组合样张”来源行，来源仅作为工具行中的低对比路径，并与标准 / 分栏宽度切换合并，减少页面顶部层级。
- Lucide 图标目录数量统计移入目录标题同行，搜索区域不再额外占一行。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-24 · Playground 基础视觉减噪

- 移除设计语言页无实际产品流程的“重新读取”按钮，Token 展示改为随页面状态自然更新。
- Markdown 故事的代码块增加 Playground 专用层级色，修复浅色主题下代码区过白的问题，不改变正式 Chat 默认样式。
- 图标尺寸改为同一语义图标的 12 / 14 / 16 / 20 真实预览，搜索默认收起为放大镜，点击后展开输入。
- 设计语言的三档 motion token 增加可点击动画样张；页头去掉重复工作域小标题和“隔离实验”徽标。
- 产品体验页将基础能力依赖收进统一页头的轻量元信息行，移除内容区前额外的依赖卡和“这页如何组成 / 体验组成”摘要层。
- 清理 Playground 样张中的特定人物和外部参考产品名称；本轮仍只在 Playground P0，不回流正式页面。

### 2026-08-24 · Foundation 故事注册架构

- 新增 `src/shared/foundation-story-registry.ts`，统一维护 Foundation story key、组件 assetKey、Tab viewId、视觉分组和 renderer 关系。
- Foundation catalog、工作台分组和高级候选故事不再各自维护完整入口清单；一致性 Unit 会检查注册资产、renderer 分支和实际故事入口。
- 组件资产注册表继续负责组件身份与生命周期，故事注册表负责 Playground 展示事实，二者职责分离但通过 assetKey 关联。

### 2026-08-24 · Foundation 常用与候选组件补齐

- 基础组件工作台补齐下拉选择、表单字段、复选框、开关和差异查看器等已使用 / 高频控件故事。
- 同步加入对话框、弹出层、下拉菜单、可搜索选择、命令面板、右键菜单、滚动区域、提示浮层、骨架屏和进度条的隔离候选故事；候选生命周期不冒充生产采用。
- 本轮完成后，Foundation 下一阶段转入统一样式、焦点、禁用、错误、窄宽和深浅主题验收，暂不继续扩大目录。

### 2026-08-23 · Playground 布局收口

- Playground 壳统一提供工作域、当前一级 Tab、目的说明和内容宽度，面板不再各自漂移。
- 基础故事筛选在数据层保留基础控件 / 状态反馈 / 开发基础归类，但界面收敛为无灰色分组标题的单行横向切换；产品体验依赖改为紧凑证据摘要；页面组合移除外层故事卡套内层预览的重复包裹。
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
- 产品体验摘要改为“体验组成 / 基础能力”两行，业务组成与 Foundation 依赖均从注册表派生；人物世界的朋友圈、物什、名册三个 Tab 增加隔离样张并可逐个切换，角色架改在设置样张中查看。
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

## 最近进展

- Playground 产品体验补齐 Chat 欢迎区到人物世界的真实候选导航；“看看朋友圈”不再是无响应的静态按钮。
- Playground 人物世界朋友圈候选补齐微信式左对齐赞 / 评论互动行；评论仍是隔离样张状态，不进入正式数据链路。

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
