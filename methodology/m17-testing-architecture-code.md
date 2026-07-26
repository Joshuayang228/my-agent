# M17 测试架构 — 代码走读

> 理念章：`m17-testing-architecture.md`  
> 对照源：feiche/wps-cowork aisdk-testing-design（边界 mock）× Alice Ch.15 范式二/十一 × 我们的 vitest / evals / Playwright  
> 沉淀时间：2026-07-26

---

## §二 对照：四层金字塔在仓库里的落点

### 我们的实现

```text
npm run test              → vitest.config.ts          → __tests__/unit/**/*.test.ts
npm run eval:run          → vitest.eval.config.ts     → evals/eval.test.ts
npm run test:e2e          → playwright.config.ts      → __tests__/e2e/chat.test.ts
npm run test:e2e:electron → 同上 project=electron     → __tests__/e2e/electron.test.ts
人工验收                  → 发版 / 产品体验（无自动化入口）
```

```typescript
// vitest.config.ts — Unit 门禁
export default defineConfig({
  test: {
    include: ['__tests__/unit/**/*.test.ts'],  // ↑ 绝不扫 evals/
    globals: true,
  },
})

// vitest.eval.config.ts — Eval 独立套件
export default defineConfig({
  test: {
    include: ['evals/eval.test.ts'],
    globals: true,
    testTimeout: 30000,   // ↑ 单场景上限；Unit 默认更短
    hookTimeout: 10000,
  },
})
```

### 字段/结构对比

| 层 | 配置文件 | 目录 | 门禁 |
|----|----------|------|------|
| Unit | `vitest.config.ts` | `__tests__/unit/` | commit 前 |
| Eval | `vitest.eval.config.ts` | `evals/` | 发版 / 改核心时 |
| E2E | `playwright.config.ts` | `__tests__/e2e/` | 可选 |
| 人工 | — | — | 发版 |

**发现**：隔离的关键不是「多写一个 npm script」，而是 **include 路径互斥**——同一 runner 扫两边会把 30s eval 超时和 unit 反馈搅在一起。这直接支撑理念章 §四。

**方法论对照**：→ `m17-testing-architecture.md` §二、§四；Eval 失败语义细节 → `m18-eval-code.md` §六

---

## §五 对照：`_streamChatOverride` DI

### 我们的实现

```typescript
// src/shared/types.ts — AgentLoopOptions 上的测试契约
export interface AgentLoopOptions {
  // ...生产字段...
  /**
   * 覆盖默认 streamChat，主要供 eval / 集成测试使用。
   * 前缀下划线：仅测试/eval，勿在生产业务逻辑里使用。
   */
  _streamChatOverride?: (options: any) => AsyncGenerator<any, any>
}

// electron/main/agent/loop.ts — 分支只有一行
const streamChat = options._streamChatOverride ?? defaultStreamChat
```

```typescript
// evals/runner.ts — Eval 装配顺序
const { _streamChatOverride: overrideFromOptions, ...restBaseOptions } = baseOptions
const streamChatOverride =
  overrideFromOptions
  ?? (scenario.mockResponses ? createMockStreamChat(scenario.mockResponses) : undefined)

const loopOptions = {
  ...restBaseOptions,
  _streamChatOverride: streamChatOverride,  // ↑ ① 场景自定义 ② 脚本序列 ③ undefined=真 LLM
}
for await (const ev of agentLoop(loopOptions, registry)) {
  transcript.push(ev)  // ↑ 事件流即证据（M02 / M18）
}
```

```typescript
// evals/mock-llm.ts — 脚本 LLM：按 MockTurn[] 消费
export function createMockStreamChat(turns: MockTurn[]) {
  let idx = 0
  return async function* mockStreamChat(_options: unknown) {
    const turn = turns[idx++] ?? { content: '[mock end]', toolCalls: [] }
    if (turn.content) yield { type: 'text', content: turn.content }
    // ...组装 StreamChatResult（含 toolCalls / usage）后 return
  }
}
```

### 存量 Unit 仍用 vi.mock（债）

