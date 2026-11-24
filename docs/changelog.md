# 变更日志

2026-11-25 右侧工作区完成 Office 高保真渲染与未保存防丢保护闭环：`.xlsx` 升级 `exceljs` 还原合并单元格/列宽/样式并原地保样式写回（支持双击与 Enter 编辑）；Word 升级 `docx-preview` 秒开高保真并支持本机 WPS/Office 原版 PDF 切换；PDF 升级 `pdfjs-dist` Canvas 高清渲染与透明文字层划词批注；PPT 优先本机静默转 PDF 高保真并可切大纲与备注；全场景未保存保护升级为应用内三态确认弹窗（保存并继续 / 放弃修改 / 取消），覆盖关闭标签、关闭工作区、切换项目与退出窗口，并在 Tab、溢出菜单及收起入口展示未保存圆点。

2026-11-25 修复公网网页白屏：正式浏览器改用受限沙箱 iframe 加载已通过主进程地址与跳转校验的网页，保留无 `allow-same-origin`、无应用权限边界；本地 HTML 和 Playground 预览路径保持不变。

2026-11-25 修复工作区网页与 HTML 文件加载：输入 `baidu.com` 等裸域名会自动补 HTTPS；网页重定向仅在每一跳通过安全地址校验且不超过上限时跟随；本地 `.html/.htm` 预览上限提升至 10MB，超过上限仍提示使用系统应用打开。

2026-11-25 右侧工作区 Batch A 补齐表格安全写回与文件变化保护：项目 IPC 新增 `.xlsx/.csv` 单元格轻编辑的公式保护、mtime 冲突检测、临时文件原子替换与 `.xls` 只读边界；右侧表格支持双击编辑、Ctrl+S、未保存提示和关闭确认；项目文件监听在外部修改时自动刷新干净预览、保留脏草稿并提示选择加载磁盘版本或保留编辑。

2026-11-24 右侧工作区五大面板全面对齐设计系统 2.0：`WorkspaceFilesPanel.tsx` 在预览标签栏左侧增加「收起 / 展开文件树」切换钮（支持全宽阅读与批注）；`ReviewPanel.tsx` 升级圆角内缩改动列表、计数胶囊与空态圆形徽标并放宽 diff 边距；`TerminalPanel.tsx` 改为目录短名与状态胶囊顶栏、新增「将最近输出发送到对话」一键快捷回传并升级为 `.chat-composer-card` 圆角命令输入区；`BrowserPanel.tsx` 地址栏升级为带图标的圆角胶囊框；`SideChatPanel.tsx` 同步主对话气泡造型、聚焦文件胶囊提示及 `.chat-composer-card` 输入底座。

2026-11-24 优化右坞侧栏展开时的中栏对话防挤压策略并升级 `FileBrowser` 至设计系统 2.0：`App.tsx` 监听视口宽度并在打开/拉宽右坞导致中栏剩余不足 `440px` 时自动收起旁侧会话抽屉（关闭/折叠右坞时自动恢复，手动再展开仍保证右坞主动让步为中栏保留至少 `380px`），同时升级会话右键菜单为圆角内缩规范；`FileBrowser.tsx` 顶栏改为展示目录短名与全路径提示、柔和搜索框与暖色调文件夹图标、放宽树节点行距与选中胶囊反馈、去重隐藏已有标签页的文件名重复条并将预览阅读区留白与 Markdown 正文分别放宽/提至 `px-5 py-4` 与 `13px`。

2026-11-24 全站设计系统 2.0 表面语言统一与规范沉淀：沉淀 5 项设计系统 2.0 基线至 `agent-skills/frontend-guidelines.md` 并扩展 `foundation-enforcement-gate.test.ts` 自动门禁；`src/index.css` 统一柔光聚焦晕与低对比悬停滚动条（`14% / 28%`）；`ChatWelcome.tsx` 拉开动态悬浮卡距至 `mt-7`；`PrimarySidebar.tsx` 将「+ 新对话」改为轻透微浮胶囊并与选中态区分；`MomentsPanel.tsx` 移除嵌入模式双重滚动；`content-layout.ts` 与 `WorldHomeGallery.tsx` 收口家居总览 `overview` 至 `560px` 并补充空间跳转摘要条；`TabStrip.tsx`、`WorkspaceToolMenu.tsx`、`ChatRightDock.tsx`、`WorkspaceFilesPanel.tsx` 及 `SettingsLayout.tsx`、`SettingsFields.tsx` 全面对齐圆角内缩浮层、细腻卡片投影、极简分割与衬线页头排版。

2026-11-24 人物世界布局收口回 Foundation 并强化静态防偏移门禁、日常开屏改走温暖时段双行问候与四项细节精修：`content-layout.ts` 新增 `LAYOUT_CLASSES.portraitGrid` 与 `MEDIA_FRAME_PRESETS.portraitHero`；`MomentsPanel.tsx` 复用 `readingContentStyle('world')` 居中限宽（672px）收敛过长信息流；`AssetsPanel.tsx` 移除全部手写 `aspect-[3/4]` 与 3 列大格，改用 `mediaFrameStyle('portraitHero')` 左图右槽双栏陈列「正在穿着」并统一走 `LAYOUT_CLASSES.portraitGrid`；`foundation-enforcement-gate.test.ts` 新增对朋友圈、衣柜与四大画廊的媒体框/网格自动化拦截；`companion-presence.ts` 新增 `buildTimeOfDaySubtitle`，日常回头开聊不重复喊人物口号；`App.tsx`、`ChatWelcome.tsx`、`ChatApprovalControl.tsx` 补齐菜单项圆角内缩、未选工作区上盖弱化、标题可读性与开屏重心微上移。

2026-11-24 修复输入框「管理模型设置…」未直达模型设置页与删除会话后残影 Bug：`SettingsPanel.tsx` 与 `App.tsx` 为 `initialEntry` 新增 `'model'` 直达入口（`openModelSettings`），并记录返回来源与阻止下拉浮层事件误消；`deleteSession` 与 `showPendingReasoning` 同步清理/守卫空会话状态，消除删除当前会话后首页左下角残留「思考过程 >」的问题。

2026-11-24 重构对话开屏欢迎区与 Codex 风格双层嵌套输入框：`src/shared/companion-presence.ts` 新增 `buildTimeOfDayGreeting` 并使 `buildColdStartCopy` 对老朋友开屏改为按时段亲切问候（「上午好啊 / 下午好啊」等），角色按自身 Role Pack 的 `firstContact.quote` 展示个性台词（未配 `quote` 回退简介）；`ChatComposer.tsx` 与 `src/index.css` 新增聚焦柔光（`.chat-composer-card`）、支持由 `projectControl` 构成上盖环境托盘、去除底栏竖线分割并将附件与生图收敛入 `+` 弹出菜单，同时清晰区分发送按钮空态与激活态；`ChatWelcome.tsx` 去除拦截视线的 3 颗模板胶囊，将输入框下方升级为等宽毛玻璃朋友圈悬浮切片卡（带角色名、时间、光圈徽标/缩略图、`聊聊 ›` 与朋友圈直达入口）；同步更新 `App.tsx`、`SurfaceBaselinePanel.tsx` 与单元测试。

2026-11-23 统一人物世界 8 大切面图标至 `icon-registry` 单一事实源、修复底栏按钮 hover 与恢复可点击模型切换器：`src/shared/icon-registry.ts` 新增 `WORLD_SURFACE_ICON_KEYS` 与 `getWorldSurfaceIcon`，将左导轨 8 个生活切面图标（朋友圈 `Aperture`、日记 `FileText`、礼物 `Gift`、衣柜 `Shirt`、文化角 `BookOpen`、家居 `Home`、通讯录 `Users`、足迹 `MapPin`）注册为单一事实源供 `NavigationRail.tsx` 与 `WorldHub.tsx` 同源消费；`ActionButton.tsx` 与 `IconButton.tsx` 移除压死 Tailwind `hover:bg-[var(--hover-overlay)]` 的内联 `background: 'transparent'` 并补齐 `hover:text-[var(--text-primary)]`；`ChatComposer.tsx` 与 `App.tsx` 新增 `modelControl` 可点击模型切换下拉菜单（支持一键切换主对话模型或直达模型设置）、将项目工作区选择（`📁 Desktop ▾`）收进输入卡片内部底栏（`projectControl`）并移除框外悬挂工具行与重复 `Debug` 链接；`ChatApprovalControl.tsx` 将自动审批图标由 `RefreshCw` 换为 `ShieldCheck`；`ChatWelcome.tsx` 移除最新动态卡左上角的 `Sparkles` 图标。

2026-11-23 恢复侧栏「+ 新对话」浅绿胶囊按钮并修复 hover、移除角色名误导下拉箭头与补齐路飞台词「是」字：`PrimarySidebar.tsx` 恢复耐看的柔和浅绿胶囊「+ 新对话」大按钮与右侧并排 `🔍` 搜索按钮、修复内联 `background: 'transparent'` 压死 hover 的问题，并去掉「路飞」右侧像下拉菜单的 `▾` 箭头；`roles/luffy/manifest.json` 与 `App.tsx` 将招牌台词修正为「我是要成为海贼王的男人！」。

2026-11-23 左导轨全员图标放大至 `20px`、替换底部碎图标并消除冗余「人物世界」入口：`NavigationRail.tsx` 将全轨图标统一放大至 `20px`（`38×38` 热区、导轨 `54px`），底部 `Debug` / `Playground` / `设置` 统一换为 `20px` 极简几何图标（`Terminal` / `Layers` / `Settings`），并在已有快捷入口时隐藏重复的「人物世界」图标（仅在快捷入口全空时兜底显示）。

2026-11-23 Playground 工作区新增 Batch B 视觉批注与样式试调候选（Phase P0，未改动正式页面）：在 `Playground → 产品体验 → 工作区` 新增「浏览器 · 本地开发批注」与「文件 · HTML 视觉试调」隔离场景，支持浏览 / 选元素 / 拖拽区域框选三态、选中元素 Adjust 样式所见即所得临时试调（输出 `before → after` 参考变更表且不改源文件）与受控 `localhost` 地址校验。

2026-11-23 右侧工作区正式支持 Office / PDF / HTML 富渲染与选区/元素批注发送到对话（Batch A P1 正式回流）：在项目文件工作区打开 `.xlsx/.xls/.csv`（多 Sheet 切换 + 拖拽框选单元格区域批注）、`.html`（沙箱选元素批注）、`.docx`（清洗富文本阅读 + 划词批注）、`.pdf`（原版高保真预览 / 文字页双模 + 按页批注）与 `.pptx`（幻灯片大纲卡片 + 演讲者备注 + 按页批注），均支持单条直发或先加入跨文件「批注草稿篮」再一键汇总发送到主对话输入框。

2026-11-23 Playground 工作区补齐 Batch A 全部富文档渲染与批注草稿篮候选（Phase P0，未改动正式页面）：在 `Playground → 产品体验 → 工作区` 的「文件」视图提供「Excel 表格」「HTML 批注」「Word 文档」「PDF 文档」「PPT 幻灯片」5 个可交互隔离场景，并新增「批注草稿篮」支持跨文档暂存多条批注后一键汇总发送到对话，待验收确认后推进 Batch A P1 正式回流。

2026-11-23 修复左导轨 hover 无响应并精修图标体系、头像尺寸与行距：`NavigationRail.tsx` 移除压死 hover 类名的内联 `background: 'transparent'`，改为显式悬停底色高亮 + 0 延迟右侧胶囊 `RailTooltip`；顶部伙伴头像放大至 `size="md"`（36×36），导轨扩至 52px、图标放大至 18px 并拉开纵向间距至 `gap-2`；将 `Sparkles` 归还给「人物世界」总入口，「朋友圈」改用镜头光圈 `Aperture`、「对话」改用圆润 `MessageCircle`（选中态实心填充）、其余切面与 `WorldHub` 对齐；`PrimarySidebar.tsx` 会话列表行距放宽至 `py-2 mb-1`。

2026-11-23 对齐 ChatGPT / Codex 极简高级双栏侧边栏质感：`PrimarySidebar.tsx` 头部收敛为单行「路飞 ▾ + 右侧搜索/收起图标」，将「+ 新对话」由沉重实心大药丸改为无底色左对齐轻量菜单行，会话列表改为单行极简目录（常规字重 `font-normal`、仅选中态 `font-medium` + 中性胶囊浅底、移除每行重复的 `今天 HH:mm` 第二行并收入悬停 title）；`NavigationRail.tsx` 与会话栏展开时同底色无竖线融为一体、去除内部碎横线、选中态改为克制中性色块并将自定义入口图标换为 `···`（`MoreHorizontal`）。

2026-11-23 统一 `SelectField` 下拉浮层主题样式，告别 Windows 原生蓝底系统菜单：`src/components/foundation/SelectField.tsx` 在保留真实 `<select>` 顶层节点（完全兼容 Playwright `selectOption`、键盘导航与表单语义）的基础上，于鼠标左键点击时拦截 Win32 原生 `#0078D7` 弹窗，改由 Portal 渲染圆角主题化下拉浮层（`--dropdown-bg` / `--accent-subtle` / `--accent-fg` + 勾选对勾），全站下拉框一次统一。

2026-11-23 落地双层左侧导航导轨（支持自定义生活快捷入口）并精修空态首屏：新增 `src/components/shell/NavigationRail.tsx`（48px 极窄左导轨，顶部固定伙伴头像切换、中部「对话 + 可自定义人物世界快捷入口（默认朋友圈/日记/礼物）+ 人物世界总入口 + 原地勾选自定义浮层并持久化至 localStorage」、底部收敛 Debug/Playground/设置）；`PrimarySidebar.tsx` 支持 `showFooter={false}` / `showBrandAvatar={false}` 并在切进人物世界时自动收起会话栏释放宽屏画布；`ChatWelcome.tsx` 将 3 颗纯对话提示词胶囊挪至输入框上方，底部最新动态轻卡收为纯图标操作并支持有图左缩略图（多图 `+N` 角标）。

2026-11-23 重构 Chat 空态首屏为「去头像 + 角色第一人称台词 + 居中输入框 + 单条最新动态轻卡」：`companion-presence.ts#buildColdStartCopy` 优先使用 Role Pack `firstContact.quote`（如路飞「我要成为海贼王的男人！」）替代第三人称简介；`ChatWelcome.tsx` 移除重复圆头像、统一三颗清透胶囊并新增 `composer` 居中插槽与 `latestMoment` 毛玻璃最新动态轻卡（支持「聊聊这条」预填输入与「去看看」跳转朋友圈）；`App.tsx` 在空态时将输入区居中承载、开聊后自然落回底部，同步更新 Playground `SurfaceBaselinePanel.tsx`。

2026-11-23 放大 Chat 左侧轮次跳转轨热区并加入 Codex 同款鱼眼波浪拉长：`ChatScrollNavigator.tsx` 将左侧按钮热区扩至贴边 44px 宽 × 14px 高且纵向零缝隙（消除滑动断档），并按悬停距离（0/1/2 格）平滑渐变拉长线条（24px / 16px / 12px / 8px）。

2026-11-23 重绘通讯录 4 位草帽团伙伴头像为阳光日漫满画幅风格：替换 `zoro` / `nami` / `usopp` / `sanji` 的 `visual/avatar-v1.png`（512×512 PNG），统一为晴朗蓝天白云甲板日光画风并彻底移除旧版黑夜阴森底色与白圆框。

2026-11-23 Chat 左侧轮次引导轨由圆点改回极简线条样式：`ChatScrollNavigator.tsx` 将左侧指示点切换为左对齐细线条（当前轮次长条主色、悬停拉长加深、未选中短细线），保留无白底与单条悬停预览卡。

2026-11-23 根治 Electron 打开用户工作区后通讯录头像与礼物/信物插画全部不显示的 Bug：`ProjectIPC` 打开用户工作区时会执行 `process.chdir(dirPath)`（如 `Desktop`），导致 `electron/main/companion/identity/loader.ts` 中 `resolveUniversesRoot()` 仅靠 `process.cwd()` 寻址 `universes/` 在 `dist-electron/` 产物下必然失败并被 `resolveRoleAssetFilePath` 静默缓存为 `null`；现改为优先按 `dist-electron/..`、`process.env.APP_ROOT`、`app.getAppPath()`、`process.resourcesPath` 定位内置 `universes/`，并在 `gifting.test.ts` 补齐 `process.chdir(os.tmpdir())` 回归。

2026-11-23 修复朋友圈自主回复「错把用户当动态作者 / 配角越位 `@我`」Bug：`electron/main/prompts/moment-reply.ts` 显式区分 `postAuthor`（动态作者）与 `commenter`（用户/我），严禁回复对着主角喊话却挂在 `回复 @我` 下，并要求无意义占位输入返回 `shouldReply: false`；`electron/main/companion/life/moments.ts` 新增 `isTrivialPlaceholderComment`（跳过 `ll`、`...` 等占位输入的自动回复）与 `isAuthorizedCastResponder`（用户未回复或点名某配角时拦截配角越位回复 `@我`），同步更新 `docs/modules/companion.md`。

2026-11-23 重构 Chat 左侧轮次跳转轨为极简圆点 + 单条悬停预览卡并补齐礼物配图断言：`ChatScrollNavigator.tsx` 彻底移除白底补丁背景，改为纵向极简圆点轨；鼠标悬停单个圆点时仅在对应位置浮现该条单轮预览卡（用户发言加粗 + 伙伴回复摘录 + `idx / total` 与时间），点击精准跳转；`App.tsx` 为 `userTurns` 同步组装 `replyPreview` 与 `timestamp`；`__tests__/unit/gifting.test.ts` 补齐 `shanks-straw-hat` 与 `going-merry` 返回真实 `data:image/png;base64,` 的端到端断言。

2026-11-23 补齐聊天图片与文档附件全链路：点击回形针或拖拽图片现已统一走多模态视觉通道（不再当纯文本读成乱码）；新增主进程 `chat:parseAttachment`（`unpdf` / `mammoth` / `xlsx`）支持直接解析 PDF、Word（`.docx`）与 Excel（`.xlsx`/`.xls`）正文；允许仅附带文件或图片不输入文字直接发送，并对不支持的二进制文件给出友好提示。

2026-11-23 修复聊天发送图片后 AI 看不到图且回复结束图片消失的 Bug：`database.ts`（v28→v29）与 `session-store.ts` 为 `messages` 表新增 `images` 列并在保存、读取与分支复制中完整持久化用户图片附件；`App.tsx` 允许不输入文字直接发送图片；`request-builders.ts` 在纯文本模型降级去图时提供明确的中文不支持视觉提示。

2026-11-23 优化严格格式约束下的语气与旁白收放：`electron/main/agent/tone-control.ts` 新增严格输出格式约束信号识别（`strict-format`），在用户明确要求纯文本、字数、大小写、禁用词或精确结构时自动抑制 `~>` 内心独白与多余首尾过渡语，Google IFEval（有效 23 题）Prompt-Strict 从 78.3% 提升至 91.3%（与 Loose 持平），`general-agent-bench` 达 20/20 满分；常规聊天与情绪陪伴人设表现保持不变。

2026-11-23 修复 `auto` 自主执行模式下写文件前口头二次确认打断闭环：`electron/main/prompts/compiler.ts` 按 `executionMode` 区分确认策略，消除 `auto` 模式下对常规工作区文件落盘的冗余口头反问，同时保留不可逆高风险破坏性操作的备份/恢复确认与宿主权限门禁；复测 `mcp-selection` 与 `rh-03` 均由 0 分升至 1.00 PASS，12 项安全攻防 12/12 零退化。

2026-11-23 扩充无 Docker 通用 Agent 底座评测矩阵并支持隔离 MCP Server 评测：`external-controller.ts` 与 `runtime.runExternalEvalTurn` 支持 turn 级临时 stdio `mcpServers` 挂载与自动回收，打通 ACB `mcp-selection`（6/6 全接入）；`scripts/harness_security_my_agent_runner.mjs` 扩充至 12 题深度攻防（12/12 PASS）；新增 20 题确定性通用 Agent 底座基准 `scripts/general_agent_bench_runner.mjs` 并接入 `scripts/run_external_evals.mjs`。

2026-11-23 优化 Chat 左侧轮次跳转轨观感与悬停实时联动：`ChatScrollNavigator.tsx` 去掉冗余「我的发言 · 共 N 条」标题头与 `01/02` 编号收紧为极简轻浮层，并新增 80ms 防抖悬停实时定位（鼠标滑过任意横杠或条目时右侧对话即时平滑滚动，点击则锁定并收起）。

2026-11-23 Chat 新增「回到底部」悬浮箭头与左侧轮次跳转轨、修复过程参数横滚条与精简页头右上角：新增 `ChatScrollNavigator.tsx`（`ChatScrollToBottomButton` 居中浮现于输入框上方一键回底 + `ChatTurnRail` 左侧极简小横杠，悬停展开全部用户发言目录并支持一键跳转，且向上浏览历史时不强制拉回底部）；`ToolCallbackList.tsx` 为工具参数 `<pre>` 补齐 `whitespace-pre-wrap break-all` 消除卡片内横向滚动条；`WorldProfileHeader.tsx` 移除右上角与左下角重复的地点胶囊。

2026-11-23 根治通讯录配角头像在 `universeId === ''` 时缺失 Bug 并精修页头细节：`ipc/companion.ts`、`contacts.ts` 与 `loader.ts`（`getRoleVisualDataUrl` / `resolveRoleAssetFilePath`）统一将空字符串 `universeId` 归一回退为 `'default'`，彻底修复未切换过世界观时索隆/娜美/乌索普/山治头像无法加载的问题；`WorldProfileHeader.tsx` 移除重复的「很开心 · 此刻 · 」前缀（直出当前活动）、微调底部暗角加深至 64%，并将右上角换图图标改为悬停头图时才轻显（配半透明深色圆底）。

2026-11-23 统一全站滚动条基线与主视口防抖动占槽：`src/index.css` 建立全局 `*::-webkit-scrollbar` 6px 圆角悬停显现基线（静止透明、容器 hover/focus-within 显色、手柄 hover 加深、隐藏上下箭头），移除与 Chromium 121+ 冲突的 `scrollbar-width: thin`，新增 `.scrollbar-stable`（`scrollbar-gutter: stable`）并接入 Chat、人物世界与 Playground 主滚动区，同步写入 `frontend-guidelines.md` 与 `foundation-enforcement-gate.test.ts` 门禁。

2026-11-23 同步 Playground 基础层展示新增容器原语与布局档位：`UiControlsPanel.tsx` 的「卡片」故事切为真实 Foundation `<SurfaceCard>` 并补充 `<DetailHeader>` 样张，「标签切换」故事新增 `TabStrip variant="pill"` 柔和胶囊样张；`LayoutLanguageSamples.tsx` 的图片区同步展示真实 `MEDIA_FRAME_PRESETS`（`card 4/3`、`portrait 3/4`、`overview 16/9`）与 `LAYOUT_CLASSES.cardGrid` 三列网格。

2026-11-23 落地 Foundation 容器原语收敛与防拖延/防退化门禁：`AGENTS.md` 新增「禁止“以后再说”式拖延」铁律，`agent-skills/frontend-guidelines.md` 固化「三次法则 + 踩坑即收口」与「单点 Bug → 全仓清扫 → 静态门禁」三步闭环；新增 Foundation 原语 `SurfaceCard.tsx`（升级 `behavior.card` 为 `adopted`）与 `DetailHeader.tsx`，收口 `CompanionAvatar#framed` 并在 `WorldProfileHeader`、`ChatWelcome`、`WorldCultureGallery` 与 `WorldKeepsakesPanel` 落地采用；`foundation-enforcement-gate.test.ts` 新增全仓「禁止给 `CompanionAvatar` 外传裸 `ring-*`/`!border-*`」与「带 `role="menu"` 浮层的 `<section>` 禁止 `overflow-hidden`」两项静态门禁。

2026-11-23 清零全仓 Tailwind v4 裸 `ring-*` 黑框并新增全仓静态扫描门禁：修复 `ChatWelcome.tsx`、`PrimarySidebar.tsx`、`GiftGivingModal.tsx` 与 `App.tsx` 全部 5 处无显式颜色类的 `ring-1/2/4`；在 `foundation-enforcement-gate.test.ts` 新增全仓 `src/**/*.tsx` 静态扫描门禁（随 `assets:check` / Git Hook 执行），并将同源清扫纪律记入 `docs/pitfalls.md`。

2026-11-23 修复人物世界页头换图下拉菜单被裁切、移除冗余关闭图标并同步 Playground 样张：`WorldProfileHeader.tsx` 移除外层 `<section>` 的 `overflow-hidden`（保留内层封面容器裁切）并提升菜单 `z-30` 防止「恢复默认」被截断，同时删除右上角冗余关闭图标；`SurfaceBaselinePanel.tsx` 同步切换为 `pill` 标签并传入 `statusMetrics` 样张，与正式人物世界保持一致。

2026-11-23 人物世界头图通透化与双色状态微条精修：`WorldProfileHeader.tsx` 去掉洗白画面的 80% 浅色渐变，改用原画 + 底部轻暗角与白字高对比层级；右上角收敛为半透明地点胶囊，右下角状态微条精简为「心情（翠绿）+ 精力（天蓝）」双色无数字细条，兼顾原画美感与随时感知状态。

2026-11-23 人物世界头图与 Tab 选中态精修：`WorldProfileHeader.tsx` 移除默认渲染黑圈的 `ring-4` 改为纸白细边，去掉与侧栏重复的长篇人设简介（仅留名字、当前地点与可点击聊天的「此刻」轻状态），并在右下角新增无数字极简状态微条（心情 / 精力 / 兴致，悬停显示自然语言解读）；`TabStrip.tsx` 新增 `variant="pill"` 柔和胶囊选中态，`WorldHub.tsx` 主导航撤掉底部横线切为柔和胶囊。

2026-11-23 修复从人物世界/右侧面板带内容回到 Chat 时输入框光标落在最左侧：`App.tsx` 的 `onTakeToChat` 与 `onGenerateAssetImage` 改为在 `requestAnimationFrame` 中聚焦并调用 `setSelectionRange(end, end)`，光标自动定位到文案末尾方便直接续写。

2026-11-23 人物世界顶部减负去「全天日程」剧透与礼物柜全量配图升级：`WorldProfileHeader.tsx` 移除前台独立「今日轨迹 / 全天日程」展开面板，将「此刻正在做什么」收敛为头图内一行可点击聊天的轻状态胶囊并压实封面渐变底衬；为路飞 4 件预置礼物与信物（香克斯草帽、黄金梅丽号、梅利号金色铃铛、生命卡一角）生成 Role Pack 静态插画，并在 `life-schema.ts`、`companion-backup.ts`、`gifting.ts` 与 `relationship-keepsake.ts` 补齐 `image_url` 解析与新礼物后台静默生图（`category: 'gift'`，4:3）；`WorldKeepsakesPanel.tsx` 同步接入 `LAYOUT_CLASSES.cardGrid` 与 `mediaFrameStyle('card')`，实现列表 3 列 `4/3` 封面与详情居中灯箱大图。

2026-11-23 统一人物世界各画廊卡片列数与图片实际尺寸：`content-layout.ts` 新增 `LAYOUT_CLASSES.cardGrid`（`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`），同步接入 `WorldTravelGallery`、`WorldCultureGallery` 与 `WorldHomeGallery`（`content-layout.test.ts` 门禁锁定），修复足迹此前 2 列导致卡片图片比文化角/家居大 1.5 倍的问题。

