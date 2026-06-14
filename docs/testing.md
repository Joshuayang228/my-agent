# 测试策略

> 测试相关的策略、代码归类方式、覆盖范围。

## 测试框架

- **单元测试 / 集成测试**：vitest 或 jest（待项目初始化时确定）
- **E2E 测试**：待定（Playwright / Spectron 等）

## 测试目录结构

```
方式一：集中式
__tests__/
  agent/
    agent-loop.test.ts
  tools/
    file-tool.test.ts
  memory/
    memory-store.test.ts

方式二：就近放置
src/main/agent/
  agent-loop.ts
  agent-loop.test.ts
```

> 两种方式均可，项目初始化时统一选定一种。

## 测试分层

| 层级 | 范围 | 策略 |
|------|------|------|
| 单元测试 | 单个函数/模块 | 必须覆盖核心逻辑、边界条件 |
| 集成测试 | 模块间交互 | 覆盖工具调用链、IPC 通信 |
| E2E 测试 | 用户操作流程 | 覆盖关键用户路径（待定） |

## 测试规范

### 必须测试的场景

- 新功能的 happy path
- Bug 修复的复现测试（先写失败测试，再修复）
- 边界条件（空值、超长输入、并发）
- 错误处理路径（异常、超时、网络失败）

### 测试命名

```typescript
describe('模块名', () => {
  it('应该做什么 - 在什么条件下', () => {
    // ...
  });
});
```

### Mock 规则

- ✅ 可以 Mock 外部 API 调用（LLM、网络请求）
- ✅ 可以 Mock 文件系统（测试环境隔离）
- ❌ 禁止 Mock 核心业务逻辑（用真实逻辑测试）
- ❌ 禁止 Mock 真实 AI 调用来假装功能正常（测试环境除外）

## 覆盖范围目标

<!-- TODO: 等项目稳定后设定具体覆盖率目标 -->

- 核心模块（Agent Loop / 工具系统 / 记忆系统）：目标高覆盖
- UI 组件：关键交互覆盖
- 工具函数：完整覆盖

## 运行方式

```bash
# 运行全部测试
npm test

# 运行单个文件
npm test -- agent-loop.test.ts

# 监听模式
npm run test:watch
```