```typescript
// __tests__/unit/agent-loop.test.ts — 现状（待迁 G1）
vi.mock('../../electron/main/llm/index', () => ({
  streamChat: vi.fn(),
  LLMError: class LLMError extends Error { /* ... */ },  // ↑ 必须手补，否则 export 漂移即炸
}))
```

### 对比表

| 方式 | 用于 | 优点 | 成本 |
|------|------|------|------|
| `_streamChatOverride` | Eval、新集成测 | 不改模块图；与生产同分支 | 要写工厂函数 |
| `vi.mock(llm)` | 存量 loop 单测 | 写起来快 | export 同步债；Eval 不能复用 |
| SSE replay（未做） | 将来 `llm/` 解析 | 真协议、少手写 chunk | 录制与维护 fixture |

**发现**：DI 是「范式十一」在我们仓库的具体落点——稳定的是 `streamChat` 形状，实现可换成脚本序列。`vi.mock` 适合 Electron/logger，不适合当作 LLM 边界的长期方案。

**方法论对照**：→ `m17-testing-architecture.md` §五；弯路 → M05（`LLMError` mock 缺口）

---

## §六 对照：基础设施 vi.mock

### 我们的实现

```typescript
// __tests__/unit/task-queue.test.ts — Electron 宿主替身
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send: vi.fn() } }],
  },
}))

vi.mock('../../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))
```

**发现**：这里 mock 的是**进程能力**，不是业务策略。队列逻辑仍跑真实 `TaskQueueManager` 代码——符合「边界 mock、内核真跑」。

**方法论对照**：→ `m17-testing-architecture.md` §六

---

## §七 对照：HTTP/SSE 边界（参考源，我们未实现）

### feiche / wps-cowork 设计（摘要）

```text
录制：scripts/record-sse.sh → testdata/*.sse（+ 可选 .meta 状态码）
回放：httptest.Server 吐出原始 SSE
断言：真实 adapter 产出的 part type 序列（非 mock 内部函数）
```

原则原句大意：**mock at the HTTP boundary, not at internal interfaces**。

### 我们的现状

| CC / feiche | 我们 | 说明 |
|-------------|------|------|
| SSE fixture + ReplayServer | — | G2 暂缓 |
| 脚本 turn 序列 | `createMockStreamChat` | 在 **Loop 边界** mock，不在 HTTP |
| — | `vi.mock(llm/index)` | 更内层，存量 Unit |

**发现**：我们今天的「稳定边界」选在 **agentLoop ↔ streamChat**，对行为 Eval 足够；对「OpenAI chunk 解析是否回归」不够——那一层才需要 aisdk 式 replay。分层不同，不是对错。

**方法论对照**：→ `m17-testing-architecture.md` §七

---

## §三 / §八 对照：Unit 断言路径 vs E2E 冒烟

### Unit 示例（权限责任链 — 路径）

```typescript
// __tests__/unit/permission-engine.test.ts（节选语义）
// ask 在审批库之后：先 recordApproval，再 check → 应放行而非再次 needs_approval
```

### E2E 现状（冒烟）

```typescript
// __tests__/e2e/chat.test.ts
test('应用标题和基础 UI 可见', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('My Agent')
  // ↑ 壳子可达；不是「AI 调了工具」
})
```

```typescript
// playwright.config.ts
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:5173',
  reuseExistingServer: true,
  timeout: 30000,
},
```

**发现**：E2E 文件证明「渲染进程能起来」，不能证明 Agent 行为。指南里的「真对话流」应落成**可选项目**（G3），避免规范与仓库互相打脸。

**方法论对照**：→ `m17-testing-architecture.md` §三、§八

---

## §九 对照：门禁在 package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "eval:run": "vitest run --config vitest.eval.config.ts",
    "test:e2e": "npx playwright test --project=ui",
    "test:e2e:electron": "npx playwright test --project=electron"
  }
}
```

**发现**：门禁文化写在脚本名里——`test` 短、无 config 后缀；`eval:run` 显式独立。不要把 `eval:run` 塞进 `test` 的 `&&` 链除非团队明确接受变慢。

**方法论对照**：→ `m17-testing-architecture.md` §四、§九
