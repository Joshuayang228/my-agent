# 施工合同：ChatRightDock 真实 PTY v1

> 状态：进行中（草案待确认，2026-09-13）
> 生命周期：未开工；确认前不得安装原生依赖、修改正式终端或改变现有命令控制台行为。
> 来源：`WISH-019`、`docs/requirements/chat-right-dock.md`、`docs/requirements/playground-workspace-five-tools-v1.md`

## 1. 背景与目标

正式 ChatRightDock 当前已经回流了终端界面，但实现是 `child_process` 命令控制台：可以输入一次命令并查看输出，不能支持 `vim`、REPL、全屏程序、光标控制或终端尺寸变化。目标是新增真实 PTY 能力，同时保留权限、沙箱和工作区边界，不能把现有命令控制台改名为 PTY。

本合同只处理终端后端与正式终端面板；Playground 只保留视觉样张，不承载真实 PTY 会话。

## 2. 功能目标

| ID | 目标 | 验收证据 |
|---|---|---|
| P1 | 创建真实 PTY 会话 | 受权限与有效沙箱确认后，主进程返回唯一 `ptyId`；拒绝时不启动子进程 |
| P2 | 双向输入输出 | Renderer 可发送原始输入，主进程转发 stdout/stderr/控制序列；输出按会话隔离 |
| P3 | 终端尺寸 | Renderer 发送列数与行数，PTY 调整尺寸；窄宽切换不重启会话 |
| P4 | 取消与关闭 | 停止、关闭标签、项目切换、窗口销毁均终止所属进程组；以 close/exit 证据完成清理 |
| P5 | 资源上限 | 输入、输出速率、累计输出、会话数量、空闲/最长运行时间均有上限；超限 fail-closed |
| P6 | 跨平台 | Windows 与 Unix 分别有真实 Electron 证据；不得用 Renderer mock 代替进程树证据 |

## 3. 明确不做

- 不改变现有权限规则、审批语义、有效沙箱推导或工作区路径守卫。
- 不允许 PTY 绕过 PermissionEngine、Headless 策略或主进程重新校验。
- 不把终端原始输出自动写入 LLM 上下文、长期记忆或主会话历史。
- 不从 Playground fixture、静态输出或浏览器终端样张伪造后端证据。
- 不在本合同中实现浏览器登录、脚本、表单或网页交互。

## 4. 技术方案

### 4.1 依赖与平台

先确认项目 Node/Electron ABI、打包平台和 CI 能力，再选择并锁定 PTY 实现。候选为 `node-pty` + 现有前端终端渲染器；当前项目尚未安装 `node-pty` 或 `xterm`，不得在确认前直接修改 `package.json`。原生模块必须覆盖 Electron rebuild、Windows 安装包和至少一个 Unix CI/实机环境。

### 4.2 IPC 契约

所有新增 IPC 同步四处：`src/shared/types.ts`、`electron/preload/index.ts`、`electron/main/ipc/terminal.ts`、`src/vite-env.d.ts`。

| 频道 | 载荷 | 约束 |
|---|---|---|
| `terminal:pty-create` | `{ command?, cwd?, cols, rows }` | 主进程重新校验命令、cwd、尺寸、权限与沙箱 |
| `terminal:pty-input` | `{ ptyId, data }` | 只允许所属 webContents；输入长度与速率受限 |
| `terminal:pty-resize` | `{ ptyId, cols, rows }` | 尺寸范围受限；不可借此创建新进程 |
| `terminal:pty-kill` | `{ ptyId }` | 只终止所属会话；成功以 close/exit 证据为准 |
| `terminal:pty-data` | `{ ptyId, data }` | 只发给发起窗口；按序、限速、可丢弃超限输出并告警 |
| `terminal:pty-exit` | `{ ptyId, code, signal? }` | 只发布一次；发布后释放监听器与会话记录 |

### 4.3 生命周期

主进程维护 `ptyId -> { senderId, child, state, limits, cleanup }`。创建前登记会话与窗口销毁监听，创建失败回滚全部登记；窗口销毁、标签关闭、项目切换和超时共享幂等终止流程。迟到的输入、resize、data、exit 必须按 `ptyId` 和 `senderId` 丢弃，不能污染新实例。

Windows 使用可验证的进程树终止；Unix 使用独立进程组并先发 `SIGTERM`，超时后 `SIGKILL`。两端都必须等待 close/exit，再向 Renderer 宣布完成。终止失败保留可重试状态，不伪造成功。

### 4.4 Renderer

正式 `TerminalPanel` 只负责终端显示、输入、尺寸观察和操作状态；会话、权限和进程生命周期仍由主进程负责。新增 PTY 模式必须显式区分现有命令控制台模式，不能让旧 IPC 与新 IPC 混用到同一 run 状态。

## 5. 影响范围

- 主进程：终端 IPC、PTY 生命周期服务、权限/沙箱调用边界。
- Preload 与共享类型：新增 IPC 类型与方法。
- Renderer：`TerminalPanel`、Foundation 终端输入/滚动容器的适配。
- 依赖与打包：原生模块安装、Electron rebuild、Windows/Unix 构建验证。
- 测试：PTY 单测、权限反例、Renderer E2E、Windows Electron E2E、Unix Electron/CI E2E。
- 文档：工作区合同、agent-runtime 模块卡、architecture、quality、progress、changelog、wishlist。

## 6. 实施步骤与门禁

1. 用户确认本合同与依赖路线；记录平台矩阵和原生模块风险。
2. 建立 PTY 服务边界与共享类型；先补失败、取消、归属和资源上限 Unit。
3. 接入主进程创建、输入、resize、终止和事件清理；通过权限/沙箱反例。
4. 接入正式 TerminalPanel 的 PTY 模式；保留命令控制台回退，不复制 Playground UI。
5. 完成 Windows 与 Unix 真实 Electron 证据：交互程序、尺寸变化、输入回显、停止、关闭标签、窗口销毁、子进程树释放。
6. 按项目顺序运行自审、Unit、`npx tsc --noEmit`、build、正式 UI/Electron E2E、assets、docs 门禁，然后提交推送。

## 7. 风险与权衡

- 原生模块可能受 Electron ABI、Node 版本和打包平台影响；不接受只在 Vite UI 环境通过。
- PTY 输出可能高速增长；必须先设计背压和上限，不能把内存问题留给 Renderer。
- 交互程序会暴露更强的命令能力；权限、沙箱和窗口归属必须在主进程重新确认。
- 若 Unix 环境或原生依赖无法提供真实证据，本合同保持进行中，不把 Windows 证据外推为跨平台完成。

## 8. 确认闸

用户确认以下三项后才能开工：

1. 接受新增原生 PTY 依赖及 Electron rebuild / 打包风险。
2. 接受 Windows + 至少一个 Unix 环境作为真实验收矩阵。
3. 接受浏览器交互继续由另一份安全合同单独处理，不与 PTY 混合施工。