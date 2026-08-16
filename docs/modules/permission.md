# 权限（permission）

## 一句话

决定工具/命令能否执行、是否要用户确认，把破坏性操作挡在执行前。

## 边界

**做**：PermissionEngine 责任链、对话页审批模式（confirm-all / auto / full-access）、由审批模式推导的有效沙箱、命令分级与路径守卫、审批记录、确认 IPC/UI、settings 中 permissionRules 与可视化编辑器、Terminal / shell / MCP 子进程凭据隔离和安全日志脱敏。
**不做**：设置页独立沙箱开关（已移除）；OS 级 Shell 强隔离；Python 嵌入解释器沙箱。后两项是 DEC-037 明确非目标，不是待补工程债；只有威胁模型触发条件变化时才重新立项。

## 短 Why

桌面 Agent 能碰文件与 shell，默认必须偏保守；权限是安全控制面，不是「工具元数据上的装饰字段」。

## 主入口

| 类型 | 位置 |
|------|------|
| UI | **对话页输入区审批模式**（主入口：确认策略 + 有效沙箱）；确认弹窗；设置页规则表单 + 默认执行模式 |
| IPC | tool confirm 请求/应答；settings.executionMode |
| 运行时 | Agent Loop 调权限引擎后再 execute |
| 工具 | `loadEffectiveSandbox()` → `file-path-guard` / `checkCommandPermission` |

## 依赖

- **依赖**：sandbox（effective-sandbox / policy / exec-policy / command-guard / approval-store）、settings-store、loop
- **被依赖**：所有破坏性/未知工具执行路径、Eval 权限向场景

## 不变量

- 未声明安全时 **fail-closed**（偏拒绝/需确认，不偏默许）
- 权限只降不升（含子 Agent）
- 确认超时必须清理监听并默认拒绝，避免悬挂
- shell 不得绕过引擎自行放行
- **有效沙箱由 executionMode 推导**：full-access → 放开路径；其余 → workspace-write

## 必读文件

- `electron/main/sandbox/effective-sandbox.ts`
- `electron/main/sandbox/permission-engine.ts`
- `electron/main/sandbox/policy.ts`
- `electron/main/sandbox/file-path-guard.ts`
- `electron/main/sandbox/command-guard.ts`
- `electron/main/agent/loop.ts`（确认与执行衔接）
- `electron/main/tools/builtins/shell-exec.ts`
- `agent-skills/security-checklist.md`

## 必测点

- 责任链：不可绕过硬边界（危险 / 越界路径 / 控制符 / cwd）→ 自定义规则 → 审批库 → ask 规则 → 分级 / 沙箱 → 默认
- `resolveEffectiveSandbox`：full-access vs 其他
- confirm 批准/拒绝/超时
- 单测：`permission-engine` / `effective-sandbox`；Eval：F01 等权限场景

## 已落地能力

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| PermissionEngine 责任链 | 已落地 | `sandbox/permission-engine.ts` |
| 对话页审批模式 | 已落地 | 输入区 · `executionMode`（含 full-access） |
| 有效沙箱（由审批模式推导） | 已落地 | `effective-sandbox.ts` · write/edit/patch/shell |
| 命令分级 + 路径守卫 | 已落地 | `command-guard` · `shell_exec`；硬边界先于 allow / 审批；危险规则大小写不敏感且 full-access 仍 bypass-immune |
| 文件读写路径沙箱 | 已落地 | `file-path-guard`；read / search / write / edit / delete / patch 共用；realpath / symlink / `ToolContext.workdir` 边界；非 full-access 读写均绑定工作区，凭据文件 fail-closed |
| 启动恢复工作区根 | 已落地 | `project:get` → `applyProject` |
| 用户确认 IPC + 超时拒绝 | 已落地 | tool confirm · 监听清理 |
| 确认弹窗组件（Chat + Playground） | 已落地 | `PermissionConfirmCard` · 串行队列 |
| 确认 ≠ 绕过沙箱 | 已落地 | 拦截文案明示改路径或对话页「完全访问」 |
| `permissionRules` 热更新 | 已落地 | settings |
| 权限规则可视化编辑器 | 已落地 | 设置「安全与权限」· `PermissionRulesEditor` |
| 权限与沙箱生产资产目录 | 已落地 | `sandbox/asset-registry.ts` · Debug「提示词管理器 → 权限与沙箱」 |
| 安全日志元数据化 | 已落地 | `logger.ts` · 命令 / 路径 / 记忆内容只留长度或短指纹 |
| 子进程环境凭据隔离 | 已落地 | `safe-process-env.ts` · Terminal / shell_exec / Git / MCP stdio / Eval Runner |
| Headless 安全批准 | 已落地 | `agent/headless-policy.ts` · 使用运行时有效 metadata，只自动批准明确只读工具，拒绝 Shell / 子 Agent / 继续任务 |

## 相关决策

- `DEC-011`：权限与沙箱参考成熟 Agent 的纵深防御原则。
- `DEC-027`：PermissionEngine 接入 Agent Loop 主流程。
- `DEC-037`：当前威胁模型不引入 OS 级 Shell 强隔离或 Python 嵌入沙箱。

## 现状 / 缺口

**现状**：工具 metadata 先经过运行时解析，再进入硬边界与五层业务责任链，已接 Loop；非 `full-access` 的 `file_read` / `code_search` 也绑定当前工作区并保护常见凭据文件；子进程默认过滤主进程环境中的 API Key / Token / Secret，日志不再落盘命令正文、权限 pattern/reason、原始路径或记忆正文；文件写入、编辑、删除和 patch 统一经过有效沙箱与工作区路径守卫，用户确认不会绕过路径边界；Headless 无交互确认时只自动批准明确只读工具；设置页不再提供独立沙箱开关；内置策略可在 Debug 只读追踪来源、版本、指纹和依赖。
**缺口**：更细的产品向权限说明文案。Shell 解释器语义、symlink TOCTOU 和子进程派生属于当前威胁模型明确接受的剩余风险；继续维持应用层 fail-closed 防线，不把 OS/嵌入级强隔离列为待办（DEC-037）。
