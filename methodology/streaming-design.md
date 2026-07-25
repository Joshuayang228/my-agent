# M02 Streaming 设计范式

> **所属**：Part I 核心运行时
> **核心问题**：如何设计可靠的流式 AI 响应管道——背压、取消、流中错误恢复？
> **状态**：📋 待写

---

## 待覆盖内容

- AsyncGenerator 作为流式传输模型的选型理由
- AbortSignal 取消信号的传播路径
- 背压（backpressure）处理：生产者比消费者快时怎么办
- 流中途报错的恢复路径与降级策略
- 与 AgentStreamEvent 事件流架构的关系（对照 M01）

## 参考源

- CC sourcemap: agentLoop / streamChat 实现
- Alice ch15 范式二：事件流作为系统边界
