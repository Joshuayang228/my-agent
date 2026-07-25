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

**preload 的类型化方案**：preload 暴露的是 `window.electronAPI`，渲染进程需要知道它的类型。我们没有独立的 `.d.ts` 文件——类型通过 React 组件直接使用 `window.electronAPI?.xxx()` 的方式隐式推断。这是轻量但不严格的方案，后续可以补 `Window` 接口的类型声明来强化。

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
// chat.ts — confirmTool 的完整实现

const confirmTool = (name: string, args: Record<string, unknown>): Promise<boolean> => {
  return new Promise((resolve) => {
    // ① 每次确认请求生成唯一 ID
    const requestId = `confirm-${Date.now()}`

    // ② 通知渲染进程显示确认对话框（单向推送）
    event.sender.send('tool:confirm-request', { requestId, name, args })

    // ③ 注册一次性监听器，等待渲染进程的回答
    //    ipcMain.once = 只处理一次，处理完自动移除
    //    频道名包含 requestId = 动态频道，不同请求互不干扰
    ipcMain.once(`tool:confirm-response:${requestId}`, (_e, approved: boolean) => {
      resolve(approved)  // ④ 用户点了"允许"或"拒绝"
    })

    // ⑤ 超时兜底：60 秒无回应则自动拒绝
    //    防止主进程永久 pending（用户切走了窗口、关掉了弹窗等）
    setTimeout(() => resolve(false), 60_000)
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

**动态频道的本质**：`ipcMain.once` 注册了一个名为 `tool:confirm-response:confirm-${Date.now()}` 的一次性监听器，渲染进程用 `ipcRenderer.send` 发到这个频道。两者通过 `requestId` 配对。如果同时有两个工具需要确认，每个都有自己的 `requestId`，对应不同的 `ipcMain.once` 监听器，不会串话。

**方法论对照**：→ `m12-ipc-architecture.md` §6（确认对话框的动态频道模式）

---

## §7 对照：三处同步的完整链路

以 `session:list` 为例，展示三处定义的完整链路：

```typescript
// 第一处：src/shared/types.ts（数据类型定义）
export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: number
}
// SessionSummary 在 preload/index.ts 里本地定义（轻量 DTO）

// 第二处：electron/preload/index.ts（渲染进程接入点）
session: {
  list: (): Promise<SessionSummary[]> => ipcRenderer.invoke('session:list'),
  //         ↑ 类型声明                                      ↑ 频道名字符串
}

// 第三处：electron/main/ipc/session.ts（主进程处理器）
ipcMain.handle('session:list', async () => {
  //           ↑ 频道名必须和 invoke 里的完全一致（字符串，TypeScript 无法校验）
  const sessions = await sessionStore.list()
  return sessions  // 返回值会成为渲染进程 invoke 的 resolved value
})
```

**频道名是字符串，TypeScript 无法校验一致性**——这是三处同步最脆弱的地方。`ipcRenderer.invoke('session:list')` 和 `ipcMain.handle('session:list', ...)` 里的字符串必须完全一样，但 TypeScript 不会提醒你它们不一致。修改频道名时必须同时改两处，而且只能靠人工 or 运行时报错发现。

---

## 关键设计对比

| 设计维度 | 我们的选择 | 备注 |
|---|---|---|
| preload 组织 | 单文件集中管理 | 规模小时简单，规模大时按模块拆分 |
| emit 函数 | 闭包捕获 `event.sender` | 避免多窗口广播问题 |
| 确认等待 | `new Promise` + `ipcMain.once` | 动态频道，60s 超时兜底 |
| 清理机制 | on 返回清理函数 | 调用方负责生命周期 |
| 频道名约定 | `模块:操作`（如 `session:list`） | 字符串，无类型校验 |
