# 施工合同：右侧工作区富文档渲染与元素/选区批注回传（v1）

- **状态**：进行中（待用户确认后进入 Phase P0 Playground 候选）
- **创建日期**：2026-11-23
- **关联模块卡**：`docs/modules/agent-runtime.md`、`docs/modules/ui-and-workspace.md`（若存在则收口至对应工作区/前端文档）
- **前置基线**：`docs/requirements/playground-workspace-five-tools-v1.md`（已完成施工快照）

---

## 1. 需求背景（Why）

当前右侧工作区的文件预览（`ChatRightDock` → `WorkspaceFilesPanel` → `FileBrowser` → `project:readFile`）仅支持纯文本/Markdown/代码、图片以及只读 HTML `iframe`：

1. **Office / PDF 无法内嵌阅读**：`.xlsx` / `.xls` / `.docx` / `.pdf` 全部在主进程被归为 `externalOnly`，仅提示「用系统应用打开」，割裂了在工作区内边看文件边与 AI 协作的体验。
2. **HTML 无法精准指代元素**：用户看到页面渲染细节想让 AI 修改某个按钮、卡片或标题时，只能手工口述位置，缺乏「点选 DOM 元素 + 写批注直接发送到对话」的闭环。
3. **Excel 无法精准指代数据区域**：用户查看表格时无法在右侧框选 `Sheet1!B3:D8` 这类单元格区域并附带批注发回对话，且 `WorkspaceFilesPanel` 尚未接入 `ChatRightDock` 的 `onTakeToChat` 回调。

## 2. 功能目标（What）

按 **Playground → 生产两阶段硬门** 分两阶段推进：

### Phase P0 · Playground 隔离候选（本合同第一阶段，不改动正式生产默认行为）

在 `Playground → 产品体验 → 工作区`（`WorkspaceExperienceCandidate`）中提供完整可交互的隔离候选与边缘态，并与左侧模拟对话壳联动，供用户验收：

1. **Excel 预览与选区批注（`.xlsx` / `.xls` / `.csv`）**
   - 多 Sheet 切换、列字母（`A/B/C...`）与行号（`1/2/3...`）粘性表头；
   - 支持单击单元格、拖拽框选矩形区域（如 `Sheet1!B2:D5`）并高亮选区；
   - 底部批注栏显示当前选区坐标胶囊、批注输入框与「发送到对话」按钮；发送后生成包含**文件路径 + Sheet 名 + 坐标范围 + Markdown 表格切片 + 用户批注**的结构化文本注入左侧对话壳。
   - 边缘态：大表行/列截断提示、空表态、超限/损坏文件降级提示。

2. **HTML 预览与元素拾取批注（`.html` / `.htm`）**
   - 保留现有「预览 / 源码」切换；在预览模式下新增「选元素批注」开关；
   - 开启后仅在沙箱 `iframe`（保持 `sandbox="allow-scripts"`，**不开启 `allow-same-origin`**）内启用轻量拾取脚本：悬浮高亮节点并显示标签/选择器提示，点击锁定元素并通过白名单 `postMessage` 回传 `selector`、`tagName`、文本摘要与精简 HTML 片段；
   - 底部批注栏填写修改意图并「发送到对话」，自动带入文件路径 + 元素选择器 + 元素摘要 + 批注内容。
   - 边缘态：关闭批注模式恢复正常点击交互、切换源码模式自动退出拾取态。

3. **Word 富文本渲染与划词批注（`.docx`）**
   - 内嵌展示经清洗的安全富文本 HTML（标题、段落、表格、列表、图片），采用文档阅读排版宽度与深浅主题兼容底色；
   - 支持鼠标划选正文中一段文字后在底部批注栏填入引用摘要 + 批注并「发送到对话」；
   - 边缘态：不支持的老 `.doc` 格式或空文档给出清晰提示与「系统应用打开」回退。

4. **PDF 按页内嵌预览与按页批注（`.pdf`）**
   - 内嵌按页渲染预览（支持上一页/下一页、页码指示、缩放比例调节）；
   - 支持针对当前页填写批注并「发送到对话」（自动附带文件路径 + 页码，如 `第 2 页` + 批注）；
   - 边缘态：加密/损坏 PDF 报错与重试、扫描版/空白页提示。

### Phase P1 · 正式回流（须用户明确批准 P0 验收后方可启动）

- 后端真实解析 IPC 升级：扩展 `project:readFile` 返回联合类型，复用并扩展 `electron/main/utils/document-parser.ts` 提供：
  - `kind: 'spreadsheet'`（`xlsx` 解析多 Sheet 二维表格，单表上限如 500 行 × 50 列并标注是否截断，单文件上限 10MB）；
  - `kind: 'docx'`（`mammoth.convertToHtml()` 输出 HTML + 前端白名单 DOM 清洗，单文件上限 10MB）；
  - `kind: 'pdf'`（主进程校验路径与大小上限 15MB 后返回受控二进制/base64 载荷交由渲染层 PDF 渲染器按页绘制，不走任意文件协议）；
- 严格执行 **IPC 四处同步**（`src/shared/types.ts`、`electron/preload/index.ts`、`electron/main/ipc/project.ts`、`src/vite-env.d.ts`）；
- 将 P0 验收通过的预览器与批注栏回流至正式 `FileBrowser.tsx`、`WorkspaceFilesPanel.tsx` 与 `ChatRightDock.tsx`，打通 `onTakeToChat` 到正式 Chat 输入框；
- 保留 `.doc` / `.pptx` / 压缩包 / 可执行文件等为 `unsupported` +「用系统应用打开」。

## 3. 技术方案（How）

### 3.1 组件与分层边界

