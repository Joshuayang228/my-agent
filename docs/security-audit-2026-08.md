# My Agent 安全审计报告（2026-08-16）

> 本报告记录 2026 年 8 月 16 日完成的第三轮高风险安全审计。事实源是当前代码、单元测试、构建结果和依赖审计；不调用真实模型，不使用真实 API Key 做验证。

## 一、审计范围

- Electron 主进程 / Renderer / preload / IPC 边界
- Agent 工具系统、命令权限、沙箱、审批责任链
- 文件路径、symlink、工作区和子 Agent `ToolContext.workdir`
- Headless / Scheduler / Debug Eval 子进程
- API Key、MCP 配置、子进程环境变量和日志错误信息
- URL 抓取 SSRF、IPv4 / IPv6 地址黑名单、重定向和响应上限
- Playground、Code Search、RAG 的输入规模和正则表达式 DoS
- LLM 配置装配一致性
- 依赖漏洞

不在本轮范围内：产品功能重构、真实模型质量、远程服务本身的权限策略、用户主动选择 `full-access` 后的预期能力。

## 二、发现与处置

| 编号 | 风险 | 根因 | 处置 | 状态 |
|---|---|---|---|---|
| SEC-01 | 高 | `safe` 命令按首词放行，`node -e`、`npm` 生命周期、绝对路径读取和 Shell 串联可绕过沙箱 | 收紧 `exec-policy`；非完全访问模式硬拦 Shell 控制符、显式越界路径和越界 cwd；危险命令先于自定义 allow / 历史审批判定 | 已修复 |
| SEC-02 | 高 | 自定义 `allow` 与历史审批在危险 / 路径边界前执行，`bypass-immune` 实际可被规则抢先绕过 | 重排权限责任链，硬边界先执行；新增回归测试 | 已修复 |
| SEC-03 | 高 | 工作区内 symlink 可把 `file_write` / `file_edit` / `apply_patch` / `file_delete` 转发到工作区外 | 新增写入目标与最近存在父目录的 realpath 边界解析；非 `full-access` fail-closed | 已修复 |
| SEC-04 | 高 | 部分文件工具使用全局工作区而不是子 Agent 的 `ToolContext.workdir` | 写入、编辑、patch、shell 统一优先使用调用上下文工作区 | 已修复 |
| SEC-05 | 高 | Headless 只拒绝 `shell_exec`，但会自动批准文件写入、Git 分支和可写子 Agent | 只自动批准明确只读工具；`shell_exec`、`delegate_task`、`continue_task` 和所有非只读工具默认拒绝 | 已修复 |
| SEC-06 | 高 | 敏感设置解密失败后回退原字符串，旧明文 API Key 可能继续留在 SQLite | 引入 `enc:v1:` 包络；旧明文 / raw base64 迁移；新密文解密失败 fail-closed | 已修复 |
| SEC-07 | 中高 | Eval Runner 将主进程完整 `process.env` 传给 npm 子进程 | 改用 `buildSafeChildProcessEnv`，不再无意继承主进程凭据 | 已修复 |
| SEC-08 | 中高 | 权限规则与 Code Search 允许无界正则，可能用灾难性回溯阻塞主进程 | 限制规则 / 查询长度，拒绝常见嵌套量词和反向引用；Code Search 去除全局正则状态污染 | 已修复 |
| SEC-09 | 中 | Playground 历史、RAG 文档、RAG topK、Shell 命令等输入缺少统一规模边界 | 增加 Prompt / history / 文档 / chunk / topK / command / cwd 上限 | 已修复 |
| SEC-10 | 中 | RAG IPC 与工具绕过唯一 LLM 配置工厂，读取已不存在的旧设置键 | 改用 `loadMainLLMConfig`，避免空配置和策略漂移 | 已修复 |
| SEC-11 | 中 | URL 黑名单对带括号 IPv6 和 IPv4-mapped IPv6 覆盖不足 | 规范化 IPv6 hostname，补 mapped IPv6 解析与测试 | 已修复 |
| SEC-12 | 低中 | 多个 IPC / Debug 错误路径直接把内部异常正文返回 Renderer | 改为用户友好错误；日志只保留错误类型 / 长度等诊断元数据 | 已修复 |
| SEC-13 | 高 | 危险命令匹配区分大小写，`full-access` 下大写的删除、PowerShell 编码命令或关机命令可能绕过 bypass-immune 规则 | 统一先转小写再匹配；补 Windows 删除、PowerShell、磁盘分区、破坏性 Git 清理规则与回归测试 | 已修复 |
| SEC-14 | 中 | 文件写入后的 TypeScript 验证使用 `npx tsc`，依赖缺失时可能触发 npx 联网安装并执行包 | 改为 `npx --no-install tsc`，验证工具缺失时只跳过验证，不触发安装 | 已修复 |
| SEC-15 | 高 | `settings:get` 直接返回解密后的 `llmApiKey` 与 MCP `env`；Renderer 一旦被 XSS/插件污染即可读取长期凭据 | 新增 Renderer 安全设置视图；API Key 只返回 `llmApiKeyConfigured`，MCP env 只返回稳定哨兵；连接测试由主进程使用已保存 Key | 已修复 |
| SEC-16 | 高 | Renderer 回传脱敏 MCP 配置时可能覆盖旧 secret，或通过设置持久化后在下次启动静默执行新进程/远程连接 | 主进程恢复哨兵对应的旧 secret；无旧值则拒绝；启用/修改 MCP 配置和 full-access 设置必须由主进程原生确认；启动恢复共用严格配置校验 | 已修复 |
| SEC-17 | 中高 | MCP 配置校验、启动恢复、手动连接各自维护边界，存在校验漂移和超限配置风险 | 抽出 `mcp/config-security.ts` 统一校验、重复 ID、50 个服务、env/参数上限和 secret hydrate；补脱敏/恢复回归测试 | 已修复 |
| SEC-18 | 中高 | API Key 脱敏后设置页仍可能把空字符串自动保存，覆盖已保存 Key，或误判首次配置 | 设置页增加 `hasStoredApiKey` / dirty 状态；未修改 Key 时跳过写入，连接测试支持 `useStoredApiKey` | 已修复 |
| SEC-19 | 中高 | 外部 MCP 工具描述和超大 input schema 会直接进入模型上下文，既可能注入伪指令，也可能造成上下文/内存膨胀 | 工具描述增加不受信任数据边界并截断；schema 超过 128KB 时 fail-closed 为禁止展开的空参数结构；工具本身仍默认破坏性、不可并发 | 已修复 |

