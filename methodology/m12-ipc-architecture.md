# M12 IPC 架构

> **所属**：Part III 安全与扩展
> **参考源**：`electron/preload/index.ts` · `electron/main/ipc/` · CC sourcemap（同样是 Electron）

---

## 一、第一性原理

**IPC 边界不是通信通道，是信任边界——渲染进程不能直接调用主进程的任何能力，跨越边界的一切都必须在 preload 层显式声明。**

Electron 的进程模型把应用分成两层：

- **主进程（Main Process）**：Node.js 环境，可以访问文件系统、数据库、调用 LLM API、启动子进程。权限很高。
- **渲染进程（Renderer Process）**：浏览器环境（Chromium），运行 React UI。权限受限，为了安全不能直接访问 Node.js。

这个隔离是 Electron 的核心安全机制。如果渲染进程可以直接 `require('fs')`，那么任何被渲染的 HTML（包括可能注入的恶意内容）都能读写用户文件系统。

**IPC（Inter-Process Communication）就是这两个世界之间唯一合法的通道**，而 preload 脚本就是这个通道的守门人——它运行在两个环境的交界处，负责把主进程的能力以**安全、显式声明**的方式暴露给渲染进程。

推论地图：

```
根认知：IPC 边界是信任边界，不是技术边界
    │
    ├─ ① 如何安全地暴露主进程能力？    → contextBridge（§2）
    ├─ ② 什么逻辑该放主进程，什么放渲染进程？ → 职责划分（§3）
    ├─ ③ 调用和推送如何区分？         → invoke vs on（§4）
    ├─ ④ 流式 AI 响应如何跨进程传输？  → 双通道组合（§5）
    ├─ ⑤ 确认对话框如何实现双向通信？  → 动态频道模式（§6）
    └─ ⑥ 如何保证三处定义不脱节？     → 三处同步原则（§7）
```

---

## 二、contextBridge：显式声明的安全桥

Electron 提供了两种让渲染进程访问主进程的方式：

| 方式 | 安全性 | 说明 |
|---|---|---|
| `nodeIntegration: true` | ❌ 危险 | 渲染进程可以直接 `require` 任何 Node.js 模块 |
| `contextBridge.exposeInMainWorld` | ✅ 安全 | 只暴露显式声明的函数，渲染进程看不到其他任何东西 |

我们使用 `contextBridge`：

```typescript
// electron/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

// ① contextBridge.exposeInMainWorld(key, value)
//    把 value 挂到渲染进程的 window[key] 上
//    但只有 value 里显式声明的字段才可访问，没有"后门"
contextBridge.exposeInMainWorld('electronAPI', {
  session: {
    list: () => ipcRenderer.invoke('session:list'),
    // ↑ 渲染进程调用 window.electronAPI.session.list()
    //   实际上是向主进程发一个名为 'session:list' 的 IPC 请求
  },
  // ...其他模块...
})
```

**这个设计的安全价值**：`contextBridge` 在暴露时会对 value 做深度克隆，确保渲染进程拿到的是一个"沙盒化"的对象，不是对主进程真实对象的引用。渲染进程无法通过这个桥接触到它没有被授权的任何能力。

---

## 三、职责划分：什么放主进程，什么放渲染进程

**判断标准**：需要 Node.js API 或系统权限的逻辑 → 主进程；纯 UI 状态和交互逻辑 → 渲染进程。

| 主进程负责 | 渲染进程负责 |
|---|---|
| LLM API 调用（网络请求） | 消息列表渲染 |
| SQLite 数据库读写 | 输入框、工具卡片 |
| 文件系统操作 | 会话切换状态 |
| 工具执行（shell_exec 等） | Token 用量显示 |
| Agent Loop 运行 | 流式文字动画 |
| 后台任务（M09） | 审批模式选择 |

**一个容易出错的判断**：会话标题是在主进程生成的（需要调用 LLM），但显示在渲染进程里。标题更新通过 IPC 推送：主进程生成完 → 通过 `session:title-updated` 事件推送 → 渲染进程更新状态。

---

