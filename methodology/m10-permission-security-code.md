# M10 权限与安全 — 代码走读

> 本文档对照 [`m06-permission-security.md`](m06-permission-security.md) 的认知框架，展示真实代码实现。
> 代码来源：my-agent `electron/main/sandbox/` × Claude Code `utils/permissions/` × Alice 混淆源码
> 所有代码块逐行注释，阐释设计意图与方法论对照。

---

## 推论组 A：怎么按场景配置信任等级

### §二 模式分级 — 三级沙箱 + executionMode（有效沙箱映射）

我们的实现是三级沙箱模式；`executionMode` 提供 `auto` / `confirm-all` / `plan-first` / `full-access`，其中前 3 个映射到 `workspace-write`，`full-access` 映射到 `full-access`。它们不是“任意 3×3 组合”，而是由有效沙箱工厂统一推导。

```typescript
// electron/main/sandbox/policy.ts

// 沙箱模式：控制「允许写哪里」
export type SandboxMode =
  | 'read-only'        // 只读，所有写操作被拦截
  | 'workspace-write'  // 允许写项目目录内，外部目录拒绝
  | 'full-access'      // 写操作不限制（但危险命令仍受 bypass-immune 拦截，→ m06 §四）

// 执行模式：控制「是否需要确认」
export type ExecutionMode =
  | 'auto'          // 默认确认策略；硬边界仍先执行
  | 'confirm-all'   // 全部确认，所有工具调用都弹窗
  | 'plan-first'    // 先规划，第一轮只让 AI 输出计划不执行工具
  | 'full-access'   // 明确选择完全访问；仍受危险命令 bypass-immune 约束

export interface SandboxPolicy {
  mode: SandboxMode
  workspaceRoot?: string          // workspace-write 模式的允许目录
  protectedPaths: string[]        // 始终受保护的路径（.git / .env / node_modules）
}

// 策略构建器：根据模式 + 项目根目录生成策略对象
export function buildPolicy(mode: SandboxMode, workspaceRoot?: string): SandboxPolicy {
  return {
    mode,
    workspaceRoot,
    protectedPaths: ALWAYS_PROTECTED,  // ['.git', '.env', '.env.local', '.env.production', 'node_modules']
  }
}
```

**方法论对照 → m06 §二**：Alice 的模式服务于 CLI 确认体验；我们把产品入口收敛为 `executionMode`，再由 `resolveEffectiveSandbox` 统一推导工具实际使用的沙箱，避免设置页旧键与运行时分叉。

---

### §三 责任链 — 硬边界先于业务责任链

当前 `electron/main/sandbox/permission-engine.ts` 不是“任意用户规则优先”。命令先经过
`guardCommand` 的不可绕过边界，再进入用户规则、审批记录和 ask 规则：

```typescript
const policy = buildPolicy(sandboxMode, workspaceRoot)
const guard = guardCommand(command, cwd, policy)
if (guard.allowed === false) return guardToResult(guard)

const hardCustom = matchCustomRules(command, 'command', { includeAsk: false })
if (hardCustom) return hardCustom

const approved = checkApproval(command)
if (approved !== null) return approvalResult(approved)

const askCustom = matchCustomRules(command, 'command', { includeAsk: true, askOnly: true })
if (askCustom) return askCustom

return guardToResult(guard)
```

第 0 层包括：危险命令、工作区外 cwd、Shell 控制符、受保护路径和显式工作区外路径。
自定义 `allow`、session / persistent 审批都不能覆盖这些边界；它们只覆盖通过硬边界
后的普通未知命令。

**方法论对照 → m06 §三**：仍保留“用户显式规则优先于系统推断”的原则，但把致命安全边界
从业务责任链中提前，避免配置错误把 `bypass-immune` 变成可绕过。

---

## 推论组 B：哪些安全边界绝不能绕过

### §四 bypass-immune — 危险命令与路径边界均先判定

`command-guard.ts` 当前先做四类不可绕过检查：

1. `assessCommand()` 判定的危险命令，即使 `full-access` 也阻断；
2. 非 `full-access` 的 cwd 必须位于当前工作区；
3. 非 `full-access` 禁止 `;`、`&&`、管道、重定向和反引号等 Shell 控制符；
4. 非 `full-access` 禁止受保护路径和显式工作区外路径。

