# 施工合同：右侧工作区全能力升级 — 富文档渲染、可视化批注与代码审阅闭环（v2 全量版）

- **状态**：进行中（Batch A 的 P0 初版已完成；升级为对标 Codex 桌面端的完整右侧工作区合同，待用户确认后按批次推进）
- **创建日期**：2026-11-23（同日升级为全量版）
- **关联模块卡**：`docs/modules/agent-runtime.md`、`docs/architecture.md`、`docs/quality.md`
- **前置基线**：`docs/requirements/playground-workspace-five-tools-v1.md`（已完成施工快照）

---

## 1. 需求背景（Why）

对标 OpenAI Codex 桌面端右侧工作区，当前 My Agent 右侧五工具工作区（文件 / 审阅 / 浏览器 / 终端 / 侧边聊天）虽然骨架齐全，但在「**看结果 → 精准指代 → 发回对话让 AI 改**」的协作闭环上仍有明显代差：

1. **办公文档无法内嵌预览**：`.xlsx / .xls / .docx / .pdf / .pptx` 全部被主进程归为 `externalOnly`，只能外开系统应用。
2. **缺乏统一的跨媒介批注回传机制**：HTML 不能点选元素/框选区域或试调样式，Excel 不能框选单元格区域，Diff 不能悬停单行 `+` 写行级评论，也缺乏把多条批注攒在一起统一发给 AI 的「批注草稿篮」。
3. **浏览器与审阅深度不足**：`BrowserPanel` 目前是只读静态抓取，无法预览本地 `localhost` 前端热更新页面并直接批注；`ReviewPanel` 仅看本会话整体 Diff，缺少 Git 未提交/分支视图以及单文件/单 Hunk 级 Stage/Revert。

## 2. 功能目标与分批边界（What）

为保证**每批都是完整可用的独立闭环（绝不分期烂尾）**，全量能力按 4 个独立可验收批次推进，且每批严格遵守 **Phase P0（Playground 隔离候选）→ 用户验收确认 → Phase P1（正式生产回流）** 两阶段硬门：

---

### Batch A：全格式办公文档内嵌渲染 + 多条批注草稿篮（当前优先）

1. **5 类文档内嵌渲染**（含 P0 已落地的 4 类 + 新增 PPT）：
   - **Excel / CSV（`.xlsx` / `.xls` / `.csv`）**：多 Sheet 切换、粘性列标（`A/B/C`）与行号（`1/2/3`）、单击/拖拽框选/Shift 扩选矩形区域（如 `Sheet1!B2:D5`），生成带坐标与 Markdown 表格切片的结构化批注。
   - **HTML（`.html` / `.htm`）**：预览/源码切换 + 「选元素批注」开关（保持 `sandbox="allow-scripts"`，不放开同源，随机 `channelToken` 白名单 `postMessage`）。
   - **Word（`.docx`）**：语义富文本白名单清洗渲染 + 划选正文片段捕获批注（老 `.doc` 保持降级系统外开）。
   - **PDF（`.pdf`）**：按页浏览 + 翻页/缩放控制 + 按页批注（P1 接入渲染层真实逐页绘制，同时保留纯文本/空白页兜底）。
   - **PPT（`.pptx`）**：纯 JS 解析幻灯片 XML（提取每页标题、正文要点、演讲者备注），按页卡片化浏览与按页批注（复杂动效/像素排版提供一键系统应用打开）。
2. **统一批注草稿篮（Annotation Queue）**：
   - 在 `AnnotationBar` 基础上支持两种动作：「**加入批注篮**」（连续攒多条，支持跨 Sheet / 跨元素 / 跨页 / 跨文件）与「**立即发送到对话**」；
   - 批注篮顶部/底部展示已攒条数，可展开查看、删除单条或「**一键汇总发送到对话**」（生成编号结构化 Markdown 列表发往主对话输入框）。
