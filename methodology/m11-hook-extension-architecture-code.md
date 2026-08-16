# M11 Hook 与扩展点架构 — 代码走读

> 理念章：[`m11-hook-extension-architecture.md`](./m11-hook-extension-architecture.md)
> 最近核对：2026-08-16

---

## 一、仓库没有用户生命周期 Hook 引擎

当前不存在 `electron/main/hooks/`。这不是缺文件，而是产品边界：任意用户脚本若能挂到 BeforeTool / AfterResponse 等生命周期，会同时引入代码执行、权限绕过、超时、顺序和错误传播问题。现阶段不暴露这类 API。

## 二、四类扩展责任

| 责任 | 入口 | 能否改变决策 |
|---|---|---|
| 观测 | `utils/observer.ts`、`utils/tracer.ts` | 否 |
| 控制 | `tools/middleware.ts`、`sandbox/permission-engine.ts` | 是，受固定代码约束 |
| 通知 | `AgentStreamEvent`、IPC 事件 | 否，只传状态 |
| 用户扩展 | Skill、MCP、Role Pack、Settings | 通过各自契约 |

“可订阅”不等于“可改写”。Observer/Tracer 失败不能阻断主业务；Permission/Middleware 才能拒绝或改造执行结果。

## 三、Tool Middleware

默认管道：

```text
error-formatting
→ logging
→ session-file-change
→ verify
→ result-persistence
→ tool.execute
```

Middleware 是内部固定扩展点。它接收结构化 ToolExecutionContext，可在执行前后处理，但不能由外部配置任意注入脚本。动态工具 metadata 通过 Registry 统一解析，权限和并发不允许各读一套值。

## 四、Observer 与 Tracer

- Observer 发布结构化阶段事件；
- Tracer 维护 span、caller、token lane 和父子关系；
- AsyncLocalStorage 传递 session/user/interaction identity；
- sink 失败只记录元数据，不抛回 Agent Loop；
- Debug 从这些存储读取生产证据，不把 Hook 当成第二条业务执行链。

## 五、内部回调不是用户 Hook

`ContextManagerOptions.onCompact` 是压缩观测回调；LLM trace sink、asset usage sink 和 store subscribe 也是内部 wiring。它们由主进程启动代码装配，不读取用户脚本，不拥有任意文件或 Shell 能力。

## 六、用户扩展通道

- Skill：YAML/Markdown 数据资产，按需注入并收窄工具；
- MCP：外部协议工具，默认破坏性/需确认；
- Role Pack：具名角色身份、世界和语气资产；
- Settings：受白名单和运行时校验的配置。

这些通道都先有注册表、类型和安全边界，再进入运行时；不能借“Hook”名义绕过权限。

## 七、安全链已接通

`shell_exec` 和 Terminal 使用 `checkCommandPermission`；`permissionRules` 在主进程启动和设置变更时加载；文件工具走 effective sandbox 与 realpath；Headless 只自动批准明确只读工具。旧文档中“shell 尚未统一、loadRules 未接线”的描述已失效。

## 八、测试证据

- `middleware.test.ts`：洋葱顺序、错误格式化、结果持久化；
- `observer.test.ts` / tracing 测试：订阅和 span；
- `permission-engine.test.ts`：控制面责任链；
- `asset-usage.test.ts`：sink 元数据与脱敏；
- `command-guard.test.ts`：命令硬边界。

## 九、当前缺口

如果未来需要用户 Hook，必须先设计：事件白名单、输入输出 Schema、超时、并发、权限继承、脚本隔离、签名/来源、失败语义和 Debug 证据。当前不以通用 EventEmitter 预埋半套 API。