2026-11-23 人物世界 AI 读取工具注册表驱动全覆盖、朋友圈主角身份评论修复与基础层媒体图框统一：`surface-registry.ts` 为全部 9 个人物世界切面声明 `readView` 并导出单一事实源 `COMPANION_WORLD_READ_VIEWS`（`arch:check` 门禁强制锁死新增切面必同步工具）；`companion_read_world` 补齐 `journal`（日记）、`gifts`（送出与收到的礼物）、`contacts`（通讯录）、`timeline`（今日轨迹）且 `moments` 附带点赞与评论列表；`companion_comment_moment` 改为调用新增的 `addProtagonistMomentCommentForRole`，以当前主角身份（`actorType='protagonist'`）发表/回复评论，彻底修复此前冒充用户账号（「我」）的 Bug；`content-layout.ts` 新增 `MEDIA_FRAME_PRESETS` / `mediaFrameStyle()` 并在文化角、家居、足迹画廊统一卡片媒体比例。

2026-11-23 优化右下角 Toast 停留时长与悬停暂停：`Toast.tsx` 由固定 3s 改为按文案字数自适应（4s–8.5s，报错至少 6.5s），并支持鼠标悬停暂停倒计时、移开后平滑退场，确保长评论回复提示从容可读。

2026-11-23 朋友圈评论交互微调：`MomentsPanel.tsx` 移除回复栏冗余「取消」按钮（直接按退格键清除回复前缀），并新增点击输入区外任意位置自动收起评论框且保留内存草稿，再次点开可无缝续写。

2026-11-23 修复朋友圈按钮 hover 被内联样式屏蔽与评论框双层套框：`MomentsPanel.tsx` 移除赞/评论/聊聊按钮的内联 `background`/`color` 覆盖，交由 `index.css` 的 `.moments-alice-action:hover` 语义类正常响应悬停态；评论框改用 Foundation `<TextField appearance="embedded" />` 彻底消除内层方框套框。

2026-11-23 人物世界收口 5 项：统一「收到的礼物」为与「送出的礼物」一致的三列纸白卡片网格 + 点击展开居中阅读详情（完整保留赠礼人、日期、附言、回响与聊聊入口）；修复配角因缺少 `protected.md` 导致 `contacts.ts` 未返回头像的 Bug（降级直读 `getRoleVisualDataUrl`）；修复旧库 `ensureStarterWardrobe` 未同步更新 `wear-state` 穿衣立绘的 Bug；移除衣柜画廊多余的「库存 · N」标题；朋友圈点赞与评论交互全面对齐 Alice（评论发送/Esc 自动收起输入框、点赞暖红态与点赞行、按钮 hover 轻高亮、一体化圆角评论条）。

2026-11-23 精简 Chat 等待首字指示器：`App.tsx` 在已有「让我想想…」思考过程展示时不再叠放 `ContentCallbackCue`；`ContentCallback.tsx` 移除机械感文字「回复生成中…」，改为极简三点呼吸输入指示器（仅在无思考过程且等待首字时轻显）。

2026-11-23 文化角卡片化、路飞完整穿衣立绘与礼物柜伙伴赠礼支持：`WorldCultureGallery` 书籍/影视/音乐/摄影列表统一封装为 `var(--card-bg)` 圆角卡片并改为 `object-cover` 贴顶封面，消除文字归属不清问题；为路飞生成完整人物全身穿搭立绘（`wardrobe-initial-outfit-v2.png`）替换无头衣架拆解图，并在 `assets.ts#ensureStarterWardrobe` 支持无损升级既有用户的出厂穿搭图（不覆盖用户自生成换装图）；`companion_received_gifts` 新增 `giver_name` 列与 `life-presets.json#starterReceivedGifts` 幂等播种，支持展示来自小伙伴与重要之人的礼物（路飞预置「红发香克斯的草帽」与可雅送的「黄金梅丽号」），`WorldKeepsakesPanel` 卡片同步显示「来自 xxx」徽标。

2026-11-23 修复人物世界详情居中对齐、家居总览图尺寸上限与通讯录船员头像接入：`readingContentStyle()` 与日记/礼物详情统一居中（`marginInline: 'auto'`，同步更新 `frontend-guidelines.md` 与 `content-layout.test.ts`），解决宽屏下「和TA聊聊」按钮悬停中段与右侧大片留白；`WorldHomeGallery` 总览图改为 `16 / 9` 并限宽 `760px` 避免撑爆首屏；`companion/cast/contacts.ts#getContactsForRole` 通过 `getRoleVisuals` 补齐 `avatarSrc`，让 Role Pack 中已生成的船员头像正式在通讯录显示（同步补齐 `world-contacts.test.ts` 断言）。

2026-11-22 修复非 Chat 视图收起侧栏后无法展开的 Bug 并落地 Chat/人物世界统一强磨砂透色侧栏与画廊去灰边：将 `App.tsx` 的「展开侧栏」按钮移出 `activeView === 'chat'` 分支，使其在人物世界、记忆、技能与 Chat 全部视图收起后均可一键展开（统一透明无底色图标样式，与右侧工具按钮一致）；Chat 与人物世界共享全宽 `CompanionSceneBackdrop` + `PrimarySidebar#frosted`（22% 轻雾 + `blur(20px) saturate(1.45)`）在左侧栏稳定透出柔和氛围色温（切页无跳变），人物世界右侧保持不透明 `var(--bg-primary)` 不与头图重影；`WorldRecordImage` 与 `WorldHomeGallery` 改用 `object-cover` 消除衣柜与家居图片的上下灰边。

2026-11-22 人物世界与侧栏二次视觉精修：`PrimarySidebar` 底色微调为与主题画布柔和融合的 `color-mix(in srgb, var(--bg-primary) 42%, var(--card-bg))` 并为会话列表底部增加渐隐过渡防硬截断；`WorldProfileHeader` 封面裁剪锚点调至 `object-[center_22%]` 避免裁掉人物头部并平滑过渡至 `var(--bg-primary)`；`WorldHub` 分区标签改为轻量化 `underline` 样式移除 8 个冗余外框；朋友圈帖子、日记详情与礼物卡片统一为清爽 `var(--card-bg)` 纸白卡，移除朋友圈顶部「展示近 14 天动态」系统提示与日记卡多余固定高度。

2026-11-22 人物世界与 Chat 视觉去噪收口（5 项）：`CompanionSceneBackdrop` 收回至右侧 Chat 主区固定渲染（滚动不位移，不再在人物世界重复叠加头图）；`PrimarySidebar` 改用明亮纸白实底 `var(--card-bg)` 避免底图人物干扰会话列表；`orchestrator.ts#formatCompanionStatusSummary` 停止拼接内部反思备忘 `userRelationship.note`；`WorldJournalPanel` 与 `WorldKeepsakesPanel` 列表卡移除厚重深绿上半色块，统一为清爽 `var(--card-bg)` 卡片；正式 Chat 传入 `showUserAvatar={false}` 隐藏多余空心用户头像；同步更新 `CompanionSettingsContent` 文案与 Playground 样张。

2026-11-22 升级全窗固定氛围底图与通透毛玻璃侧栏：将 `CompanionSceneBackdrop` 提升至 `App.tsx` 最外层 `.app-shell`（覆盖左侧栏与右侧 Chat / 人物世界，彻底修复 Chat 滚动后底图随首屏消失的问题，并让人物世界各 Tab 共享同一固定底图）；`PrimarySidebar` 改为全透明底（仅保留 `1px` 细分割线，移除展开态 `translateX(0)` 隔离合成层），与全窗 12% 轻雾底图浑然一体；`formatSessionPreview` 过滤 `~>` 小声蛐蛐行防止原始符号露出，Playground Chat 与人物世界样张同步对齐。

2026-11-22 最终收口 Chat 过程流、代码块与正文阅读节奏：移除过程展开区外层白底卡片框，思考过程与工具行收紧为统一紧凑行距（`py-0.5`），「去查看」跳转收进对应工具展开详情块底部，保证工具列表右侧绝对对齐；思考详情、工具详情与 `CodeBlock` 统一为左对齐 40% 轻磨砂圆角卡片；正文段落、列表与 `💭` 小声蛐蛐放宽行高与间距，拉开过程与正文的主次疏密；移除 `GeneratedImageResult` 底部技术栏，仅保留纯净圆角图片与点击全屏灯箱预览。

2026-11-22 精修 Chat 对话流视觉、过程留白流与氛围壁纸透明度设置：`CompanionSceneBackdrop` 默认壁纸浓度由 22% 降至 12% 轻雾感，并在伙伴设置新增「壁纸透明度」滑块（`companionChatBackdropOpacity`，0%–35%，同步纳入 `data:export` / `data:import` 与 Playground 设置样张）；`MarkdownRenderer` 行内代码改为轻量中性灰底深灰字，代码块启用 `.scrollbar-thin` 细滚动条与统一圆角；`ReasoningCallback` 与 `ToolCallbackList` 收口为极简留白过程流（`xxx >` 收起，展开为 88% 浅雾磨砂圆角卡、思考直接可读限高滚动、工具状态「准备中… / 进行中… / 未通过」与「去查看」统一右对齐、默认不摊开 JSON）。

2026-11-22 参考 Alice `rf` / `Xg` 升级 Chat 过程视图为「双段实底小胶囊 + 点击弹窗看详情」：`ToolCallbackList` 与 `ReasoningCallback` 共用 `ProcessStepCapsule`（左段动作名、右段单行摘要与可选「去查看」轻链接，去掉重复回执行与大绿按钮）与居中 `ProcessDetailModal`（`Esc`/遮罩关闭），绝不在对话流里摊开大段 JSON；多轮折叠摘要补充失败计数提示；`GeneratedImageResult` 改为独立圆角实底图卡去除多余顶线；提升 `.ququ-line` 在氛围壁纸上的可读对比度，正式页与 Playground 同步生效。

2026-11-22 轻量重构 Chat 过程视图并落地多轮任务自动收起：`ReasoningCallback` 与 `ToolCallbackList` 去框减重为统一色阶（`--text-secondary`）无框幽灵行与柔和半透明浅底展开容器；新增 `groupVisibleMessages` / `buildProcessSummaryText` 接入正式 `App.tsx` 与 Playground，多轮工具任务进行中实时展开、跑完后默认折叠过程仅保留最后一轮最终回复与外露生成图；同步将 `ChatFileChip` 移除按钮统一为与 `ChatImageThumb` 相同的右上角悬浮圆标。

2026-11-22 参考 Alice 的「蛐蛐（`.ququ-line` / `~>`）」重构小声蛐蛐样式与频次控制：`src/shared/aside.ts` 新增 `parseAsideSegments` 与 `shouldSuppressAside`（纯 `~>` 独立行协议，跳过代码围栏、流式零闪跳，移除旧 `<aside>` XML 标签兼容）；`MarkdownRenderer.tsx` 与 `src/index.css` 落地 `💭 ` 前缀、12px 正体 muted 原位渲染及 `user-select: none` + `onCopy` 自动剔除；主进程收敛 Prompt 单一事实源（消除 4 处重复提及）并接入 2 轮硬冷却与紧绷态静默抑制，Playground 同步更新样张。

2026-11-22 参考 Alice 输入卡内一体化附件托盘，新增共享 `ChatAttachments.tsx`（`ChatAttachmentTray` / `ChatFileChip` / `ChatImageThumb`）：将待发送图片缩略图（52×52，移除角标仅 hover/focus 浮现）与结构化文件卡片（同高 52px，类型图标 + 文件名 + 扩展名与大小）统一收纳进 `ChatComposer` 卡片内部 `prefix` 托盘，并在 Playground Chat「图片与文件」旅程补齐发出去的纯文件消息气泡、单图消息气泡与多图+文件混合消息气泡，正式页 `App.tsx` 同步切换为同一组件。

2026-11-22 从正式 Chat 消息流与 Playground 旅程中撤掉正上方 `MemoryCitationChips` 记忆引用芯片（后端召回与 Debug 记录保持不变）；并在 Playground Chat 新增「图片与文件」主旅程，补齐已发送单图/多图与文件引用消息样式以及输入区待发送图片缩略图、文件胶囊预览交互。

2026-11-22 完成平台层零角色耦合重构：新增通用 Role Pack 预设加载器 `companion/identity/life-presets.ts`，将原散落在 15 个平台模块（`assets`、`relationship-keepsake`、`co-decision`、`replan`、`script-generator`、`vulnerability`、`inner-thoughts`、`gifting`、`host-presence`、`chat-resonance`、`travel-progression`、`nightly-reflection`、`spontaneous-impulse`、`life-context-snapshot`、`moment-interactions`）及 Prompt/工具/`companion-error-voice.ts` 中的路飞专属数据与硬编码分支全部下沉至 `universes/default/roles/luffy/life-presets.json`，并在 `arch:check` 新增「零角色耦合静态门禁」防回流。

2026-11-22 统一 Chat 对话流全部过程组件视觉与对齐：`ReasoningCallback` 与 `ContentCallbackCue` 收拢进 `ChatMessageFrame` 助手列与正文、工具卡严格左对齐；思考卡与 `ToolCallbackList` 共用同一套轻量过程折叠卡皮肤（统一圆角/字号/状态点/右侧折叠箭头，思考正文改用 UI 字体，工具名映射自然中文与语义图标）；`MemoryCitationChips` 改用中文分类名与 `--radius-pill` 轻胶囊，正式页与 Playground 同步生效。

2026-11-22 归档并删除多余的 Playground 候选文件（`VulnerabilityExperienceCandidate` 与 `GiftingExperienceCandidate`），在 Playground Chat 主旅程新增「思考与工具」全景交互视图（完整接入 `ReasoningCallback` 进行中/完成、`ToolCallbackList` 七态含朋友圈/生活记录/生图/错误、`ContentCallbackCue`、`MemoryCitationChips`、`MarkdownRenderer`+`<aside>` 与 `formatCompanionErrorBubble`），便于先在 Playground 统一检视对话流视觉问题。

2026-11-22 移除人物世界图片组件 `WorldRecordImage` 右下角「在文件夹中定位」角标按钮，消除生活画廊遮挡；同步收口 Playground `SurfaceBaselinePanel` 与正式人物世界顶栏的偏差，移除独立假头图 `WorldOverviewHero` 与 `hideHeader`，改由 `WorldHub` 直接渲染真实 `WorldProfileHeader` + `WorldTodayTimeline` 并同步「刷新礼物」标签。

2026-11-22 补牢现有前端一致性门禁与路由：`EmptyState` 无操作时默认自动垂直居中；`foundation-enforcement-gate.test.ts` 覆盖 6 个人物世界正式面板并新增禁止 `EmptyState` / `ErrorState` 外包居中大留白容器的 AST 门禁与负例；`AGENTS.md` 补齐前端 UI 任务必读路由，`frontend-guidelines.md` 明确内容页空态与错误态直接贴内容区边界。

2026-11-22 日记页移除脆弱心境表单卡片恢复纯净日记册；「信物」Tab 更名为「礼物」并收口为只读礼物柜（「送出的礼物」与「收到的礼物」），移除所有手动送礼按钮，新增 `companion_receive_gift` 聊天收礼工具支持在对话中自然送礼，并将日记与礼物空态对齐其他人物世界 Tab 的全宽贴顶 `EmptyState` 样式，同步更新 Playground 样张。

2026-11-22 完成人物世界顶栏与新 Tab（今日轨迹、日记、脆弱心境、信物、送礼）前端体验精调及 Playground 离线样张同步：移除顶栏「看数字」和送礼弹窗里的 RPG 体征数值、移除信物页「索取信物」、将今日轨迹移出封面区并接入 Playground 离线预览、外观编辑收进轻量菜单并修复恢复默认漏重置封面、无脆弱心事时静默隐藏卡片，以及为日记删除补齐二次确认与深夜反思徽标。

2026-11-22 落地全链路生图管线 v2：新增受控「绘画导演」辅助模型扩写层（`companionImageDirector`）、对话专属伙伴拍照工具 `companion_take_photo`、通用 `image_generate` 的 `useChatImage` 聊天图片垫图能力，以及 OpenAI `/images/edits` 多图垫图与 `image`/`image[]` 自动重试及进程级降级缓存。

2026-11-21 落地主会话人格化错误承接（`WISH-016`）：断网、限流、超时、权限拒绝或未配置模型时，以当前伙伴的自然口吻承接并附带真实脱敏错误原因引用，避免裸技术报错破坏陪伴感；同步完成锁定依赖安全复核（`WISH-044`：生产依赖 0 漏洞，全量 0 critical / 0 high）。

2026-11-21 补齐角色自定义头像/封面覆写（`roleVisualOverrides`）与 Chat 氛围壁纸开关（`companionChatBackdropEnabled`）的 `data:export` / `data:import` 备份恢复与回滚闭环；新增当日聊天共鸣即时单槽微调（`adaptNextUpcomingSlotForResonance`），让聊天中约好的美食/文化/日常活动能即时编入今天下一个空闲生活槽位；收敛 `vite.config.ts` 开发依赖扫描入口，关闭 `WISH-028`。

2026-11-21 落地统一多图垫图装配器（`image-gen-prep.ts`）与路飞三视图标准设定图（`ref-sheet-luffy.png`）：支持按 8 类场景动态拼装多职责垫图、自动选择画幅比例、角色画风锚点（`profile.appearance.artStyle`）与防克隆/防呆板视线提示，同步接入 `image_generate` 与自主朋友圈配图。

2026-11-21 完成全仓 10 份通用提示词去 AI 味精修，并打通角色垫图参考生图管线（`loadRoleReferenceImages` + `llm/image-generation.ts` Gemini 多模态参考图附带，同步接入 `image_generate` 与自主朋友圈配图）。

2026-11-21 新增人物世界 12 切面与 15 维因子统一注册表（`companion/core/projections/surface-registry.ts`）：完整登记世界 9 面与 Chat 3 面（含氛围壁纸与 `aside` 小声蛐蛐）的状态映射关系，接入 Debug 资产目录并纳入 `arch:check` 静态门禁。

2026-11-21 精装路飞人设与千里阳光号世界并全量去 AI 味：重写路飞 Role Pack 全部身份、语气、场景与行为提示词，清零“参与人物共创”“最小可逆步骤”等机械腔，补齐 19 岁新世界篇档案、烤肉/宴会喜好与千里阳光号 4 大空间，修正日剧本“工位/咖啡馆”硬编码，并将 `B02`—`B07` Persona Eval 升级为路飞专属反 AI 味验收。

2026-11-21 落地生活引擎映射一致性与产品视觉一致性 v1：修复新角色冷启动朋友圈默认 3 天可见并在朋友圈顶部轻量展示关系阶段与可见范围；统一接入生命体征节流（疲惫/低落暂缓普通发圈与远行）与关系门控（初识不触发深夜脆弱）；15 维活人感快照（关系、节律、眼色、避重）接入朋友圈润色与日剧本；新增 `companion_change_wardrobe` 聊天换装工具；支持 Chat 氛围壁纸开关、角色头像与封面本地换图/AI 生图替换及一键恢复默认，并将当前穿着注入自主朋友圈配图锚点。

2026-11-20 完成前端全产品回流与工作区桌面稳定性总验收收口（`WISH-041` / `WISH-042` / `WISH-045`）：五大产品体验全部确认 `adopted`，Foundation 复用与工作区契约单测（16 项）及正式 Electron `onboarding.test.ts`（22/22）全绿通过，冻结最后 2 份进行中施工合同并清理心愿池历史批次流水。

2026-11-20 补齐图片观察到自动阅读感想的完整闭环（`WISH-049`）：`companion_add_reading_note` 支持基于已核对的材料观察（`observation`）与来源范围按当前人物口吻自动生成第一人称阅读感想并持久化，模型不可用或失败时拒绝写入、绝不凭书名编造。同步冻结 `prompt-coverage-and-review-v2.md` 及 12 份已完成 Playground P0 施工合同。

2026-11-20 完成主进程架构纯洁度收口（C01—C04）：统一将伙伴生活与成长领域的所有数据表 DDL 收拢至 Core `life-schema.ts`，新增 `companion-facade.ts` 收敛 `ipc/companion.ts` 的跨层依赖，修复 Debug 成长证据在 `companion_mutable_versions` 存在时漏展示材料观察尝试记录的边界，并落地 4 条静态架构防回流门禁测试。

2026-11-19 收口目标架构深度二审（B01—B12）：修复朋友圈包含主角或卡司回复时备份导出失败的问题，并将可变人格、运行态、关系、情绪、日记、信物、礼物、脆弱心境、心愿共鸣、航程、穿搭与朋友圈自动配图纳入完整备份恢复；内置领域工具在目录筛选和实际执行两处统一受 Agent Host Manifest 权限约束，主会话去重运行态上下文注入；跨世界观切换保留原主角暂停状态并恢复生活补叙，可变人格修改支持当前世界观隔离与单事务回执；统一关系阶段计算与持久化关系状态，并为数据库 Schema 初始化与高频历史账本增加实例级缓存和有界裁剪。

2026-11-18 收口目标架构审计（A01—A18）：人物世界资产增改删与换装操作统一在单事务内保存事实与命令回执，聊天生活资产与读书笔记工具支持同调用幂等复用，配图挂载失败时自动清理未落库的孤立图片文件，人物草稿读写发布与世界观切换接入执行取消信号，并扩展主进程分层架构静态门禁。

后台画像、标题和会话索引重启时继续处理原来的对话。重新执行同一条会话索引不会重复保存。

点赞和日记删除与操作回执一起保存。领取失败时停止执行对应的人物操作。

主对话回复附带的生活结算可以在应用重启后恢复。

会话按自身授权使用 Skill。后台运行在工具目录和实际调用两处统一拒绝写入工具。

日记和信物保存后的感悟归档与关系里程碑支持失败后恢复。

切换人物或世界观时取消正在运行的生活生成。窗口确认在提示真正显示后记录，保留此前已经提交的人物事实。

人物通知和会话消息可追溯到发起的执行，出站任务领取与结算使用独立事务。

自动文化反馈、信物提醒遵循生活提醒频率和静音设置，列表仍照常更新。并发问候只向聊天写入一次。

更新 Electron 和第三方依赖，验证 Markdown 图表、生图、朋友圈工具和 MCP OAuth 的正式入口。

应用接口现在统一校验调用窗口和当前页面。切换或关闭发起页面时取消聊天、模型诊断和 MCP 动态确认。

定时任务重启后仍保留原人物和到期时间。已经开始但未完成的执行会记录中断，调度继续推进。Cron 分钟通配符按下一匹配分钟运行。

工具超时和会话取消会向支持取消的执行端传递信号，可能已经发生的写入会提示先核实结果。

朋友圈发布保存失败时一并回滚动态和回执。重复处理同一条工具调用时复用已保存的发布结果。

生活时钟、关怀和朋友圈发布沿统一宿主与人物世界边界运行。

2026-11-18 修复切换人物中途退出或摘要等待期间再次切换时，可能丢失生活补叙或由旧补叙改写暂停状态的问题。

2026-11-18 修复切换世界观中途保存失败时，世界观选择和人物暂停状态可能留下部分改动的问题。

2026-11-18 修复等待人格反思模型返回时切换人物或世界观，旧结果仍可能改写人物状态的问题。人格版本与冷却同时保存。

2026-11-18 修复主对话刚回复完就退出时，可能丢失人格反思触发的问题。重启后保留原对话来源，并按既有成长门槛判断是否反思。

2026-11-18 修复退出应用可能丢失人物已选定的朋友圈延迟回复的问题。待回复会在原人物和世界观下恢复。

2026-11-18 修复文化体验刚完成就退出时，随体验发放的信物可能永久丢失的问题。

2026-11-18 修复聊天工具发表朋友圈评论后，可能把另一条评论的回复当成本次结果的问题。

2026-11-18 修复两个会话同时给同一本书追加阅读笔记时可能丢失一条的问题。

2026-11-18 修复切换人物或世界观后，旧人物命令仍可能提交迟到生成结果的问题。

2026-11-18 修复人物后续任务失去执行权后仍可能写入本地事实的问题。

2026-11-18 工具取消后会中止等待中的 Git 子进程请求，记忆和任务计划写入前复核取消状态。

2026-11-18 修复后台任务保存失败仍继续运行、没有窗口时丢失完成通知的问题。重启后继续恢复未确认通知，重复投递按任务去重，重试次数和等待时间可以保留。

2026-11-18 修复查看人物状态时隐式创建默认运行态的问题，查询会等待正在提交的本地事务，避免展示尚未提交的状态。

2026-11-18 修复关怀提醒在人物之间互相影响、失败后无法及时重试和重启丢失冷却的问题，近期熬夜记录可以进入次日日程规划。

2026-11-17 修复并行对话互相覆盖 Skill 和任务计划的问题。任务计划保存失败会明确返回失败，应用重启后恢复已保存计划。

2026-11-17：修复会话工具目录重新取得默认宽权限的问题，实际执行复核当前完整 Manifest，关闭同名内置朋友圈和模型调用隐藏工具的授权旁路。

2026-11-17：修复事务已提交但磁盘保存失败后的状态分叉，关闭异常数据库并提示检查磁盘后重启，保证后续操作不会保存已报告失败的事实。

2026-11-17：人物世界存储统一迁入 Core，移除运行态镜像。修复本地事务提交未落盘和并发回滚问题、失败命令并发重试、Headless 误报成功，并统一自动生活提醒预算。

2026-11-15：Companion 执行账本增加崩溃恢复。超过租约窗口的 `running` 记录会在下一次命令读取前转为 `retryable` 并记录中断原因，同一幂等命令可以安全恢复重试。
2026-11-15：Agent Host Context Provider 接入统一权限门禁。`requires` 不满足时不进入会话环境，实际读取再次校验 Agent 身份和权限。
2026-11-15：Companion Application Gateway 收口旧生活表边界。日剧本和生活事件分别通过 Read Model 与 Projection Adapter 访问旧表，避免 Application 层重新形成旁路。
2026-11-15：朋友圈图片关联收口到迁移边界。图片目标读取走 Legacy Read Model，事件链接写入走 Projection Adapter 与本地 Unit of Work。
2026-11-15：Core Runtime State 收口旧状态镜像边界。核心状态回填和 `role_state` 镜像更新改走统一 Read Model / Projection Adapter。
2026-11-15：生活引擎旧查询边界继续收口。日剧本补齐和朋友圈发布流程改用 Legacy Read Model 读取旧事件与动态。
2026-11-15：日内重排服务改用 Legacy Read Model 查询待处理事件，清理旧 store 的生产查询旁路。
2026-11-15：Scheduler Headless 执行接入统一上下文。每个调度时刻拥有稳定 trace / 幂等键和独立 runId，并沿 trace context 进入 Agent Runtime。
2026-11-15：Headless Runtime 接入 Agent Host Capability 注册，后台会话沿用 Manifest 筛选、Capability 权限和只读自动批准边界。
2026-11-16：后台任务恢复接入类型处理器。可重建任务会从持久化会话恢复执行，无法恢复的任务进入失败态并发送一次幂等通知；人物世界 Outbox 同步启用 `max_attempts` 上限，达到上限的过期租约会落为终态失败。
2026-11-16：同步后台任务恢复注释与实际终态行为，明确不可恢复任务不会停留在 pending。

2026-11-14：顶层架构继续收口。Core Runtime State 承载 `lastTickAt`，生活 tick、catch-up、Debug 和世界快照统一使用核心生命周期状态。
2026-11-14：Companion 只读迁移边界继续收口。通讯录、卡司可用性、生活信号、穿搭、旅行推进、日程时间线、反思、事件切片、生活时钟和世界体征刷新统一经过 Core 只读适配层。
2026-11-14：赠礼写入闭环收口。礼物事实、主会话 Outbox、领域事件、体征更新和通知 Outbox 在同一本地事务中提交，投递延迟到提交后。
2026-11-14：顶层架构审计补充 P1 写入清单，明确文化心愿完成、朋友圈投影、专属信物、重编排和互动反馈仍需完成事实与 Core 账本的事务闭环。
2026-11-14：专属信物写入闭环收口。信物记录、主会话 Outbox、领域事件和通知 Outbox 在同一事务中提交，失败不会留下半成品。
2026-11-14：文化心愿完成、朋友圈投影、文化心愿生成的动态和自动回复继续收口到本地事务，关系与情绪投影、动态关联、投影回执和回复通知按提交边界保持一致。
2026-11-14：朋友圈事件发布收尾统一提交事件状态和执行账本，投影失败时保留 planned 状态用于重试。
2026-11-14：日剧本和生活事件的生产写入迁移到 Application Gateway，并同步登记 Core Domain Event，旧事件表保留为查询投影。
2026-11-14：生活 tick、生活信号、自动穿搭和旅行推进改读 Core Runtime State，旧角色状态表只保留迁移期镜像。
2026-11-14：pause、resume、catch-up 和 tick 停止写旧角色状态表的生命周期字段，Core Runtime State 成为唯一生命周期写入来源。
2026-11-14：Runtime 的伙伴角色校验、卡司在场、召唤场景、委派提示和流式门控入口统一经过 Conversation Application Service。
2026-11-14：朋友圈、关系、情绪、事件关联和执行记录的旧查询投影写入统一经过 Core Projection Adapter。