这次安全审计补上了一个之前容易遗漏的责任链问题：危险命令检查不能只放在
`guardCommand` 内，还必须在自定义 `allow` 和历史审批之前调用。否则一条 `allow: rm -rf`
规则就会抢先返回，破坏 `bypass-immune` 的设计意图。

**方法论对照 → m06 §四**：`full-access` 代表用户承担普通命令风险，不代表允许系统级
不可恢复操作；非完全访问模式则把 cwd、Shell 复合语法和越界路径也纳入硬边界。

---

### §五 危险命令分级 — 不再按首词放行可执行入口

当前 `exec-policy.ts` 的重要取舍：`node`、`python`、`npm`、`npx`、`git` 不再因为首个词
出现在集合中就自动标记为 `safe`。只有严格的版本查询、包信息查询和 Git 只读子命令
等模式可以进入 safe；其余命令走 unknown + 审批。

原因是下面这些命令名本身不是安全证明：

```text
node -e "..."
npm test                 # 可执行 package.json 生命周期
npx <任意包>
git -c ... / git hook  # 参数可改变行为
```

Code Search 和权限规则还额外限制正则长度，并拒绝常见嵌套量词 / 反向引用，避免用户或
模型生成的正则在主进程同步匹配时造成灾难性回溯。

**方法论对照 → m06 §五**：安全等级不是命令名字的静态标签，而是“命令 + 参数 + cwd +
Shell 语法”的组合判断；无法证明安全时应转为审批，而不是猜测放行。

---

### §六 路径边界 — ALWAYS_PROTECTED 数组

除了逻辑路径包含关系，写入类工具还必须解析目标及最近存在的父目录 realpath。这样工作区内的 symlink 不能把 `file_write` / `file_edit` / `apply_patch` / `file_delete` 转发到工作区外；子 Agent 以 `ToolContext.workdir` 作为当前工作区，不回退到全局路径。


```typescript
// electron/main/sandbox/policy.ts

// 非 full-access 下受保护的路径段；full-access 由用户显式承担风险
const ALWAYS_PROTECTED = [
  '.git',             // 破坏后整个仓库损坏
  '.env',             // 泄漏后密钥暴露
  '.env.local',       // 本地环境变量
  '.env.production',  // 生产环境变量
  'node_modules',     // 手动修改后难以恢复
]

// electron/main/sandbox/command-guard.ts

function hasProtectedPathAccess(command: string, protectedPaths: string[]): boolean {
  for (const path of protectedPaths) {
    // 检查命令是否尝试写入受保护路径
    if (command.includes(path) && (command.includes('rm') || command.includes('>') || command.includes('write'))) {
      return true
    }
  }
  return false
}
```

**方法论对照 → m06 §六**：受保护路径的判断标准是「这个目录的内容由外部工具管理（git / npm / 环境变量），AI 手动修改会制造不一致」。

---

## 推论组 C：怎么让 AI 不反复碰壁

### §七 拒绝追踪 — deniedTools + deniedCommands（G2）

