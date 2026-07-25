# M12 IPC 架构

> **所属**：Part III 安全与扩展
> **核心问题**：Electron 主进程与渲染进程的边界如何划分，IPC 通道如何设计？
> **状态**：📋 待写

---

## 待覆盖内容

- 什么逻辑放主进程、什么放渲染进程——判断标准
- Preload 桥接层的设计：contextBridge + 类型安全
- 三处同步原则（types.ts / preload / ipc handler）
- IPC 通信模式：request-reply（invoke）vs 单向推送（send）的选型
- 双向通信的状态同步模型（流式 AI 响应的 IPC 传输设计）
- 踩坑记录：重复 import、preload 未注册、竞态兜底

## 参考源

- 我们的 electron/preload/index.ts 和 electron/main/ipc/
- CC sourcemap: IPC 实现（CC 也是 Electron）