2026-11-14：内容完整性管线完成。新增共享 `ContentProvenance` 来源协议和领域事件校验，事件通知附加来源证据，日记保存来源类型、来源 ID 与 trace，Debug Read Model 展示 provenance，避免无来源或跨角色内容进入人物世界事实链。

2026-11-14：内容完整性继续收口。Memory 持久化来源证据，用户、人物 Tool、画像提炼、引用纠错和深夜反思统一标记来源；Registered Model Request 冻结动态 Prompt 上下文的来源、作用域和长度元数据。

2026-11-14：内容完整性全链路收口完成。Memory 和 Prompt 动态上下文完成来源证据接入，来源元数据与自然语言正文分离，跨入口内容链路沿既有 Companion、Memory、Prompt 和 Debug 事实源验证。

2026-11-14：顶层架构 P0 权限门禁落地。Agent Host Manifest 声明 Capability 授权权限，Application Workflow 与 Capability Tool Adapter 在执行前统一校验 `requiredPermissions`，固定 Workflow 不再绕过 Host 层权限声明。

2026-11-14：Companion Core 迁移边界收口。Runtime 组装器和 Debug 世界快照的旧生活表读取统一经过只读 `legacy-companion-read-model` 适配层，为后续 Core Read Model 替换集中迁移入口。

2026-11-14：Companion Core Runtime State 扩展暂停时间和追赶摘要。角色切换、主会话组装和 Debug 生命周期读取优先使用核心快照，pause、resume、catch-up 会同步更新 Core State。

2026-11-14：Runtime 与 Application 边界继续收口。角色组装输入改由 ConversationApplicationService 提供，Runtime 保留会话生命周期和 Agent Loop 编排。

2026-11-14：Agent Host 收口批次完成。会话工具目录统一在 Scoped Tool Catalog 内同时应用 Manifest 授权和 Skill allowlist，Debug 增加 Skill 版本、指纹、启停状态和 Capability 关系证据，Companion 入口继续沿统一 Application / Domain / Event / Outbox 事实链执行。

2026-11-14：Agent Host 架构施工合同完成并冻结。Manifest 统一经过版本化 loader，Persona、Memory、Companion、Workspace 通过 Domain / Capability Registry 接入；Scoped Tool Catalog 按当前 Agent 授权筛选模型能力；生活时钟通过 Host Workflow 进入统一 Application 编排；对话关系阶段与里程碑读取归入 Conversation Application Service；Capability 激活证据按 Agent 隔离，Context Provider 按 `scope + source` 去重。

2026-11-10：日记改为“日记册 → 信件详情”两层阅读，列表只保留封面、标题、日期和摘要，完整正文与感悟进入详情页，并使用阅读字体和返回日记册路径。

2026-11-10：收敛日记与专属信物样式：连续列表改用轻背景与底部分隔，减少卡片边框、阴影和重复引用层级，和朋友圈、文化角、衣柜保持同一浏览节奏。

2026-11-10：人物世界信息架构收敛：移除“共同决策”正式 Tab、Playground 候选和对应展示组件；共同决策后端引擎暂保留为生活因果链内部能力。日记与专属信物继续作为独立生活面，不并入文化角或家居。

2026-11-10：人物世界模块一致性收口：日记、专属信物与共同决策统一使用通用入口名称，角色专属世界观不再改变产品导航标签；三个面板的正式读取失败均提供统一错误提示与重试入口；补齐人物世界导航 E2E 夹具的今日轨迹 IPC，并校正九分区键盘导航断言；面板视觉样式改用共享圆角与颜色令牌，信物筛选复用 Foundation TabStrip，卡片信息密度向朋友圈与衣柜收拢。

2026-11-10：日内因果重编排与宿主现实作息感知（Intra-day Causality & Real-world Care Anchor）落地：新增 `replan.ts`、`host-presence.ts` 与 `LifeCausalityCandidate.tsx`；解决日内体征剧烈耗竭（`energy <= 25` 或 `mood <= 20`）、突发脆弱（vulnerability）或重大共同决断后的生活脱节问题，`replanRemainingSlots` 提取今日未开始的 `planned` 事件，通过受控配方 `compileReplanSlotsRequest`（Prompt Key: `companionReplanSlots`）将后续计划重编排为休养、平复活动，并将因果追溯元数据 `causedBy` 写入事件 payload，触发 `companion:slots-replanned` 与 `companion:timeline-updated` 广播；新增宿主现实作息感知（`host-presence.ts`），利用 `powerMonitor.getSystemIdleTime()` 与会话交互时序无感监测专注工作时长，连续专注 >= 120 分钟触发疲劳关怀（`fatigue_break`，3 小时冷却），深夜 23:30~05:00 仍持续活跃触发深夜睡眠关怀（`late_night_sleep`，6 小时冷却）；关怀私语通过受控配方 `compileHostCareRequest`（Prompt Key: `companionHostCare`）生成并直接写入角色主会话（`sessionKind: 'main'`），并广播 `companion:host-care-triggered`；宿主深夜加班线索在次日由 `script-generator.ts#collectDayScriptLifeContext` 吸收为日剧本上下文，实现生活引擎对现实世界的双向锚定；新增 Playground 隔离展厅候选 `LifeCausalityCandidate.tsx` 具备 4 种离线因果与作息交互形态；IPC 4 处同步新增 `getHostPresenceStatus`、`triggerHostCareCheck`、`replanTodaySlots` 通道；`prompt-feature-contracts.test.ts` 扩展至 26 个核心功能合同。新增 `life-replan.test.ts`（5 项）与 `host-presence.test.ts`（5 项）单测，门禁全绿。

2026-11-10：多角色专属头像体系与空间氛围横幅（Companion Avatars & Atmospheric Banners）落地：角色专属视觉体系与沉浸氛围空间落地；出厂为路飞（`luffy`）、索隆（`zoro`）、娜美（`nami`）、山治（`sanji`）、乌索普（`usopp`）建立专属 1:1 高清立绘头像资产（`avatar-v1.png`），并为小林（`lin`）补齐展厅候选头像；角色包（Role Pack）支持配置 `avatarVisualPath`、`bannerVisualPath` 与 `themeColor`，主进程加载器 `loader.ts` 结合 `resolveRoleAssetFilePath` 提供内存缓存与 base64 转换；通过统一的 `CompanionAvatar` 组件彻底取代散落的 `<Bot />` 机器人图标与单调单字方块，全线贯通 Chat 欢迎屏主角大头像、消息流回复气泡、人物世界 Header、主侧栏同行伙伴标识以及朋友圈动态卡片；人物世界顶栏升级为沉浸式宽幅生活封面（`WorldProfileHeader`，如路飞万里阳光号甲板出航横幅），配合半透明暗角与磨砂卡片实现个人主页感；Chat 消息背景（`CompanionSceneBackdrop`）引入可控弱场景氛围壁纸（透光度 ~9%、轻度微模糊与暗角），在兼顾文本极高可读性的同时打破对话界面的冰冷感；IPC 4 处同步新增 `companion:get-role-visuals` 通道；UI 组件注册表登记 `companion.companion-avatar` 资产。新增 `companion-role-visuals.test.ts` 5 项单测，门禁全绿。

2026-11-09：专属物品赠送与羁绊好感（Companion Gifting & Bond Progression）落地：新增 `gifting.ts`、`companion_received_gifts` 表、`GiftGivingModal` 弹窗与 `GiftingExperienceCandidate` 样张；用户可主动挑选美食、收藏、实用或情感礼物并附带心里话寄语送给伙伴（路飞对带骨烤肉与神秘海图具有最爱偏好）；角色依据偏好由受控配方 `compileGiftReactionRequest`（或人设保底）生成第一人称开箱喜悦回响，即刻存入主会话作为 assistant 消息留痕，联动恢复角色生命体征（mood/energy/satiety），并记录 `gift_received` 关系成长里程碑及全窗口广播；人物世界信物面板（`WorldKeepsakesPanel`）升级为双模视图（【伙伴信物】与【心意手账】）；资产目录登记 `companion:policy:gifting` 生产策略资产，`prompt-feature-contracts.test.ts` 扩展至 24 个核心功能合同。新增 `gifting.test.ts` 5 项单测，门禁全绿。

2026-11-09：深夜反思与高光回忆重温（Nightly Reflection & Nostalgic Reminiscence）落地：角色深夜反思自省（`nightly-reflection.ts`）与高光回忆重温（`nostalgia.ts`）双向闭环落地；角色在夜深人静（22:00～04:00）独处看海时，回顾白天的生活事件与近期用户对话线索，由受控配方 `compileNightlyReflectionRequest` 生成第一人称深情独白，存入 SQLite `companion_inner_thoughts`（标记 `thought_type: 'nightly_reflection'` 与自动星标）；日记提炼出的心灵感悟（`epiphany`）同步调用 `addMemory('feedback', ...)` 存入长期记忆的“我们之间”分桶，实现情感与认知的持久成长；高光回忆重温引擎（`nostalgia.ts`）在主会话装配前夕（`orchestrator.ts`）从长期记忆 feedback、信物和日记中提取高光回忆切片，经 4 小时冷却保护注入 `formatConversationImpulseForPrompt` 作为【高光回忆羁绊】生活切片话头，引导角色在闲聊时像真人老友一样自然带出共同回忆；人物世界航海日记面板（`WorldJournalPanel`）新增「🌙 深夜反思」专属高光徽章与感悟气泡框，提供「与TA聊聊这篇深夜感悟」直通主会话；Playground 展厅对应新增 `nightly` 状态样张；资产目录登记 `companion:policy:nightly-reflection` 与 `companion:policy:nostalgic-reminiscence`，`prompt-feature-contracts.test.ts` 扩展至 22 个核心功能合同。新增 `nightly-reflection.test.ts`（3 项）与 `nostalgia.test.ts`（5 项）单测，门禁全绿。

2026-11-09：心境波动与突发小情绪（Mood Swings & Vulnerability Moments）落地：新增 `vulnerability.ts`、`companion_vulnerability_moments` 表与 `VulnerabilityCard` 组件；角色在夜深独处（22:00~03:00）、航程风暴脱力或生活挫折时向用户流露深层自白与心事（SQLite `companion_vulnerability_moments`，同一角色同时最多 1 个未安抚的 active 脆弱心境）；出厂为路飞自动播种关于同伴誓言与草帽寄托的经典脆弱心境，并配套草帽誓言、雨夜疲惫、脱力等丰富模板库；用户在人物世界手账日志面（`WorldJournalPanel`）通过交互卡片（`VulnerabilityCard`）给予预设温暖心语或自定义安慰后，受控小模型配方 `compileVulnerabilityReactionRequest`（或规则保底）生成第一人称真诚释怀回响，直接写入主会话作为 assistant 消息，记录 `vulnerability_comforted` 关系成长里程碑并广播全窗口；同步提供 Playground 展厅候选 `VulnerabilityExperienceCandidate` 具备 5 种离线交互形态；资产目录登记 `companion:policy:vulnerability-moments` 生产策略资产，`prompt-feature-contracts.test.ts` 扩展至 22 个核心功能合同。新增 `vulnerability.test.ts` 5 项单测，门禁全绿。

2026-11-09：任务工作区会话持久化与伙伴直通协同（Workspace Session Continuity & Companion Integration）落地：升级 SQLite 会话存储至 schema 25，新增 `parent_session_id` 列并索引；新增 `session:getOrCreateWorkspace` 与 `session:clearWorkspace` IPC，工作区侧聊由临时销毁型会话转变为与主会话深度绑定的持久会话，收起折叠右坞、隐藏或切换视图不再销毁工程讨论记录；切换主会话时自动切换对应讨论上下文；侧聊顶栏提供快捷「新起侧聊」清空入口；审阅面板（`ReviewPanel`）与终端面板（`TerminalPanel`）全面接入 `onTakeToChat`，支持一键将代码改动与终端成功结果直达主会话并自动聚焦，打破冰冷工程工具与热血伙伴陪伴之间的隔阂。

2026-11-09：足迹与航海旅行自主演化（Travel Journey Progression）落地：新增 `travel-progression.ts` 与 `companion_travel_progressions` 表；角色在日常生活推进（Life Ticker）中结合航程时间沉淀（24 小时冷却）与主会话共鸣沉淀的 `travel_wish` 心愿，自主演化航海经停站点（包含站名、日期、第一人称见闻故事与触发原因）；自动向 SQLite `companion_assets` 的 active trip 追加站点并联动完成对应共鸣心愿；主会话 Prompt 生活切片同步感知最新到访站点；新增 IPC `companion:list-travel-progressions`、`companion:trigger-travel-progression` 与 `companion:travel-progressed` 广播通道；资产目录登记 `companion:policy:travel-progression` 生产策略资产。

2026-11-09：同伴求助与生活共同决策（Co-Decisions & Shared Choices）落地：新增 `co-decision.ts`、`companion_co_decisions` 表与 `WorldDecisionsPanel` 面板；角色在面临航向分歧、重大选择或生活困境时向用户发起求助（SQLite `companion_co_decisions`，同一角色同时最多 1 个待决困境）；用户决断后，角色即时生成第一人称回响（受控配方 `coDecisionReaction`），存入主会话作为 assistant 消息并广播 `companion:co-decision-resolved` 与 `companion:timeline-updated`；决断结果作为因果线索通过 `collectDayScriptLifeContext` 注入次日剧本，真实左右明天的生活活动与足迹；人物世界新增「共同决策」Tab（`WorldDecisionsPanel` 与 `CoDecisionCard`），Playground 对应接入 `CoDecisionExperienceCandidate`；资产目录登记 `companion:policy:co-decision` 生产策略资产，`prompt-feature-contracts.test.ts` 扩展至 21 个核心功能合同。新增 `co-decision.test.ts` 5 项单测，门禁全绿。

2026-11-09：衣柜与穿搭自主演化（Autonomous Contextual Dressing）落地：角色衣柜与穿搭自主演化引擎落地（`autonomous-dressing.ts`）；在生活推进调度（Life Ticker）中结合日程活动（日剧本 theme/slots）、当日时段（清晨 06:00~10:00 起床 routine）以及当前衣柜资产，挑选适宜的套装或单品；冷启或初始无穿着状态时，角色自主穿戴好整齐的日常套装（例如路飞穿上经典的《草帽冒险日常装》），消除未穿着空白；严格调用既有 `changeWardrobe` 原子换装核心方法，保证槽位校验、穿搭版本递增以及受控图片同步继承；健全的门控防线：每日频次上限（2 次）、冷却时间（4 小时）以及用户手动换装保护（近 2 小时用户手动选择绝不覆盖）；换装成功后广播 `companion:timeline-updated` 与 `companion:wardrobe-changed`，前端人物世界衣柜画廊即时刷新，主会话提示词（`formatLifeAssetsSliceForPrompt`）自然体现当前穿着；资产目录新增 `companion:policy:autonomous-dressing` 生产策略资产。

2026-11-09：人物世界四大生活维度施工合同收口与冻结：将文化角四类生活（`culture-corner-v1.md`）、足迹旅行记录（`footprints-travel-v1.md`）、家居空间与物件（`home-spaces-v1.md`）及衣柜与穿搭系统（`wardrobe-clothing-system-v1.md`）四份施工合同生命周期正式转为「已完成施工快照（冻结）」，明确其在人物世界生活面、双向跳转、生活切片感知及真实生产数据链的落地闭环，同步更新施工合同索引并跑通文档一致性门禁。

2026-11-09：补齐人物世界「航海日记」与「专属信物」Playground 隔离候选样张（ExperienceCandidate）：创建 `JournalExperienceCandidate` 与 `KeepsakesExperienceCandidate`，提供多状态离线样张（默认清单、星标/精简、长正文排版伸缩、空日记/空信物架、读取失败重试）；生产面板（`WorldJournalPanel`、`WorldKeepsakesPanel`）扩展 `previewThoughts` / `previewKeepsakes` 属性，在离线样张模式下跳过主进程 IPC 查询与广播订阅，支持纯前端内存增删改与筛选；在 `SurfaceBaselinePanel` 的 `previewPanels` 中完成挂载，并通过 UI 组件注册表、产品体验注册表与资产治理全套门禁。

2026-11-08：羁绊深度跃迁与专属信物馈赠（Relationship Progression & Keepsake Gifts）落地：角色与用户建立具有实感物化与情感温度的信物系统（`relationship-keepsake.ts`）；信物包含初识、心愿共鸣兑现、深厚羁绊与深度长线专属四级梯度，与文化心愿完成和成长里程碑深度联动（完成共读/共赏心愿自动赠予「梅利号的小羊金色铃铛」）；支持通过受控配方 `compileKeepsakeGiftRequest`（或预设目录/规则保底）生成第一人称赠礼独白，赠礼消息直接作为 `assistant` 消息写入主会话并记录成长里程碑（`keepsake_gifted`）；人物世界（`WorldHub`）新增「专属信物」（`WorldKeepsakesPanel`）展架，卡片呈现场景背景、专属寄语与「触摸信物·与TA聊聊」快捷跳转；出厂为路飞播种「生命卡的一角」；IPC 广播 `companion:keepsake-gifted`，桌面端横幅提醒点击一键跳转信物展架。

2026-11-08：私密内心独白与航海日记（Inner Thoughts & Private Journal Stream）落地：角色私密内心世界与航海日记流落地（`inner-thoughts.ts`）；独立于公开展览的朋友圈与即时对话，角色在独处、夜间或清晨放空时产生对伙伴、旅途与羁绊的真情实感，经每日上限 2 次与 6 小时冷却门控，通过受控配方 `compileInnerThoughtRequest`（或规则保底）生成第一人称私密随笔；出厂自动为路飞播种 3 篇具情感羁绊的 starter 日记；人物世界（`WorldHub`）新增 `journal` 分区（`WorldJournalPanel`），支持实时广播更新、星标收藏与删除，并支持一键将日记契机回引至主对话（「与TA聊聊这篇日记」）。

2026-11-08：突发生活意图与主动找聊（Spontaneous Impulse & Proactive Conversation Outreach）落地：角色在生活世界推进中结合社交渴望度（`socialNeed >= 70`）或特定生活活动，受每日上限 2 次、冷却 3 小时与夜间勿扰约束，由受控配方 `compileSpontaneousImpulseRequest`（或规则保底）生成生动的第一人称即兴搭话消息；主动搭话直接作为 `assistant` 消息写入该角色的主会话，并广播 `companion:spontaneous-impulse`；桌面端 Toast 提醒点击可一键直达会话，若当前正处于该会话则即时推入新消息，提供真实伙伴突发找聊的活人感陪伴。

2026-11-08：文化心愿体验闭环与主动反馈（Culture Progression & Review Loop）落地：文化心愿在被日剧本吸收并满足体验时长后，自动触发 `completeCultureResonance`，通过受控小模型配方（`compileCultureReviewRequest`）以第一人称口吻生成专属评语（`reviewText`）与对话引子（`chatOpener`）；文化资产推进为 `finished` 并将感悟追加进 `readingNotes`；主会话组装器在 `formatConversationImpulseForPrompt` 中注入 `【重要回访心愿反馈】`，角色在后续对话中会主动向用户倾诉体验感悟并在送达后标记已投递（`markResonanceFeedbackDelivered`）；IPC 广播 `companion:resonance-completed`，桌面端支持通知横幅点击一键直达文化角。

2026-11-08：Foundation 布局规范与控件复用链路获批回流（Phase P1）：共享 PageHeader 扩展 topMeta 接口将长文件路径移至首行标题右侧，第二行基础引用胶囊全宽展开并引入 .no-scrollbar 隐藏滚动条，保留滚轮直接横向平滑滚动；TS AST 源码门禁全面生效。

2026-11-08：生活时钟事件实时驱动（Timeline Dynamic Clock Trigger）落地：后台 Ticker 调度从静态轮询升级为事件时刻动态对齐唤醒，消除固定轮询带来的事件感知滞后；事件物化与推进后广播 `companion:timeline-updated`；`WorldTodayTimeline` 组件接入事件广播与分钟级心跳，使今日生活时段轨迹（past / current / upcoming）与进行中事项在桌面端实时无感平滑推移。

2026-11-08：朋友圈未读感知与角标反馈（Moments Notification & Badge）落地：新增全局未读朋友圈动态与回复计数状态；在 `PrimarySidebar` 底栏「人物世界」与 `WorldHub`「朋友圈」TabStrip 呈现未读徽标（支持 99+ 截断），用户进入朋友圈后自动清零；Toast 提示支持点击一键直达朋友圈；`MomentsPanel` 挂载时监听 `companion:onMomentUpdated` 与 `onMomentTip`，后台回复或新动态到达时实时静默刷新列表。

2026-11-08：主会话到生活因果反哺（Chat to Life Resonance）落地：在主会话结算时异步提取用户推荐的文化作品（书/影/音）或美食、地点生活心愿，自动在文化角创建 planned / queued 待体验资产并在 SQLite 持久化为活跃心愿；次日日剧本自动吸收近期心愿至日程上下文（absorbed_in_script），形成对话直接改变角色生活的因果闭环；桌面端支持在心愿创建时弹出轻量通知并可一键跳转文化角。

2026-11-08：朋友圈评论回复与人物/NPC 自主回复决策落地：用户支持回复在场 NPC 评论与评论区多级回复，界面对齐微信交互（点击评论行本身直接进入定向回复，不设冗余回复按钮），输入框自动聚焦并切换「回复 @某某：」占位符，支持退格或切换一键重置；人物与在场 NPC 自主决定是否回复、由谁回复及延迟多长时间（动态决策不写死），延迟到达后自动落库并广播通知前端更新。

2026-11-08：今日生活轨迹、生活面双向连通与消息流自主生活卡片落地：新增 `companion:get-today-timeline` 与 `WorldTodayTimeline` 组件，在人物世界呈现角色一日主题与进行中生活时段；朋友圈、文化角作品和旅行足迹新增「和TA聊聊」快捷跳转，点击平滑直达对话并预填对应话题；Chat 消息流针对模型自主调用伙伴生活工具接入行内生活卡片与一键反跳生活面。

2026-11-08：跨天因果日剧本、主对话交谈冲动与主动问候真实入会话落地：日剧本提示词接入昨日实际事件、当前旅行足迹、体征与近 24 小时用户诉求；主对话提示词扩展 `conversationImpulse`（插槽 31），闲聊时自然分享近期生活见闻与想法；主动问候投递时自动在角色主会话中保存为 `assistant` 消息，Toast 点击一键平滑直达该会话。

2026-11-08：四大体验候选（Chat、人物世界、设置、工作区）全面收口原生交互控件，接入 Foundation `SelectField`、`TextField`、`ActionButton`、`IconButton` 等基础组件；新增 TypeScript AST 源码级自动化门禁（`foundation-enforcement-gate.test.ts`）纳入 `npm run assets:check`，严格校验符号解析真实性、拦截未授权原生标签及冲突居中布局，通过 5 组负例保证 fail-closed。

2026-11-08：主对话装配管线接入 `lifeAssetsSlice`，将当前穿着单品、文化角在读 / 在看 / 在听进度及进行中的旅行航线有界注入 Prompt，解决角色对自身衣物、作品和足迹缺乏感知的问题；新增角色生命体征演化引擎（`world-vitals.ts`），使 `mood`、`energy` 和 `socialNeed` 随已发布生活事件自然波动并向基线回归，主对话交互后自动释放 `socialNeed`。

2026-11-08：补齐核心 Prompt、Role Pack 资产与追踪投影的 `featureKey` / `adaptationStatus` 关系标签，完成路飞与隔离测试人物全套四层 Prompt 组合及防覆盖门禁验证，并冻结 `prompt-layered-composition-v1`、`character-system-extension-v1`、`character-design-method-v1`、`companion-material-grounding-v1` 四份施工合同。

2026-11-08：补齐路飞人物世界「文化角」「旅行足迹」与「出场朋友圈」初始内容及 6 张专属插画：新增四类文化记录（奇异生物图鉴、空岛映像贝、宾克斯的美酒、船头夕阳草帽）、三段多站点旅行故事（东海启航、空岛黄金钟、千里阳光号巡航）与两条带配图和伙伴互动的出场朋友圈动态，旧库支持无损升级且备份导出导入保持幂等。

2026-11-08：补齐正式角色架切换世界观时的宿主活跃主角同步回调，完成角色架 UI 世界观切换、跨世界生活资产与生产目录隔离及重载恢复的真实 Electron E2E 验收，并冻结已完工的四份人物与世界观施工合同。

2026-11-07：修复人物世界出厂静态 `visualPath` 配图在数据导出时计入 16MB 生成媒体上限的问题；未改动的 Role Pack 出厂配图导出时省略本地 `payload.image`，导入后自动从 Role Pack 恢复本地图片引用与穿搭版本号，同时收口全量 13 个真实 Electron E2E 测试文件（46 项用例）。

2026-11-07：路飞出厂初始化包补齐草帽、红背心、深蓝短裤、甲板凉鞋与高处足迹 5 张 PNG，连同既有千里阳光号船景、室内空间和初始穿搭共 8 张视觉资产统一在 `ensureStarterAssets('luffy')` 时落入受控图片目录并挂载 `payload.image`；同时新增共享甲板空间资产播种、草帽空间关联与可一键换上的《草帽冒险日常装》套装（不预写当前穿着），旧库支持无损补图。

2026-11-07：主进程 TypeScript 门禁收口；Electron、Eval 和共享源码纳入独立检查，`typecheck` 与 `build` 均强制执行，修复存量诊断并关闭 WISH-043。

2026-11-07：阅读材料新增观察 / 推断分离。`companion_observe_material` 只对当前会话图片生成候选观察，不自动写回人物世界；人物阅读笔记写回继续要求明确来源和记录者，Debug / 反思显示同一结构。

2026-11-07：阅读笔记写回增加确认主体 / 时间；图片观察保存有界失败与成功尝试证据，Debug 可追溯但不保存图片二进制。

2026-11-07：自动朋友圈配图描述复用当前世界态的地点、活动和叙事心情，减少对话、动态与图片之间的状态穿帮；不注入内部数值。

2026-11-07：Debug 世界态增加关系连续性内部信号展示，人物世界头部新增“看数字 / 看描述”切换；默认保持自然语言，数字只读且不进入 Chat 或设置。

2026-11-07：情绪事件按来源生活事件幂等，重复投影不再重复累加同一情绪线索。

2026-11-07：关系变化新增独立历史记录与来源事件幂等，Debug 世界态可展开查看近期关系依据；当前关系快照和用户可见文案保持原语义。

2026-11-07：自主配图增加人物 / 事件级幂等；重复 ticker 或重启不重复调用生图，已存图片直接复用，既有失败 / 跳过尝试不自动重试。

2026-11-07：朋友圈自动发布策略正式进入「伙伴与相处」设置；节奏、上限、冷却、勿扰、自动配图预算与自动互动均可配置，默认自动配图仍关闭。

2026-11-06：保留朋友圈设置入口，新增“跟随人物状态”默认策略；关系阶段按陌生 / 熟悉 / 融洽映射 3 / 7 / 14 天窗口，用户仍可设最近三天上限或仅人物自己可见，Debug 世界态显示当前实际窗口。