```typescript
// electron/main/agent/loop.ts

interface LoopState {
  messages: ChatMessage[]
  turnCount: number
  // ... 其他状态字段
  deniedTools: Array<{ name: string; reason: string }>      // 工具级拒绝（M1 已有）
  deniedCommands: Array<{ command: string; reason: string }> // 命令级拒绝（G2 新增）
}

// ① 提取函数：从 shell_exec 的 tool_result 里识别被沙箱拦截的命令
const SANDBOX_BLOCK_MARKER = '[SANDBOX BLOCKED]'

function extractBlockedCommand(
  call: ToolCall,                                    // 工具调用对象
  result: ToolResult,                                // 工具结果
  parsedArgs: Map<string, Record<string, unknown>>,  // 解析后的参数 Map
): { command: string; reason: string } | null {
  // ⓐ 只处理错误结果 + 包含沙箱标记
  if (!result.isError || !result.content.includes(SANDBOX_BLOCK_MARKER)) return null

  // ⓑ 从 parsedArgs 提取原始命令（不是从错误信息，因为错误信息只有 reason）
  const command = (parsedArgs.get(call.id)?.command as string) || call.name

  // ⓒ 提取标记之后的原因文字（首行），去掉后续说明段落
  const reason = result.content
    .slice(result.content.indexOf(SANDBOX_BLOCK_MARKER) + SANDBOX_BLOCK_MARKER.length)
    .split('\n')[0]
    .trim() || 'blocked by sandbox'

  return { command: command.slice(0, 120), reason }  // 命令截断到 120 字符（防止超长）
}

// ② 注入函数：把 deniedTools + deniedCommands 拼成 System Prompt 后缀
function buildDeniedToolsPromptSuffix(
  deniedTools: Array<{ name: string; reason: string }>,
  deniedCommands: Array<{ command: string; reason: string }> = [],
): string {
  if (deniedTools.length === 0 && deniedCommands.length === 0) return ''

  const parts: string[] = []

  // ⓐ 工具级拒绝（如 shell_exec 整个工具被权限规则 deny）
  if (deniedTools.length > 0) {
    const lines = deniedTools.map(d => `- ${d.name}: ${d.reason}`)
    parts.push(`[System] The following tools were denied during this session. Do not attempt to call them again:\n${lines.join('\n')}`)
  }

  // ⓑ 命令级拒绝（如某条具体命令被沙箱拦截）
  if (deniedCommands.length > 0) {
    const lines = deniedCommands.map(d => `- ${d.command}: ${d.reason}`)
    parts.push(`[System] The following commands were blocked by the sandbox this session. Do not run them again; try a different approach:\n${lines.join('\n')}`)
  }

  return `\n\n${parts.join('\n\n')}`  // 追加到 System Prompt 末尾（对 KV Cache 友好）
}

// ③ 检测点：Observe 阶段，工具结果写回上下文时检测 SANDBOX BLOCKED
async function* agentLoop(options, registry): AsyncGenerator<AgentStreamEvent> {
  const state: LoopState = {
    messages: [...],
    deniedTools: [],
    deniedCommands: [],  // 初始化为空数组
    // ...
  }

  while (state.turnCount < maxIterations) {
    // ... Think → Act ...

    // ── Observe: 工具结果写回上下文 ──
    for (const result of results) {
      state.messages.push({
        id: `tool-${result.callId}`,
        role: 'tool',
        content: result.content,
        timestamp: Date.now(),
        toolCallId: result.callId,
      })

      // G2: 追踪被沙箱拦截的命令，避免 LLM 反复重试同一条被拦命令
      const call = pendingCalls.find(c => c.id === result.callId)
      if (call) {
        const blocked = extractBlockedCommand(call, result, parsedArgs)
        if (blocked && !state.deniedCommands.some(d => d.command === blocked.command)) {
          state.deniedCommands.push(blocked)
          log.info('Blocked command tracked for denial injection', { command: blocked.command, reason: blocked.reason })
        }
      }
    }

    // ── 下一轮开始前：注入拒绝摘要到 System Prompt ──
    const deniedSuffix = buildDeniedToolsPromptSuffix(state.deniedTools, state.deniedCommands)
    if (deniedSuffix && state.messages[0]?.role === 'system') {
      const basePrompt = systemPrompt
      state.messages[0] = {
        ...state.messages[0],
        content: basePrompt + deniedSuffix,  // System 消息末尾追加（不改开头，保护 KV Cache）
      }
    }

    state.turnCount++
  }
}
```

**方法论对照 → m06 §七**：M1 已有 deniedTools（工具级拒绝），G2 补全 deniedCommands（命令级拒绝）。检测时机在 Observe 阶段（工具结果写回上下文时），注入时机在下一轮迭代开始前（System Prompt 动态拼接）。

---

### §八 决策可审计 — DecisionType 枚举（G4）

