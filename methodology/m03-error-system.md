# M03 错误体系设计

> **所属**：Part I 核心运行时
> **核心问题**：如何分层分类 Agent 系统的错误，何时重试，如何向用户传播？
> **状态**：📋 待写

---

## 待覆盖内容

- AgentErrorCode 错误分类体系（可重试 vs 永久失败 vs 用户可见 vs 内部诊断）
- 错误在 loop → llm → tools 各层之间的传播与转换规则
- retryable 标志的判定标准
- Deny-and-Continue 熔断机制与错误体系的关系（对照 M10 权限）
- 用户可见错误信息的设计原则（不暴露堆栈/路径/SQL）

## 参考源

- 我们的 AgentErrorCode 实现
- CC sourcemap: 错误处理路径
- feiche: retrier.go
