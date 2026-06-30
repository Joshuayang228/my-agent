# Debug Guide

## 调试原则

1. 先定位，再修复，禁止猜测式修改。
2. 先复现，再分析，能稳定复现才算理解问题。
3. 先测试，再收尾，修完后补复现测试，避免回归。

## 调试步骤

1. 复现问题，找到最短复现路径。
2. 加 log 定位，在关键节点记录输入、输出、耗时。
3. 读相关代码，理解完整业务链路，不只看报错行。
4. 定位根因，区分症状和病因。
5. 写复现测试，优先先写一个会失败的测试。
6. 最小修复，只修根因，不做附带重构。
7. 验证，测试通过、手动验证、无新增 linter 报错。

## Log 格式

前端：

```ts
console.log('[模块名] 操作描述', {
  params,
  response,
  stack: error?.stack,
});
```

主进程：

```ts
logger.info('[来源模块] 操作描述', {
  input: {},
  output: {},
  duration: Date.now() - startTime,
  caller: 'main' | 'compact' | 'memory' | 'permission',
});
```

## 常见陷阱

- 异步竞态：多个 await 之间状态可能变化，检查是否需要加锁。
- 工具调用配对丢失：中断或取消后检查 tool_call 和 tool_result 是否配对。
- 上下文溢出：长对话后行为异常，先检查 token 用量是否接近上限。
- IPC 事件丢失：高频事件是否被批量合并策略吞掉。

## 测试要求

- 测试框架：vitest 或 jest。
- 测试目录：`__tests__/` 或同级 `*.test.ts`。
- 命名：`{模块名}.test.ts`。
- 修 bug 时优先写复现测试。
- 新功能至少覆盖 happy path。