## 三、未发现但明确保留的边界

1. `full-access` 是用户明确选择的高信任模式；除 bypass-immune 危险命令外，它允许用户主动承担工作区外命令和路径风险。
2. 用户显式配置的 MCP stdio command / SSE URL 仍会按配置连接或启动；这是 MCP 集成功能本身，但现在必须经过主进程原生确认，且普通设置视图不会暴露 env 原文。MCP Server 返回的工具默认按高风险处理。
3. URL 抓取已做解析前 SSRF 检查、重定向阻断和响应上限；DNS 解析与实际连接之间仍存在操作系统网络层面的竞态，后续如需对抗主动 DNS rebinding，应增加固定地址连接器或进程级网络策略。
4. Renderer 的 HTML 文件预览使用空 `sandbox` iframe；Markdown / Mermaid 仍必须保持既有严格安全配置，不应引入 raw HTML 或任意协议链接。
5. 开发模式仍会把 CDP 绑定到 `127.0.0.1:9222` 以支持 UI 调试；生产构建不启用。若在不可信本机环境运行开发版，应关闭该开关或使用隔离账户。

## 四、验证证据

- Unit：当前门禁以最新命令输出为准；本轮修复后的最近一次结果为 129 个测试文件、755 项通过
- 定向安全回归：MCP 配置/设置安全视图、命令、Git、工作区、Terminal、Markdown、Tool Result 等回归均通过；全量数字以最终门禁输出为准
- TypeScript：`npx tsc --noEmit` 通过
- 依赖：`npm audit --registry=https://registry.npmjs.org` → 0 vulnerabilities
- 生产依赖：`npm audit --omit=dev --registry=https://registry.npmjs.org` → 0 vulnerabilities
- 未调用真实模型，未使用真实 API Key 做测试

## 五、后续门禁

每次修改权限、路径、子进程、MCP、Prompt / Debug 或数据导入导出时，至少补跑：

```text
npm run test
npx tsc --noEmit
npm run build
npm run test:e2e
npm audit --registry=https://registry.npmjs.org
npm audit --omit=dev --registry=https://registry.npmjs.org
```
