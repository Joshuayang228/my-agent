# M12 IPC 架构 — 代码走读

> 理念章：[`m12-ipc-architecture.md`](./m12-ipc-architecture.md)
> 最近核对：2026-08-16

---

## 一、四处同步是接口契约

每个 Renderer 可调用接口必须同时核对：

```text
src/shared/types.ts          共享载荷/事件类型
electron/preload/index.ts    contextBridge 白名单
 electron/main/ipc/*.ts       主进程 handler
src/vite-env.d.ts            window.electronAPI 形状
```

频道字符串本身没有编译期关联；TypeScript 只能保证各文件内部类型正确，不能证明 preload 与 handler 拼写相同。

## 二、invoke 与 event 分工

- `ipcRenderer.invoke`：一次请求对应一次返回，例如 settings、session、project、debug 查询；
- `webContents.send`：持续事件，例如 `chat:event`、`task:event`、Eval 状态；
- Renderer 的 `onXxx` 必须返回清理函数，组件卸载时 off 同一个 handler。

Chat 使用 invoke 启动一次主进程流，增量内容走 event；invoke 的 finally 是 Renderer 最终清理兜底。

## 三、确认协议

工具确认包含：

```text
主进程发送 tool:confirm-request
Renderer 展示确认卡
Renderer 回传 tool:confirm-response:<requestId>
超时 → 默认拒绝
finally → 清理动态监听器
```

requestId 随机且单次使用。确认通过只代表用户同意该工具调用，不能绕过命令、路径或 Headless 硬边界。

## 四、输入是不可信的

即使 Renderer 是本地页面，IPC 参数仍需运行时校验：

- 字符串/对象/枚举类型；
- ID、Prompt、命令、路径和数组长度；
- 文件 realpath 和当前项目根；
- Debug suite 白名单；
- Scheduler cron/interval；
- MCP transport/URL/command；
- 导入文件 Schema 和数量。

对外只返回用户友好错误；内部路径、堆栈、SQL 和凭据不直接返回。

## 五、事件目标

Chat 与 Terminal 事件发回发起请求的 `event.sender`，避免多窗口串流；全局任务、伙伴事件和 Eval 状态按产品语义广播到存活窗口。广播前检查窗口是否 destroyed。

## 六、preload 边界

BrowserWindow 使用 contextIsolation、nodeIntegration=false 和默认 sandbox。Renderer 不能直接访问 Node；preload 只暴露固定命名空间。外部导航被阻断，外链交给系统浏览器，避免远程页面继承 preload 能力。

## 七、测试证据

- `ipc-handlers.test.ts`：确认超时和可测纯逻辑；
- 各模块输入测试：project、scheduler、memory、MCP、data import、debug runner；
- `npx tsc --noEmit`：四处 TypeScript 形状；
- Vite/Electron build：preload 和主进程实际打包；
- UI E2E：Renderer 调用入口和导航可用。

当前已有 IPC 单元测试与模块级 handler 测试，旧文档中“IPC 只能靠 Eval、尚无单测”的结论已失效。

## 八、当前缺口

频道名仍是裸字符串，尚无从单一 Schema 自动生成 preload/handler/types 的机制；因此四处同步纪律和测试仍不能省略。

## 2026-08 敏感设置边界

`settings:get` 不再直接返回 `getAllSettings()`：主进程返回 `RendererSettings` 安全视图，API Key 只返回 `llmApiKeyConfigured`，MCP env 只返回 `__MY_AGENT_REDACTED__`。连接测试用 `useStoredApiKey` 让主进程读取安全存储，避免 Renderer 为了测试而重新读取长期凭据。
