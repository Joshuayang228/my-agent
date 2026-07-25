# M17 测试架构

> **所属**：Part IV 可观测与质量
> **核心问题**：如何让 LLM 依赖的 Agent 代码可测？单元测试、集成测试、Eval 如何分层？
> **状态**：📋 待写

---

## 待覆盖内容

- 三层测试分离：单元测试（vitest）/ Eval（vitest.eval.config）/ 人工验收
- DI 注入点设计：\_streamChatOverride 的设计哲学（测试代码不用 vi.mock）
- 主进程代码的 mock 策略（Electron API、SQLite、logger）
- 非确定性测试的处理：fake timers、确定性 mock 序列
- 测试边界的划分：什么属于单元测试，什么属于 Eval
- 测试速度分层：<2s / <30s / 手动

## 参考源

- 我们的 __tests__/ 和 evals/ 目录
- M18 Eval 体系（关注行为层测试）
- Alice ch15 范式中的测试相关讨论
