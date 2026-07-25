# M06 System Prompt 工程化

> **所属**：Part II 上下文与记忆
> **核心问题**：如何构建、分层、预算化系统提示词，使各组件协同而不互相干扰？
> **状态**：📋 待写

---

## 待覆盖内容

- System Prompt 的分层注入体系（人格定义 / 能力边界 / 上下文注入 / 动态追加）
- KV Cache 优化：稳定层与变化层的位置设计
- Context Budget 主动分配：各层的 token 预算配额与优先级
- 工具描述的工程化（input_examples、描述截断、maxResultSizeChars）
- System Prompt 与 Memory 召回的接缝设计

## 参考源

- Alice ch14：提示词工程
- CC sourcemap: buildSystemPrompt / context 组装
- Anthropic Context Engineering 文章