```typescript
// electron/main/sandbox/permission-engine.ts

// 决策来源类型，便于审计和 DevPanel 展示
export type DecisionType =
  | 'custom-rule'      // 用户自定义规则命中
  | 'approval-store'   // 历史审批记录
  | 'dangerous'        // 危险命令检测（bypass-immune）
  | 'sandbox-policy'   // 沙箱策略
  | 'default-allow'    // 默认允许（无规则命中）

export interface PermissionCheckResult {
  allowed: boolean | 'needs_approval'
  reason: string                    // plain string reason（向后兼容，前端展示用）
  decisionType: DecisionType        // G4 新增：结构化决策类型（审计/DevPanel 用）
  matchedRule?: string              // 命中的规则 ID（custom-rule 时有值）
  chain: string                     // 责任链名称（legacy 字段）
}

// 5 处返回点示例：

// ① custom-rule
if (customResult) {
  return {
    allowed,
    reason: rule.description || `匹配规则: ${rule.pattern}`,
    decisionType: 'custom-rule',  // 结构化类型
    matchedRule: rule.id,
    chain: 'custom-rule',
  }
}

// ② approval-store
if (approved !== null) {
  return {
    allowed: approved,
    reason: approved ? '历史审批：已允许' : '历史审批：已拒绝',
    decisionType: 'approval-store',
    chain: 'approval-store',
  }
}

// ③ dangerous (bypass-immune)
if (guard.allowed === false) {
  const decisionType: DecisionType = guard.reason.startsWith('危险命令被拦截')
    ? 'dangerous'         // bypass-immune 拦截
    : 'sandbox-policy'    // 普通沙箱策略拒绝
  return { allowed: false, reason: guard.reason, decisionType, chain: 'sandbox-policy' }
}

// ④ sandbox-policy
return { allowed: true, reason: '沙箱策略允许', decisionType: 'sandbox-policy', chain: 'sandbox-policy' }

// ⑤ default-allow
return { allowed: true, reason: '默认允许', decisionType: 'default-allow', chain: 'fallback' }
```

**方法论对照 → m06 §八**：结构化 DecisionType 利于后续 DevPanel 展示权限决策链，也利于审计日志。plain string reason 无法区分"被哪条规则拦截"。

---

### §九 持久审批 — 内存缓存 + 异步落盘（G3）

