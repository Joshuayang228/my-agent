# M15 状态机设计

> **所属**：Part IV 可观测与质量
> **核心问题**：何时应该用显式状态机，如何让状态机可观测、可持久化、可恢复？
> **状态**：📋 待写

---

## 待覆盖内容

- Agent 系统里的隐式状态机：任务五态、权限模式、Loop 终止原因
- 显式 FSM vs 隐式状态管理的选型标准
- 状态机的可观测性：每次转移都应有 reason 字段
- 跨重启的状态一致性：哪些状态必须落 SQLite、哪些可以内存
- 状态机与 M09 后台任务（任务五态）的对照走读

## 参考源

- 我们的 TaskStatus / TerminalReason / ExecutionMode 实现
- CC sourcemap: session state 管理
