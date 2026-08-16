# M13 MCP 集成 — 代码走读

> 理念章：[`m13-mcp-integration.md`](./m13-mcp-integration.md)
> 最近核对：2026-08-16

---

## 一、配置和传输

`McpServerConfig` 支持：

```text
stdio: command / args / env
sse:   http(s) URL
enabled / id / name
```

Settings UI 已能选择 stdio 或 SSE；IPC 对 transport、command、args、env 和 URL 做长度/协议校验。配置通过 settings-store 的 safeStorage 加密，普通数据备份明确排除 MCP command/env。

## 二、连接生命周期

`McpManager.connect()`：

1. 防止重复 ID；
2. 创建 Client，并声明 tools/resources/elicitation capability；
3. 注册 elicitation handler；
4. 创建 StdioClientTransport 或 SSEClientTransport；
5. 连接并刷新 tools/resources；
6. 监听 onclose/onerror；
7. 断开后指数退避重连，最大 60 秒。

主动 disconnect 会关闭 allowReconnect 并清理 timer，不能被 onclose 再次拉起。

## 三、子进程环境

stdio 不继承主进程全部凭据。`buildSafeChildProcessEnv(config.env)` 先过滤 process.env 中常见 API Key/Token/Secret，再合并用户显式配置的 env。显式 env 代表用户主动授予该 MCP Server。

## 四、Bridge

MCP Tool 以 `mcp:<serverId>:<toolName>` 注册进 ToolRegistry。刷新 inventory 时先移除该 server 的旧工具再注册新列表，避免断线重连后重复或残留。

外部工具默认 metadata：

```text
isReadOnly=false
isDestructive=true
isConcurrencySafe=false
```

Schema 尽量保留 MCP 原始 inputSchema；描述做长度限制。外部 Server 没有明确安全声明时必须确认，不能按名字猜只读。

## 五、Resources 与 Elicitation

Client 尝试 `listResources()`，不支持时只记录结构化错误元数据，不阻断 tools。Elicitation 请求通过主进程回调交给产品层；没有 handler 时返回 decline，而不是自动填写。

## 六、启动恢复

主进程启动读取加密配置，只连接 enabled Server；单个 Server 失败不阻断应用启动。关闭应用时 disconnectAll 清理进程和 timer。

## 七、测试证据

- `mcp-bridge.test.ts`：命名空间、Schema、描述和保守 metadata；
- `ipc-handlers.test.ts`：重连退避纯逻辑；
- MCP client/IPC 输入测试：transport、URL、配置边界；
- `settings-encryption.test.ts`：safeStorage 包络、迁移和 fail-closed；
- `security-boundaries.test.ts`：子进程环境与备份排除。

## 八、当前缺口

- 尚无 OAuth / needs-auth 状态和企业凭据代理；
- SSE URL 是用户显式连接目标，不套用普通 `url_fetch` 的公网 SSRF 黑名单；
- Tool Search/按需注入尚未针对大量 MCP 工具启用；
- 外部 Server 的可信度仍依赖用户选择和权限确认。


## 2026-08 安全校准

- MCP env 在 Renderer 侧只显示 `__MY_AGENT_REDACTED__`，连接和启动恢复由主进程按 id/key 恢复真实值；没有旧值时拒绝启动。
- MCP 配置保存/连接使用统一结构与资源上限；启用或修改配置需主进程原生确认。
- 外部工具描述明确标记为不受信任数据并截断；input schema 超过 128KB 时不再展开到模型上下文，采用 fail-closed 的空参数结构。
