# 测试策略

> 测试相关的策略、目录结构、运行方式。

## 测试框架

| 类型 | 框架 | 目录 |
|------|------|------|
| 单元测试 | vitest | `__tests__/unit/` |
| E2E 测试 | Playwright | `__tests__/e2e/` |

## 当前覆盖

### 单元测试（105 个 / 13 个文件）

| 文件 | 覆盖模块 | 测试数 |
|------|----------|--------|
| `tool-registry.test.ts` | ToolRegistry（注册/执行/并发/超时） | ~15 |
| `prompt-builder.test.ts` | PromptBuilder（4 层/人格/自定义） | ~10 |
| `context-manager.test.ts` | ContextManager（L1-L4 压缩） | ~8 |
| `agent-loop.test.ts` | AgentLoop（文本/工具/中断/重试/maxIterations） | ~10 |
| `memory-tools.test.ts` | remember/recall/forget/task_plan | ~13 |
| `middleware.test.ts` | 中间件管道（洋葱模型/短路/截断） | ~8 |
| `token-budget.test.ts` | Token 预算（会话/日级限额） | ~6 |
| `message-pipeline.test.ts` | 消息管道（孤儿修复/合并） | ~6 |
| `permission-engine.test.ts` | 权限引擎（自定义规则/沙箱集成） | ~6 |
| `provider-router.test.ts` | Provider 路由（检测/Anthropic/Gemini） | ~6 |
| `llm-failover.test.ts` | LLM Failover（降级/通知/全失败） | ~5 |
| `rag-chunker.test.ts` | RAG 分块（段落感知/重叠/边界） | ~6 |
| `scheduler.test.ts` | 定时任务调度（CRUD/interval/cron/rowToTask） | ~6 |

### E2E 测试（5 个 UI + 4 个 Electron）

- UI 测试：基本渲染 / 会话创建 / 发送消息 / 设置面板 / 设置开关
- Electron 测试：真实对话（需 `TEST_LLM_API_KEY` 环境变量）

## 运行命令

```bash
# 单元测试
npm test

# 单个文件
npx vitest run __tests__/unit/middleware.test.ts

# 监听模式
npx vitest --watch

# E2E 测试（需要先启 dev server 或交给 playwright.config webServer）
npx playwright test
```

## 测试规范

### 必须测试的场景

- 新功能的 happy path
- Bug 修复的复现测试（先写失败测试，再修复）
- 边界条件（空值、超长输入、并发）

### Mock 规则

- ✅ Mock 外部 API 调用（LLM / 网络请求）
- ✅ Mock 文件系统（测试环境隔离）
- ❌ 禁止 Mock 核心业务逻辑
- ❌ 禁止 Mock 真实 AI 调用来假装功能正常

### 命名约定

```typescript
describe('ModuleName', () => {
  it('should do X when Y', () => { ... })
})
```

## 环境变量

| 变量 | 用途 |
|------|------|
| `TEST_LLM_API_KEY` | E2E 真实对话测试的 API Key |
| `TEST_LLM_BASE_URL` | 可选，覆盖默认 API 地址 |
