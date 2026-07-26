# M12 IPC 架构 — 代码走读

> 对照 `m12-ipc-architecture.md` 的各章节，展示 preload + main/ipc 的真实实现。
>
> 主要文件：`electron/preload/index.ts` · `electron/main/ipc/chat.ts` · `electron/main/ipc/index.ts`

---

## §2 对照：contextBridge — 显式声明的安全桥

### 我们的 preload 结构

```typescript
// electron/preload/index.ts L1-3, L19

// ① import：只能用 electron 提供的两个 API
//    contextBridge = 安全桥（把东西暴露给渲染进程）
//    ipcRenderer = 渲染进程侧的 IPC 客户端
import { ipcRenderer, contextBridge } from 'electron'

// ② 从 shared/types.ts 导入类型（仅类型，不导入运行时代码）
//    preload 可以 import shared 类型，因为类型在编译后会被擦除
import type { ChatMessage, AgentStreamEvent, TaskLifecycleEvent } from '../../src/shared/types'

// ③ exposeInMainWorld(key, api)
//    渲染进程通过 window[key]（= window.electronAPI）访问 api 里的方法
//    api 之外的一切对渲染进程不可见——这是安全边界的实现
contextBridge.exposeInMainWorld('electronAPI', {
  // 所有 IPC 方法以命名空间组织
  session: { ... },
  chat: { ... },
  tasks: { ... },
  // ...
})
```

**preload 的类型化方案**：`window.electronAPI` 的形状写在 `src/vite-env.d.ts`（`declare global { interface Window { electronAPI: ... } }`）。这是四处同步里的第 4 处——preload 增删方法时必须同步改这里，否则渲染进程类型会漂移。

### 窗口创建上的显式信任边界

```typescript
// electron/main/index.ts — createWindow
webPreferences: {
  preload,
  contextIsolation: true,   // ↑ 渲染进程隔离；只能碰 bridge
  nodeIntegration: false,   // ↑ 禁止 renderer 直接 require Node
}
```

**发现**：Alice 每个 BrowserWindow 都显式写这两项；feiche spec 同样强制。Electron 42 默认已安全，显式写出是防「读代码的人依赖默认值」和防未来默认变更。

**方法论对照**：→ `m12-ipc-architecture.md` §2（contextBridge：显式声明的安全桥）

---

## §4 对照：invoke vs on 两种 IPC 模式

### invoke（request-reply）

```typescript
// preload/index.ts — session 模块（典型 invoke 用法）

session: {
  // ① ipcRenderer.invoke(channel, ...args) = 发请求给主进程，等回复
  //    返回 Promise，主进程 ipcMain.handle(channel) 的返回值就是这里的 resolved value
  list: (): Promise<SessionSummary[]> =>
    ipcRenderer.invoke('session:list'),

  // ② 带参数的 invoke
  get: (id: string): Promise<ChatSession | null> =>
    ipcRenderer.invoke('session:get', id),

  // ③ 返回 void 的 invoke（主进程只是执行，不返回数据）
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke('session:delete', id),
},
```

### on（事件订阅 + 清理函数）

```typescript
// preload/index.ts — tasks 模块（典型 on 用法）

tasks: {
  onEvent: (callback: (event: TaskLifecycleEvent) => void) => {
    // ④ 创建 handler 包装器：Electron IPC 的第一个参数是 IpcRendererEvent，
    //    我们不关心它，直接忽略（_e），只把业务数据 ev 传给 callback
    const handler = (_e: Electron.IpcRendererEvent, ev: TaskLifecycleEvent) =>
      callback(ev)

    // ⑤ 注册监听器
    ipcRenderer.on('task:event', handler)

    // ⑥ 返回清理函数——注意 return 的是一个函数，不是调用结果
    //    调用方 useEffect 里：const cleanup = onEvent(cb); return cleanup
    return () => ipcRenderer.off('task:event', handler)
  },
},
```