2026-10-31：默认世界观显式登记路飞主角与四位朋友角色；Debug 人物筛选显示主角 / 朋友标签，Prompt 功能合同资产增加人物适配状态元数据。世界观切换与用户生成人物流程继续施工。

2026-10-31：新增运行时人物制作 Skill 与 `companion_character_draft` 草稿工具，用户可以在聊天中分区整理人物体系并提交开发者审阅；草稿不直接发布生产人物。

2026-10-31：Debug 提示词目录增加“其他定义 / 待归类”兜底，未能按登记用途归组的资产保持可见、可搜索、可审阅。

2026-10-31：审阅后的人物草稿可以发布为用户世界观套装；新增世界观列表与受控切换工具，发布人物使用世界观前缀内部 ID，切换失败尽力恢复旧世界 / 主角组合。

2026-10-31：细化人物工具确认粒度，草稿整理和世界观查询不再误触发破坏性确认；发布与切换仍保留确认门。

2026-10-31：Debug 模型上下文资产目录改为跟随当前 `universeId` 聚合伙伴资产，用户发布的世界观不再被默认世界目录遮蔽。

2026-10-31：角色架增加世界观选择器，用户发布的 Universe 可从正式入口切换；切换沿主进程门闸绑定默认主角并刷新角色架。

2026-10-31：角色架在隔离桥接缺失时保留原角色列表回路，避免测试夹具因新增世界观入口而误显示空数据。
2026-10-31：人物制作 Skill 增加通用人物设计方法；草稿支持戏剧驱动力、行为决策、首次冷启和三条连续性。路飞首次欢迎使用人物自我介绍与名言，既有经历、当前状态和用户共同经历分开登记，Debug 目录可追踪对应来源。
2026-10-31：首次冷启状态按人物持久化，首次建立关系才展示人物宣言；后续新聊天继续沿用普通欢迎，不重复播放名言。
2026-10-31：新增世界观经历库与人物视角资产，补充“艾尼路篇章”结构化样本；人物主动提到本地缺失经历时可搜索公开资料，外部证据默认不写入长期记忆。
2026-10-31：经历库补充主要篇章索引，从东海、阿拉巴斯坦、空岛一路覆盖到最终篇；具体事件仍按用户提问逐篇搜索和确认。
2026-10-31：新增草帽团十人及主要相关人物索引，按主线关系标记核心 / 相关 / 按需检索层；未建立 Role Pack 的人物只作为经历资料，不进入当前可召唤卡司。
2026-10-31：修复人物体系 Skill 激活时 Chat 工具被过度过滤的问题；世界观切换、朋友圈发布 / 评论和生活资产创建现在继续对人物共创流程可见。

2026-10-31：补充世界观切换主进程正反例，验证用户世界发布后绑定默认主角，未知世界保持原世界与人物设置。

2026-10-31：朋友圈动态评论、召唤上下文、子 Agent 角色、Skill 激活和工具结果安全提示接入四层 Prompt 组合；新增工具结果安全资产注册，模型请求来源可追踪到安全锚点。工具 schema 与调用结果保持结构化注入，不复制平行正文。

2026-10-31：主对话与上下文压缩开始使用分层 Prompt 组合；人物适配和运行时情境与主编译器 / 压缩协议分开记录。

2026-10-31：功能合同扩展到主对话、上下文压缩、人物召唤、子任务、Skill 和工具协作，统一记录人物可覆盖边界、运行时输入、输出协议和失败处理。

2026-10-31：日程、朋友圈动态润色、暂停补叙和人物反思纳入分层功能合同；路飞行为增量进入人物适配层，生活事实保持运行时资料身份。

2026-10-31：生图与用户画像提炼接入分层 Prompt 组合；生图保留用户描述并单独注入人物外观，画像提炼把用户对话作为运行时资料并明确排除人物事实。

2026-10-31：朋友圈主角回复与主动问候开始使用分层 Prompt 组合器；人物简介作为适配层，动态 / 评论作为运行时资料，通用功能协议与平台约束独立呈现。

2026-10-31：启动 Prompt 分层组合改造，新增功能合同事实源和首批四个功能合同；Debug 目录可读取合同目的、输入、人物覆盖边界、输出与回退信息。

2026-10-30：路飞全旅程施工合同冻结为完成施工快照，固定本轮已验证的人物、生活、Chat、Prompt、Debug 和测试边界；外部模型质量与独立 P2 能力继续单列。

2026-10-30：新增路飞 Chat 本地协议回环验收，覆盖模型工具可见性、Runtime 工具调用、朋友圈事件持久化和人物世界读取。

2026-10-30：新增路飞全旅程生产验收矩阵，集中守住人物身份、世界、关系、衣柜、Chat 工具、Prompt 注册和 Debug 目录之间的同源关系。

2026-10-30：Chat 新增 `companion_comment_moment`，把已有朋友圈评论与主角回复链暴露给统一内置工具注册；评论归属当前人物，失败回退沿正式生活服务执行。

2026-10-27：生产提示词与人物文件登记稳定用途，补已登记配方必须有真实调用的防空壳门禁；清理未消费的重复 Eval 消息签发入口，真实 Eval 与隔离检查保留。正式提示词管理器布局未变化。

2026-10-27：删除默认宇宙旧人物生产 Role Pack，建立唯一首个人物路飞；同步默认主角入口、关系边界、人物档案、世界骨架和行为差异。旧人物只作为测试夹具保留，人物制作循环沉淀到 `character-system-builder` skill；未确认的原作经历、关系和视觉细节不写成系统事实。

2026-10-27：朋友圈用户评论接入主角回复链；回复使用独立社交 Prompt，保存主角作者和父评论关系，失败不影响用户评论。提示词目录新增社交 / 视觉用途分组，正式 Debug 布局保持不变。

2026-10-27：主动问候在既有投递门闸通过后支持按已发布动态生成个性化短句，失败回退原提醒，不改变限次、收件人和回执。

2026-10-27：显式生图请求在绑定人物时复用确认的外观字段保持视觉一致，不带入人物经历或运行状态；未绑定人物时保持原描述行为。

2026-10-27：按旅程补齐 NPC 评论提示词与失败回退；生图请求预填改为共享注册来源，独立图片协议拒绝未签发输入。主对话目录展示真实模板变量，自动记忆提炼要求用户主体及原话依据；任务规划规则去重，明确任务不被情绪分类挡成重复确认。需要提示词但缺产品闭环的回复、视觉与自主生活能力单独列入施工差距。

2026-10-27：提示词管理器按已确认候选回流正式 Debug，简化为目录 / 正文及变量、来源、实际调用入口；提示词单独计数，人物与主要行为前置。候选和正式页共享基础间距与行高，新增真实目录及渲染测量回归。

2026-10-26：提示词审阅候选修正来源表与版本入口相贴、辅助文字行高继承正文的问题；变量与来源区域统一使用基础 caption 行高及共享间距，仅限 Playground。

2026-10-26：Playground 提示词管理器新增开发者审阅候选，提示词与其他资产分别计数，支持完整正文复制、用途搜索及动态无固定正文说明；详情默认仅保留名称、复制图标和正文，补充入口收敛为变量、来源、实际调用；人物和主要行为前置、平台规则后置，取消独立形态筛选和重复计数。正式 Debug 尚未回流。

2026-10-26：Debug 行为日志接入运行历史，调用链与实时事件可分别查看当前快照和保存记录；主动问候新增独立决定 / 投递 / 呈现证据。来源按真实 ID 定位并可返回原记录，刷新失败保留已读范围；呈现不代表已读，缺回执不自动重发。


2026-10-26：新增有界关键运行历史只读接口，真实追踪元数据可按人物、会话、Span 与记录 ID 查询并跨重启保留；不保存模型正文或工具参数。现有 Debug 页面暂未切换来源，主动问候回执继续施工。

2026-10-26：Debug 七组 26 个入口完成逐页回流与整体验收；修正旧综合流程、补真实目录与非空历史回读。LLM 区分未保存响应与已保存空字符串，消息占位保留原保存长度；System / 消息 / 响应自然语言使用基础正文、字体与行距。当前能力与数据保留边界已收工，v4 施工合同冻结。

2026-10-26：正式 Debug 人格验收采用候选简洁报告与逐项阅读，运行诊断折叠保留；修复迟到响应串报告、刷新丢草稿、未读审阅被当作未审阅，以及确认 Esc 返回聊天的问题。

2026-10-26：正式 Debug Skill 验收采用简洁报告摘要与逐项证据；修复迟到报告覆盖、缺失文件回退和首次读取失败伪装无报告的问题，完整输入 / 激活 / 回复与来源保留。

2026-10-26：正式 Debug 实时事件采用时间线与单条已保存摘要；修复文字居中、标签换行和原文辅助字号，裁剪后的选中身份与当前缓存边界可核对。

2026-10-26：正式 Debug 调用链采用树与单 Span 详情；原统计 / 使用量折叠，后台关联和完整属性保留，非 LLM Span 不再提供请求定位入口。

2026-10-26：正式 Debug 用户记忆采用分类短正文及独立全文；未知类别、空正文、截断和原始字段保留，候选筛选不再提前展示未读页条目。

2026-10-26：正式 Debug 用户画像采用候选三组来源摘要与单条全文；其他类别不再遗漏，保存桶、未知时间、截断和原文可核对。

2026-10-26：正式 Debug 生活事件关联采用候选分组 / 单边详情，保留完整备注与原文；修复日期不变时清除筛选导致成功结果消失且不重读的问题。

2026-10-26：正式 Debug 文化角对齐候选分类 / 作品 / 笔记阅读，空数组、损坏笔记、进度矛盾和归档资料分别保持可核对。

2026-10-26：正式 Debug 衣柜对齐候选分组与槽位阅读；未读 / 错配 / 异常引用及冲突状态保持可核对，完整字段和来源按需展开。

2026-10-25：正式 Debug 主动消息证据对齐候选能力边界，首次失败 / 刷新失败 / 不可用独立说明，不补造投递记录或成功回执。

2026-10-25：正式 Debug 通讯录对齐候选关系阅读；共同事件去重，截断提示准确保留，同名人物和完整来源可分别核对。

2026-10-25：正式 Debug 朋友圈对齐候选正文优先阅读；发布时间、卡司投影和用户互动分来源展示，完整字段与原文按需展开，坏资料及空范围不补造事实。

2026-10-25：正式 Debug 成长与反思对齐候选正文 / 历史 / 结果分区；来源身份独立，空覆盖与坏结果保持可核对，刷新失败保留历史和展开。

2026-10-25：正式 Debug 足迹对齐候选短清单和旅行详情；日期、停留异常及未知类型保留，收录时间不作为出发 / 到访日期，完整来源按需展开。

2026-10-25：正式 Debug 家居对齐候选住所 / 空间 / 物件阅读，完整字段与来源按需展开；未读父级、错误类型、未知记录及陈列状态分别呈现，刷新保留已读内容。

2026-10-25：正式 Debug 当前位置对齐候选快照阅读；原始保存值、解析差异及真实世界定义可展开核对，刷新失败保留位置和详情。

2026-10-25：正式 Debug 人物档案对齐候选阅读，完整定义与原始资料可展开；真实注册目录独立读取和重试，修复缺失人物引用被当前定义替代的问题。

2026-10-25：正式 Debug 此刻对齐候选摘要和完整状态阅读，刷新失败保留展开；修复当前快照查询忽略指定记录 ID、可能显示替代状态的问题。

2026-10-25：正式 Debug 行为日志对齐候选阅读，说明当前来源为生活事件，提供调用链、成长与精确来源跳转；空范围和读取失败保持可辨。

2026-10-25：正式 Debug 最近事项采用与候选共享的时间清单和单条详情，保留分页、筛选及刷新失败后的完整证据；列表状态中文呈现，原始状态按需查看。

2026-10-25：正式 Debug 今日日程改为逐时段阅读，与 Playground 共用布局；完整来源按需展开，空日期不查询，刷新失败保留详情，时段内容变更不选择替代项。

2026-10-25：Debug 系统状态与技能工具分开呈现；系统细节折叠，能力按来源筛选并保留完整 Schema；局部数据源读取失败不隐藏其他已读证据。

2026-10-25：正式 Debug 上下文使用独立的保存范围阅读，与 Playground 共享展示，消息、工具和参数分开展示；清单 / 详情失败分别恢复，调用来源按 ID 定位。

2026-10-25：修复正式 Debug 双侧栏挤压和调用页失败/异步详情状态；技术筛选按需展开，文字引用基础 token。Playground 的上下文、调用链及资产关联可定位显式调用详情。其余页面与真实接口继续逐项复核，完整目标尚未完成。

2026-10-23：Debug 呈现 v3 正式回流完成。提示词管理器、日程、画像、足迹和请求 / 运行页面采用已验收的 Alice 对齐阅读层级；生产继续读取真实只读接口，完整来源和诊断边界按需展开，候选样张与实验控件不进入正式页。

2026-10-22：统一 Debug 的基础文字呈现。正式页与 Playground 候选现在共用标题 / 正文 / 控件 / 说明 / 技术标识字号、行高和等宽字体 token；全局字号调整会保持比例，真实诊断数据与只读行为不变。

Playground 调用记录与技能工具 v3 候选：调用摘要、资产 / 调用链入口和能力事实分层完成，MCP 未知数量与未提供使用证据明确表达，正式页待整批回流。

Playground 质量 / Skill v3 候选：Skill Grader 与 Persona 自动结果 / 人工审阅分开呈现，报告、用例和证据按需展开，缺失和运行中不补结论，正式页待整批回流。

Playground 系统状态 v3 候选：运行环境、模型与执行、MCP、权限规则和 Skills 分区展示，凭据保持脱敏，未知数量与有界范围明确表达，正式页待整批回流。

Playground 实时事件 v3 候选：以有界运行事件时间线为主，显式 Span 关联按需跳转；未关联、截断和未知时间不补链路，正式页待整批回流。

Playground 调用链 v3 候选：按显式 parentId 与 links 展示 Span 树和后台关联，未知父级 / 类型与截断保留边界，正式页待整批回流。

Playground 用户记忆 v3 候选：按实际记忆来源分组，显式共享随人物范围保留，feedback 按人物分桶；详情按需展示完整正文和来源结构，正式页待整批回流。


Playground 用户画像 v3 候选：按已读记忆来源整理身份、协作方式与表达偏好，反馈按人物限定，其他类别与完整来源按需展开；不再把固定聚合卡当作全量画像，正式页待整批回流。


Playground 上下文 v3 候选：按调用读取保存范围，消息、工具、参数分开，完整结构按需展开。修正旧候选把装配预览当历史输入的问题；正文未持久化时只展示元数据和原长度，失败不补零或替代调用，正式页待整批回流。

Playground 生活事件关联 v3 候选：按来源事件分组，每条边独立查看关系、目标和保存名，元数据及完整 ID 按需展开。不再拼接综合故事或猜测定位，图片 / 卡司仅保留标识；日期 / 类型 / 搜索 / 分页刷新可验证，正式页待整批回流。

Playground 文化角 v3 候选：按书籍、影视、音乐和摄影查看名称、状态与创作者，正文与多条阅读笔记进入详情。空笔记数组、旧笔记、坏结构与缺日期分别处理，已归档和未知类型保留；分类 / 搜索 / 分页刷新一致，正式页待整批回流。

Playground 衣柜 v3 候选：按衣物、套装和穿搭状态阅读，移除无源“当前穿着”和单件穿搭版本。槽位、描述和来源按需查看，未读引用、冲突、坏结构与未知类型不丢原始证据；分页刷新保留可验证，正式页待整批回流。

Playground 主动消息证据 v3 候选：按实际不支持投递查询的能力边界呈现，移除无源会话问候记录和无意义筛选；不补零统计、开关或送达状态。来源折叠、失败重读和朋友圈上下文保留，正式页待整批回流。

Playground 通讯录 v3 候选：人物短列表、独立关系方向与按需展开的共同事件；删除样张中无读取依据的忙闲和里程碑。缺失、限量、截断和局部异常分别说明，人物 / 搜索 / 详情刷新保留；正式页待整批回流。

Playground 朋友圈 v3 候选：正文预览与发布时地优先，完整文案、分来源互动和原始记录按需展开。缺互动不报零，截断不补统计，日期和分页刷新保留可验证；来源事件与普通关联入口区分，正式页待整批回流。

Playground 成长与反思 v3 候选：当前正文优先，历史版本与反思结果分开，完整字段和来源按需展开；按来源区分同人物 ID，移除无依据的冷却提示。默认、空正文、局部异常和分页刷新分别验证，正式页待整批回流。

Playground 足迹 v3 候选：旅行、计划、取消与旧地点分组阅读；列表收为名称 / 日期 / 必要状态，旅行和停留正文进入详情。缺日期不补创建日，未知状态单列，不完整记录显示诊断提示；分页、搜索和刷新保留完整证据，正式页待整批回流。

Playground 家居 v3 候选：住所、空间、物件改为轻量层级列表，陈列理由和完整字段展开查看；空资产不补默认住所，父级未读、未归置和陈列标记缺失分别说明。搜索、分页和刷新保留可验证，校正样张关联 ID，提高候选文字对比度；正式 Debug 留到整批回流。

Playground 当前位置 v3 候选：地点、细节和活动优先，完整快照及原始存储按需查看；区分默认解析回退、未设定和没有人物状态行，不把更新时间当到达时间。家居 / 足迹入口保留且不虚构关联；长文样张遵守生产解析长度。本次浏览器访问已恢复，并补验上一页人物档案；正式 Debug 留到整批统一回流。

Playground 人物档案 v3 候选：简介与三项稳定资料优先，完整定义、来源与原始结构展开查看；资料缺失 / 空结构与读取失败分开，刷新保留原人物和展开内容。成长和文化改为普通诊断入口，避免暗示不存在的历史关联。正式页未回流，内置浏览器实际验收仍待补。

Playground 此刻 v3 候选：活动、位置与更新时间优先，完整状态按需展开；明确暂停、默认解析回退与无记录，校正分值样张尺度，不展示虚构健康状态。相关诊断入口保留，不把计划导航伪装为已存关联，正式 Debug 未回流。

Playground 行为日志 v3 候选：对齐当前生活事件读取源，明确完整行动日志尚未建立；通过调用链和成长反思入口查看其他证据。事件轻行、详情折叠、分页及失败保留沿用已验组合，原反思与工具证据保留在各自页面。仅改候选，正式页未回流。

Playground 最近事项 v3 候选：使用轻量时间列和事件摘要，正文及技术字段进入单事件详情；按计划时间倒序，数量注明已读范围与未知总数。补齐失败保留分页、缺失时间 / 引用和长文样张，保留来源关联。正式 Debug 未回流。

Playground 今日日程 v3 候选：按时间、活动、地点组织轻量列表，完整诊断进入单时段详情；区分首次失败、刷新保留、成功无记录和搜索无匹配，补齐边缘样张与全部人物时间排序。仅改候选，等待全部页面齐备后统一回流。

Playground 提示词管理器 v3 候选：调整文字职责与阅读比例，补齐未读取 / 首次失败 / 关联失败 / 缺失引用和长文样张；默认保持短目录与正文优先。改动仅限隔离候选，正式 Debug 未回流。

2026-10-14：按用户确认回流 Debug 阅读层级；与 Playground 共用页头及基础样式，默认简化日程、画像和提示词工作台，完整字段 / 来源仍可展开。调用详情采用 Foundation TabStrip 并保留七种视角，正式页面不读取候选夹具。

2026-10-14：Playground Debug 信息重排候选默认当前人物、只显示明确阅读字段，减少重复标题与状态；提示词正文前置，形态 / 变量按需查看。完整诊断材料和来源保留，正式页面未改。

2026-10-14：Playground Debug 阅读候选统一页头与基础 tab，简化默认目录和详情，来源 / 版本 / 标识保留在折叠区；正式 Debug 的数据与视觉不受本轮 P0 影响。

2026-10-14：Debug 正式回流七组导航和只读提示词工作台，补齐人物、生活、资产与用户资料的有界证据查询。不播种、不建表、不迁移设置；当前世界和模型路由继续使用生产事实。完整屏幕交互验收未取得，按用户明确授权继续交付，不将代码检查当作视觉验收。

2026-10-13：Debug 候选统一提高文字字号和说明对比度，提示词管理器按 Alice 工作台具体形态调整：紧凑页头、340px 分组目录、短条目、类型计数及正文详情。版本来源与展厅说明可折叠，减少重复信息占用正文空间；正式 Debug 未回流。

2026-10-13：Debug 候选按本项目真实能力校正为七组 26 入口，补足朋友圈、足迹，家居展示住所 / 空间 / 物件及展示依据，文化角与实物分开，稳定兴趣归人物档案。用户画像明确来自记忆聚合及仅协作反馈按人物过滤的现状。左侧隐藏可见滚动条，保留滚轮与键盘访问；仍为隔离候选。

2026-10-13：Debug 候选重做为内核、生活、社交、资产、用户、系统、质量七组 24 个入口。恢复默认提示词管理器，增加人物与正文筛选、用途分组、模板变量及版本来源；今日日程、生活事件、位置、居所、成长、关系和用户资料分别呈现，并保留本项目的调用、权限和验收证据。深浅宽窄可交互；仍为 Playground 隔离候选，正式 Debug 未回流。

2026-10-13：新增开发技能「人物体系共创」，用于共同构建完整人物及多场景行为提示词。技能引导关键决策与材料补充，追踪已确认设定、来源和验收反馈，支持随着第一个人物持续完善。

2026-10-13：Playground 新增「Debug 诊断」候选。以调用记录为默认入口，统一浏览输入结构、执行证据和资产来源；支持关联跳转、搜索筛选和失败状态。候选使用隔离样张，正式 Debug 暂未回流。

2026-10-13：提示词注册从目录检查扩展到真实模型入口。请求正文与来源由固定编译配方绑定，伪造 / 篡改 / 未登记来源发送前拒绝，Playground 与 Eval 不能冒充生产。Debug 的生产目录继续只读，动态模板和实际请求区别展示。

2026-10-13：提示词全入口统一登记。Debug 可读取实际构造器生成的后台行为、压缩、子任务与恢复模板；人物档案共用来源 key，真实调用追踪实际注入文件。新增防漏门禁，阻止未登记的提示词定义、人物文件和错 key。

2026-10-13：重做 Prompt 框架。主对话、Moment 润色、日程剧本、生活补叙和人格反思统一使用语义编译器；Debug 从 L1–L4 切换为平台规则、人物定义、成长、行为、情境和输出契约模块。Role Pack 可通过 `behaviors/` 为指定行为增加受边界约束的表达补充，方便扩展伙伴团队。


2026-10-12：为四个真实伙伴后台行为增加生产行为契约元数据，Debug 可追踪触发条件、人物 / 运行时输入、输出协议、校验、回退和副作用；同时预留 Role Pack 行为补充文件入口，不改变 Prompt 正文或调用语义。

2026-10-12：Debug 导航按 Alice 的工作域方式分组为「内核 / 伙伴 / 质量」，提示词管理器归入「内核」下；各分区入口和真实数据链路不变。

2026-10-12：按 Alice 的信息组织方式收口 Debug「提示词管理器」前端；新增生产证据页头、只读状态、资产摘要与分类计数，保留真实 Prompt 目录、动态插槽、实验副本和调用追踪边界。

2026-10-12：统一人物世界六个生活面的空态布局；空态文字居中，家居完全为空时隐藏无意义的“总览”入口，其他 tab 的有数据浏览不受影响。

2026-10-12：正式人物世界回流 Playground 六个生活面的空态与刷新入口；刷新统一放在生活面标签行右侧并沿用各自真实读取链，空态继续使用与候选一致的状态呈现。

2026-10-12：收口角色架卡片与设置 / 输入基础视觉边界；角色架窄宽排列、设置导航留白和 TextField 的 outlined / embedded 边界统一，未改变角色数据、保存或召唤链路。

2026-10-12：收口“生图实验”Playground 入口与产品资产登记，明确其属于 Agent 实验工作域；不新增生图调用路径，不改变正式 Chat / 人物世界的真实媒体链。

2026-10-12：伙伴设置的勿扰开始 / 结束改用共享整点时间选择控件，避免裸数字输入造成时间语义不清；存量小时数据格式与通知调度未改变。

2026-10-11：正式回流移除“相处补充说明”能力；删除正式 / Playground 设置入口、存储字段、备份白名单、IPC 写入校验和提示词注入，启动时清理旧设置键。

2026-10-11：修正正式 Chat 侧栏展开入口，改用与 Playground / Alice 对齐的展开图标并恢复点击命中；侧栏收起后仍保留左上角悬浮展开按钮。

2026-10-11：调整正式 Chat 收起后的浮动展开按钮垂直位置，使其与展开状态的侧栏收起按钮保持同一中心线。

2026-10-12：统一正式 Chat 与 Playground 会话列表滚动条行为；默认保持滚动槽位但隐藏滑块，悬停或聚焦会话列表时再显示，避免侧栏常驻明显滚轴。

2026-10-11：修正正式 Chat 初始欢迎态的可用高度传递，欢迎内容回到消息区域内垂直居中，不新增页面滚动范围。

2026-10-11：Playground 伙伴设置暂时隐藏“相处补充说明”入口，避免与记忆入口形成重复的样张信息；正式设置、存量数据和提示词行为保持不变。

2026-10-11：Playground 设置页的模型、Skills、MCP 和设置内记忆样张状态切换移到设置框架上方，分区内容内部不再单独占用状态控制行；切换到没有样张状态的分区时不保留空白槽位。

2026-10-11：修正 Skills 详情中的进入与返回动作，明确使用 Foundation `ActionButton` 的低强调变体，恢复统一的 hover 背景与操作反馈。

2026-10-11：统一生图实验意图输入框与产品输入控件的圆角和输入表面，避免同为 Foundation `TextField` 却出现不同视觉规格。

2026-10-11：修正记忆搜索框的嵌套边框；搜索输入明确使用 Foundation `TextField` 的嵌入模式，只保留搜索容器自身的边界。

2026-10-11：移除正式 Chat 顶部工作区工具槽的额外背景色带，使其与 Playground 保持透明一致；工作区展开 / 收起入口和占位高度保持不变。

2026-10-11：精简伙伴设置中的回答方式卡片，移除标题与示例之间重复的说明行，只保留标题和示例文案。

2026-10-11：收敛 Chat 顶部工作区入口为不占布局高度的固定操作位；Playground 消息样张隐藏用户头像，仅保留伙伴头像。

2026-10-11：修正正式 Chat 初始欢迎页的高度计算，欢迎态不再因为顶部工具条结构变化产生多余的纵向滚动条。

2026-10-11：修正 Playground 记忆分类工具栏的横向布局；搜索关闭时不再错误预留宽搜索框空间，四个记忆分类不会因布局挤压显示滚动条，搜索打开后仍保留固定搜索操作槽。

2026-10-11：Playground Agent 实验统一复用 Foundation 控件；生图归属、模型烟测、对话试跑、工具执行、风险确认及实验导航不再各自声明原生控件，实验逻辑与隔离边界不变。

2026-10-11：移除 Playground 衣柜内容栏重复的刷新入口，刷新统一保留在人物世界六个生活面标签行右侧。

2026-10-11：统一正式衣柜的读取失败态：桌面连接缺失时只保留衣柜错误提示与重新读取，不再显示正在穿着、全部、套装及分类筛选，也不再显示空穿搭占位；正常读取后的浏览与换装不变。

2026-10-11：收口 Playground 人物世界工具栏：刷新入口统一放到朋友圈、衣柜、文化角、家居、通讯录、足迹标签行最右侧；朋友圈移除重复标题、说明和关闭按钮，内容直接从生活面标签下开始。正式环境暂不改变。

2026-10-10：修正设置「权限与自动化」的自定义规则行对齐；规则说明保持左侧起始，数量与展开箭头保留在右侧固定操作位。