## 四、invoke（request-reply）vs on（事件推送）

preload 里有两种 IPC 模式，对应不同的通信语义：

**`ipcRenderer.invoke`** — 请求-回复（同步语义的异步实现）

```typescript
// preload
session: {
  list: () => ipcRenderer.invoke('session:list'),  // ① 发请求，等回复
  create: () => ipcRenderer.invoke('session:create'),
}
// 使用方（渲染进程）
const sessions = await window.electronAPI.session.list()
// ↑ 等待主进程处理完，拿到返回值
```

适用场景：**一次操作，一个结果**。查询、写入、操作类 IPC 全走这里。

**`ipcRenderer.on`** — 事件订阅（推送模式）

```typescript
// preload
onEvent: (callback: (event: AgentStreamEvent) => void) => {
  // ② 注册监听器，主进程 send 时触发 callback
  const handler = (_e: Electron.IpcRendererEvent, ev: AgentStreamEvent) => callback(ev)
  ipcRenderer.on('chat:event', handler)
  // ③ 返回清理函数——调用方负责在不需要时取消订阅，防内存泄漏
  return () => ipcRenderer.off('chat:event', handler)
},
```

适用场景：**主进程主动推送，渲染进程被动接收**。AI 流式事件、后台任务状态更新、调度器触发通知全走这里。

**关键设计：`on` 必须返回清理函数**

如果不清理，`handler` 会一直挂在 `ipcRenderer` 上。用户切换会话、组件销毁时，旧的 handler 仍然在响应事件，产生"幽灵监听器"问题。返回清理函数让调用方可以控制生命周期。

---

## 五、流式 AI 响应的双通道设计

AI 聊天的 IPC 是最复杂的一条链路，用了 **invoke + on 的组合**：

```typescript
// preload
chat: {
  // ① invoke：发起对话（长时间 pending，直到整个 loop 结束才 resolve）
  send: (sessionId: string, messages: ChatMessage[]) =>
    ipcRenderer.invoke('chat:send', sessionId, messages),

  // ② on：订阅事件流（loop 运行期间，每个 AgentStreamEvent 都推过来）
  onEvent: (callback: (event: AgentStreamEvent) => void) => {
    const handler = (_e: IpcRendererEvent, ev: AgentStreamEvent) => callback(ev)
    ipcRenderer.on('chat:event', handler)
    return () => ipcRenderer.off('chat:event', handler)
  },

  // ③ 停止对话
  abort: (sessionId?: string) => ipcRenderer.invoke('chat:abort', sessionId),
}
```

**为什么 send 用 invoke 而不是 send（单向）？**

`invoke` 在 loop 结束时 resolve，让渲染进程知道"这次对话彻底结束了"——可以用来做 IPC 竞态兜底（即使最后一个 `done` 事件没收到，`invoke` resolve 也能保证 `setIsStreaming(false)` 被调用）。

**流的完整路径**：

```
渲染进程
  ↓ window.electronAPI.chat.send(...)
  ↓ ipcRenderer.invoke('chat:send', ...)
主进程 ipc/chat.ts
  ↓ 调用 runtime.chat()
  ↓ agentLoop yields AgentStreamEvent
  ↓ BrowserWindow.webContents.send('chat:event', ev)  ← 每个事件独立推送
渲染进程
  ↓ ipcRenderer.on('chat:event', handler)
  ↓ handleEvent(ev) → 更新 React 状态
```

---

## 六、确认对话框的动态频道模式

工具执行需要用户确认时，主进程需要"暂停等待"渲染进程的回答。这是一个**跨越 IPC 边界的异步阻塞**，用了动态频道名来实现：

```typescript
// preload

// ① 订阅确认请求（主进程 → 渲染进程）
onConfirmRequest: (callback: (data: { requestId: string; name: string; args: Record<string, unknown> }) => void) => {
  const handler = (_e, data) => callback(data)
  ipcRenderer.on('tool:confirm-request', handler)
  return () => ipcRenderer.off('tool:confirm-request', handler)
},

// ② 发送确认结果（渲染进程 → 主进程）
//    注意：频道名包含 requestId，每次确认是独立的频道！
confirmResponse: (requestId: string, approved: boolean) =>
  ipcRenderer.send(`tool:confirm-response:${requestId}`, approved),
```

