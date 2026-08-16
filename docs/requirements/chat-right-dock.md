# 施工合同：Chat 右侧能力坞（Phase 1）

> 状态：**已落地**（Phase 1：文件 / 审阅 / 终端 Tab；Debug 覆盖；命令控制台非 PTY）
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 日期：2026-08-08
> 来源：wishlist「Chat 右侧工作台」· Alice/Codex 对照
> 上位：[`docs/modules/agent-runtime.md`](../modules/agent-runtime.md) · DEC-018

---

## 1. 需求背景（Why）

右栏今天只有「项目文件 + 预览」，对话 Debug（LLM 调用链）可盖在上面。对照 Codex，右栏应是**能力坞**：看文件、审改动、跑命令——而不只是文件夹。

已对齐结论：

- **第一期做 A+B+C**：坞壳 Tab + Diff/审阅 + 终端/控制台
- **D（HTML 预览）已落地**：`FileBrowser` 内沙箱 iframe，不另开浏览器 Tab
- **Debug 继续 Alice 式覆盖上层**，不与文件/审阅/终端平级 Tab

---

## 2. 功能目标（What）

| ID | 目标 | 验收 |
|----|------|------|
| **A1** | 右坞壳 `ChatRightDock`：顶栏 Tab「文件 / 审阅 / 终端」 | 打开文件坞时可见三 Tab；切换不丢各 Tab 内部状态（切换回来仍在） |
| **A2** | 入口不变：Chat 顶栏文件夹钮打开坞；无项目时文件 Tab 空态提示选项目 | 行为与现网一致，仅内容升级为坞 |
| **A3** | Debug 覆盖：`conversationDebugMode` 时整坞盖一层 `ConversationDebugAside` | 不出现「Debug」与文件平级的 Tab |
| **B1** | 审阅 Tab：展示**本会话**内文件写入/编辑/补丁触及的路径列表 | 有 `file_write` / `file_edit` / `apply_patch` 成功后出现条目；可点开看内容或 diff |
| **B2** | 单文件：优先展示 unified diff（有旧内容时）；否则展示当前全文预览（复用文件预览能力） | 无改动时空态文案清晰 |
| **C1** | 终端 Tab：可输入命令、在**当前工作区**执行、流式/分段展示 stdout/stderr/exit | 无 PTY 交互程序（vim 等）要求；超时与现 shell 策略对齐 |
| **C2** | 终端受有效沙箱约束（同对话页审批模式） | `read`/工作区外危险命令按现有引擎拦截，错误回显到终端面板 |

### 本轮明确不做

- 独立「浏览器」Tab / 任意 URL 浏览（D 已用文件 HTML 预览覆盖常见需求）
- Debug 与业务 Tab 平级
- 真伪终端（node-pty / xterm 全交互）——Phase 1 用**命令控制台**（child_process + 输出面板）
- 跨会话持久化审阅列表、多人协作审阅
- 侧边聊天快捷入口（Codex 有，wishlist 后置）

---

## 3. 技术方案（How）

### 3.1 架构

```text
Chat 主区
  └─ 右坞 ChatRightDock (380px+)
       ├─ Tab: 文件 → 现有 FileBrowser（可去外层重复标题）
       ├─ Tab: 审阅 → ReviewPanel（会话变更列表 + diff/预览）
       ├─ Tab: 终端 → TerminalPanel（命令输入 + 输出）
       └─ [覆盖] ConversationDebugAside（conversationDebugMode）
```

### 3.2 数据流

**审阅（B）**

- 渲染进程在 Agent 流事件里收集成功的写文件工具：
  `tool_end` 且 name ∈ `file_write` | `file_edit` | `apply_patch` 且非 error → 解析 args.path（及 patch 目标）写入 `sessionFileChanges: { path, tool, at }[]`（按 path 去重，保留最近一次）
- 打开某条时：IPC `project:readFile` 取现状；若本地能拿到「编辑前快照」则做简单行 diff，否则全文预览
- **编辑前快照（最小可用）**：在主进程工具执行前对目标 path 读一次原文（已存在于 edit/patch 路径），经新事件或侧信道 `workspace:file-changed` 带 `{ path, before?, afterHint }`；若拿不到 before，审阅仍可打开现状

