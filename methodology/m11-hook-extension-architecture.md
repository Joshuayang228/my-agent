# M11 Hook / 扩展点架构

> **所属**：Part III 安全与扩展
> **核心问题**：如何让框架可扩展，在不改核心代码的前提下注入横切行为？
> **状态**：📋 待写

---

## 待覆盖内容

- Hook 系统的设计哲学：什么应该做成 hook，什么应该直接改框架
- 生命周期钩子的执行时机（beforeToolCall / afterToolCall / onMessage / onSessionEnd）
- Hook 的错误隔离：单个 hook 失败不应崩溃主流程
- 副作用边界：hook 能做什么、不能做什么
- 与 M01 AgentLoop 事件流的关系（钩子 vs 事件消费者的区别）

## 参考源

- CC sourcemap: hooks 实现
- Alice ch15 范式一：声明式契约