**主进程侧的等待逻辑**（ipc/chat.ts 简化版）：

```typescript
// 等待渲染进程的确认，最多等 30 秒
const approved = await new Promise<boolean>((resolve) => {
  const timeout = setTimeout(() => resolve(false), 30_000)
  ipcMain.once(`tool:confirm-response:${requestId}`, (_e, result) => {
    clearTimeout(timeout)
    resolve(result)
  })
  // 通知渲染进程弹出确认对话框
  win.webContents.send('tool:confirm-request', { requestId, name, args })
})
```

**动态频道名的价值**：如果用固定频道名，并发的多个确认请求会互相串扰（A 的确认被 B 收到）。用 `requestId` 作为频道名的一部分，每次确认有独立频道，互不干扰。

---

## 七、三处同步原则

IPC 接口由三处代码共同定义，缺一不可：

```
1. src/shared/types.ts        ← 数据类型（ChatMessage、AgentStreamEvent...）
2. electron/preload/index.ts  ← 渲染进程的接入点（contextBridge 声明）
3. electron/main/ipc/*.ts     ← 主进程的处理器（ipcMain.handle / ipcMain.on）
```

任何一处漏掉或不一致，都会在运行时报"方法未定义"或类型错误：

- 漏了 `preload` → 渲染进程调用时报 `window.electronAPI.xxx is not a function`
- 漏了 `ipc handler` → 主进程不处理请求，`invoke` 永久 pending
- `types.ts` 类型不对 → TypeScript 编译通过，运行时数据格式错误（最难调试）

**执行纪律**：每新增一个 IPC 接口，必须同时改三处，然后跑 `tsc --noEmit` 验证。

---

## 八、暂缓：IPC 层的单元测试

IPC 代码是最难测试的部分——主进程的 IPC handler 直接依赖 Electron 的 `ipcMain`，在 Vitest 环境里这个对象不存在。

当前所有 IPC 相关的测试都通过 Eval（M18）做集成测试，不是单元测试。单元测试需要 mock `ipcMain` / `ipcRenderer`，这需要额外的测试框架配置，暂缓。

---

## 实战记录

### 踩过的坑

**preload 没注册就调用**

最经典的错误：在渲染进程里调用了 `window.electronAPI.xxx`，但 preload 里没有注册对应的方法，报 `window.electronAPI.xxx is not a function`。

根因：新加了 IPC handler（第三处），但忘了在 preload 加对应桥接（第二处）。修复纪律：三处同步，改完立即 `tsc`。

**invoke 竞态：最后一个事件丢失**

AI 流式响应结束时，最后一个 `done` 事件和 `invoke resolve` 几乎同时到达渲染进程。偶发情况下 `invoke resolve` 先到，cleanup 函数已经移除了 `onEvent` 监听器，最后一个 `done` 事件到达时没有 handler 接收，`isStreaming` 状态卡在 `true`。

修复：在 `invoke` resolve 后的 `finally` 里加了兜底 `setIsStreaming(false)`，不依赖 `done` 事件。这是事件和 invoke 双通道设计的典型竞态，必须在调用侧兜底。

**重复 import 导致 build 失败**

`ipc/chat.ts` 里同一个函数被 import 了两次（在重构过程中留下的），TypeScript 编译通过，但 Vite build 时报重复导入错误。教训：`tsc --noEmit` 查不到 Vite 的打包期错误，改了 import 结构必须单独跑 `vite build` 验证。

### 设计检查清单

- [ ] 新增 IPC 接口时：三处同步（types.ts / preload / ipc handler），`tsc --noEmit` 验证
- [ ] on 订阅时：必须返回清理函数，调用方在组件销毁时调用
- [ ] invoke 配合 on 使用时：在 invoke 的 finally 里加状态兜底，处理竞态
- [ ] 需要"等待用户回应"时：用动态频道名（`channel:${requestId}`），不用固定频道
