# 权限（permission）

## 一句话

决定工具/命令能否执行、是否要用户确认，把破坏性操作挡在执行前。

## 边界

**做**：PermissionEngine 责任链、执行模式（confirm-all / auto / full-access）、沙箱策略、命令分级与路径守卫、审批记录、确认 IPC/UI、settings 中 permissionRules。  
**不做**：OS 级强隔离沙箱（当前为策略级）；精美权限规则可视化编辑器（wishlist）。

## 短 Why

桌面 Agent 能碰文件与 shell，默认必须偏保守；权限是安全控制面，不是「工具元数据上的装饰字段」。

## 主入口

| 类型 | 位置 |
|------|------|
| UI | 输入区审批模式；确认弹窗；设置页权限 JSON |
| IPC | tool confirm 请求/应答；settings |
| 运行时 | Agent Loop 调权限引擎后再 execute |
| 工具 | `shell_exec` 等走 `checkCommandPermission` |

## 依赖

- **依赖**：sandbox（policy / exec-policy / command-guard / approval-store）、settings-store、loop  
- **被依赖**：所有破坏性/未知工具执行路径、Eval 权限向场景

## 不变量

- 未声明安全时 **fail-closed**（偏拒绝/需确认，不偏默许）  
- 权限只降不升（含子 Agent）  
- 确认超时必须清理监听并默认拒绝，避免悬挂  
- shell 不得绕过引擎自行放行

## 必读文件

- `electron/main/sandbox/permission-engine.ts`
- `electron/main/sandbox/policy.ts`
- `electron/main/sandbox/exec-policy.ts`
- `electron/main/sandbox/command-guard.ts`
- `electron/main/sandbox/approval-store.ts`
- `electron/main/agent/loop.ts`（确认与执行衔接）
- `electron/main/tools/builtins/shell-exec.ts`
- `agent-skills/security-checklist.md`

## 必测点

- 责任链：自定义规则 → 审批库 → 分级 → 沙箱 → 默认  
- confirm 批准/拒绝/超时  
- 单测：`permission-engine`；Eval：F01 等权限场景

## 现状 / 缺口

**现状**：五层链已接 Loop；shell 统一走引擎；permissionRules 可热更新；确认队列（UI）。  
**缺口**：权限规则可视化编辑器；更细的产品向权限说明文案。