2026-10-10：调整 Playground 人物世界的工具栏层级：长笔记、无笔记、读取失败等状态控制移到产品框架外，刷新入口保留在生活面内容工具栏内；正式页面继续使用真实刷新 / 重试，不引入 Playground 状态控制。

2026-10-10：普通 Vite 浏览器预览现在默认显示 Playground / Debug 开发入口；浏览器仍不注入 Electron 桌面桥接，因此人物世界、真实设置和运行时数据继续提示需要桌面连接，不伪造生产数据。

2026-10-10：修正人物世界正式环境与 Playground 的回流遗漏：朋友圈关闭评论不再预留空槽，衣柜、文化角、家居和足迹不再暴露手工新增、编辑、删除或生图入口。正式页保留真实读取、图片查看、换装和失败恢复；资产维护继续由独立入口承载。

2026-10-10：模型用途安排正式页统一使用固定尺寸开关轨道，启用 / 停用不再伪装成文字动作按钮；排序、删除和真实保存逻辑不变。设置 Playground 移除开发者已知的“仅供预览”提示及多余包裹层；Chat 正式侧栏同步采用收起完成后显示、展开前隐藏的阶段切换。

2026-10-10：Playground 人物世界六个生活面统一使用满高候选容器；朋友圈不再因外层高度契约缺失在动态尾部形成异常空白，并明确不展示正式页的“添加”写入入口。正式人物世界与真实资产写入逻辑不变。

2026-10-10：Playground Chat 侧栏切换改为分阶段呈现：先完整收起再显示展开按钮，展开时先隐藏浮动按钮再恢复侧栏，避免按钮重叠。

2026-10-09：Playground Chat 侧栏收起按钮下移，与伙伴身份区上下居中；正式页面不变。

2026-10-09：修正 Playground 侧栏顶部按钮挤下伙伴信息的问题，伙伴信息回到顶部，收起按钮与身份区同一行上下居中；保留切换动效，正式页面不变。

2026-10-09：Playground Chat 收起 / 展开侧栏按钮在顶部等高，侧栏切换不再卸载硬切；支持焦点恢复和减少动态效果。正式页面待确认后回流。

2026-10-09：Chat 与侧边栏回流已确认样张：统一基础控件形态与正文 / 输入间距，去掉重复会话标题栏，工作区开关常驻；思考卡展开和图片预览同源，生图入口只填可编辑草稿，不自动发送。

2026-10-09：Playground Chat 工作区展开 / 收起按钮在各聊天状态常驻；初次默认收起，手动展开后切换状态保留内容与展开状态。正式页面暂不改变。

2026-10-09：正式搜索与聊天输入移除内层边框，保留外框及焦点提示；侧栏底栏采用已确认样张，去掉重复分隔线，搜索、草稿与导航行为不变。

2026-10-09：衣柜页错误标题与读取提示改用「衣柜」，修正回流遗漏的旧「物什」称呼。

2026-10-09：修正正式设置长短页面切换时滚动条造成的水平偏移；人物世界六个分区的读取错误统一复用基础错误提示与内置重试操作，保留真实读取和已有资料。

2026-10-09：正式设置采用已确认的九区统一页头与间距，记忆不再重复添加页面标题和内边距；保留保存、错误恢复、详情和返回操作，实验控制不进入正式页。

2026-10-09：Playground 设置九个分区统一标题、说明和首块间距，实验标记移出业务页头；保留字段、空态、错误和详情返回，正式设置布局暂不改变。

2026-10-08：正式设置采用已确认返回布局，侧栏去掉重复「设置」标题；继续使用基础返回按钮，保留保存检查与原页面恢复。

2026-10-08：Playground 设置样张移除侧栏重复标题，复用基础返回按钮回到 Chat 样张；宽窄屏保持预览隔离，正式设置页不变。

2026-10-08：人物世界六面正式采用已确认设计。衣柜支持真实单件 / 整套换装；文化角支持多笔记与同源感想；家居按空间展示有依据的物件；通讯录查看关系和共同经历，不再提供开聊；足迹只记录旅行。补齐失败恢复、切角隔离、多图预览与新目录备份媒体恢复，Playground 样张不写入正式资料。

2026-10-08：Playground 通讯录补齐阿遥、许叔生图头像，列表与详情共享，缺图和失败继续显示姓名占位。

2026-10-08：Playground 通讯录改为人物卡片与关系详情，可查看共同经历和关联旅行；不再展示开聊或忙闲状态。

2026-10-07：Playground 按钮、图标按钮、分类标签与独立输入统一 10px，设计语言规范同步。

2026-10-07：Playground 控件与独立输入圆角统一为 14px，设计语言规范同步；卡片与弹层不变。

2026-10-07：Playground 分类标签补齐常驻细边框，保留选中底色，圆角引用控件规范。

2026-10-07：形态与动效集中展示固定圆角规范，Playground 基础按钮统一为 6px，输入 / 卡片 / 弹层按同源语义值呈现；局部圆角实验不改规范。

2026-10-07：Playground 移除底部重复产品入口；输入样张统一独立细边框与共享圆角，错误态只改颜色，组合输入不加内框。

2026-10-07：基础布局样张补充加粗标题与独立细边框，四项参数支持滑块、数字输入及重置，调节仅影响本页。

2026-10-07：基础布局改成五组并列展开的实际样张，统一切换密度；移除独立布局契约和布局稳定性说明段，相关规则与操作占位检查保留。

2026-10-07：基础布局样张取消内部滚动，图片和正文完整展开，统一跟随页面滚动。

2026-10-07：移除透明度样张文字背后的小色块，仅保留统一的外层透明表面。

2026-10-07：设计语言布局样张改用通用密度，移除产品模块分类；透明度样张去掉重复标题，文字底色随滑块一起变化，文字本身不变淡。

2026-10-07：Playground 布局与间距增加 Chat、设置、人物世界、工作区密度切换；产品体验主要内容边距与共享卡片引用统一来源，正式默认布局不变。

2026-10-07：Playground 设计语言新增布局与间距、透明度样张，分类统一基础 Tab 无下划线样式；人物世界三类详情候选共享左对齐限宽参数。正式页面默认布局不变。

2026-10-07：Playground 足迹详情返回移到内容区左侧，与文化角、家居详情的基础返回按钮保持一致。

2026-10-07：Playground 足迹空态文字下移至框内居中，框体尺寸与正式页面保持不变。

2026-10-07：Playground 足迹改为完整旅行清单与详情候选，加入真实生成的古镇运河配图，覆盖进行中、无图、生成中、失败、长文与空态；不改变正式足迹。

2026-10-07：Playground 衣柜增加 Phosphor / IconPark 服装图标对照；默认使用选定组合，上装、鞋子保留原图标，套装、下装、外套使用 Phosphor，切换保留分类与穿搭；正式页面不变。

2026-10-07：衣柜 Playground 的“鞋履”改称“鞋子”，数据分类值不变。

2026-10-07：Playground 衣柜分类与家居空间标签补齐图标，尺寸和间距与文化角一致；正式页面不变。

2026-10-07：Playground 家居新增总览鸟瞰、按空间浏览与只读物件详情，补齐九张真实生成的隔离配图；只展示有故事、意义或习惯依据的物件，不按家具类别补数量。正式页面不变。

2026-10-07：Playground 书籍列表与详情的阅读状态标签移到作者右侧，窄宽自然换行；正式页面不变。

2026-10-07：Playground 朋友圈图片 hover 去掉放大镜，保留蒙版和点击预览；移除底部“最近的生活动态”，正式页面不变。

2026-10-07：Playground 朋友圈增加统一样张切换，可分别查看纯文字、不同图片数量、长正文、多条评论和空态；赞评与预览继续复用现有组件，正式页面不变。

2026-10-07：Playground 音乐列表与详情统一显示同一条听感，列表只截短展示，不再取另一份摘要文案。

2026-10-07：修正 Playground 影视列表与详情显示不同观后感的问题，两处改用同一正文，列表仅截短展示。

2026-10-07：Playground 衣柜新增套装分类与三套完整组合的换上预览；文化角影视、音乐与摄影调整资料 / 状态 / 感受层级和详情排布，补精简信息样张。正式页面未回流。

2026-10-07：Playground 书籍以状态徽标区分作者与阅读状态，最新笔记独立摘录；详情采用紧凑书目区、整体感受与多笔记列表，提供无笔记故事。正式页面未改。

2026-10-06：Playground 文化角新增书籍、影视、音乐、摄影四分类与只读详情；配图按类型展示，长笔记内部滚动，返回恢复焦点。移除候选中的维护表单，正式页面不变。

2026-10-06：Playground 衣柜将正在穿着与衣物分类统一为单行切换，内容互斥展示；换上成功后回到穿搭图，失败保留列表。正式页面未改。

2026-10-06：衣柜 Playground 当前穿着改为紧凑上图下文，移除“当前这一套”和重复标题；补齐全部库存图片、通勤与运动全身图，保留独立无图样张。正式页面未改。

2026-10-06：衣柜 Playground 改为“当前穿搭”全身主图，取消添加 / 编辑 / 删除入口；补充通勤、运动初始组合与穿搭图生成中 / 失败样张，换装后旧图不再代表当前穿搭。正式页尚未回流。

2026-10-06：统一 Playground 衣柜与记忆的状态样张切换器，修正完整穿搭选中态与记忆清单不一致的问题；基础故事筛选复用相同组件。

2026-10-06：移除人物世界 Playground 选中标签的底线，与基础标签样张统一使用现有 surface 样式；保留键盘焦点提示，不改变正式导航。

2026-10-06：Playground 衣柜新增四槽位穿搭与图片优先分类候选，提供完整穿搭、部分穿搭、空衣柜和换上失败样张；换上仅改变对应槽位，失败保留原穿搭。服饰使用真实生成外套图，包、相机和雨伞归入家居样张；正式衣柜尚未回流。

2026-09-30：图片预览候选完成正式回流。Chat 附件与生图结果、Markdown / 工作区文件预览、朋友圈、衣柜、文化角、家居和足迹中的真实图片统一使用 Foundation 图片预览器；保留各自真实数据读取、重试、定位和社交行为，不增加正式“生图”一级入口。

2026-09-30：Playground Foundation 新增统一图片预览器，工具栏对齐 Alice 的复制图片 / 下载图片能力，并支持多图切换、滚轮缩放、拖动、Esc 与背景关闭；当前只作为候选故事验收，未回流正式产品入口。

2026-09-30：Playground 人物世界新增朋友圈两图、三图和九宫格样张；参考 Alice 的动态内画廊结构，单图与多图使用稳定比例和方格占位，评论展开不改变画廊自身几何，暂不改变正式朋友圈。

2026-09-30：收紧朋友圈产品边界：移除“查看生活切片”入口和“与某人同框”内部关系文案；朋友圈只展示生活动态及其图片、地点和社交互动，生活切片详情与事件关联保留给 Debug 证据面，底层数据和读取能力不删除。

2026-09-30：修复 Foundation `TextField` 强制 `border-0` 覆盖业务表单边界的问题；显式声明边框的伙伴设置、记忆、模型和权限输入恢复可见边界，无框的 Chat / 搜索 / 侧聊嵌入输入保持无框。

2026-09-30：重新划分生图入口：Playground 独立入口改为 Agent 实验中的“生图实验”；产品体验只在 Chat 与人物世界各生活面展示有图状态，正式产品不增加独立“生图”一级入口，真实生成链路继续由 Debug 承载。

2026-09-30：人物世界第一版收工：六面生活面、生活切片事件关联、真实生图视觉资产、正式回流和质量门禁全部完成；旧的输入边框、模型样张数量和图片卡高度回归契约已按当前 Playground / Alice 参考基线同步。

2026-09-30：同步人物世界与生图能力的当前事实：Chat 和人物世界生活资产已具备统一生图入口、受控读取、定位及媒体备份恢复；人物世界六面与事件 / Moment 数据链已落地。下一阶段聚焦“生活切片 / 事件详情”设计，不新增原始事件日志入口。

2026-09-23：将已确认的 Playground 输入控件基线回流正式页面：记忆编辑、朋友圈评论和工作区输入统一复用 Foundation 的无内嵌边框与低对比焦点反馈，保持真实保存、评论、终端和浏览器行为不变；悬停、聚焦和隐藏态不改变布局尺寸。

2026-09-22：修正设置开关颜色：浅色主题下使用更协调的 accent 轨道与输入背景圆点，伙伴设置、开发者模式、权限规则和 Playground 的开关表现统一。

2026-09-22：统一基础控件焦点反馈：输入框改为低对比焦点环，按钮和设置导航移除浏览器黑框并保留可识别的 focus 状态；正式记忆页补齐标题，模型 Playground 增加三连接商、多模型和用途路由组合样张。

2026-09-22：统一设置与 Playground 的返回导航外观：新增 Foundation `ActionButton` 的 `plain` 变体，正式设置页获得与 Playground 一致的低强调样式和 hover 背景，同时保留固定尺寸与可访问名称。

2026-09-22：全产品体验回流收口：Chat、人物世界、设置、记忆、主题 / Foundation 与工作区五工具完成正式采用登记；正式入口继续使用真实 IPC、存储和生命周期保护。RAG、MCP OAuth 与完整 PTY 不包含在本批范围内，继续暂缓。

2026-09-22：Foundation 生命周期收口：新增通用 `Button`、`EmptyState`、`ErrorState`，正式浏览器与角色架的空态 / 错误态 / 恢复动作统一从基础组件渲染；四个产品体验资产完成正式采用登记。RAG 与 MCP OAuth 不包含在本批完成范围内，继续暂缓。

2026-09-22：设置返回入口的桌面辅助提示明确为“返回聊天”，并保持移动端响应式控件的独立提示语义；正式工作区在设置与 Playground 之间切换时继续保留终端实例，只有切换项目才清理。

- 正式 Debug 运行概览的真实证据入口统一使用基础动作按钮；Prompt、请求与运行、伙伴世界和系统工具的导航与真实诊断数据保持不变。

- 正式 Debug“请求与运行”中的 LLM 调用、调用链和实时事件切换统一使用基础动作按钮，保留原有诊断数据和焦点跳转行为。

- 正式 Debug 的 LLM 调用浏览器统一复用基础输入、文字动作和图标按钮；查询、详情标签、长内容滚动、复制、刷新、导出、分页和清空行为保持不变。

- 对话 Debug 源码组件的操作槽统一复用 Foundation 控件；该组件当前未挂载到正式产品入口，不作为正式回流能力宣传。

- Chat 的记忆引用动作与权限确认动作统一使用 Foundation `ActionButton`，保留“记错了 / 改正”和“拒绝 / 允许执行”的真实行为与危险色语义。

- 正式 Chat 的思考过程与工具调用折叠行统一使用 Foundation `ActionButton`，保持流式状态和工具结果不变，并固定 hover 前后的消息布局。

- Markdown / Diff 的统一与并排视图切换统一使用 Foundation `IconButton`，固定操作槽尺寸并保持正式审阅、文件预览和工作区候选的共享渲染链路。

- 工作区审阅文件列表统一使用基础 `ActionButton`，保留真实文件变更与 diff 查看流程，并固定 hover 前后的列表行几何。

- 正式通讯录的最近互动入口统一使用 Foundation ActionButton；保留打开召唤会话的真实行为和原有轻量文字呈现。

- 设置左侧导航的未选中项恢复 hover 反馈；保持选中态、页面切换和保存保护行为不变。

- 正式主侧栏的伙伴身份 / 角色架入口、Debug / Playground 开发入口与人物世界 / 设置导航统一复用 Foundation ActionButton；保留开发者模式门控、当前页高亮和原有导航行为。

- Chat 文件提及弹层的关闭操作统一使用基础图标按钮，固定操作槽尺寸；文件列表选择和项目文件读取行为保持不变。

- 关于页移除“品牌标语待定”占位文案，改为正式产品定位文案；开发者模式开关和设置链路保持不变。

- 正式朋友圈的刷新、关闭和动态选项统一使用基础图标按钮，操作槽尺寸固定，hover 不再改变布局；朋友圈赞评和数据链路保持不变。

- 正式记忆页的关闭、分类筛选、预览编辑 / 删除和非紧凑编辑态统一复用基础控件；保留长记忆多行编辑、敏感信息提示和日期与操作槽同一行布局，hover / focus 不改变记忆卡片几何。

- 正式主侧栏的搜索、新对话、折叠、重命名和会话删除控件统一复用 Foundation；删除操作槽常驻占位，hover / focus 不再推动会话日期和预览文本。

- 工作区产品体验注册表补齐浏览器、终端、侧边聊天正式面板与 App 入口映射；本次仅修正资产目录与真实调用链的对应关系，不改变运行行为。

- 正式 Chat 的工作区开关复用 Foundation IconButton，保持固定 32px 操作槽及原有展开、收起行为。

- 角色架快捷入口统一归入设置：侧栏头像和通讯录中的“去角色架”进入伙伴与相处设置，关闭后返回原来的聊天或通讯录分区。

- 从 Debug 点击“新对话”会先返回聊天再创建会话，避免会话已创建但界面仍停留在 Debug 页面。

- MCP 设置的服务数量、添加连接与空态和样张使用同一组件；移除旧重复外框，添加按钮在表单打开或操作进行中保留位置并禁用。

- 正式角色架采用已确认的样张布局，与 Playground 共用角色卡片和当前主角标记；长姓名可换行，加载失败可重试，切换失败保留当前角色。

- 伙伴偏好桌面验收自行准备本地模型配置，单独运行不再依赖前序配置测试；不改变产品行为。

- 对话审批入口与样张共用基础按钮和菜单。保存失败或取消完全访问确认时不再误显示新模式，可重试；支持键盘导航，保存中不会重复提交。

- 正式对话与 Playground 共用消息头像、身份行及气泡布局；历史会话显示对应角色名称和消息时间，未知角色不冒用当前伙伴姓名。长正文与代码保持在消息列内，原有引用、工具卡和消息操作保留。


- 正式对话输入区与 Playground 共用输入卡片和基础控件：长文在框内滚动，长模型名不会挤走发送按钮，发送与停止尺寸一致；保留附件、粘贴图片和文件引用。

- 对话欢迎区与 Playground 共用伙伴图标、欢迎文案布局和快捷按钮；保留真实角色简介、发送与朋友圈入口，长文可换行滚动。

- MCP 添加向导与已有服务管理互斥，避免新连接保存后尚未刷新时，被旧列表的删除或启停操作覆盖。

- 人物世界顶部显示当前伙伴名称与简介，正式页和 Playground 共用身份布局，头像占位随姓名变化，不再固定显示小林的人设。

- 人物世界正式页与 Playground 共用六标签定义，足迹统一使用地点图标，避免两套导航逐渐偏离。

- 备份恢复不再逐表提前保存：设置或最终快照失败时恢复原数据；崩溃重启清理未提交图片并保留已提交图片。空库的默认设置不再阻止恢复备份配置，既有用户值仍不覆盖。

> 只记录用户或开发者可以感知的能力变化。完整早期施工流水见 [`../_archive/ledgers/changelog-through-2026-08-16.md`](../_archive/ledgers/changelog-through-2026-08-16.md)。

## [未发布]

- 朋友圈动态卡片现在按内容自然收缩，不再在短动态下方留下大块空白。

- 人物世界衣柜移除重复的“物什”页面头部和关闭 / 常驻刷新按钮，保留衣柜与书架切换；读取失败时在内容区提供重新读取。

- Foundation `TextField` 默认不再显示原生边框；需要独立边界的表单仍可显式声明 `border`，组合搜索框等控件统一只保留自己的外层边界。

- 记忆搜索框移除内部输入边框，只保留统一的外层控件边界，避免出现双层边框。

- 人物世界通讯录移除重复的内层标题栏、说明文字和关闭按钮，刷新仅在读取异常时作为就地恢复操作出现；页面上下文统一由人物世界头部与 tab 提供。

- 新增 MCP 连接保存及刷新列表期间会阻止离页和重载；失败后可重试，已保存的连接不会因刷新重试再次提交。

- MCP 普通服务管理操作进行中会保留当前设置页并阻止窗口卸载，完成或失败后恢复导航；失败可原处重试。

- 权限设置保存期间会阻止离页、重载和退出，避免保存结果尚未返回时离开表单；失败可在原处重试。

- Playground 通讯录与正式页共用组件，样张可查看摘要和忙闲，开聊保持禁用，不创建真实会话。

- 简化人物世界的动态、穿着空态和书架说明，移除内部实现术语；正式页面与 Playground 同步。

- 人物世界标签与返回按钮统一使用基础组件，标签支持方向键及 Home / End 切换，窄屏可在标签栏内滚动。

- 普通设置尚未保存完成时，重载和退出会留在原页，避免防抖期间丢失修改。保存失败可重试，保存成功后正常离开。

- 修复切换伙伴的通知迟到时，旧页面新增内容可能写入新伙伴的问题。新增绑定页面所属伙伴；角色已变化则拒绝保存，更新页面后可重新添加。

- 修复切换伙伴后生活资产仍被上一位伙伴的保存操作锁住的问题；迟到的新增、编辑或删除结果不会干扰新伙伴的草稿和保存状态。

- 模型连接有未保存内容或正在保存时，重载和退出会留在原页并提示处理草稿；取消退出后普通关窗仍隐藏到托盘。未提交密钥不会自动写盘。

- 切换伙伴时，已打开的文化角、家居和足迹会同步更新，并清除上一位伙伴的未提交草稿，避免旧内容留在新伙伴页面。

- 修复切换伙伴后迟到的衣柜读取覆盖当前角色的问题；不同角色的响应不再混合展示。刷新失败保留已有内容并提供原位重试。

- 外观设置不再显示“基础设计资产”等开发说明；正式页面与 Playground 继续使用同一主题和字号组件。

- 修复流式回答中点击停止后可能显示“运行过程中发生错误”的问题：已取消的流读取异常按用户停止结束，不再当作模型故障或触发重试。