3. **Batch A 正式回流（P1）**：
   - 主进程 `electron/main/ipc/project.ts` + `electron/main/utils/document-parser.ts` 扩展 `project:readFile` 返回结构化联合类型（`spreadsheet` / `docx` / `pdf` / `pptx`），维持 `resolveCurrentProjectFile` `realpath` 防穿越与防 OOM 体积/行列上限；
   - 严格执行 **IPC 四处同步**（`src/shared/types.ts`、`electron/preload/index.ts`、`electron/main/ipc/project.ts`、`src/vite-env.d.ts`）；
   - 将预览与批注篮回流正式 `FileBrowser.tsx`、`WorkspaceFilesPanel.tsx` 与 `ChatRightDock.tsx`，打通 `onTakeToChat` 到正式 Chat 输入框。

---

### Batch B：HTML 与内置浏览器视觉批注升级（对标 Codex Browser Annotation）

1. **HTML / 网页「区域框选（Region Select）」**：
   - 除单元素拾取外，新增拖拽画框选定一块视觉区域，记录区域相对坐标/尺寸及落入区域内的主要节点摘要。
2. **「样式试调（Adjust）」所见即所得微调**：
   - 选中元素后点击「试调」，可在隔离预览内临时调整该元素的**文案、字号、内外边距、文字色、背景色**（绝不写回原文件），发送批注时自动附带 `styleDiff`（改前 → 改后对比）作为 AI 改码的精确参考。
3. **内置浏览器（`BrowserPanel`）受控升级**：
   - 支持本地开发服务（`http://127.0.0.1:*` / `http://localhost:*`）交互式预览与同套「选元素 / 框选 / Adjust 批注」；
   - 安全约束：独立隔离 partition、不共享用户主浏览器 Cookie/密码、非 localhost 外站仍走显式授权边界。

---

### Batch C：Diff 审阅行级内联批注 + Git 多视图与 Hunk 级控制（对标 Codex Review）

1. **审阅范围切换**：
   - 支持在 `ReviewPanel` 顶栏切换：`本会话变更`（现有） / `Git 未提交（Uncommitted）` / `相对主分支（Branch Diff）`。
2. **行级 `+` 号内联批注**：
   - 在 `DiffViewer` 悬停任意变更行显示 `+` 图标，点击就地展开行级批注输入框；
   - 提交后自动并入工作区统一「批注草稿篮」（携带 `filePath:lineNumber` 与对应 diff 上下文行），可批量攒多条后一键发给 AI 修复。
3. **单文件 / 单 Hunk 级 Stage 与 Revert**：
   - 主进程新增受控 Git 审阅 IPC（严格参数化 `execFile('git', [...])`，禁止 shell 拼接，校验工作区根目录）；
   - 支持按单文件或单个 Hunk 执行 Stage / Unstage / Revert（Revert 属于破坏性操作，必须二次确认）。

---

### Batch D：产出物摘要面板与双向焦点引用

1. **会话产出物与引用摘要**：在右栏轻量汇总当前会话新建/修改的文件、生成的图片与未发出的批注篮，一键点击跳转对应预览标签；
2. **对话侧显式引用**：在 Chat 输入区支持一键带入当前右栏焦点（如当前预览文件/选区/网页），与 `SideChatPanel` 共享同一焦点模型。

---

## 3. 技术方案与安全边界（How）

### 3.1 目录与分层演进

- **P0 隔离候选阶段**：所有未回流组件统一放在 `src/components/playground/workspace-preview/`，在 `src/shared/ui-component-registry.ts` 登记为 `status: 'playground'`；通过 `WorkspaceExperienceCandidate.tsx` 与左侧 `WorkspaceChatShell` 验证完整闭环，绝不修改正式页面默认行为。
- **P1 正式回流阶段**：按 `.agents/skills/playground-to-production/SKILL.md` 逐项审计后，迁入 `src/components/chat/right-dock/preview/`（或对应正式目录）并更新 `ui-component-registry.ts` 生命周期为 `adopted`；Playground 样张继续复用同一正式组件 + 隔离夹具。