更稳妥的主进程方案（推荐）：

- 新增轻量 `electron/main/agent/session-file-changes.ts`：工具成功写盘后 `recordChange(sessionId, path)`
- IPC：`session:listFileChanges` / 可选 `session:clearFileChanges`
- 前端审阅 Tab 订阅或拉取

**终端（C）**

- IPC：`terminal:run` `{ command, cwd? }` → 主进程 `child_process.spawn`（非 PTY）
- 事件：`terminal:stdout` / `terminal:stderr` / `terminal:exit`（带 runId）
- cwd 默认 `getWorkspaceRoot()`；权限走 `checkCommandPermission` + `loadEffectiveSandbox()`（与 `shell_exec` 同源）
- UI：输出区 monospace + 输入框；支持 Ctrl+C 映射为 kill 当前 run（`terminal:kill`）

**不做**：把终端输出自动塞进 LLM 上下文（避免噪声）；Agent 仍用 `shell_exec` 工具。

### 3.3 关键接口（IPC 四处同步）

| 频道 | 方向 | 载荷 |
|------|------|------|
| `session:listFileChanges` | invoke | `{ sessionId }` → `{ path, toolName, updatedAt }[]` |
| `session:clearFileChanges` | invoke | `{ sessionId }` → `{ ok }` |
| `terminal:run` | invoke | `{ command, cwd? }` → `{ runId }` 或错误 |
| `terminal:kill` | invoke | `{ runId }` → `{ ok }` |
| `terminal:stdout` / `stderr` / `exit` | event | `{ runId, chunk? , code? }` |

类型：`src/shared/types.ts` + preload + `vite-env.d.ts` + `electron/main/ipc/*`。

### 3.4 UI

- 新组件目录建议：`src/components/chat/right-dock/`
  - `ChatRightDock.tsx`（壳 + Tab）
  - `ReviewPanel.tsx`
  - `TerminalPanel.tsx`
- `App.tsx`：用 `ChatRightDock` 替换当前仅 `FileBrowser` 的右栏挂载；Debug 覆盖逻辑上移到坞内
- 风格：遵守 `frontend-guidelines`（无多余卡片、scrollbar-hover）

### 3.5 依赖

- Phase 1 **不新增** `node-pty` / `xterm`（Windows 原生模块风险高）
- Diff：可用极简自研行 diff，或轻量依赖（若引入须在合同注明包名）；优先自研避免依赖膨胀

---

## 4. 影响范围

| 区域 | 影响 |
|------|------|
| 破坏性 | 低：右栏结构重构；Debug 覆盖行为保持 |
| 测试 | 单测：session-file-changes 记录；terminal 权限拒绝路径；可选组件 smoke |
| 文档 | 模块卡 agent-runtime「已落地能力」；wishlist 勾部分；changelog / progress |
| 设置 | 无新全局设置 |

---

## 5. 实施步骤（每步可验证）

1. 落本合同 + 索引「进行中」→ **用户确认**
2. `ChatRightDock` 壳 + 三 Tab，文件 Tab 嵌现有 `FileBrowser`；Debug 覆盖迁入
3. 会话文件变更记录（主进程 + IPC）+ `ReviewPanel` 列表/预览
4. `terminal:*` IPC + `TerminalPanel`（含沙箱拒绝回显）
5. 单测 + `tsc`；更新模块卡 / wishlist / changelog / progress

---

## 6. 风险与权衡

| 风险 | 缓解 |
|------|------|
| 命令控制台 ≠ 真终端，用户期望 vim/交互 | 空态/标题写「命令控制台」；wishlist 留真 PTY |
| 审阅无 before 则只有全文 | 文案标明「当前内容」；edit/patch 路径尽量带 before |
| 右栏变宽信息多 | 维持 ~380px；Tab 内滚动，不撑破 Chat |

---

## 7. 验收口令（人测）

1. 打开文件坞 → 见「文件 / 审阅 / 终端」
2. Agent 改一个工作区文件 → 审阅出现该路径，可点开看
3. 终端执行 `echo hello`（有项目时）→ 输出可见
4. 审批非完全访问时，终端尝试写工作区外应被拦并显示原因
5. 开对话 Debug → 调用链盖住整坞；关 Debug → 回到刚才的 Tab
