# TypeScript Guidelines

## 技术栈

- 外壳：Electron，主进程 Node.js，渲染进程 Chromium。
- 语言：TypeScript 全栈，主进程与渲染进程共享类型定义。
- 存储：SQLite、向量数据库、本地文件系统。
- Agent 事件流：AsyncGenerator 模式。

## 编码原则

- KISS：优先最简方案，避免过度抽象。
- DRY：重复逻辑提取为共享函数。
- YAGNI：不提前建不需要的抽象。
- 不可变优先：修改数据时创建新对象，不原地修改。
- 文件大小上限约 800 行，超过则拆分。
- 函数大小上限约 50 行，超过则拆分。

## 注释规范

**核心原则**：AI 通过搜索代码片段来理解和编写代码，注释是片段的上下文载体。好的注释让代码片段”自带说明书”，即使脱离项目也能被正确理解和复用。

### 函数注释必写内容

每个非平凡函数（>5 行）必须包含：

1. **背景**（Why exists）— 为什么需要这个函数？解决什么问题？
2. **意图**（What does）— 做什么事情？核心逻辑是什么？
3. **约束**（Constraints）— 前置条件、副作用、性能特征、线程安全性
4. **应用场景**（Where used）— 谁在调用？典型用例是什么？
5. **边界情况**（Edge cases）— 如何处理空值、错误、极端输入？

示例：
```typescript
/**
 * 执行一组工具调用，保持 LLM 返回的原始顺序。
 * 
 * 背景：LLM 返回的工具调用顺序有语义（如”先读文件 A，再根据内容写文件 B”），
 *       全部并行会破坏依赖关系，全部串行会牺牲性能。
 * 
 * 策略：连续的 concurrencySafe 工具合并为批次并行执行，遇到非安全工具则先
 *       flush 当前批次，再串行执行该工具。
 * 
 * 调用方：AgentLoop 每轮工具执行阶段
 * 
 * 约束：
 * - toolContext.signal 触发时，所有进行中的工具会收到取消信号
 * - 单个工具超时 30s 会返回错误，不阻塞后续工具
 * 
 * 边界情况：
 * - calls 为空 → 返回空数组
 * - 工具不存在 → 返回 isError: true 的结果
 * - JSON 解析失败 → 返回错误结果，继续执行后续工具
 */
async executeAll(calls: ToolCall[], ctx?: ToolContext): Promise<ToolResult[]> {
  // ...
}
```

### 禁止的注释类型

- ❌ 功能描述式注释：”获取用户列表”（函数名已经说明了）
- ❌ 显而易见的注释：”i 加 1”（代码本身就是最好的注释）
- ❌ 过时的注释（修改函数时必须同步更新注释）

### 内联注释规范

复杂逻辑块、非显而易见的技巧、绕过的陷阱，必须加内联注释说明原因：

```typescript
// ✅ 好的内联注释
// 必须先 flush 批次再执行非安全工具，否则会破坏 LLM 指定的顺序语义
if (!isSafe) {
  await flushBatch()
  results.push(await this.executeSingle(call, ctx))
}

// ❌ 差的内联注释
// 如果不安全就单独执行
if (!isSafe) { ... }
```

## 错误处理

- 所有 catch 块必须有实际处理逻辑：日志、上报、降级或重新抛出。
- 对外接口返回用户友好的错误信息。
- 禁止空 catch 块。
- 禁止静默吞错。

## 测试

- 新功能尽量附带测试。
- 测试框架：vitest 或 jest。
- 测试目录：`__tests__/` 或同级 `*.test.ts`。
- 测试文件命名：`{模块名}.test.ts`。
- **写测试前先查重** — 用 Glob 搜索 `__tests__/**/*.test.ts`，避免重复造轮子或命名冲突。

### E2E 测试规范

E2E 测试必须覆盖**真实的对话流程**，而不只是测试元素存在：

- 用真实 LLM 调用（从 `TEST_LLM_API_KEY` 环境变量读取 API Key）
- 测试完整的用户交互路径：发消息 → AI 响应 → 工具调用 → 结果展示
- Playwright 配置必须包含 `webServer`，超时设为 30s
- **禁止只测元素存在** — 测 `expect(button).toBeVisible()` 不够，要测点击后的行为变化

示例（E2E 测试结构）：
```typescript
test('AI 能调用工具并展示结果', async ({ page }) => {
  await page.goto('/')
  await page.fill('[data-testid="chat-input"]', '读取 package.json 的 name 字段')
  await page.click('[data-testid="send-button"]')
  
  // 等待 AI 响应 + 工具调用完成
  await page.waitForSelector('[data-testid="tool-result"]', { timeout: 30000 })
  
  // 验证结果包含预期内容
  const result = await page.textContent('[data-testid="tool-result"]')
  expect(result).toContain('my-agent')
})
```

未配置 `TEST_LLM_API_KEY` 时，E2E 测试应跳过（不报错）。

## 代码搜索策略

**原则**：AI 通过搜索代码片段来理解项目，单次搜索可能遗漏关键信息。采用"冗余搜索"策略，从多个角度覆盖同一目标。

### 搜索模式

实现新功能或修改现有代码前，必须进行冗余搜索：

1. **按关键词搜**：核心概念的多种表达
   ```
   搜索目标：工具执行逻辑
   → 搜 "execute" / "executeTool" / "runTool" / "toolExecution"
   ```

2. **按文件名搜**：相关模块的文件
   ```
   目标：工具系统
   → Glob "**/*tool*.ts" / "**/*registry*.ts" / "**/*middleware*.ts"
   ```

3. **按类型搜**：关键数据结构的定义和使用
   ```
   目标：理解 ToolDefinition
   → Grep "interface ToolDefinition" / "type ToolDefinition" / ": ToolDefinition"
   ```

4. **按调用链搜**：谁调用了这个函数？
   ```
   目标：理解 executeAll 的调用时机
   → Grep "executeAll\(" / ".executeAll"
   ```

5. **按测试搜**：功能的测试用例（最好的使用示例）
   ```
   目标：理解工具注册流程
   → Glob "**/*tool*.test.ts" 然后读测试代码
   ```

### 搜索验证清单

每次搜索后自问：
- [ ] 我找到了定义吗？（类型、接口、类）
- [ ] 我找到了实现吗？（具体的执行代码）
- [ ] 我找到了调用方吗？（谁在用这个功能）
- [ ] 我找到了测试吗？（预期行为是什么）
- [ ] 我找到了相关文档吗？（设计决策和约束）

**如果任何一项为"否"，继续搜索，换关键词、换模式。**

## 架构约束

- 工具与服务分离：AI 可见的是工具，AI 不可见的是服务。
- 事件流边界：核心逻辑只输出纯数据事件 `AgentStreamEvent`，UI 层消费事件并渲染。
- 声明式工具接口：每个工具带元数据，例如 `isReadOnly`、`isDestructive`、`isConcurrencySafe`。
- 先读后写：修改文件前必须先读取最新版本。