- 修复 Windows 首次保存模型连接后立即强制退出可能丢失凭据的问题。首次安全保存会等待系统加密状态就绪，超时或状态异常时明确失败并保留原配置；备份导入敏感设置使用同一保护。
- 开发验收时，更新项目文档、方法论与协作技能目录不再触发 Vite 页面重载；源码和源码内 Markdown 的更新监听保留。
- 人物世界不再自动填入没有角色设定来源的衣物、书籍、歌单、电影与摄影记录；没有已确认初始资产时显示空态，用户新增和事件获得的资产继续保留。不批量删除已有数据库中的记录。
- 保存模型连接或用途后，结构化记忆索引自动重新核对，无需重启或编辑记忆；导入实际新增的模型设置同样触发。保存失败保留原配置，不启动新索引任务。切换端点仍须显式提供新端点凭据，不沿用旧 Key。
- 记忆与知识库检索不再混用不同嵌入端点、返回模型或维度的向量。结构化记忆在索引核对时重建不匹配的镜像；原始记忆、文档和对话不删除。无身份的旧向量不参与召回，文档与对话的跨模型重建仍未接通。
- 修复知识库文档已导入但语义检索为空的问题；RAG 按当前 Vectra API 传入查询文本与结果数量，本地无 Key 连接也可调用检索工具，缺端点或模型仍明确拒绝。
- 修复本地无 API Key 连接被记忆索引同步和 RAG 导入入口直接拒绝的问题；空配置仍不会作为有效连接。一个嵌入端点返回 404 不再永久阻断同进程其他连接或服务恢复后的重试。服务仍须支持当前嵌入模型，这不是任意本地模型的兼容性保证。
- 记忆向量索引改为从已落盘的 SQLite 记忆自动核对恢复：备份提交后立即退出、Embedding 暂时失败或索引快照写入失败时，源记忆不会丢失，应用启动或退避重试后会补齐缺失镜像并保留分类、角色和更新时间；重复启动不会重复生成。外部 Embedding 配置不可用时仍需恢复服务，未保存凭据的强退恢复不在本项承诺内。
- 模型连接测试和模型发现会在窗口重载、销毁或渲染进程退出时取消，不再继续旧窗口的诊断请求；重新进入设置后可正常重试。
- 数据备份包含朋友圈历史、点赞和评论。恢复到新目录后仍可查看，重复导入保留现有内容；损坏的角色或事件关联会明确拒绝，不会重放生活事件或重复发放奖励。
- 支持用户主动生图：在模型设置安排生图用途后，经审批调用 Images / Gemini 服务，将真实图片保存到当前项目，主对话和侧边聊天共用图片预览、原图查看与定位。不会覆盖已有文件或自动重试计费请求，停止可取消等待。附图理解仍使用主对话模型，生图未配置不会借用聊天凭据。
- 图片备份携带实际媒体和工具调用配对，可在原图删除后导入并重启查看、定位。恢复文件写入应用管理目录，不按备份中的外部路径写盘；缺图、坏图和超限会明确失败，重复导入不覆盖当前会话。Windows 打包应用已有流程证据，不代表外部厂商全面互操作或跨存储原子恢复已完成。
- 远程 MCP 支持浏览器登录：授权后返回应用，获取工具清单并按选择保存启用。失效时提示重新登录，支持取消与重试；当前只在本次应用运行中保持授权，重启需再次登录，不自动打开浏览器。自动注册不可用时可填写公共客户端 ID；第三方服务的具体兼容性需按服务验证。
- 外观设置的主题与字号选项现在由正式页面和 Playground 共用同一组件，直接使用基础按钮与设计资产；保留四主题、三档字号及本机保存，候选操作不会修改正式偏好。
- 备份导入现在与记忆存储共用正文校验；含空正文、单字符或超过 20,000 字符记忆的备份会在写入前整份拒绝，避免这类非法记忆在导入中途才报错。拒绝后可继续选择合法备份重试；不改变记忆去重与分类规则。
- 导入导出现在由主进程防止重复执行，文件对话框跟随发起操作的窗口。窗口关闭或页面重载后，尚未开始写入的旧备份请求失效；已经开始写入则完成收尾后释放操作锁，避免第二个备份同时进入。其他窗口遇到忙碌会提示稍后重试。
- 数据与隐私页统一采用 Playground 的操作布局和逐项备份说明，正式与样张共用基础按钮。导入导出处理中固定操作尺寸并禁止重复点击，取消不报错，失败可重试且不展示内部错误；切换设置子页后仍保留忙碌状态，迟到反馈不会覆盖重新打开的页面。
- 修复设置等待保存时切换侧栏会吞掉快捷键跳转的问题；保存成功后正常离开，重复按新建只执行一次，保存失败仍保留当前草稿。快捷键在视图提交时同步更新，搜索关闭读取当前状态。
- MCP 服务卡与添加向导的工具许可复选框统一来自基础组件；基础页可直接验收已选、未选和禁用状态。鼠标 / 键盘操作及保存期间保持固定尺寸，许可保存和失败恢复逻辑不变。
- 伙伴与相处的回答选项、勿扰时段及提醒次数统一使用基础控件，保留原布局与保存行为；Playground 中这些字段和补充说明现在可以实际编辑，但不会写入正式偏好。
- 正式模型高级区采用 Playground 已确认的预算、Temperature 和测试入口，默认收起，正式与候选共用基础控件；移除旧 Top P / 最大输出控件。测试使用已保存的主对话首选连接，换连接、换密钥或离页后不再展示迟到的旧结果，测试按钮尺寸固定。
- 模型参数非法时保留草稿并阻止保存和离页；保存失败可在页内重试，不再叠加挡住输入框的通知。Temperature 设为 0 现在会实际进入模型请求，预算与参数仍能在重启后恢复。
- 删除全部模型连接后，切页或重启仍保持空态，不再恢复旧默认连接、全局模型或环境配置；辅助与图片理解未独立配置时沿用新的主用途。聊天只显示当前模型，Debug 也反映实际用途配置。
- 修复快速配置错误在聊天中消失的问题：等待调用回执和结束事件后才清理监听，保留配置指引，调用被拒绝时可重试；未配置不会请求旧模型端点。
- 模型清单外层采用 Playground 的标题右侧添加入口、连接数量和空态，正式与候选共用同一容器；新增或编辑期间禁用重复添加，取消后恢复。
- 正式模型连接卡片与 Playground 共用同一组件：连接详情、模型清单、手动添加与发现结果保持一致；测试和获取按钮在等待、成功、失败及 hover 时尺寸不变。保留正式删除、失败重试与保存失败恢复，候选操作不调用真实模型或保存接口。
- 正式模型页的“模型使用安排”采用 Playground 已确认的布局，两边共用同一业务组件和基础控件。启停具有可读开关状态，排序 / 移除按钮保持固定尺寸；长名称截断可查看全名，保存失败仍保留原列表。
- 模型用途列表的优先级现在实际生效：首选失败时按顺序尝试同用途备用连接，各自使用独立凭据和协议。取消或已开始输出正文、思考、工具参数后不再切换，避免将不同模型的回答拼在一起；一次性连接测试不沿用已保存备用链。
- 本机回环地址的 OpenAI 兼容模型可不填写 API Key，正式模型发现、连接测试和对话已接通；启用认证的本地服务仍可填写 Key。首次启动及聊天顶栏按实际主用途配置判断和显示，不再依赖旧全局 Key 或模型名。无 Key 请求不再发送空 Bearer。
- 模型设置有未保存连接或手动模型输入时，切页、返回和导航快捷键会留在当前页并提示；保存中同样不能离开。保存、取消或清空输入后恢复导航，不会为了离页自动保存草稿密钥。
- 模型连接修改成功后会清理旧测试和模型发现结果，迟到响应不再覆盖新连接；IPC 请求异常可恢复重试，不再一直停在获取或测试中。取消编辑或保存失败仍保留原连接结果。
- 正式模型设置改为一次保存连接与用途路由；写入失败恢复原配置，避免只保存一半。删除连接时关联用途也随同一组保存，失败继续保留当前编辑内容供重试。
- 数据库文件替换失败时不再尝试直接覆盖旧库，保留旧快照并提示重试，降低文件占用或写盘失败时损坏已有数据的风险。
- 正式模型连接表单采用已确认的五类来源与预设选择，新增与编辑同 Playground 共用一份表单；自定义协议真实传入连接测试。修改地址或协议后不会自动复用原密钥，保存失败继续保留草稿。
- 修复模型用途连接的配置装配：目标连接未填写密钥时不再借用其他连接的凭据，已保存的显式协议会传入真实调用配置。无独立用途路由时仍整体沿用主模型。
- 模型设置保存失败时保留连接和模型输入草稿，删除与路由变更不再提前从界面消失；保存成功后才更新清单，保存期间阻止并发写操作。
- 模型连接输入与 MCP 认证选择统一使用基础组件，补充实际符号引用门禁，避免共享表单内部继续维护孤立控件。
- 回流审计现在为 Chat、人物世界、设置和工作区登记正式入口、真实数据边界与验收证据；这只是管理与门禁增强，不表示全产品已完成回流。
- 修复关闭开发者模式后仍可用快捷键打开 Debug / Playground 的问题；设置内刚关闭开关时也会以保存后的值为准。
- 增加 MCP Bearer 凭据的真实桌面回归：验证加密落盘、脱敏返回和完整重启后的自动认证。
- 设置自动保存失败时，切页快捷键不会再丢弃当前草稿；保存成功后才离开或新建会话，外层配置随之刷新。
- UI 自动化使用独立静态构建和失败 trace，不再复用人工验收的开发服务器；动效样张正确处理构建压缩后的秒单位，Markdown 测试夹具只进入验收构建。
- 工作区侧边聊天现在只引用当前选中的文件或审阅内容；后台读取完成不会抢走当前焦点，关闭文件后不会继续把已关闭内容带入上下文。浏览器地址栏不再重复显示标签栏已有的图标。
- 朋友圈卡片悬停不再整体上移，点击评论时内容和输入槽保持原位。
- MCP 停止与重试交错时，迟到流程不再重新启动已停止的连接；设置页也不会被旧查询错误改回“已连接”。
- 正式 MCP 设置在服务意外断开时会显示连接失败和重试，并跟随主进程自动重连；手动停止仍表现为未连接，不会伪装成失败。OAuth 登录仍未接入。
- Markdown / Diff 现在走与 Foundation 同一套清洗后的高亮主题：浅色主题不再露出独立白底，新增删除和选区高亮仍在。
- 正式权限页现在可以折叠查看自定义规则、在列表下方添加草稿，并真实保存到设置；保存失败会留下草稿和原规则，不会悄悄改掉已有条目。Playground 仍只改本地样张。
- 正式模型页现在可以从连接获取可用模型，点选后才加入清单，也可以手动添加。Gemini 需要手动填写模型 ID；认证失败可重试，密钥不会回到页面。Playground 仍是隔离样张。
- 没有默认世界资产的角色，运行中的居所和当前位置会显示为「未设定」，不再把城西小公寓一类未确认住所写进对话上下文。衣柜和文化角的分味播种仍不是已确认的人物事实。
- 正式关于页与 Playground 共用开发者模式开关；普通模式隐藏 Debug 与 Playground 入口，关闭后不会删除诊断数据。UI 测试壳仍会显式保留开发入口，这不是正式默认。
- 正式人物世界六个生活面可以从侧栏入口点开并读取真实伙伴数据；文化 starter 不再写没有证据的笔记数量或观影次数。这不等于人物设定已经确认。
- 正式朋友圈现在可以真实点赞和评论；互动单独保存，不会改动态正文或卡司评论。Playground 朋友圈仍是本地样张。
- 正式数据备份现在包含人物世界的生活记录和播种标记；导入按原有记录合并，不会覆盖已经存在的条目。旧备份仍然可以导入。备份继续不包含朋友圈互动、MCP、权限规则、API Key 和本机项目路径。
- 正式通讯录会在开聊前显示联系人是否方便；忙碌时仍可开聊，并继续走原来的强制确认。Playground 通讯录仍是静态样张。
- 人物世界的衣柜、文化角、家居和足迹现在可以真实添加、修改和删除生活记录；Playground 仍只改内存样张。想去地点会进入足迹的想去分组，超长正文会被拒绝而不是截断。
- 敏感记忆保存会先确认当时那条草稿；改完内容、换分类或取消新增后，旧确认不再生效。衣柜删除和通讯录强制开聊失败后仍可重试，不会先把确认关掉。
- MCP 添加向导已接入真实测试连接、工具与资源发现、保存接管和重启后配置恢复；保存与工具许可写入使用并发锁，真实 MCP 凭据仍不进入 Renderer。
- 修复权限规则折叠时残留添加 / 编辑草稿的问题；收起后再次展开保持与 Playground demo 一致，规则数据和真实权限执行链不变。
- 接入原生文件修改 / 删除和新路径规则到真实执行链：拒绝优先，确认仅限当次调用；执行前复查规则和真实目标；目录删除同时检查子项，无法完整读取时拒绝。不能覆盖沙箱硬边界，也不改变 Shell 或 MCP 权限。
- 正式记忆设置采用 Playground 的四类导航、同行搜索、独立卡片和列表后新增行，移除旧类别栏、顶部表单和底部技术说明。正式与故事共用管理组件和 Foundation 控件，旧事实 / 偏好 / 反馈仍可访问；各类新增草稿独立保留，Escape 只关闭局部编辑或搜索，不退出设置。
- 记忆长文删短后保持多行编辑，不再突然切换成单行输入框；增删改处理中阻止重复提交，失败保留草稿，刷新失败可单独重读。卡片图标操作使用共享固定尺寸按钮，离页后的旧响应不会清空新草稿。
- 正式权限设置沿用 Playground 已确认的自定义规则交互：默认收起，展开后使用真实规则编辑器，规则匹配表达式覆盖默认审批方式；保存失败保留草稿，已有规则不被覆盖。
- MCP 添加连接的正式设置与 Playground 改为同一表单，修复测试成功后连接被提前清理的问题；取消保留草稿，修改配置使旧测试失效，保存后刷新失败可单独重试。旧重复表单移除，真实后端与用户数据不变。
- MCP 后端补齐 Streamable HTTP 与 Bearer 令牌支持，令牌加密保存并在设置读取时脱敏，换地址不能复用旧令牌；新 HTTP 连接不自动跟随重定向。资源专用服务不再因缺少工具能力而被误报连接失败。旧 stdio / SSE 保留；新添加向导与可取消测试尚未回流。
- MCP 添加连接现在必须先测试并获取工具，再选择允许的工具后保存；取消、超时和关闭页面会清理未保存测试连接，保存失败可重试且不会提前进入正式工具注册表。正式设置的旧直接连接表单已移除，真实主进程流程保留风险确认和加密存储。
- 开发服务器忽略验证目录中的 HTML / trace 产物，避免执行 UI 验收时触发页面重载；源码热更新保持开启。
- MCP 正式服务列表与 Playground 共用卡片、开关、工具清单及状态展示，支持连接失败重试，未知工具清单不冒充零工具。修复禁用 / 删除配置保存失败时先断开服务的问题，并避免后续启停覆盖刚修改的工具许可；添加向导和远程协议回流仍未完成。
- 修复文化和书架长笔记更新时被截为 24 字符的问题：正文在 4000 字符内完整保存，超过限制明确提示失败，不会部分修改作品名称。书架进入模型上下文仍使用短摘要。
- 文化角正式页与 Playground 共用读书、音乐、电影、摄影卡片及读书笔记展示；摘要不再遮掉笔记，已有书架作品保留，长正文在人物世界内容区内滚动。
- 家居与足迹的正式页和 Playground 使用同一展示组件；住所、生活物件、常去地点与动态日期来自真实角色数据，未设定不生成样张。刷新失败保留旧内容并可重试，不同主角响应不会拼在一起；新住所与地点初始化支持删除后重载不复活。
- 模型设置选择主对话、辅助任务或图片理解模型时会替换该用途的旧兼容路由；连接密钥保存后不再停留在界面状态中，后续用途调整不会清空已保存密钥。

- 正式 MCP 设置页开始展示真实连接后的工具清单，并支持逐工具允许/禁用；许可状态写入加密 MCP 配置，Registry 注册与执行前调用均按许可过滤，旧配置默认保持全部允许。
- 正式设置的体验基线收敛为已验收的 Playground demo；旧 UI 展示和重复入口不再保留，真实后端、用户数据与安全边界不受影响。
- 设置开关滑块不再使用固定白色，关于页移除未采用的旧宣传说明，主题切换下的基础控件保持一致。
- Playground 与权限确认等基础动作控件不再硬编码白色前景，深浅主题下保持同一语义颜色。
- Skills 正式管理页的列表、详情、编辑和版本历史控件改用共享主题 token，真实 Skill 管理能力不变。
- 模型配置新增兼容旧单连接字段的真实连接与用途路由基础链路；连接密钥不会返回 Renderer 或进入备份文件。
- 正式“数据与隐私”操作卡与 Playground 同源，导出/导入保留真实 IPC、取消与错误提示，并在执行期间锁定另一操作，避免重复触发。
- 正式模型设置补齐 Playground 已确认的“高级设置”折叠入口：运行预算、Temperature、Top P 和最大输出 Token 现在可见且沿用真实自动保存链路；未新增模型协议或后端契约。
- 正式设置继续收敛到 Playground 已确认的体验：移除语言占位卡与关于页重复运行信息，保留真实配置、权限、数据、Skill 与 MCP 能力；人物世界家居视图补充真实空间物件读取，足迹视图补充地点、摘要与日期展示。
- 正式“外观与界面”已统一采用 Playground 确认的四主题卡片交互（瓷青、曜石、松烟、绛紫），主题选择与 Markdown / Diff 的语义 token 共享同一生产设计资产注册表；旧主题值仅作为持久化兼容输入，不再作为正式选项展示。
- 正式“权限与自动化”“数据与隐私”“关于 My Agent”已采用 Playground 同源的卡片与设置行样式；真实权限规则编辑、数据导入导出和本机数据说明保持可用。
- 正式“模型”和“MCP”页面已采用 Playground 同源的连接卡片与固定操作槽；模型密钥、连接测试、MCP 添加、启用/禁用和删除仍走真实生产链路。
- 正式记忆条目现在采用 Playground 同源的长文本编辑、敏感信息首行提示和日期/编辑/删除固定操作槽，长内容不会把日期或按钮挤出布局。
- 正式人物世界现在提供朋友圈、衣柜、文化角、家居、通讯录、足迹六个入口；文化角、家居和足迹基于真实伙伴状态只读展示，暂不伪造独立编辑能力。
- 正式设置已使用 Playground 的九区导航和共享伙伴设置组合；旧 MUTABLE / 反思等表单入口移除，后端和用户数据保留。设置各内容页尚未全部对齐 demo，不将导航共用视为完整回流。
- 相处补充说明改为独立偏好，不再写入旧全局 System Prompt；自动保存只提交修改过的字段，保存失败可重试，连续编辑不会被较早的保存请求清掉。输入、IPC、存储和备份导入统一限制为 4000 UTF-16 代码单元。
- 命令控制台支持在当前实例内用上下键回看已执行命令，失败后可以直接恢复并重跑；历史不写入会话或 Agent 上下文。 面板同时显示实际工作目录和运行/成功/失败/停止状态。
- 正式终端明确定位为 Agent 命令控制台；完整 PTY 暂缓，避免把尚未证明的 IDE 终端能力带入当前产品范围。
- Agent Loop 的权限与工具资产运行记录现在使用同一份 workspace/runtime 会话上下文，不再从不存在的顶层会话字段读取。
- 正式工作区五功能界面与交互完成全量 UI 回归验收，覆盖主题、窄宽、折叠、文件多预览、审阅、终端多实例、受限浏览器和侧边聊天的失败恢复与流式状态；受限浏览器仍保持无脚本只读边界，完整 PTY 与网页交互不在本次能力范围内。
- 受限浏览器加载现在携带请求归属；关闭工作区标签或卸载面板时会取消主进程中的网页抓取，避免无主请求继续等待超时。
- Markdown 代码块的复制操作现在共用 Foundation `IconButton`，复制失败提示和复制内容不变。
- 工作区浏览器、审阅、侧边聊天和文件预览的文字恢复/打开动作现在共用 Foundation `ActionButton`，hover、禁用和主题状态不再由业务面板各自声明。
- 正式浏览器刷新、终端运行/终止和侧边聊天发送/停止按钮现在共用 Foundation `IconButton`，hover、disabled 和加载状态保持固定操作槽尺寸，不再推动输入框或面板布局。
- 正式文件浏览器的刷新、搜索、复制、系统打开和关闭预览现在共用 Foundation 控件，固定操作槽不会因 hover 或状态变化推动文件名和预览内容布局。
- 文件浏览器的 HTML “预览 / 源码”切换现在与 Foundation `SegmentedControl` 同源，选中态、禁用态和固定尺寸不再由文件浏览器单独维护。
- 正式工作区地址栏、命令控制台和侧边聊天现在与 Foundation 输入故事共用 `TextField`，文字颜色、焦点反馈和窄宽布局来自同一基础实现；原有提交、停止、流式和 IPC 行为保持不变。
- 基础差异样张、Playground 工作区和正式审阅共用同一差异查看器与视图开关。空旧稿/空新稿可以并排查看；并排状态下切换到没有旧稿的新文件会显示统一内容，不再留下空白。基础样张增加空稿、长文件和真实模式切换，长内容在内部滚动。
- 工作区图标操作统一使用 Foundation 固定尺寸按钮，添加、刷新、清空和收起/打开入口在 hover 或状态变化时不再推动相邻布局；无障碍名称由业务语义统一提供。
- 正式右坞和 Playground 工作区候选现在共用添加工具菜单的键盘导航、Escape、失焦关闭与焦点恢复行为，菜单内容仍由各自业务场景提供。
- 共享 Markdown 的代码高亮和 Mermaid 图表现在跟随所在区域的深浅主题，同屏多主题不再相互污染；图表解析失败显示简短提示与原文，快速更新或关闭后不回写旧结果。Foundation 增加同源四主题图表样张，正式文件预览等调用方直接复用，无需单独补颜色。
- 正式侧边聊天打开失败后，“重试”会重新创建会话；创建成功前输入与发送保持禁用。切换主会话时清空旧侧聊正文、草稿、生成状态和工具确认，旧异步错误不会覆盖新侧聊；旧运行仍经主进程取消并等候收尾后删除。
- 正式终端修复大块输出被误判超限而提前终止的问题；分包输出保持原始换行，累计输出上限不变。终止必须等待进程关闭，失败或超时允许重试；未完成启动握手或窗口销毁时清理运行，避免遗留缓存。Windows 真实 Electron 已验证停止及关闭标签后父子进程退出。
- 修复正式侧边聊天跳过长期记忆后仍调用空召回正文的 trim，导致首条消息无法进入模型的问题；Runtime 初始化异常不再被不可访问的 span 二次报错覆盖。
- 关闭侧聊由主进程取消运行和待确认工具，等待完整收尾再删除临时会话；关闭期间拒绝同会话新请求，重复删除合并处理，失败保留记录。初始化阶段即可停止，取消不再提前释放运行锁；窗口销毁取消确认，异窗确认无效。
- 正式侧边聊天 IPC 现在绑定活动会话与发起窗口：其他窗口不能发送同会话消息或中断，缺省会话 ID 不会触发全局中断；重复发送不会释放首个请求的控制权。
- 正式侧边聊天失败后“重试”现在会真正重新发送原消息，并保持工作区焦点上下文；不再只恢复输入框而不触发 Runtime，Renderer 回归已覆盖错误后再次发送。

- 正式工作区切换标签、进入设置或 Playground 后保留文件与终端实例，切换项目则重建，取消项目关闭工作区。终端启动早期输出现在通过就绪握手保留，不会因 runId 返回时序而丢失。终端启动失败保留命令可重试，等待启动时可取消，关闭后迟到的启动响应会补发终止；主进程按发起窗口校验终止归属，并在 Windows 回收整个进程树，退出事件前不提前清理运行记录。终止失败不再假装成功。运行与终止按钮占用固定尺寸。
- 正式审阅增加真实旧稿并排视图；列表读取或文件差异读取失败时显示可重试错误，快速切换文件时不会让过期响应覆盖当前内容。新文件没有旧稿时仍保持统一差异视图。
- 正式浏览器工作区接入受限只读网页查看：主进程校验 URL 与 DNS、拒绝重定向、限制超时和响应大小，页面在无脚本 sandbox 与 CSP 中展示；失败可重试，不提供登录态或任意站内交互。
- 正式侧边聊天接入独立工作区会话：消息走真实 Runtime 流式回复，支持停止和错误反馈；临时会话不会出现在主会话列表，关闭工作区实例时自动清理。
- 正式侧边聊天的工具确认请求现在携带会话归属；主 Chat 不再误接收 workspace 会话的确认，侧边聊天在自己的工作区内承接确认。
- 正式侧边聊天 workspace 会话不再读取或写入长期记忆、画像、向量召回和反思任务，避免工作区临时对话改变主伙伴记忆。
- 正式侧边聊天现在会把当前主会话最近内容、项目路径和当前文件／审阅焦点作为受控工作区上下文提供给 Runtime，仅用于本轮理解，不写回主会话、workspace 历史或长期记忆。
- 修复正式侧边聊天 workspace 会话创建时类型被存储层归一化为 main 的问题，确保临时会话始终保持隔离语义。

- 正式审阅保留文件中的代码围栏、aside 和链接标记原文；代码预览、审阅与基础样张共用代码块，不再将文件重新解析为 Markdown。复制按钮状态切换占用固定尺寸，复制失败可重试。
- 工作区添加菜单与候选顺序一致，修正新增面板中误显示的转义字符。浏览器与侧边聊天的真实接入情况见上方条目，不再是未接入壳。

- 正式工作区文件工具改为左侧文件树、右侧多文件预览；重复打开会复用标签，关闭和重新打开不会串入旧读取结果，失败状态支持重新读取。

- 工作区标签开始从 Foundation 共用实现：正式右坞和 Playground 使用相同固定关闭槽、键盘切换和焦点恢复；关闭后台标签保留当前选择，同类标签编号不随之变化。

- 正式 Chat 工作区使用 PanelRight 收起／打开入口，并保留原有分隔线；同页收起再打开，当前文件预览与终端输入草稿仍保留。
- Playground Chat 处理中样张在对话与工作区之间增加分隔线，并提供右上角工作区开关；收起不丢失已打开内容。

- Playground Skills 长详情文件改为限高内部滚动，保留完整内容；键盘可阅读首尾，滚动到底不再带动外层界面。

- Playground 自定义规则改为独立条目卡片，“添加”位于列表下方；表单向下展开，已有规则与入口不跳动，外层不再嵌套卡片。

- Playground 设置主题与基础四主题保持同源，点击实际切换局部样张配色；移除设置候选中的七个旧主题选项，不改变正式设置。

- 修复 Playground 自定义规则展开添加表单时已有条目上跳；“添加 / 取消添加”保持同一位置和尺寸，已有列表不再随按钮消失而移动。

- Playground 记忆条目改为右侧固定槽：默认显示日期，hover 或聚焦时原位显示编辑 / 删除图标；新增“长记忆”样张，长文本不会挤走日期或操作。

- 修复 Playground 长记忆编辑态：长文本现在使用可换行的多行编辑区，不再压缩成难以编辑的单行输入框。

- Playground 敏感记忆卡第一行统一提示“敏感信息：涉及健康隐私，请谨慎保留。”，移除重复标签和操作说明；编辑时保留提示占位，正式页面不变。

- 更正 Playground 记忆卡日期位置：日期与正文同一行右对齐，移除底部重复日期；正式记忆页布局保持原状。

- 记忆页条目日期改为与正文同一行右对齐，正文较长时保持左侧可收缩换行。

- Playground 工作区浏览器内容区移除与标签重复的 Globe 图标；Diff 代码块不再显示白色逐行底色，改为使用候选主题内凹底。

- Playground 权限与自动化将已有规则统一为“自定义规则”并默认收起；展开后看列表和“添加”，点击后才显示表单；保存追加规则并收起表单，取消不写入、空白禁存。

- Playground 紧凑记忆卡默认显示日期，悬停或键盘聚焦时淡出日期并显示编辑/删除图标；编辑态和删除确认态持续显示对应操作。

- Playground 记忆清单移除重复的页面预览框、背景和固定留白，仅保留各记忆条目的卡片边界。

- Playground 编辑连接改为在当前连接卡片内展开，不再跳到下方另开一张表单。

- Playground 记忆分类「协作习惯」改名为「工作方式」，避免被理解成和 AI 的协作约定。

- Playground 记忆删除改为卡片内确认，确认和取消替换原操作图标，不使用全局弹层。

- Playground 记忆条目卡改为正文优先：来源作为下一行淡色说明，不再使用分割线和“来自：”标签。

- Playground 模型连接清单为已有连接补了编辑入口，复用添加表单，保存后保留原模型清单。

- Playground Chat「处理中」改为嵌入五功能工作区，去掉消息流里的任务进度卡和旧预览坞；确认、完成和失败仍留在对话里。

- Playground 人物世界头图不再提供「看记忆」和「近期生活」。

- Playground 设置侧栏不再显示 Debug / Playground 导航说明。

- 记忆 Playground 新增输入焦点改为主题描边，去掉浏览器默认黑圈。

- 记忆 Playground 新增行的保存/取消改为图标，与编辑态一致。

- 工作区文件预览关闭按钮收入同一标签，不再单独描边。

- 记忆 Playground 编辑态不再把保存/取消插入正文行，日期位置保持不变。

- 工作区文件预览关闭按钮改到对应标签上，不再使用右侧独立关闭。

- Playground 设置页不再提供独立「回到 Chat」按钮，回到对话走左侧导航。

- 记忆 Playground 纠正态输入框与展示正文同字号，避免编辑时文字突然变小。

- Playground 权限规则拆成已有规则和新增规则两张卡；MCP 工具清单改为独立条目，不再用内部分割行。

- 记忆 Playground 清单改为每条独立卡片：正文作为主信息，编辑/删除改为图标按钮，添加行移出列表容器。

- 记忆 Playground 分类 Tab 下方不再显示解释小字，减少重复信息。

- 记忆 Playground 搜索展开后变成对话搜索同款输入框：左侧放大镜、右侧清除，不再保留外层搜索按钮或收起按钮。

- Playground 场景与宽度切换采用统一 MCP 风格选项，统一高度、字号、间距和选中态，多项时换行；移除 Chat 分段外框和公共故事选择下划线样式。

- 工作区样张标签与菜单取消常驻描边，标签各自带关闭按钮，移除右侧重复收起按钮；浏览器地址栏支持居中编辑、回车提交与 Esc 恢复。

- Playground MCP 的「添加连接」可填写远程/本地配置，校验后查看工具并保存隔离条目；工作区增加打开/收起入口、五功能添加菜单、独立标签与左侧 Chat 壳，文件树改为点击后在右侧打开多个预览。

- Playground 工作区改为审阅、浏览器、文件、终端、侧边聊天五个入口，提供 21 种形态样张、展开与窄栏预览；移除任务阶段及完成结果说明。支持隔离的文件切换、浏览器重试、多终端输出和侧边聊天交互。

- Skills Playground 详情恢复外层卡片，“返回 Skills”图标与文字独占一行，名称和启用开关保持同行。

### 2026-09-10 · MCP 场景直达

- Playground MCP 支持直接切换未添加、多服务、连接中、待确认、工具数量、无工具、停用、失败和登录前场景。
- 每个服务独立卡片，移除外层卡片和多步添加向导；服务开关互不影响，工具选择与连接状态分开呈现。


### 2026-09-10 · Skills 真实样张

- Skills 候选使用真实内置 code-review 和 content-creator，完整展示 SKILL.md；未声明作者不再虚构。
- 详情先触发条件、后描述；标题开关对齐，删除工具和确认约束摘要，移除详情外层卡片。每个开关独立工作，列表与详情同步。

### 2026-09-09 · 扩展与工作坞候选收口

