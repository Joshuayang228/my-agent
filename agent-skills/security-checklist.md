# Security Checklist

## 使用场景

涉及安全、密钥、权限、沙箱、路径、命令执行、数据库输入时参考本文档。

## 密钥管理

- [ ] API Key、密码、token 全部走环境变量或安全存储。
- [ ] `.env` 文件在 `.gitignore` 中。
- [ ] 代码中无硬编码密钥或凭据。
- [ ] 用户自定义 Key 使用 Electron `safeStorage` 加密存储，例如 `settings-store.ts` 的加密字段；旧明文 / 旧密文迁移，新密文解密失败必须 fail-closed。

## 输入校验

- [ ] 所有外部输入有类型校验。
- [ ] 正则、Prompt、命令、RAG 文档和批量输入有长度 / 数量上限；用户可配置正则拒绝常见灾难性回溯形状。
- [ ] 文件路径操作有防路径穿越检查。
- [ ] SQL 查询使用参数化，禁止拼接用户输入。
- [ ] 用户可控配置 / Frontmatter 只用数据解析器，禁止 `eval`、JavaScript YAML 标签或可执行模板引擎。

## 错误信息

- [ ] 对外错误响应只包含用户友好信息。
- [ ] 不暴露堆栈、内部路径、SQL 语句。
- [ ] 内部日志可保留必要诊断信息，但注意密钥脱敏。

## 沙箱系统

策略级三级沙箱（`SandboxMode`）。**产品主入口是对话页审批模式**，由 `resolveEffectiveSandbox(executionMode)` 推导有效档：

| 对话页模式 | 有效沙箱 |
|------------|----------|
| `confirm-all` / `auto` / `plan-first` | `workspace-write` |
| `full-access` | `full-access` |

策略含义：

| 模式 | 文件读 | 文件写 | 命令执行 |
|------|--------|--------|----------|
| `read-only` | 仅当前工作区内普通文件 | 禁止 | 仅安全命令 |
| `workspace-write` | 仅当前工作区内普通文件 | 工作区内 | 需审批 |
| `full-access` | 允许 | 任意 | 需审批（危险命令仍 bypass-immune） |

设置页不再提供独立沙箱开关。工具层须用 `loadEffectiveSandbox()`，禁止只信旧键 `settings.sandboxMode`。

## 命令安全分级

- safe：`ls` / `cat` / `echo` / `pwd` / `git status` 等只读命令。
- dangerous：`rm` / `chmod` / `kill` / `sudo` / `curl | sh` 等。
- unknown：未匹配命令，按沙箱模式决定。

## 路径守卫

- 检查命令目标路径是否在工作区内。
- `file_read` / `code_search` 在非 `full-access` 模式下也必须限制到当前工作区；没有项目时 fail-closed。
- 保护系统关键路径和凭据文件，例如 `/etc`、`C:\Windows`、`~/.ssh`、`.env`、`.npmrc`、`.netrc`。

## 审批记录

- 会话级审批：仅当前会话有效。
- 持久级审批：跨会话记忆，通常存储在 SQLite。

## 权限规则引擎

五层责任链：

1. 自定义规则：用户定义的 regex pattern 与 allow/deny/ask。
2. 审批记录：历史已审批的命令或工具。
3. 命令分级：ExecPolicy 白名单和黑名单。
4. 沙箱策略：当前 SandboxPolicy 的默认行为。
5. 默认：兜底 ask。

```ts
interface PermissionRule {
  type: 'command' | 'tool' | 'path'
  pattern: string
  action: 'allow' | 'deny' | 'ask'
  reason?: string
}
```

## 工具权限

| 元数据 | 行为 |
|--------|------|
| `isReadOnly: true` | 自动执行 |
| `isDestructive: true` | 必须用户确认 |
| `executionMode: 'confirm-all'` | 所有工具都需确认 |

## 数据保护

- [ ] 对话数据存储在本地 SQLite，不上传云端。
- [ ] Headless / Scheduler 无交互确认时只自动批准明确只读工具，拒绝 Shell、子 Agent 和其他副作用工具。
- [ ] 向量数据库中的嵌入不可逆推原文。
- [x] 数据导出自动脱敏 API Key，并排除 MCP env / command、权限规则、执行模式和本机路径。
- [x] 任意 URL 抓取阻止 SSRF、凭据 URL、重定向到私网和无界响应。
- [x] Electron Renderer 阻止外部同窗导航，CSP 与 CDP 仅允许必要范围。
- [ ] 依赖版本锁定，保留 `package-lock.json`。
