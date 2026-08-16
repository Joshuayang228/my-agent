# M12 IPC 架构

> **所属**：Part III 安全与扩展
> **状态**：✅
> **参考源**：`electron/preload/index.ts` · `electron/main/ipc/` · `src/vite-env.d.ts` · feiche/wps-cowork `electron-client-design.md` · Alice preload/main（本机 `D:\alice-extracted\out`）
>
> 说明：Alice 方法论目录里没有独立的「Electron IPC」章（skill 映射里的 ch13 实际是可观测性）；IPC 对照以 feiche Electron 薄壳 spec + Alice 解包源码为准。

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
    ├─ ① 如何安全地暴露主进程能力？    → contextBridge + 显式 webPreferences（§2）
    ├─ ② 什么逻辑该放主进程，什么放渲染进程？ → 职责划分（§3）
    ├─ ③ 调用和推送如何区分？         → invoke vs on（§4）
    ├─ ④ 流式 AI 响应如何跨进程传输？  → 双通道组合（§5）
    ├─ ⑤ 确认对话框如何实现双向通信？  → 动态频道模式（§6）
    └─ ⑥ 如何保证定义不脱节？         → 四处同步原则（§7）
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

**信任边界要写在窗口创建上，不只写在 preload 里**（受 Alice / feiche 启发）：

```typescript
webPreferences: {
  preload,
  contextIsolation: true,   // 渲染进程拿不到 Node；只能碰 bridge 暴露的面
  nodeIntegration: false,   // 禁止 renderer require('fs') 等
}
```

Electron 42 默认已是此组合，但**默认值会变、读代码的人看不见默认**——显式写出才是纪律。feiche 薄壳还用「通用 `invoke` + `client_` 频道白名单」；我们选**按命名空间显式声明方法**，攻击面更小，不跟通用 invoke。

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