```typescript
// electron/main/sandbox/approval-store.ts

import { getDatabase, persist } from '../storage/database'

// ① 两个内存 Map：session（会话级）+ persistent（跨会话）
const sessionApprovals = new Map<string, ApprovalRecord>()
const persistentApprovals = new Map<string, ApprovalRecord>()  // 镜像 SQLite

interface ApprovalRecord {
  commandPattern: string
  scope: ApprovalScope  // 'once' | 'session' | 'persistent'
  approved: boolean
  createdAt: number
}

// ② 启动时从 SQLite 预加载持久审批到内存缓存
// 应在 app ready 后调用一次（IPC 初始化时）
export async function loadPersistentApprovals(): Promise<void> {
  try {
    const db = await getDatabase()
    const stmt = db.prepare('SELECT command_pattern, approved, created_at FROM persistent_approvals')
    let count = 0
    while (stmt.step()) {
      const row = stmt.getAsObject() as { command_pattern: string; approved: number; created_at: number }
      persistentApprovals.set(row.command_pattern, {
        commandPattern: row.command_pattern,
        scope: 'persistent',
        approved: row.approved === 1,  // SQLite INTEGER → boolean
        createdAt: row.created_at,
      })
      count++
    }
    stmt.free()
    log.info('Persistent approvals loaded', { count })
  } catch (err) {
    log.warn('Failed to load persistent approvals', { error: String(err) })
  }
}

// ③ 异步落盘：写入 SQLite（内存缓存已在 recordApproval 里同步更新）
async function persistApprovalToDisk(record: ApprovalRecord): Promise<void> {
  try {
    const db = await getDatabase()
    db.run(
      `INSERT INTO persistent_approvals (command_pattern, approved, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(command_pattern) DO UPDATE SET approved = excluded.approved, created_at = excluded.created_at`,
      [record.commandPattern, record.approved ? 1 : 0, record.createdAt],
    )
    persist()  // 触发 SQLite WASM 导出到磁盘
  } catch (err) {
    log.warn('Failed to persist approval to disk', { command: record.commandPattern, error: String(err) })
  }
}

// ④ 同步读取：checkApproval() 保持同步 API（权限链依赖）
export function checkApproval(command: string): boolean | null {
  const key = normalizeCommand(command)  // 规范化（取前 3 个 token）

  // 先查 persistent（优先级高，跨会话）
  const persistent = persistentApprovals.get(key)
  if (persistent) return persistent.approved

  // 再查 session（只在本会话有效）
  const session = sessionApprovals.get(key)
  if (session) return session.approved

  return null  // 未找到审批记录
}

// ⑤ 写入：recordApproval() 同步更新内存 + 异步落盘
export function recordApproval(
  command: string,
  approved: boolean,
  scope: ApprovalScope = 'once',
): void {
  if (scope === 'once') return  // 一次性审批不记录

  const key = normalizeCommand(command)
  const record: ApprovalRecord = {
    commandPattern: key,
    scope,
    approved,
    createdAt: Date.now(),
  }

  if (scope === 'session') {
    sessionApprovals.set(key, record)
    log.info('Session approval recorded', { command: key, approved })
  } else if (scope === 'persistent') {
    // 内存缓存同步更新（保证 checkApproval 立即可见），SQLite 异步落盘
    persistentApprovals.set(key, record)
    log.info('Persistent approval recorded', { command: key, approved })
    void persistApprovalToDisk(record)  // void promise，不 await（异步 fire-and-forget）
  }
}

// ⑥ SQLite 表定义（database.ts）
db.run(`
  CREATE TABLE IF NOT EXISTS persistent_approvals (
    command_pattern TEXT PRIMARY KEY,  -- 规范化命令（前 3 个 token）
    approved        INTEGER NOT NULL,  -- 1=允许 / 0=拒绝
    created_at      INTEGER NOT NULL   -- 审批时间戳
  )
`)

// ⑦ 启动入口（electron/main/index.ts）
app.whenReady().then(async () => {
  await createWindow()
  // ... 其他初始化 ...

  // 加载持久审批记录（sandbox approval-store）
  const { loadPersistentApprovals } = await import('./sandbox/approval-store')
  loadPersistentApprovals().catch(err => log.warn('Persistent approvals load failed', { error: String(err) }))
})
```

**方法论对照 → m06 §九**：持久审批的同步/异步边界是关键设计点。权限检查必须同步返回（允许/拒绝），但 SQLite 读写是异步的。用「内存缓存 + 预加载 + 异步落盘」解决：启动时全量加载到内存 Map，`checkApproval()` 同步读内存，`recordApproval()` 同步更新内存 + void 异步落盘（不 await）。

**对比 settings-store**：同样的模式——`getSetting()` 同步读（从内存），`setSetting()` 同步写（更新内存 + 异步 persist）。

---

## 关键设计总结

### 1. bypass-immune 的实现时机

G1 的修复只有 1 行前移，但效果是"full-access 也拦危险命令"：

```typescript
// ❌ 修复前（危险命令可绕过）
if (policy.mode === 'full-access') return { allowed: true }  // 先放行
if (assessment.risk === 'dangerous') return { allowed: false }  // 后检查（但上面已返回）

// ✅ 修复后（bypass-immune）
if (assessment.risk === 'dangerous') return { allowed: false }  // 先拦截
if (policy.mode === 'full-access') return { allowed: true }   // 后放行（危险命令已在上面拦截）
```

### 2. deniedCommands 的提取边界

错误信息和原始输入是两个维度，提取时要分别处理：

- **原始命令**：从 `parsedArgs.get(call.id)?.command` 提取（工具调用参数）
- **拒绝原因**：从 `result.content` 提取（错误信息，`[SANDBOX BLOCKED]` 后的文字）

### 3. persistent 审批的同步保证

内存缓存是「最终一致性」的关键：
- **写时**：同步更新内存 + 异步落盘（void promise）
- **读时**：只读内存（同步），不查 SQLite
- **启动时**：预加载 SQLite 全量到内存

这样 `checkApproval()` 保持同步 API，同时持久化不丢失（app 退出时 `closeDatabase()` → `persist()` 保证落盘）。

### 4. DecisionType 的审计价值

结构化 `decisionType` 字段利于后续 DevPanel 展示权限决策链：

```
UI 展示：
  ✅ 允许执行 `npm install`
  └─ custom-rule: user-rule-001 (允许所有 npm 命令)

  ❌ 拒绝执行 `rm -rf /`
  └─ dangerous: bypass-immune (危险命令被拦截)

  ⏸️ 需要审批 `git push origin main`
  └─ sandbox-policy: workspace-write 模式禁止外部网络操作
```

---

**全文完** — 对照 [`m06-permission-security.md`](m06-permission-security.md) 认知框架阅读。

## 2026-08 安全审计补充

- ToolRegistry 的动态 metadata 统一用于权限、Debug 预检、并发调度、Headless 和实际执行；解析失败按可写、破坏性、不可并发处理。
- `settings:set` 不能仅凭 Renderer 传入 `full-access` 绕过确认；主进程弹原生确认。
- MCP 配置保存/启用同样由主进程确认；Renderer 不持有 MCP env 原文。
- full-access 仍硬阻止文件系统根、当前工作区根和任意 `.git` 路径的永久删除。