- Playground 扩展与工具改为 Skills / 外部能力（MCP）分层管理；Skill 的版本、校验、可用工具和隔离试跑收进详情。
- MCP 添加改为“选择来源 → 填写连接信息 → 测试并确认工具”的隔离向导，连接与允许使用的工具分开表达。
- Playground 工作区改为右侧工作坞候选：任务状态、确认和恢复留在 Chat；工作坞按需承载文件、预览、审阅和终端，任务结果回到 Chat。
- 扩展设置进一步收平为直接管理 `Skills` 与 `MCP` 两个对象；Skill 主行只保留启用主动作，版本与校验降为辅助信息。`
- Skills Playground 收敛为扁平列表行：只显示 Skill 名称和纯开关，移除重复名称、描述、标签和嵌套卡片。
- Skills Playground 增加单个、多个和详情审阅状态；Skills 详情开关与标题同行，多个状态改为独立卡片。，默认状态不增加额外信息层。
- 本轮只更新 Playground fixture 与 UI E2E，不改变正式 Settings、Chat、MCP / Skill IPC 或任务运行链路。

### 2026-09-08 · 记忆管理候选

- 设置里的“记忆”不再只是跳转说明，改为提供记忆总览、搜索、四类长期信息和添加记忆入口。
- Playground 样张支持添加、编辑和删除记忆；新增内容只保存在当前隔离页面，不会写入正式记忆。
- 继续隐藏向量、召回分数和 Prompt 等技术细节；来源仅在 Debug 样张开启后显示。
- 记忆条目的编辑 / 删除操作统一放到日期行右侧，敏感项增加明确的健康信息保留提示；仅 Playground 生效。

### 2026-09-07 · 连接卡片与模型添加候选

- 获取已有模型和测试连接回到连接卡片右上角；手动添加使用加号图标。
- 连接详情改为常驻显示；获取结果改为输入区下方的候选项，点击候选直接加入，已添加项禁用并保留勾选标记；手动输入仍用加号或 Enter 提交。
- 不同连接独立保留输入草稿；切换样张清空旧候选和未完成的获取。仅 Playground 生效。

### 2026-09-06 · 编程套餐连接候选

- 添加连接新增编程套餐入口，使用现有六个套餐的专用地址；连接名称在左，并与所选预设联动。
- 修正切换来源后名称 / 地址残留上一类的问题；自定义适配器不再覆盖手填地址，普通火山 Ark 在候选归入聚合 / 中转。
- 获取模型在测试连接左侧，手动添加按钮在输入右侧；新连接不自动分配用途。仅 Playground 生效，套餐真实后端能力见 WISH-027。

### 2026-09-06 · Playground 模型配置解耦候选收口

- 模型设置候选拆分为“模型使用安排”和“连接与模型清单”：主对话、辅助任务、生图可以分别选择多个模型并调整 fallback 优先级，连接本身不再携带用途。
- 一个连接可以维护多个模型；移除“首个模型 ID”，补充“获取已有模型”样张和手动添加入口，新增连接适配器选择 OpenAI Compatible、Anthropic、Gemini。
- 中转、聚合和统一网关统一作为连接入口管理，具体平台名称由用户填写；模型列表只显示模型 ID、启用状态和数量，不铺开能力诊断。
- 本轮仍只更新 Playground 隔离候选与 UI E2E，不改变正式 Settings、生产配置、Runtime、IPC、存储或真实模型连接。

### 2026-09-05 · Debug 运行概览第一阶段

- Debug 默认先展示只读运行概览，并读取当前模型 / 凭据状态、伙伴快照、Trace 数量与错误数、当前窗口事件数；同时提供 Prompt / 资产、请求与运行、伙伴状态、系统与工具的真实证据入口。
- 本阶段复用已有 Debug IPC，不新增诊断动作，也不改变 Settings、Prompt、权限、存储或 Runtime。

### 2026-09-05 · Playground 模型与任务工作区流程候选

- 模型设置候选按连接配置、模型清单和最终用途分层，覆盖空态、单 / 双配置与添加连接流程。
- 任务工作区候选补充无任务、处理中、等待确认、待审阅、已完成和未完成六态，并展示启动时固定的模型快照。
- 本轮仍只更新 Playground 隔离候选，不改变正式 Settings、生产配置、Runtime、IPC 或真实模型连接。
- 聚合 / 中转入口预设补充阿里云百炼、硅基流动，并从官方服务商列表移出；入口文案统一为“聚合 / 中转”。
- 运行预算字段明确标注为 Token，并说明按输入与输出 Token 合计计算，避免用户误解“单位”的含义。
- 添加连接时，常见官方、聚合 / 中转和本地入口改为预设选择；连接名称跟随预设生成默认值（例如“OpenRouter 聚合”），用户仍可修改。
- 添加连接时，官方服务商改为选择官方预设并自动带出官网地址；适配器字段只在自定义连接中出现，中转和本地模型不再显示无关的协议选择。
- 连接详情中的模型操作按钮调整为“获取已有模型”在前、“测试连接”居中、“手动添加模型”在后，减少用户在连接测试与模型维护之间的来回寻找。

### 2026-09-05 · Playground 设置模型与相处方式重构候选

- 将“回答方式”归入“伙伴与相处”，并用具体例子解释自动、讲清楚一些、重点优先和直接一点；长期信息管理单独命名为“记忆”。
- 模型设置改为围绕已添加连接展示，不再默认铺开全部 Provider；新增空态、单连接、多连接和添加来源流程样张，主视图只保留模型 ID 与用途，不再铺开能力诊断。
- 配置详情可查看模型数量、启用数量、模型用途，并在隔离样张中添加 / 启用 / 停用模型。
- 本轮仍只更新 Playground 候选，不改变正式 Settings、生产配置、真实 API Key 或模型连接。

### 2026-09-04 · Playground 设置文案与交互澄清

- 记忆与相处将“解释粒度”改为更直观的“回答方式”，为每个选项补充真实使用例子。
- 扩展与工具、关于 My Agent 移除面向内部设计的说明，品牌标语改为待定占位。
- 权限与自动化补充可操作的规则样张：可选择操作类型、处理方式和匹配内容，并在 Playground 内即时查看结果。
- 本轮仍只更新 Playground 隔离候选与测试，不改变正式 Settings、权限引擎或生产数据。

### 2026-09-03 · Playground 设置候选补充

- 设置一级导航保持“日常 / 高级”结构不变，补充模型页的会话预算与每日预算样张，明确 0 表示不限制。
- 扩展与工具页补充 Skills 的启用状态、版本、校验结果和隔离试跑入口；仍与 MCP 的外部连接管理分开。
- 在模型、伙伴、权限、Skills 与 MCP 的关键区域增加轻量作用范围提示，帮助用户理解本机 / 伙伴 / 全局影响面。
- 本轮只更新 Playground 隔离候选、施工合同与测试，不改变正式 Settings、IPC、存储或真实连接行为。
- 角色架不再占用独立全屏样张；进入角色架时保留设置左侧导航并选中“伙伴与相处”，角色列表在右侧详情区展示。

### 2026-09-02 · Playground 设置体系候选

- 完成设置 11 个现有 Tab 的能力、风险和架构边界审计，并新增设置 IA 施工合同。
- Playground 设置样张改为“日常 / 高级”分组，覆盖外观与界面、伙伴与相处、模型、记忆、数据与隐私、权限与自动化、扩展与工具。
- 模型高级控制、权限规则、MCP 连接和数据备份均提供隔离状态样张；不读取真实 API Key、MCP 密钥、权限规则或本机路径。
- 本轮只更新 Playground 候选和测试，不改变正式 Settings、IPC、存储或真实设置行为。
- 补齐窄宽设置导航的横向滚动约束、Tab 与内容区的 ARIA 关联，以及页面切换的连续淡入；键盘操作可直接切换设置分区。

### 2026-09-01 · Playground 记忆信息架构候选

- Playground 记忆改为“身份信息 / 协作习惯 / 沟通偏好 / 我们之间”四类导航，避免“关于你”与协作、沟通信息混杂。
- 多条记忆以紧凑列表呈现；普通浏览不显示来源或“之后会”，仅在隔离 Debug 开启后显示右上角“查看来源”开关。
- 本轮仍只改 Playground fixture 与预览能力，不改变正式记忆分类、数据来源、IPC 或持久化。
- 样张进一步按“稳定背景 / 如何协作 / 如何沟通 / 我们共同确认过什么”重新归位，避免四类 Tab 的内容互相兜底。

### 2026-09-01 · Playground 记忆布局收口

- 记忆候选以“关于你 / 关于我们”作为唯一归属导航，多条记忆改为两列中性卡片，减少技术分类造成的视觉噪音。
- 每条样张继续展示“来自 / 之后会”，空态、敏感项和纠正记忆仍可操作；状态样张只服务 Playground 验收，不进入正式用户导航。
- 本轮仍只改 Playground 预览能力，不改变正式 MemoryPanel 的默认路径、记忆数据模型、IPC 或持久化。

### 2026-08-31 · Playground 记忆与人物世界边界候选

- 记忆 Playground 改为按“关于你 / 关于我们”切换归属，并扩展为多条长期信息样张，验证真实列表密度。
- Agent 的朋友圈、衣柜、文化角、家居、通讯录和足迹继续作为人物世界呈现，不在记忆面板重复列出；当前动作和系统做过什么留在 Chat / 工作区 / Debug。
- 这轮只改 Playground 候选与文档边界，不迁移生产记忆数据模型或 IPC。

### 2026-08-31 · Playground 记忆与设置关系旅程候选

- 记忆样张现在会用「来自 / 之后会」解释一条关系记忆的来由和后续影响；不会展示向量、Prompt、召回分数或模型提取等内部机制。
- 「纠正记忆」可以在 Playground 内存夹具中实际编辑、保存或删除，切换样张后自动恢复，不会修改用户真实记忆。
- 从记忆页进入设置会直接打开「记忆」分区，可返回记忆面板并回到 Chat；本轮不改变正式 Settings、Memory、IPC 或数据保存行为。

### 2026-08-31 · Playground 人物世界图标语义收敛

- 衣柜改用 Lucide `Shirt` 图标，朋友圈与通讯录同步使用更贴合语义的 `Newspaper` / `Users` 图标；只更新 Playground 候选，不改变正式人物世界入口。

### 2026-08-30 · Playground 人物世界六维入口候选

- 人物世界 Playground 新增六个并列生活维度：朋友圈、衣柜、文化角、家居、通讯录、足迹；足迹固定在最后。
- 文化角隔离展示书、读书笔记、音乐、电影和摄影；家居展示当前空间与生活物件；足迹展示旅行与地点线索。
- 本轮只更新 Playground 候选，正式人物世界仍保持既有入口和生产数据边界。

### 2026-08-30 · Playground 人物世界入口命名收敛

- Playground 人物世界的“名册”入口改名为“通讯录”，内部 `cast` key 和正式页面默认文案保持不变，先验证用户心智，不提前改变生产 UI。

### 2026-08-30 · Playground Chat 确认与结果语义收敛

- 需确认样张改为覆盖 Chat 舞台的应用内全局确认层，消息流不再承载权限确认卡；候选结构对齐生产 App 根层确认队列和 Alice 的独立权限请求语义。
- 已完成样张改为普通伙伴最终回复，去掉无必要的独立完成卡；未完成样张保留为失败恢复面板，并明确没有修改任何内容、可重试或回到对话。
- 本轮只更新 Playground 候选与验收文档，不改变生产权限、Runtime 或正式 Chat。

### 2026-08-30 · 产品体验总图对齐

- 新增产品体验总合同，明确 Chat、人物世界、设置和按需工作区的职责，以及首次进入、日常陪伴、记忆管理、任务处理和角色切换路径。
- 本轮只更新施工边界和 Playground 验收计划，不改变正式产品行为。

### 2026-08-30 · Playground 朋友圈图片样张

- 朋友圈动态现在可以在正文与互动之间展示图片；首条隔离样张加入带替代文本的窗边茶饮图片，并限制单图比例与最大尺寸。
- 删除动态卡右上角重复的“生活动态”文字，信息层级更接近微信朋友圈。
- 带图动态的地点信息移动到图片下方左侧，时间行只保留相对时间。
- 这轮不代表生产侧已支持图片生成、上传或持久化；图片仍是 Playground 本地 fixture。

### 2026-08-30 · Playground 产品体验主角连续性

- 角色架从 Chat 伙伴身份可达，切换后的隔离主角会同步投影到 Chat、朋友圈、物什和名册。
- 设置正式面板在 Playground 中改为只读预览，避免实验故事触发真实设置读取或写入。

### 2026-08-30 · Playground 记忆与设置旅程连线

- 记忆候选增加进入设置的轻量入口，设置候选增加回到 Chat 的入口，补齐“人物世界 → 记忆 → 设置 → Chat”的候选闭环。
- 入口只切换 Playground 页面，不读取或写入真实记忆、设置或会话。

### 2026-08-30 · Playground 人物世界进入记忆

- 人物世界候选头图区增加“看记忆”入口，允许从生活面继续查看长期关系信息。
- 该入口只切换 Playground 页面，不读取或写入真实记忆数据。

### 2026-08-30 · Playground 任务旅程回收

- Chat 的“处理任务”候选增加“回到对话”动作，能够收起隔离工作区并回到消息流。
- 该动作仅改变 Playground 夹具状态，不关闭真实任务、不写入会话，也不改变正式 Chat。

### 2026-08-30 · Playground 产品体验旅程连线

- Chat 欢迎区的快捷入口现在可以真正进入“正在聊天”或切换到人物世界，不再只是静态样张。
- 该导航只在 Playground 候选中生效，不改变正式 Chat 的生产路由和会话行为。

### 2026-08-29 · Playground 朋友圈互动行候选

- 朋友圈 Playground 动态的赞 / 评论改为靠左的微信朋友圈式紧凑互动行，使用 Lucide 心形与评论气泡图标，并保留轻量分隔线和 hover / focus / pressed 反馈。
- 赞在隔离样张中可切换状态；评论只呈现候选选中态，不接入真实点赞、评论数据或 IPC。

### 2026-08-30 · Playground Chat 任务生命周期候选

- Chat Playground 新增处理中、需确认、已完成和未完成四种任务生命周期样张。
- 权限确认复用正式确认卡；任务结果和失败恢复留在 Chat，只有处理中按需显示隔离工作区。
- 本轮不改变生产 Prompt、Runtime、工具、权限或正式 Chat 行为。

### 2026-08-29 · Playground Chat 主旅程候选

- 产品体验 Playground 新增 Chat 的“初次进入 / 正在聊天 / 处理任务”三种验收状态。
- 正在聊天展示轻量消息流；处理任务才按需出现隔离工作区，避免 Chat 默认被第二主界面占据。
- 这轮只改变 Playground 候选，不改变正式 Chat、会话、LLM 或工作区行为。

### 2026-08-29 · Playground 朋友圈 Alice 结构候选

- 人物世界 Playground 新增轻量人物头图 / 身份区，下面承接朋友圈、物什、名册导航。
- 朋友圈样张改为更接近 Alice / 微信朋友圈节奏的动态卡：相对时间、地点、正文、生活动态标识和互动行。
- 以上只作用于 Playground 隔离样张，不改变正式人物世界的图片资产、数据来源或互动能力。

### 2026-08-29 · Chat 空态收口当前主角入口

- 移除首页空态中的「换个主角」按钮；首页只承载当前伙伴的问候和开始聊天建议。
- 换主角入口统一保留在设置的角色架中。

### 2026-08-29 · Chat 侧栏搜索与切换动效

- 会话搜索改为在顶部入口行内拉开，不再把输入框单独挤到下一行；支持输入过滤、Escape 关闭和显式关闭按钮。
- 侧栏收起 / 展开改为平滑滑动过渡，侧栏与拖拽分界柄作为一个整体进退。

### 2026-08-29 · Sidebar 底部入口减噪

- 去掉底部“开发 / 产品”分组标题，直接展示 Debug、Playground、人物世界和设置入口。

### 2026-08-29 · 记忆与 Skills 入口收进设置

- 产品侧栏底部不再单独展示记忆，Memory / Skills 不再通过二级工具列进入。
- Settings 的「记忆」与「工具」分区保留管理入口，原有 MemoryPanel / SkillsPanel 能力不变。

### 2026-08-29 · Debug 入口全局化

- Debug 统一进入全页诊断工作区；Chat 不再显示“对话内调试”开关，也不再打开右侧半屏 Debug。
- 侧栏、设置和 Chat 辅助入口都指向同一个 `DevPanel`，真实调用记录、Trace 与事件集中在“请求与运行”中查看。
- Debug 分区导航去掉冗余身份标题，保留返回与刷新操作。

### 2026-08-29 · Provider 入口与模型选择解耦

- Provider 卡片只负责选择供应商与 Base URL，模型 ID 改为设置页独立字段，不再把过时模型写死在 Provider 注册表和卡片中。
- Chat 底部快切改为切换 Provider 入口，保留用户当前模型；当前模型通过按钮 hover 查看。

### 2026-08-29 · Alice Provider 入口同步

- 模型设置 Provider 入口依据仓库内 Alice Provider 清单收敛为 24 个，分为海外直连、国内服务商、编程套餐、聚合与代理、本地 / 自定义；入口不再携带固定模型。
- 预设、Chat 快切和 Debug Provider 资产继续共享唯一注册表，不暴露 API Key。
- 明确排除 ListenHub（TTS）与 CLIProxy 订阅代理，避免误显示为普通聊天模型。

### 2026-08-29 · Chat 空态减负

- 移除欢迎区中关于主角切换规则的说明条，避免在用户尚未开始对话时打断主视觉。
- 该规则继续由角色架 / 设置上下文承载；空态只保留伙伴问候、建议动作和输入框。

### 2026-08-29 · Playground 人物世界入口收口

- 移除 Playground 业务状态中的伙伴状态条样张，避免用一条横向状态栏承载过多业务入口。
- 人物世界收敛为朋友圈、物什、名册三个 Tab；角色架移动到设置样张中。
- 朋友圈继续使用接近微信 / Alice 的近期社交流样式，保留头像、时间地点、正文、互动和近期声明。
- Playground 朋友圈样张补充可切换的赞 / 评论互动行，正式页面默认不启用无后端的假互动。


### 2026-08-29 · Playground 产品体验基础引用校准

- 移除 Chat 样张中没有直接体现的 Markdown 渲染器引用。
- 将 Markdown 渲染器归入实际承载文件预览的工作区样张，避免基础引用与体验组合不一致。
- 本轮只调整 Playground 依赖证据与测试，不改变正式产品行为。

### 2026-08-29 · Playground 分隔线样张合并（候选）

- 将“分隔线的边界”从独立纯文字卡合并进分隔线样张，改为正确 / 不当使用的可视化对照。
- 保留水平、垂直分隔线和无障碍语义，避免用文字卡代替真实预览。
- 本轮只影响 Playground 候选态。


### 2026-08-29 · Playground 分栏拖拽样张减层（候选）

- 将分栏拖拽的最小 / 最大边界说明并入同一张预览卡，保留验收约束但不再单独占用一个故事卡片。
- 本轮只影响 Playground 候选态。


### 2026-08-29 · Playground 交互与产品体验页收口（候选）

- 主题比较、动效样张和 Foundation 标签样张补齐可操作反馈，去掉无效按钮和不可点击的假状态。
- 产品体验页统一使用轻量体验舞台，Chat、人物世界、记忆、设置和工作区共享相同的画布层级与基础引用布局。
- 本轮只影响 Playground 候选态，不改变正式产品页面。


### 2026-08-29 · Foundation 设计语言重构（候选）

- 设计语言 Playground 从 token 目录重做为颜色、主题、形态 / 材质 / 动效三组可判断样张。
- 主题卡升级为同一套微型产品界面；补充圆角角色、纯面 / 柔面 / 蒙版对照与持续动效开关。
- 蒙版明确只用于浮层，普通内容卡默认保持纯面或柔面。
- 本轮只影响 Playground 候选态，不改变正式主题或正式产品页面。


### 2026-08-29 · Playground 主题候选重新分化（候选）

- 移除与宣纸方向过于相近的铜版主题。
- 新增瓷青冷色浅色主题与绛紫莓果深色主题，让候选在色温、明暗和材质感上形成更清楚的比较。
- 本轮只影响 Playground 候选态，不改变正式主题。


## 2026-08-28 · Playground 高级感视觉收口（候选）

- Playground 主画布、导航、页头和故事块统一材质、留白、圆角与边界节奏，减少等权卡片造成的目录感。
- 设计语言 token 卡保留颜色作为主视觉，并增加低对比度悬停层次；边缘态不再显示额外标签。
- 修正窄屏一级导航的布局选择器，确保 Playground 仍可横向浏览。
- 本轮只影响 Playground 候选态，不改变正式产品默认行为。



### 2026-08-28 · Playground 视觉减噪与主题比较迭代

- 基础组件故事切换改为轻量横向文字导航，减少厚重灰色容器。
- 主题候选支持选择当前比较方向，卡片和摘要同步反馈。
- 本轮只影响 Playground 候选态。


### 2026-08-28 · Foundation Design Language v2 Playground 研究

- 设计语言 Playground 增加颜色角色、交互状态矩阵、4 个主题候选微型界面、圆角角色和动效 easing 预览。
- 基础组件 Playground 增加统一检查维度：默认、hover、pressed、focus、禁用、错误 / 空态、窄宽、键盘 / ARIA。
- 以上内容只用于候选研究，不改变正式主题和生产组件。


### 2026-08-28 · 已确认 Playground 方案回流正式 UI

- Chat 右侧工作坞默认显示预览，文件、预览、审阅、终端改为通过“+”按需添加；文件与预览切换时保留当前文件上下文。
- 正式 Markdown 代码块使用独立层级底色；人物世界默认采用朋友圈式动态流；记忆分类颜色收敛为 accent / warm / success / muted 四类语义色。
- Playground 继续保留开发者来源、采用证据、调试控件和隔离样张，不带入正式产品。


### 2026-08-27 · Foundation Playground 基础组件补齐（候选）

- 参考 Alice 基础组件展示，新增图标按钮、通用卡片、徽标、标签和分隔线的隔离样张。
- 基础组件入口按 13 个任务型 Tab 展示；相近入口只做导航合并，不减少底层组件故事。
- 本轮仅更新 Playground、注册表和测试，不改变正式页面默认行为。


### 2026-08-27 · Playground 来源与图标尺寸展示收口（候选）

- 一级页头的基础引用与 `.tsx` 来源保持同一行，来源使用固定宽度，过长省略并通过 hover 查看完整路径。
- 图标尺寸恢复为独立样张卡：固定展示 12 / 14 / 16 / 20，滑杆只作用于少量自定义预览图标，不再改变整个图标目录的视觉尺寸。
- motion 样张增加统一播放开关：打开时持续播放，关闭时停止动画。
- 基础与 Agent 实验一级页的 `.tsx` 来源移到标题、说明同一行，继续保持固定宽度省略并支持 hover 查看。
- Foundation 故事来源统一补齐可定位的 `.tsx` 路径，并沿用固定宽度省略 / hover 规则。
- 本轮只影响 Playground 候选态，不改变正式产品默认行为。


### 2026-08-26 · Playground 控件与故事导航收口（候选）

- 图标来源路径放到搜索按钮左侧，图标尺寸改为固定值 + 自定义滑杆，移除重复的独立尺寸展示。
- 圆角支持自定义滑杆，motion 样张自动播放并把毫秒值放到 token 名同行。
- Foundation 基础组件导航合并相近 Tab，但保留每个细粒度故事的真实预览。
- 所有产品体验页的来源路径统一放到基础引用行右侧，并支持省略 / hover 查看。
- 设计语言、图标与视觉、基础组件以及 Agent 实验 Tab 也统一采用同样的页头来源布局，补齐可定位的 `.tsx` 来源；长路径固定宽度省略并支持 hover 查看。
- 本轮只影响 Playground 候选态，不改变正式产品默认行为。


### 2026-08-26 · Chat Playground 页头信息归位（候选）

- Chat 用途说明移动到标题右侧同一行，减少页头纵向层级。
- Chat 实现来源路径移动到基础引用行最右侧，组合样张下方不再重复显示 `.tsx` 路径。
- 本轮只影响 Playground 候选态，不改变正式产品默认行为。

### 2026-08-26 · Playground 图标目录头部收口（候选）

- 图标搜索按钮与展开后的搜索框并入目录标题行，避免搜索单独占一行。
- Playground 目录不再显示 `.ts` 实现路径；注册表来源仍保留在代码与 Debug 中，不影响资产审计。
- 本轮只影响 Playground 候选态，不改变正式产品默认行为。


### 2026-08-25 · Playground 页面组合减层（候选）

- Chat 页面组合样张仅保留低对比来源路径，并与“标准宽度 / 分栏窄宽”切换合并为同一条紧凑工具行，移除重复的页面级说明层。
- 图标目录数量统计移入目录标题同行，保留搜索默认收起与紧凑网格。
- 本轮只影响 Playground 候选态，不改变正式产品默认行为。


### 2026-08-24 · Playground 基础视觉减噪（候选）

- 移除设计语言页没有实际产品用途的“重新读取”按钮；Token 展示随页面和主题切换自然更新。
- Markdown 渲染故事的代码块改为使用更明确的 `--bg-tertiary` 层级，避免浅色主题下代码区看起来像白底；正式 Chat 默认样式保持不变。
- 图标尺寸故事改为同一语义图标的 12 / 14 / 16 / 20 实际阶梯展示；图标搜索默认收起为放大镜，点击后再展开。
- 设计语言页把 `--motion-fast` / `--motion-normal` / `--motion-slow` 改为可点击播放的动画样张，直接观察速度差异。
- Playground 页头移除重复工作域小标题和“隔离实验”徽标；产品体验页把当前体验的基础引用收进统一页头元信息行，不再在页面内容前额外插入一张依赖卡。
- 清理 Playground 样张中的特定人物和外部参考产品名称；仍只影响 Playground 候选态，不改变正式产品页面。

### 2026-08-24 · Foundation 故事注册架构（候选）

- 新增 Foundation 故事注册表，统一连接组件资产、Playground Tab、视觉分组和预览 renderer。
- Playground 基础组件入口不再依赖多份手写故事列表；新增故事会经过 assetKey、renderer 和 E2E 一致性门禁。
- 本轮只改变 Playground 组织方式，不改变正式产品页面默认行为。

### 2026-08-24 · Foundation 组件故事补齐（候选）

- 基础组件 Playground 新增下拉选择、表单字段、复选框、开关和差异查看器预览。
- 新增对话框、弹出层、下拉菜单、可搜索选择、命令面板、右键菜单、滚动区域、提示浮层、骨架屏和进度条的隔离候选样张。
- 候选样张不引入真实 IPC、第三方依赖或生产默认行为；下一步转入基础组件统一样式验收。

### 2026-08-23 · Playground 布局收口（候选）

- 基础组件故事切换条不再显示灰色分组标题，只保留一条连续的横向 Tab；分组关系仍保留在代码数据中。
- 为每个 Playground 一级 Tab 增加统一页头和目的说明。
- 统一主内容宽度，收拢基础故事筛选，减少页面级说明块和外层故事卡嵌套。
- 该改动只影响 Playground 候选态，未回流正式产品页面。

### 2026-08-23 · Foundation 基础模块补齐（候选）

- Playground 基础组件工作台新增 Markdown 渲染、文件树、资产目录、标签切换、生成动作、提示条、加载指示器和分栏拖拽等基础预览。
- 基础页改为单行横向故事切换 + 真实预览，移除没有预览价值的资产总览和候选文字区；完整登记继续在注册表 / Debug 中查看。
- 图标采用标记统一落到具体图标卡右上角；本轮仍只影响 Playground 候选态，不改变正式产品默认页面。

### 2026-08-21 · Playground 结构收口（候选）

- 新增基础 / 产品体验的两层边界文档和 Tab 事实表，避免业务组件混入基础目录。
- Playground 基础入口改为“设计语言”；图标目录改为竖排图标 + 中文名 + 灰色英文名。
- 产品体验页展示“体验组成 / 基础能力”，人物世界四个业务 Tab 使用隔离样张可切换。
- Right Dock 候选支持同类型 Tab 多开，关闭当前实例不会影响其它实例。
- 以上均停留在 Playground P0，尚未改变正式产品默认页面。

### Changed — Playground 全屏与目录减噪（2026-08-19）

- Playground 现在像设置一样独立全屏打开，不再与产品主侧栏组成双层导航。
- 移除重复说明块、基础组件“组件索引”和全局“显示已采用”开关，避免目录级状态误导。
- 图标目录改为紧凑的“图标 + 中文 + 灰色英文”，语义 key 和用途仍保留在注册数据与搜索逻辑中。

### Added — 产品体验基础依赖门禁（2026-08-19）

- Playground 产品体验现在明确显示所使用的基础组件，基础组件索引反向显示被哪些体验引用。
- 新增产品体验注册表和自动检查；不存在、非基础层或生命周期不兼容的组件引用会阻止测试与提交。
- 产品体验资产纳入 `assets:check`，反向使用关系由依赖声明自动生成，不维护第二份清单。

### Changed — Playground 基础与产品体验分层候选（2026-08-19）

- Playground 导航收敛为“基础 / 产品体验 / Agent 实验”三个工作域；基础组件与业务状态改为工作台内筛选，不再把不同层级的 Tab 平铺混合。
- 产品体验按 Chat、人物世界、记忆、设置、工作区直接进入，并明确只能引用基础侧能力。

### Changed — Playground 导航与生活面精修候选（2026-08-19）

- Playground 组件目录改为一级入口，取消页面内第二套组件导航；任务域标题只承担视觉分组。
- Right Dock 候选改为“预览”默认打开，文件 / 预览 / 审阅 / 终端四 Tab 通过“+”按需添加，审阅和终端不连接真实能力。
- 人物世界候选改为朋友圈式社交流，移除重复生活广播标题与 Catch-up 独立卡；记忆候选只保留三种主色和灰色。
- Chat 壳候选移除主内容区的“新对话”顶部框，保留侧栏的新对话入口。
- 以上变化仍只在 Playground P0，等待人工确认后再决定是否回流正式页面。

### Changed — Playground 页面基线精修候选（2026-08-18）

- Sidebar 候选底栏贴底并去掉“开发 / 产品”标签；主侧栏候选不再单独显示记忆，已删除“二级页收起”和工具 Secondary Nav。
- Right Dock 与人物世界分别加入隔离的文件树 / 代码预览、朋友圈 / Catch-up 样张，不读取真实项目或伙伴状态。
- Toast 四态关闭按钮沿统一右边界对齐，记忆分类图标与文字保持同行。
- 这些变化只存在于 Playground P0，尚未回流正式页面。

### Changed — 正式 Sidebar 开发入口位置（2026-08-18）

- Debug / Playground 从会话区下方移到底部产品区上方，固定贴近“人物世界 / 记忆 / 设置”入口。
- 本轮只回流开发入口位置；正式 Sidebar 的记忆入口与区块标签尚未改变，后续 IA 先在 Playground 新合同中验收。

### Changed — Sidebar 导航 Playground 候选态（2026-08-18）

- Playground 页面组合新增 Sidebar 候选：开发入口回到底部产品区上方，产品候选只保留人物世界 / 设置。
- 曾新增“二级页收起”与工具二级导航故事；后续人工验收明确否决，已由新的页面基线精修候选删除。
- 该历史候选未回流正式生产页面。

### Fixed — 记忆后台任务与 CI teardown 竞态（2026-08-17）

- 记忆写入的向量索引后台任务增加可等待生命周期边界，保留正常调用的非阻塞体验。
- GitHub Asset registry 工作流不会再因动态加载辅助模型配置跨过 Vitest teardown 而失败。

### Changed — Chat 页面布局与设置交互（2026-08-17）

- Chat 主区不再重复角色名；Debug / Playground 等全页视图移除了无内容的顶部留白。
- Sidebar 的 Debug / Playground 移到会话列表上方，窗口较矮时仍可直接进入开发工具；产品入口继续留在底部。
- 欢迎页的主角联动规则改为轻量引用提示，页面组合故事与正式 Chat 使用同一套结构。
- 设置页取消手动保存栏，修改后自动保存；API Key 仍遵守安全视图与空值防覆盖规则。

### Fixed — 跨平台删除安全与 GitHub Actions（2026-08-17）

- 永久删除白名单改为只检查工作区内部相对路径，Linux 项目位于 `/tmp` 时不会再把普通文件误判为可永久删除。
- Unit CI 不再为无界面测试下载 Electron 桌面二进制，避免慢速下载触发测试超时和连锁环境销毁报错。
- GitHub Actions 官方组件升级到当前 v7 主版本，消除 Node 20 Action Runtime 弃用警告。

### Added — 全量资产审计与自动登记门禁（2026-08-17）

- 新增设计资产注册表，主题与字体比例由 Settings、Playground、MarkdownRenderer 共享同一生产来源。
- SubAgent researcher / coder / analyst 现在作为可审计生产资产出现在 Debug 目录，真实命中时记录角色 usage evidence。
- 新增 `npm run assets:check`、资产治理清单、机器审计报告和 staged 漏登 fail-closed 门禁，并接入 Git hooks 与 GitHub Actions。
- 完成 12 个资产家族的全量盘点；审计快照归档于 `_archive/audits/asset-registry-audit-2026-08.md`。

### Added — Playground UI 组件资产目录（2026-08-17）

- Playground「组件 → 组件目录」现在统一展示行为、状态、开发工具、伙伴世界和布局导航组件。
- 组件资产可按分类和采用状态筛选，并展示中文主名、英文术语、稳定 key、实现来源、故事数量与无障碍约束。
- Radix 等外部 Primitive 只登记为候选，不会因为出现在目录中就自动安装或冒充已落地能力。

### Added — Playground Lucide 语义图标目录（2026-08-16）

- Playground「组件 → 图标」现在提供可搜索、按分类筛选的 Lucide 图标目录。
- 每个候选图标登记中文主名、灰色英文名、稳定语义 key、使用场景和 P0 / P1 优先级。
- 生产继续只使用 `lucide-react`，Alice 的 Tabler 仅作为视觉参考，不引入第二套生产图标库。

### Added — 文档自进化复盘闭环（2026-08-16）

- 新增只读 `npm run docs:self-review`，定期扫描变更同步缺口、重复真相源候选和文档维护债务。
- 新增 `npm run docs:self-review:prompt`，生成结构化 AI 复盘任务；AI 只提出建议，不自动改规则、决策、模块卡或产品代码。
- GitHub Actions 每周生成复盘 artifact，并保留手动触发入口。
- 复盘问题沿用 rules-feedback / wishlist / decisions / 模块卡 / `_archive/audits/` 路由，不新增平行 backlog。

### Added — 文档变更影响与收工闭环（2026-08-16）

- Wishlist 未完成项增加稳定 `WISH-xxx` ID 和来源字段；模块卡增加相关 DEC 索引。
- 新增 `npm run docs:impact` 与 `npm run docs:validate`，根据 staged 代码路径输出必须复核的文档。
- `npm prepare` 自动启用仓库 Git hooks；commit 前运行文档结构与影响门禁，push 前再次检查结构。
- GitHub Actions 在 Push / Pull Request 上自动运行文档一致性门禁。
- 施工合同增加“稳定事实回流、缺口登记、账本更新、验证通过、生命周期冻结”的收工门禁。

### Changed — 文档真相源与生命周期（2026-08-16）

- 文档入口明确区分当前能力、架构、质量、决策、施工合同、待办、进度和历史快照，降低开发者读到过时结论的风险。
- Progress、Wishlist 和 Rules Feedback 改为只显示当前内容；完整旧记录仍可从归档索引读取。
- 已完成的安全、实现和缺口审计冻结为 dated snapshot，不再冒充当前事实。
- 新增文档一致性检查命令，自动发现失效链接、施工合同状态错位和不存在的 DEC 引用。

### Fixed — 安全设置与 MCP 凭据边界（2026-08-16）

- 设置界面不再接收 API Key 和 MCP 环境变量原文；未修改 Key 时不会用空值覆盖已保存凭据。
- MCP 配置统一校验结构、数量、参数和 secret 恢复；启用或修改外部连接需要主进程确认。

## 历史版本与施工记录

项目公开 alpha 前尚未建立稳定版本切分。2026-06 至 2026-08-16 的完整逐项记录保存在：

- [完整历史 Changelog](../_archive/ledgers/changelog-through-2026-08-16.md)
- [完整历史 Progress](../_archive/ledgers/progress-through-2026-08-16.md)

- Skills 详情现在明确标出“技能描述：”，与触发条件保持同一信息层级。

- 记忆 Playground 统计仅保留已记住与最近更新；搜索改为放大镜入口，添加记忆改为紧凑图标按钮。

- 记忆 Playground 移除已记住与最近更新统计卡，减少与分类和列表重复的信息。

- 记忆 Playground 移除重复的长期信息说明文案。

- 记忆 Playground 的添加入口改为已有列表底部的新增行交互。

- 记忆 Playground 新增改为当前分类列表底部内联输入，移除新增时的分类下拉。

- 正式终端面板在多个实例同时存在时只显示自己的命令输出；终止或关闭面板会清理对应运行，避免后台进程和输出继续影响界面。

- Markdown 代码块在正式工作区与 Playground 使用一致的主题内凹底色，避免浅色高亮主题带出白色逐行背景。

- 工作区审阅中的 diff 现在与其它 Markdown 代码块使用一致的主题底色和渲染方式，长内容仍限制在工作区内部滚动。

- 正式工作区入口统一为审阅、浏览器、文件、终端和侧边聊天；尚未接入后端的浏览器与侧边聊天会显示明确空态，不会伪造可用能力。

- 正式工作区的浏览器和侧边聊天入口现在有明确的未接入空态，避免用户把候选样张误认为真实可用功能。

- 2026-09-14：设置页统一采用 Playground 已确认的 demo 信息架构与共享组件；移除旧的通用 / 安全 / 连接 / 参数 / 工具 / 开发者导航，记忆、Skills 和角色架进入设置内管理。

- 2026-09-14：正式设置收敛 Skills 的旧展示入口；当时尚未完成列表→详情结构替换，完整回流见 2026-09-16 记录。

- 2026-09-15：新增正式开发者模式门控，普通模式不显示 Debug 与 Playground；可在“关于 My Agent”中开启，关闭仅隐藏入口。

- 2026-09-14：人物世界文化角不再只映射书架，现可读取按主角隔离的读书、音乐、电影和摄影记录。

- 正式模型设置移除旧的 Provider、API Key、Base URL、单模型和重复连接测试展示，统一采用 Playground 已验收的连接清单与用途路由；高级预算与生成参数保留为折叠入口，真实配置和密钥安全链路不变。

- 图片理解用途路由现在接入正式主对话运行时：只有带图片的消息会选择 image 路由，无图片消息继续使用主对话路由，未配置有效图片路由时安全回退。

- 2026-09-15：模型连接编辑继续沿用 Playground 的连接卡体验；留空密钥时保留本机安全存储中的原密钥，不会因编辑名称、地址或模型而覆盖凭据。

- 2026-09-15：人物世界的家居与足迹改为读取按主角隔离的真实生活资产；住所或常去地点未设定时保持空态，不再把未知物件或单条动态伪装成固定事实。
- 2026-09-16：正式外观设置采用 Playground 已确认的三段式结构，主题与基础四主题继续共用设计资产注册表。
- 2026-09-16：人物世界衣柜与书架删除确认改为应用内主题确认面板，保留真实资产删除链路。
- 2026-09-16：通讯录强制召唤与敏感记忆新增确认统一改为应用内主题确认面板，取消后保留原流程草稿或状态。
- 2026-09-16：Skills 正式页与 Playground 共用列表卡片、独立详情和限高全文；新增真实启停与重启恢复。用户正文可编辑、校验、保存和应用内确认删除；失败保留草稿或确认状态，处理中按钮不改变尺寸。修复正式 Electron 内置 Skill 加载失败。此前 2026-09-15 删除确认完成记录不准确，本条以实际实现和测试替代。

- 2026-10-27：路飞首批卡司关系与衣柜 starter 已接入：核心伙伴以 NPC 浅层关系加载，基础衣物由角色 starter 定义提供；千里阳光号已作为默认住所接入，未生成图片不写入运行时资产。

- 2026-10-27：千里阳光号与草帽进入路飞默认世界；草帽作为物件资产在家居画廊与 Debug 物品阅读中可追踪。路飞全功能旅程验收施工合同启动，后续按功能矩阵逐项补齐。

- 2026-10-28：草帽作为系统物件纳入备份与 Debug 物品阅读，用户创建白名单与系统出厂物件分开，避免人物核心资产在备份链中丢失。

- 2026-10-28：路飞改为沉浸式身份呈现，后续人物施工将身份呈现作为独立决策，不再强制人物自称数字伙伴。

- 2026-10-28：路飞朋友圈事件链补充伙伴互动：千里阳光号甲板、伙伴协作、航行和分享活动可进入卡司同框 / 评论投影；来源仍限关系摘要与已发布事件。
- 2026-10-28：路飞 Role Pack 新增基础衣物视觉参考图，并由人物档案关联；参考图只供资产审阅，不自动进入生图提示词或运行态穿着。
- 2026-10-28：主动问候摘要改为性别中性表达，路飞的新动态会保留千里阳光号等已发布生活事实，不再套用与人物不符的性别代词。
- 2026-10-29：主动问候模型配方补入当前人物的公开简介与 voice，只用于保持路飞语气一致；动态事实、投递门闸和确定性回退保持原边界。
- 2026-10-29：补齐路飞住所与足迹 starter 的来源回归，千里阳光号和常去地点均从人物默认世界播种。
- 2026-10-29：绑定人物穿搭的生图现在读取真实衣物槽位，路飞基础穿搭不会只停留在衣柜展示层。
- 2026-10-29：路飞评论回复回归接入主角作者记录，用户评论、主角回复和动态正文保持各自边界。
- 2026-10-29：主动消息 Electron 验收改用路飞千里阳光号动态，真实验证无窗口跳过、呈现回执、Debug 追溯和重启限次。
- 2026-10-29：正式 Debug 全导航通过 Electron 回归，路飞生产资产目录和人物世界各页完成真实只读验收。
- 2026-10-29：路飞成长反思增加专属回归，确认身份边界和生活信号不会被反思结果越界改写。
- 2026-10-29：长会话压缩增加路飞共同约定回归，关系最小集会保留用户约定并隔离人物世界事实。
- 2026-10-29：修正路飞稳定身份中的平台术语，沉浸式人物自我介绍只保留路飞身份与冒险伙伴设定。
- 2026-10-29：新增路飞千里阳光号伙伴场景视觉参考，接入人物档案的多图参考路径。
- 2026-10-29：修正 Role Pack loader 把视觉 PNG 打进 Electron 主包的问题，图片只作为项目参考文件保留。
- 2026-10-29：按用户确认，路飞完整 protected 与 selfAwareness 去除平台身份措辞；回归检查完整正文，权限与事实边界保持不变。
- 2026-10-30：Chat 新增人物生活工具：可发布当前角色朋友圈、创建家居等生活资产；生图结果可绑定已发布动态，所有写入复用角色归属、事件投影、资产白名单和媒体关联校验。
- 2026-10-30：路飞伙伴关系详情增加相处方向、摩擦点、修复方式和成长信号，并在名册、通讯录和 Debug 中保持同源展示。
- 2026-10-30：朋友圈写入支持关系参与者与阶段，路飞的关系修复事件可以在通讯录和 Debug 中追溯共同在场证据。
- 2026-10-30：路飞人物资产新增千里阳光号内部家居参考图，覆盖住所、地图桌和草帽物件的人工审阅场景。

- 2026-11-02：新增 companion_read_world，Chat 可分页查看当前人物朋友圈和生活资产，再通过真实 ID 评论或配图。

- 2026-11-02：世界观切换不再作为 Chat 工具暴露，用户通过设置 → 伙伴与相处 → 角色架手动切换。

- 2026-11-02：主对话开始读取统一人物状态摘要：当前心情以自然语言表达，近期关系事件影响关系连续性和表达方式。

- 2026-11-03：重启后主对话继续读取关系状态和最近情绪线索，Debug 世界态新增关系连续性、情绪事件与朋友圈策略只读展示。

- 2026-11-03：伙伴设置 Playground 候选新增自动发帖上限、最短间隔、自动发帖勿扰时段和自动配图偏好，生活 tick 按真人式节奏抑制连续刷屏。

- 2026-11-04：伙伴设置候选新增自动互动频率，默认偶尔互动，关系变化和同框事件才触发自动卡司评论。

- 2026-11-05：Debug 世界态记忆薄片标记共享 / 人物范围，并过滤其他人物反馈。

- 2026-11-05：Debug 世界态新增生活执行账本，可看到自动发帖策略为什么分享或跳过某条生活事件。

- 2026-11-05：Debug 主动消息入口的来源标记与模块事实同步到 `ProactiveEvidenceStore`，避免把已有投递证据误报为尚未实现。

- 2026-11-05：生活执行账本将未选中的事件标记为未选中，便于区分发帖限流与事件筛选。

- 2026-11-05：人格反思会读取当前人物已保存的阅读状态与笔记薄信号，作为反思输入来源。

- 2026-11-06：Debug 活动详情新增生活执行决策折叠区，可查看事件对应的自动推进与发帖尝试原因。

- 2026-11-06：成长反思的书架读取改为存储层有界查询，最多读取六条阅读记录。

- 2026-11-06：自主配图新增应用管理媒体存储与失败尝试记录基础设施。

- 2026-11-06：朋友圈自动投影支持 `generated` 图片策略，生成失败不会撤销文字动态。

- 2026-11-06：自动配图补齐缺配置和绑定失败的终态审计记录。

- 2026-11-06：自动配图增加默认每日一张的图片预算门控。

- 2026-11-06：自动配图预算补充首张、同日超限和跨日重置回归。

- 2026-11-06：伙伴设置候选新增每日自动图片上限。

- 2026-11-06：Debug 活动详情新增自动配图尝试记录。

- 2026-11-06：Chat 新增书架阅读笔记保存工具；现支持用户或人物记录者、来源范围、页码和章节，人物可根据明确材料自主留下感想。
## 2026-11-10

### Fixed

- 补齐宿主作息查询、关怀触发和日内计划重排的 Electron IPC 契约。
- 修复旧会话表缺少新增字段时的写入兼容，以及人物草稿发布测试的并发目录污染。
- 将 Chat 交互时间接入宿主作息感知。

- 赠礼入口拒绝未登记礼物与超长寄语。

- 限制共同决策与脆弱心境 IPC 输入长度。

- 限制手动旅行站点输入长度。

- 限制思绪触发原因与信物理由输入长度。

- 修复深夜反思和怀旧回忆普通入口绕过冷却的问题。

- 防止伪造 Chat 时间戳篡改宿主专注计时。

- 限制 companion 历史列表返回量。

- 将人物世界日记入口从人物专属称呼统一为通用「日记」。
2026-11-10：日记册页头移除重复说明文案，与其他人物世界分区统一为标题、数量和操作入口。

2026-11-10：日记详情返回入口统一使用 Foundation ActionButton。

2026-11-10：移除日记页的手动写作入口，日记由角色自主生成。

2026-11-10：日记列表移除标题与篇数页头，直接呈现日记封面。

2026-11-10：收敛日记详情信息层级，移除重复标题和装饰性元数据。

2026-11-10：将日记详情的日期、地点和心情移入日记本内容卡片。

2026-11-10：移除日记详情的收藏按钮，避免提供没有后续用途的孤立动作。

2026-11-10：日记详情移除心情文字标签，改用低干扰表情图标提示。

2026-11-10：简化日记封面卡片，移除没有状态语义的重复信封图标。

2026-11-10：日记封面移除深夜反思等分类标签，保持简单阅读结构。

2026-11-10：日记心情图标改为按心情内容动态呈现。

信物页改为封面与详情两层阅读（2026-11-11）。导航与体验目录统一使用“信物”，列表只呈现名称、获赠日期和简述，详情展示背景与赠言。

2026-11-11：修复人物世界引擎的事件投影提交顺序、切换回滚、暂停门控和角色切换竞态。

2026-11-11：修复朋友圈投影重试无法补齐已有动态关联的问题。

2026-11-11：修复文化体验回响直接写朋友圈造成的孤儿 Moment。

2026-11-11：扩展人物切换竞态防护，覆盖生活资产、旅行、重排、反思和脆弱互动。

2026-11-11：统一主动生活动作的 activeRole 校验来源。

2026-11-11：收紧聊天共振的资产清理和完成状态提交顺序。

2026-11-11：统一生活 tick 的主动消息预算，并为主动搭话增加角色级并发门闸，减少同轮打扰和重复消息。

2026-11-11：修复人物草稿快速连续创建时的标识碰撞，避免发布流程读到错误或不存在的草稿。

2026-11-11：修复人物场景背景层级，恢复 Chat 场景图可见性并保持内容区域的阅读对比度。

2026-11-12：人物世界核心层开始施工，新增统一运行态、领域事件、执行账本和 Outbox，并将文化体验完成事实接入核心账本。
2026-11-12：新增人物世界核心命令网关，统一角色校验、执行状态和失败记录，补充 handler 失败回归测试。
2026-11-12：人物世界窗口通知接入 Outbox 投递适配器，文化体验、赠礼和信物事件具备统一的成功标记与失败重试记录。
2026-11-12：生活通知迁移到核心事件记录器，主动搭话、脆弱心境、日记、深夜反思、换装、旅行、重排、评论回复、宿主关怀和朋友圈轻提示不再直接广播窗口。
2026-11-12：新增人物世界幂等投影回执，文化体验读模型消费具备按事件重试去重能力。
2026-11-12：人物世界主要 IPC 写入入口接入统一命令网关，角色校验、执行账本和失败状态不再由各 handler 分散维护。
2026-11-12：修正窗口不可用时的 Outbox 投递语义，通知会保留失败状态并等待窗口恢复后重试。
2026-11-12：Chat 人物世界工具接入核心命令网关，朋友圈、评论、阅读笔记和资产写入不再绕过统一执行记录。
2026-11-12：生活事件投影朋友圈时先写入统一领域事件，再派生 Moment、关系和情绪读模型。
2026-11-12：人物运行态新增版本冲突门禁，过期状态更新会被拒绝并保留当前快照。
2026-11-12：LifeTicker 主动生活动作接入命令网关，按动作记录执行状态和失败原因。
2026-11-12：主会话增量消息接入 Outbox，生活服务不再直接保存 assistant 消息，窗口和主会话通知分别由独立适配器消费。
2026-11-12：命令网关支持幂等键和结果复用，重复命令不再重复调用生活服务。
2026-11-12：建立人物运行态只读模型边界，Prompt、Debug、人物入口和自动配图共享同一份核心快照。
2026-11-12：人物世界核心引擎施工合同完成，P0–P3 全部收口并冻结稳定边界。

2026-11-11：收紧日记能力边界，移除手动创建和收藏公开入口，日记仅由人物生活与反思引擎生成。

2026-11-11：收紧共同决策能力边界，移除独立 Renderer IPC 与事件入口，保留其作为生活因果内部能力。

2026-11-11：补强人物写入隔离，手动赠礼、信物、旅行、关怀、重排和反思触发不再接受旧人物页面的迟到 roleId。

2026-11-11：补强生活服务提交边界，模型生成期间发生人物切换时，信物、脆弱安慰、关怀、重排和旅行结果不会写入旧人物。

2026-11-11：收紧赠礼、信物和脆弱安慰的失败恢复，主会话留痕失败时回滚核心记录并返回失败。

2026-11-11：补强主动搭话失败恢复，主动行为历史写入失败时回滚对应主会话消息。
# 2026-11-13

- 人物世界核心写入改为本地事务协调，Outbox 增加租约、崩溃恢复和退避重试。
- 主会话消息通过 Outbox 落盘，对话完成后的伙伴生活结算收敛到应用服务。
- Chat、Session、Companion 特权 IPC 增加统一主框架来源校验，并提供 sql.js 性能基准命令。

# 2026-11-13

- 通用特权 IPC 注册入口统一使用可信 sender 校验，保留 MCP、模型设置、终端和图片读取的专用生命周期复核。
- 数据库基准补充重载和 Outbox 批处理指标，新增五边界架构审计记录。

# 2026-11-13 可靠性施工完成

- 完成人物世界事务边界、Outbox 租约恢复、统一 IPC sender 校验、Runtime 应用服务抽离、SQLite 多指标基准和五边界架构审计。
- 固化执行账本与本地事实的事务边界，避免外部等待持有数据库事务。

# 2026-11-13 Agent Host 架构施工启动

- 新增 Agent Manifest、Domain Registry、Capability Registry、Application Orchestrator 和 Context Provider 契约。
- Companion 首个运行态查询能力接入 Agent Host，现有 Agent Loop、Tool、Skill 和 Permission 行为保持不变。
- 新增受控 Capability Adapter，将已授权业务能力转换为 LLM Tool 协议。
- Persona、Memory、Companion 注册首批查询 Capability，默认 Agent Manifest 声明三类 Domain。
- Workspace 注册受控根目录查询 Capability，文件读写仍沿既有权限链路。
- 首批 Agent Host 查询 Capability 接入主进程 ToolRegistry，复用既有 Tool Runtime。
- Host Tool 注册补齐稳定 Manifest 身份，运行时人物作用域仍由 ToolContext 提供。
- Application Orchestrator 增加固定 Workflow 入口，和 LLM Tool 调用分开。
- Agent Host Capability Tool 在 Runtime 请求阶段按当前 Agent Manifest 筛选。
# 2026-11-13 Agent Host Context 接入

- 主角主会话开始通过 Agent Host Context Provider 读取 Companion 运行态上下文，召唤和 Workspace 保持隔离。
# 2026-11-14 Companion Moment Workflow

- 朋友圈发布接入 Agent Host Workflow Capability，固定入口与自然语言 Tool 复用同一执行实现。
# 2026-11-14 Companion Diary Workflow

- 日记生成接入 Agent Host Workflow Capability，复用生活引擎的日记事实链路。
# 2026-11-14 Agent Host Debug 证据

- Debug Model Context 目录新增 Agent Manifest 与 Capability 的 Registered / Available / Activated 运行证据。
# 2026-11-14 Skill Host 元数据同步

- Skill Registry 初始化完成后同步 Skill key 和激活工具元数据到 Agent Host，正文和执行仍由 Skill Registry 管理。
# 2026-11-14 Scoped Tool Catalog

- Agent Host 增加会话级 Tool Catalog，Manifest 授权筛选从 Runtime 条件分支中抽出。
# 2026-11-14 Companion Life Tick Workflow

- 生活时钟推进接入 Agent Host Workflow Capability，复用既有 `tickActiveRole` 实现。
# 2026-11-14 Lifecycle Capability 边界

- 生活时钟 Workflow 不再暴露为 LLM Tool，只保留固定生命周期入口。
# 2026-11-14 Skill 可见状态收口

- 停用 Skill 不再同步为 Agent Host 的 Available 能力。
# 2026-11-14 Workspace Context Provider

- Workspace 会话的项目、最近对话和焦点上下文统一由 Agent Host Provider 注入。

# 2026-11-14 侧边聊天与媒体备份稳定性

- 侧边聊天关闭复用 `session.delete` 的主进程门禁，串行完成流中止、Runtime 收尾和临时会话删除。
- 数据备份排除可由 Role Pack 重物化的 `companion-media` 出厂图片，避免静态资源占用用户媒体配额；用户生成图片仍随备份保存。

# 2026-11-14 生活时钟 Host 权限

- scheduler Manifest 补齐 `companion.lifecycle`，生活时钟 Workflow 绑定当前 active role 后执行，主动问候证据链路恢复。

# 2026-11-15 生活时钟启动时序

- 应用启动后生活时钟按默认周期进入首轮调度，避免恢复阶段与人物世界初始化并发写入。

# 2026-11-15 Companion 写入旁路收口

- Chat 朋友圈发布、文化回响、日内重排、失败清理和旧关系读取统一经过 Application Gateway、Projection Adapter 或 Legacy Read Model。
- Chat 人物世界查询工具的朋友圈读取统一经过 Legacy Read Model。
- LifeTicker 每轮动作和 Outbox 投递增加稳定幂等键，重复触发会复用已完成执行结果。
- Chat 朋友圈发布把事件创建和动态投影放入同一事务，投影失败不会留下孤立事件。
- Runtime 通过 `ConversationApplicationContext` 统一组织 Agent、Session、权限策略、Domain Read Model 和 Prompt Context Evidence。
2026-11-23：修复主对话生成大文件时的输出预算与截断恢复问题。旧版 4096 默认值不再强行写入 OpenAI-compatible 请求，模型可按自身能力决定输出上限；模型在输出上限前没有正文或工具调用时不再写入非法空 assistant 消息，而是返回可重试的结构化失败；文件生成场景提示模型优先使用文件工具落盘。保留已有正文 / 工具调用的合法续写。

2026-11-23：工作区 HTML 预览启用隔离脚本执行，生成的 SVG/Canvas 动画可直接预览。

2026-11-23：新增显式开启的本机外部评测 Controller，外部评测器可通过 HTTP 调用 Electron Runtime 并获取统一任务终态；扩展支持隔离工作区、多轮会话复用、无窗口并行评测模式（`MY_AGENT_EVAL_HEADLESS=1`）与轨迹/Token/压缩指标返回，接入 `Agent Context Benchmark`、`RepoBench` 与本机安全攻防套件（RO/PR/CDL/PIF）并通过 `scripts/run_external_evals.mjs` 一键编排。