- **P0 新增独立预览与批注组件（不修改生产 `FileBrowser` / `WorkspaceFilesPanel` 默认行为）**：
  - `src/components/playground/workspace-preview/SpreadsheetPreview.tsx`：Excel/CSV 多 Sheet 渲染 + 单元格拖拽选区 + 坐标/Markdown 切片序列化 + 批注条；
  - `src/components/playground/workspace-preview/HtmlAnnotatePreview.tsx`：沙箱 `iframe` + 受控注入拾取脚本 + `postMessage` 白名单校验 + 元素批注条；
  - `src/components/playground/workspace-preview/DocxPreview.tsx`：白名单安全清洗后的 Word 富文本渲染 + 划词捕获 + 批注条；
  - `src/components/playground/workspace-preview/PdfPreview.tsx`：按页渲染与翻页/缩放控件 + 按页批注条（P0 使用确定性隔离样张页/canvas；P1 接真实 PDF 字节流）；
  - `src/components/playground/workspace-preview/AnnotationBar.tsx`：统一复用 Foundation 控件（`TextField`、`ActionButton`、`IconButton`、`Badge`）的紧凑底部批注栏与结构化消息拼装纯函数（`formatAnnotationForChat.ts`）。
- **Playground 集成**：
  - 在 `src/components/playground/WorkspaceExperienceCandidate.tsx` 的 `files` 场景列表新增 `Excel 表格`、`HTML 批注`、`Word 文档`、`PDF 文档` 隔离场景；
  - 将候选预览器的 `onSendToChat` 接到 `WorkspaceChatShell`（模拟主对话输入框），让用户在 Playground 内完成端到端交互验收；
  - 绝不修改生产 `ChatRightDock.tsx`、`WorkspaceFilesPanel.tsx`、`FileBrowser.tsx` 或 `electron/main/ipc/project.ts`（直到 P1 获批）。

### 3.2 安全与架构红线

- **HTML 沙箱不降级**：`HtmlAnnotatePreview` 的 `iframe` 始终维持 `sandbox="allow-scripts"`，禁止添加 `allow-same-origin`；`postMessage` 仅校验明确 `source === iframeRef.current?.contentWindow` 与固定协议字段（`type === 'my-agent:html-pick'`），忽略未知消息。
- **Word HTML 安全清洗**：禁止直接 `dangerouslySetInnerHTML` 渲染未清洗 HTML；渲染前统一剥离 `<script>`、`<iframe>`、`<object>`、`<embed>`、`on*` 事件属性及 `javascript:` 协议链接（或使用独立沙箱 `iframe sandbox=""` 渲染）。
- **主进程边界（P1）**：仍走 `resolveCurrentProjectFile` 做 `realpath` + 项目根防穿越校验；严禁放开项目外路径读取；限制体积与解析行列上限防 OOM。
- **无新增重型依赖原则**：优先复用已安装的 `xlsx`、`mammoth`、`unpdf`（`pdfjs`）；若 P1 PDF 按页 Canvas 渲染需要直接使用 `pdfjs-dist` worker，届时明确声明依赖。

## 4. 影响范围评估

- **Phase P0**：
  - 仅新增 `src/components/playground/workspace-preview/*` 与更新 `src/components/playground/WorkspaceExperienceCandidate.tsx` 及对应单元测试；
  - **不碰**：`src/App.tsx`、`ChatRightDock.tsx`、`WorkspaceFilesPanel.tsx`、`FileBrowser.tsx`、主进程 IPC 与存储。
- **Phase P1（待审批）**：
  - 涉及 `src/shared/types.ts`、`electron/preload/index.ts`、`electron/main/ipc/project.ts`、`electron/main/utils/document-parser.ts`、`src/vite-env.d.ts`、`src/components/FileBrowser.tsx`、`src/components/chat/right-dock/WorkspaceFilesPanel.tsx`、`src/components/chat/right-dock/ChatRightDock.tsx`；
  - 需同步更新 `docs/modules/agent-runtime.md`、`docs/architecture.md`、`docs/progress.md`、`docs/changelog.md`、`docs/quality.md`。

## 5. 实施步骤

1. **Step 0（当前）**：用户确认本施工合同范围、交互形态与 P0 → P1 节奏。
2. **Step 1（Phase P0）**：实现共享批注拼装纯函数与四个隔离预览组件，接入 `WorkspaceExperienceCandidate` 四个新场景并与左侧 `WorkspaceChatShell` 打通「发送到对话」。
3. **Step 2（Phase P0 验证）**：补齐单元测试（坐标换算、矩形选区 Markdown 序列化、HTML 拾取协议校验、Word HTML 清洗、批注格式化），通过 `typecheck` / `vitest` / `vite build` / `assets:check`，在 Playground 交付截图/交互验收。
4. **Step 3（用户确认门）**：用户验收 Playground 候选并明确批准回流范围。
5. **Step 4（Phase P1）**：主进程真实解析 IPC + IPC 四处同步 + 正式 `FileBrowser` / `WorkspaceFilesPanel` / `ChatRightDock` 回流 + 全套回归测试与文档收口。

## 6. 风险与权衡

- **大 Excel 表格性能**：直接 DOM 渲染上万行会卡顿；首版主进程硬上限（如每 Sheet 最多 500 行 × 50 列并显示截断提示）可兼顾流畅度与真实办公场景，后续按需再评估虚拟滚动。
- **HTML 页面自身拦截点击事件**：页面脚本可能调用 `stopPropagation`；拾取脚本在开启批注模式时使用捕获阶段（`capture: true`）拦截点击并 `preventDefault()`，关闭模式立即还原。
- **Word 复杂样式保真度**：`mammoth` 偏语义转换（非像素级分页排版），优先保证文字、表格、标题、列表清晰可读与划词批注流畅；需要像素级校版时一键「用系统应用打开」。