**标题怎么跨进程**：智能标题在主进程由后台任务 `smart-title` 生成并写库；渲染进程在 `chat:event` 的 `done`（或手动「重新生成标题」的 invoke 返回）后 `loadSessions()` 刷新列表。没有单独的 `session:title-updated` 推送通道——这是刻意保持通道面简单，用「写库 + 列表刷新」而不是再开一条事件。

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
// 等待渲染进程的确认，最多等 60 秒；超时与应答都走同一 finish，避免 once 泄漏
const approved = await new Promise<boolean>((resolve) => {
  const requestId = `confirm-${randomUUID()}`
  const channel = `tool:confirm-response:${requestId}`
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const finish = (result: boolean) => {
    if (settled) return
    settled = true
    if (timer !== undefined) clearTimeout(timer)
    ipcMain.removeListener(channel, onResponse)
    resolve(result)
  }
  function onResponse(_e: Electron.IpcMainEvent, result: boolean) {
    finish(result)
  }
  ipcMain.once(channel, onResponse)
  event.sender.send('tool:confirm-request', { requestId, name, args })
  timer = setTimeout(() => finish(false), 60_000)
})
```

**动态频道名的价值**：如果用固定频道名，并发的多个确认请求会互相串扰（A 的确认被 B 收到）。用 `requestId` 作为频道名的一部分，每次确认有独立频道，互不干扰。`requestId` 用 UUID，不用裸 `Date.now()`（同毫秒碰撞）。

**已知限制（C4）**：主进程侧频道已按 requestId 隔离，但渲染进程 UI 目前只有一个 `confirmDialog` 状态——若两个需确认的工具并发弹出，后到的请求会覆盖对话框，先到的那次主进程仍在等待。破坏性工具通常不标 concurrency-safe，实战里少见；若以后并行确认变常见，应学 Alice 的 `permission:request` / `askUser` **串行队列**（一次只展示一个，应答后再出下一个）。

---

## 七、四处同步原则

IPC 接口由**四处**共同定义，缺一不可：

```
1. src/shared/types.ts           ← 载荷数据类型（ChatMessage、AgentStreamEvent...）
2. electron/preload/index.ts     ← 渲染进程接入点（contextBridge 声明）
3. electron/main/ipc/*.ts        ← 主进程处理器（ipcMain.handle / on）
4. src/vite-env.d.ts             ← window.electronAPI 的 TypeScript 形状
```

早期口头说「三处同步」，漏了第 4 处：没有 `vite-env.d.ts` 时，渲染进程侧靠可选链蒙混过关，补了新 API 却忘了改类型时，`tsc` 拦不住错误调用。

任何一处漏掉或不一致，都会在运行时报"方法未定义"或类型错误：

- 漏了 `preload` → 渲染进程调用时报 `window.electronAPI.xxx is not a function`
- 漏了 `ipc handler` → 主进程不处理请求，`invoke` 永久 pending
- `types.ts` 载荷类型不对 → 编译通过，运行时数据格式错误（最难调试）
- 漏了 `vite-env.d.ts` → 渲染进程类型与真实 API 漂移，误用却可能仍能编译

**执行纪律**：每新增一个 IPC 接口，必须同时改四处，然后跑 `tsc --noEmit` 验证。频道名是字符串，TypeScript **校不住** preload 与 handler 是否拼写一致——这是最脆弱的一环，只能靠纪律和运行时暴露。

---

## 八、IPC 层测试

IPC 代码是最难测试的部分——主进程的 IPC handler 直接依赖 Electron 的 `ipcMain`，在 Vitest 环境里这个对象不存在。

当前已有 `ipc-handlers.test.ts` 和各模块 handler/纯逻辑测试；四处类型同步仍由 TypeScript + Build 兜底。尚未实现的是从单一 Schema 自动生成频道、preload 和 Window 类型。

---

## 实战记录

### 学 / 审做了什么（2026-07-26）

三路对照：

1. **feiche Electron 薄壳**：`contextIsolation` + `nodeIntegration: false`；通用 `invoke` + `client_` 前缀白名单——我们不跟通用 invoke，保留显式方法面。
2. **Alice preload/main**：显式 webPreferences；流事件在 listener 未就绪时缓冲；`stream-batch`；permission/askUser **串行队列**；固定 `permission:respond` + id，而非动态频道。
3. **我们**：显式 bridge 命名空间；chat 用 invoke+on 双通道；confirm 用动态频道；`vite-env.d.ts` 已有完整 Window 类型（code 章旧表述过时）。

本轮代码：显式 webPreferences（C1）；confirm 超时清理 + settled 标志（C2）；`randomUUID` requestId（C3）。C4 确认 UI 串行队列写入已知限制，不本轮实现。

### 踩过的坑

**preload 没注册就调用**

最经典的错误：在渲染进程里调用了 `window.electronAPI.xxx`，但 preload 里没有注册对应的方法，报 `window.electronAPI.xxx is not a function`。

根因：新加了 IPC handler，但忘了在 preload 加对应桥接。修复纪律：四处同步，改完立即 `tsc`。

**invoke 竞态：最后一个事件丢失**

AI 流式响应结束时，最后一个 `done` 事件和 `invoke resolve` 几乎同时到达渲染进程。偶发情况下 `invoke resolve` 先到，cleanup 函数已经移除了 `onEvent` 监听器，最后一个 `done` 事件到达时没有 handler 接收，`isStreaming` 状态卡在 `true`。

修复：在 `invoke` resolve 后的 `finally` 里加了兜底 `setIsStreaming(false)`，不依赖 `done` 事件。这是事件和 invoke 双通道设计的典型竞态，必须在调用侧兜底。

**重复 import 导致 build 失败**

`ipc/chat.ts` 里同一个函数被 import 了两次（在重构过程中留下的），TypeScript 编译通过，但 Vite build 时报重复导入错误。教训：`tsc --noEmit` 查不到 Vite 的打包期错误，改了 import 结构必须单独跑 `vite build` 验证。

**确认超时泄漏 once 监听器**

超时只 `resolve(false)`、不 `removeListener` 时，迟到的用户点击仍会打到残留的 once（虽已 settled 无害，但监听器堆着）。finish 路径必须同时清 timer 和 listener。

### 暂缓项

| 项 | 说明 |
|----|------|
| C4 确认 UI 串行队列 | 主进程频道已隔离；UI 单 dialog 覆盖为已知限制；并行确认变常见再做 |
| S1 流事件预缓冲 | 我们先 `onEvent` 再 `send`，当前够用 |
| S2 stream-batch | 无性能痛点 |
| S3 task/scheduler 广播窗口选择 | 单窗口可接受；多窗口再改为定向 sender |
| S4 频道名生成 | 单测已落地；裸字符串频道自动生成仍暂缓 |
| S5 feiche 通用 invoke 白名单 | 显式方法更安全，不采用 |

### 设计检查清单

- [ ] 新增 IPC 接口时：四处同步（types.ts / preload / ipc handler / vite-env.d.ts），`tsc --noEmit` 验证
- [ ] 新建 BrowserWindow 时：显式 `contextIsolation: true` + `nodeIntegration: false`
- [ ] on 订阅时：必须返回清理函数，调用方在组件销毁时调用
- [ ] invoke 配合 on 使用时：在 invoke 的 finally 里加状态兜底，处理竞态
- [ ] 需要"等待用户回应"时：用动态频道名（`channel:${requestId}`）+ UUID；超时路径必须卸掉 listener
- [ ] 确认类 UI：若可能并发，是否已串行？否则标为已知限制

## 2026-08 安全校准

IPC 的“类型同步”不等于“权限授权”：敏感字段必须在主进程建立安全视图；Renderer 传来的确认字段只能表达请求，破坏性设置、MCP 连接和 Debug 高风险操作仍由主进程重新确认。