**发现**：CC 的 IPC 设计和我们高度类似——都用 `ipcRenderer.invoke` 做 request-reply，用 `ipcRenderer.on` 做推送。差异在于我们把所有接口集中在一个 `preload/index.ts` 文件，CC 按模块分散在多个 preload 文件里。对于我们当前的规模，集中在一个文件更易维护。

**方法论对照**：→ `m12-ipc-architecture.md` §4（invoke vs on）

---

## §5 对照：流式 AI 响应的双通道

### preload 侧（接口定义）

```typescript
// preload/index.ts L142-158

chat: {
  // ① invoke：发起对话，长时间 pending 直到整个 loop 结束才 resolve
  //    为什么用 invoke 而不是单向 send？
  //    答：invoke 的 resolve 可以作为"对话彻底结束"的信号
  //       即使最后一个 chat:event(done) 丢失，invoke resolve 也能触发兜底处理
  send: (sessionId: string, messages: ChatMessage[]) =>
    ipcRenderer.invoke('chat:send', sessionId, messages),

  // ② on：订阅 AgentStreamEvent 事件流
  //    loop 运行期间，每个 yield 出来的事件都通过这里推送
  onEvent: (callback: (event: AgentStreamEvent) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, ev: AgentStreamEvent) => callback(ev)
    ipcRenderer.on('chat:event', handler)
    return () => ipcRenderer.off('chat:event', handler)  // ← 清理函数
  },

  abort: (sessionId?: string) => ipcRenderer.invoke('chat:abort', sessionId),
},
```

### main 侧（ipc/chat.ts 完整代码）

```typescript
// electron/main/ipc/chat.ts

export function registerChatIPC(toolRegistry: ToolRegistry): void {

  ipcMain.handle('chat:send', async (event, sessionId: string, messages: ChatMessage[]) => {
    // ③ emit 是一个局部辅助函数：向触发这次 invoke 的那个窗口推送事件
    //    event.sender = 发起 invoke 的渲染进程的 webContents
    //    .send('chat:event', ...) = 推送事件（单向，不等回复）
    const emit = (ev: Record<string, unknown>) => {
      event.sender.send('chat:event', { ...ev, sessionId })
      //                                ↑ 把 sessionId 附加到每个事件上
      //                                  渲染进程可以用 sessionId 过滤"不是当前会话的事件"
    }

    try {
      // ④ runtime.chat() 返回 AsyncGenerator<AgentStreamEvent>
      const stream = runtime.chat(sessionId, messages, toolRegistry, confirmTool)

      // ⑤ for await...of 消费 agentLoop 的事件流
      //    每个 yield 出来的事件都通过 emit 推送给渲染进程
      for await (const ev of stream) {
        emit(ev)
      }
      // ⑥ for await 结束 = agentLoop 结束 = invoke resolve（返回 undefined）
      //    渲染进程的 await chat.send(...) 此时返回，触发 finally 里的兜底处理

    } catch (err) {
      // ⑦ 最外层 catch：agentLoop 完全崩溃时（正常不会发生，loop 内部已处理所有错误）
      const agentErr = toAgentError(err)
      emit({ type: 'error', ...agentErr.toEventPayload() })
      emit({ type: 'done', reason: 'model_error' })
    }
  })
}
```

**发现**：`emit` 函数的设计很精妙——它是在 handler 内部创建的闭包，捕获了 `event.sender`（触发这次 invoke 的窗口）。这保证了事件只发给发起请求的那个窗口，而不是广播给所有窗口。如果用 `BrowserWindow.getAllWindows()[0].webContents.send()`（其他地方的做法），在多窗口场景下会广播给错误的窗口。

**方法论对照**：→ `m12-ipc-architecture.md` §5（流式 AI 响应的双通道设计）

---

## §6 对照：确认对话框的动态频道模式

### main 侧（ipc/chat.ts）