### 3.2 核心安全与性能红线

- **路径防穿越**：所有文件读取、解析与 Git 操作必须走 `resolveCurrentProjectFile` / `getCurrentProjectRoot` 的 `realpath` 边界校验，严禁越出当前工作区。
- **HTML 沙箱与消息校验**：本地 HTML 预览 `iframe` 始终保持 `sandbox="allow-scripts"`（绝不开启 `allow-same-origin`）；`postMessage` 强制校验 `event.source === iframe.contentWindow` 与会话级随机 `channelToken`。
- **Word HTML XSS 清洗**：强制经 `sanitizeDocxHtml` 剥离 `<script>`、`<iframe>`、`<object>`、`<embed>`、`on*` 事件与 `javascript:` / 非图片 `data:` 协议。
- **防 OOM 与大文件保护**：
  - Excel：单文件 ≤ 10MB，每 Sheet 预览上限 500 行 × 50 列并标注截断提示；
  - Word / PPT：单文件 ≤ 10MB，PPT 预览上限 80 页；
  - PDF：单文件 ≤ 15MB，按需逐页渲染不一次性全页解码进内存；
  - Git Diff / Hunk：使用 `execFile` 参数数组调用 `git`，严禁字符串拼接命令，大 Diff 超限自动截断并提示。

### 3.3 依赖评估

- **Batch A**：完全复用现有 `xlsx`、`mammoth`、`unpdf`（`.pptx` 可直接用 `jszip` 或 Node 内置/轻量 zip 解析，若需新增 `jszip` 或 `pdfjs-dist` 在动手前明确声明）。
- **Batch B / C / D**：优先复用 Electron 原生能力、Foundation 控件与本地 `git` CLI，不引入重型第三方编辑器框架。

---

## 4. 实施路线与验收门禁

| 批次 | 范围 | P0 状态 | P1 状态 | 独立验收标准 |
|---|---|---|---|---|
| **Batch A** | Excel / HTML / Word / PDF / PPT 渲染 + 批注草稿篮 | ✅ P0 已验收 | ✅ P1 已回流正式右栏 | Playground 5 类文档可渲染交互 + 多条批注汇总发送；P1 真实项目文件（`.xlsx/.xls/.csv/.docx/.pdf/.pptx/.html`）打开与批注直达 Chat 输入框；单测 + `assets:check` + `arch:check` + `vite build` 全绿 |
| **Batch B** | HTML 区域框选 + Adjust 样式试调 + 受控本地浏览器批注 | ⬜ 未开始 | ⬜ 未开始 | 区域框选坐标准确；Adjust 试调不改源文件且输出 `styleDiff`；本地 `localhost` 页面可预览并批注 |
| **Batch C** | Diff 行级 `+` 批注 + Git 多视图 + 单文件/Hunk Stage/Revert | ⬜ 未开始 | ⬜ 未开始 | 悬停行写批注并入批注篮；Uncommitted / Branch 视图切换正常；单 Hunk Stage/Revert（含二次确认）真实生效且有单测回归 |
| **Batch D** | 产出物摘要 + 对话侧显式焦点引用 | ⬜ 未开始 | ⬜ 未开始 | 会话产物一键定位预览；Chat 输入区可显式引用右栏焦点 |

---

## 5. 风险与权衡

- **PPT / Word 保真度**：纯 JS 解析偏向「清晰可读 + 高效批注」，而非像素级 Office 排版引擎；每类文档右上角保留「用系统应用打开」兜底。
- **内置浏览器安全边界**：Electron 内直接加载任意外部网页存在登录态与安全面扩张风险，Batch B 严格隔离独立 session partition，优先服务本地开发预览（`localhost`）与显式授权页面，不默认共享主浏览器凭据。
- **范围控制**：四个批次彼此解耦，每完成一批的 P0 → 确认 → P1 都是一次完整可用的正式版本交付，避免一次性铺开过大导致半成品积压。