```typescript
// chat.ts — confirmTool（2026-07-26：UUID + 超时清理）

const CONFIRM_TIMEOUT_MS = 60_000

const confirmTool = (name: string, args: Record<string, unknown>): Promise<boolean> => {
  return new Promise((resolve) => {
    // ① UUID，避免 Date.now() 同毫秒碰撞
    const requestId = `confirm-${randomUUID()}`
    const channel = `tool:confirm-response:${requestId}`
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    // ② 统一收口：应答 / 超时都走 finish，清 timer + 卸 listener
    const finish = (approved: boolean) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      ipcMain.removeListener(channel, onResponse)
      resolve(approved)
    }

    function onResponse(_e: Electron.IpcMainEvent, approved: boolean) {
      finish(approved)  // ③ 用户点了允许/拒绝
    }

    ipcMain.once(channel, onResponse)
    // ④ 通知渲染进程弹确认框（单向推送）
    event.sender.send('tool:confirm-request', { requestId, name, args })

    // ⑤ 60s 无回应 → 自动拒绝，并卸掉 once（防泄漏）
    timer = setTimeout(() => {
      log.warn('tool confirm timed out', { requestId, name })
      finish(false)
    }, CONFIRM_TIMEOUT_MS)
  })
}
```

### preload 侧

```typescript
// preload/index.ts L151-157

// ⑥ 接收确认请求（主进程 → 渲染进程）
onConfirmRequest: (callback) => {
  const handler = (_e, data) => callback(data)
  ipcRenderer.on('tool:confirm-request', handler)
  return () => ipcRenderer.off('tool:confirm-request', handler)
},

// ⑦ 发送确认结果（渲染进程 → 主进程）
//    ipcRenderer.send（单向），不是 invoke（不等回复）
//    这里 channel 名是动态的：tool:confirm-response:confirm-1234567890
confirmResponse: (requestId: string, approved: boolean) =>
  ipcRenderer.send(`tool:confirm-response:${requestId}`, approved),
```

**动态频道的本质**：`ipcMain.once` 注册 `tool:confirm-response:${requestId}`，渲染进程 `send` 到同一频道。主进程侧按 requestId 隔离，不会串话。

**发现（UI 侧缺口）**：主进程可并发等多个确认，但 `App.tsx` 只有一个 `confirmDialog`——后到的请求会覆盖对话框。与 Alice 的 permission/askUser 串行队列不同；标为已知限制，见理念章 §6。

**方法论对照**：→ `m12-ipc-architecture.md` §6（确认对话框的动态频道模式）

---

## §7 对照：四处同步的完整链路

以 `session:list` 为例：

```typescript
// ① src/shared/types.ts — 载荷数据类型
export interface ChatSession { id: string; messages: ChatMessage[]; createdAt: number }

// ② electron/preload/index.ts — bridge 接入点
session: {
  list: (): Promise<SessionSummary[]> => ipcRenderer.invoke('session:list'),
}

// ③ electron/main/ipc/session.ts — 主进程 handler
ipcMain.handle('session:list', async () => store.listSessions())

// ④ src/vite-env.d.ts — 渲染进程看到的 window.electronAPI 形状
declare global {
  interface Window {
    electronAPI: {
      session: { list: () => Promise<SessionSummary[]>; /* ... */ }
      // ...
    }
  }
}
```

**频道名是字符串，TypeScript 校不住 ②↔③ 拼写一致性**——四处同步里最脆的一环。④ 只能保证渲染进程「调用面」类型正确，不能证明 handler 已注册。

---

## 关键设计对比

| 设计维度 | 我们的选择 | 备注 |
|---|---|---|
| preload 组织 | 单文件集中管理 | 规模小时简单，规模大时按模块拆分 |
| 信任边界 | 显式 contextIsolation + 禁 nodeIntegration | 与 Alice/feiche 一致 |
| emit 函数 | 闭包捕获 `event.sender` | chat 路径避免多窗口误广播 |
| 确认等待 | Promise + once + UUID + finish 收口 | 60s 超时卸 listener |
| 确认 UI | 单 dialog（已知限制） | 并行确认变常见再做串行队列 |
| 清理机制 | on 返回清理函数 | 调用方负责生命周期 |
| 类型同步 | 四处（含 vite-env.d.ts） | 频道名仍无编译期校验 |
| 频道名约定 | `模块:操作`（如 `session:list`） | 字符串，无类型校验 |
