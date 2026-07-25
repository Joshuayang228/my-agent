# M6：权限与安全工程化方法论

> 这份文档沉淀我们对 Agent 权限系统的设计思考。
> 前半部分是**认知框架**——权限系统该怎么设计、为什么。
> 后半部分是**实战记录**——我们做了什么改动、踩了什么坑。
>
> 对照源：Alice Ch.07（权限系统）× CC utils/permissions/ × 我们的 sandbox/ 五层实现
> 沉淀时间：2026-07-04

---

# 第一部分：认知框架

## 一、第一性原理：权限是「在自动化和安全之间找到可配置的平衡点」

设计权限系统时，最容易掉进的坑是"一刀切"——要么全自动（什么都不问），要么全拦截（每次都问）。但 Agent 的价值恰恰在于**用户期望的自动化程度和实际操作风险不是固定的，是动态的、可配置的**。

Alice Ch.07 把这个矛盾总结成"不可能三角"：

```
       全自动化（省心）
          △
         / \
        /   \
       /     \
安全性 ────── 可配置性
```

三个角无法同时最大化：
- 要完全安全 → 每个操作都问用户，体验极差
- 要完全自动 → 放开权限，误操作风险剧增
- 要完全可配置 → 规则系统极其复杂，大多数用户不会用

第一性原理：**权限系统的本质是「让用户自己选择信任等级」，而不是替用户决定。不同场景（日常开发 / CI 环境 / 高风险操作）需要不同的平衡点，系统要让这个平衡点精确可配。**

一旦接受这个认知，权限系统的所有设计都变成一个问题的展开——**"怎么让不同场景都有合适的配置、怎么让危险决策不被绕过、怎么让 AI 不反复撞墙"**：

```
第一性原理：权限 = 在自动化与安全间找到「可配置的」平衡点

├─ 推论组 A：怎么按场景配置信任等级
│     §二 模式分级 · §三 责任链
│
├─ 推论组 B：哪些安全边界绝不能绕过
│     §四 bypass-immune · §五 危险命令分级 · §六 路径边界
│
└─ 推论组 C：怎么让 AI 不反复碰壁
      §七 拒绝追踪 · §八 决策可审计 · §九 持久审批
```

> **一个前置边界**：权限（谁能做什么）和沙箱（怎么隔离运行）是两个独立问题，解法完全不同——前者靠策略，后者靠容器隔离。M6 只做权限，沙箱容器化（Docker/VM）不在本文范围。

---

# 推论组 A：怎么按场景配置信任等级

> 第一性原理说"让用户选择信任等级"，落到实现就是分级模式 + 责任链。不同模式决定"哪些操作自动放行、哪些需要确认、哪些直接拦"，责任链决定"多条规则同时存在时按什么顺序匹配"。

## 二、模式分级：从最保守到最激进，覆盖完整需求谱

Alice 提出五种权限模式，从最保守到最激进：

| 模式 | 含义 | 典型场景 |
|------|------|----------|
| `plan` | 只规划，不执行。所有工具调用被阻断，Agent 只能输出文字 | 不确定的任务，先看计划再决定 |
| `default` | 危险操作需要用户弹窗确认 | 日常开发，默认模式 |
| `accept_edits` | 自动接受文件编辑，bash 等命令仍需确认 | 信任 AI 的代码修改能力 |
| `dont_ask` | 全自动，但保留 AI 分类器兜底（智能判断危险操作） | 长任务，减少打断 |
| `bypass_permissions` | 完全绕过权限检查 | CI/自动化场景，无人值守 |

**关键判据**：模式不是"开关"（开/关），而是"刻度"（1-5 级）。用户根据场景选择刻度，系统自动调整行为。

**我们的实现**：三级沙箱模式（`read-only` / `workspace-write` / `full-access`）+ 三级执行模式（`auto` / `confirm-all` / `plan-first`）。沙箱模式控制"允许写哪里"，执行模式控制"是否需要确认"。两者正交，可以组合（如 `workspace-write + confirm-all`）。

## 三、责任链：多条规则同时存在时按什么顺序匹配

当用户自定义规则、历史审批、命令分级、沙箱策略同时存在，按什么顺序匹配？

**Alice / CC 的答案**：按优先级排序，第一个命中的规则生效：

```
输入：工具名 + 参数
    ↓
1. 用户自定义规则（最高优先级）
    allow → 放行，deny → 拒绝，ask → 继续
    ↓
2. 历史审批记录（session / persistent）
    已允许 → 放行，已拒绝 → 拒绝
    ↓
3. 命令安全分级（dangerous / safe / unknown）
    dangerous → 拒绝，safe → 放行
    ↓
4. 沙箱策略（mode + 路径边界）
    ↓
5. 默认行为（fallback）
```

**关键判据**：优先级越高的规则越精确、越接近用户意图。用户显式配置的规则（自定义）优先级最高，系统推断的规则（命令分级）优先级较低，默认行为（fallback）优先级最低。

**我们的实现**：五层责任链（custom-rule → approval-store → exec-policy → sandbox-policy → fallback），每层返回 `allow / deny / needs_approval`，第一个非 `null` 结果生效。

---

# 推论组 B：哪些安全边界绝不能绕过

> 第一性原理里"安全"这一角不能完全牺牲——即使在最宽松的模式下，某些危险操作也必须拦截。这一组解决"什么是不可绕过的安全边界"。

## 四、bypass-immune：最宽松的模式也不能绕过的安全检查

CC 的核心设计：某些安全检查是 **bypass-immune** 的——即使在 `bypassPermissions` 模式下也要拦截。

典型场景：
- `.git/` `.claude/` `.vscode/` 等敏感目录（safetyCheck）
- shell 配置文件（`.bashrc` `.zshrc`）
- Windows 路径穿越（`C:\` → `\\wsl$\...`）

**判据**：bypass-immune 的判断标准是"这个操作如果被绕过，会破坏 Agent 自身的运行环境或用户的系统配置"。不是"危险"（用户可能后悔），而是"致命"（系统无法恢复）。

**我们的实现（G1）**：危险命令检测 bypass-immune。`rm -rf /`、fork bomb、`format C:`、磁盘覆写——这些 `exec-policy.ts` 的 DANGEROUS_PATTERNS 在 `full-access` 下也要拦截。实现时把 `assessCommand('dangerous')` 检查移到 `policy.mode === 'full-access'` 判断之前。

## 五、危险命令分级：不是所有命令都需要同等审查

`rm -rf /` 和 `ls -la` 的风险天差地别，不能一视同仁。

**分级标准**（参考 Codex execpolicy）：

| 风险等级 | 判定标准 | 示例 | 处理方式 |
|---------|---------|------|---------|
| `safe` | 已知只读/查询命令 | `ls` `cat` `git status` `npm list` | 自动放行 |
| `dangerous` | 已知破坏性极强的模式 | `rm -rf /` fork bomb `format C:` `curl \| bash` | 强制拦截（bypass-immune） |
| `unknown` | 未匹配到明确规则 | 用户自定义脚本 | 按沙箱模式决定 |

**关键判据**：分级的边界在"能否自动恢复"。删除一个文件（可恢复），删除整个根目录（不可恢复）。下载一个包（可审计），管道到 shell 执行（不可审计）。

**我们的实现**：`exec-policy.ts` 维护 `SAFE_COMMANDS` 集合 + `SAFE_PATTERNS` 数组 + `DANGEROUS_PATTERNS` 数组。`assessCommand()` 返回 `{ risk: 'safe' | 'dangerous' | 'unknown', reason: string }`。

## 六、路径边界：不是所有目录都能随便写

即使在 `workspace-write` 模式下，某些路径也要保护：
- `.git/` — 破坏后整个仓库损坏
- `.env` — 泄漏后密钥暴露
- `node_modules/` — 手动修改后难以恢复

**判据**：受保护路径的判断标准是"这个目录的内容由外部工具管理（git / npm / 环境变量），AI 手动修改会制造不一致"。

**我们的实现**：`policy.ts` 的 `ALWAYS_PROTECTED` 数组 + `command-guard.ts` 的 `hasProtectedPathAccess()` 检查。

---

# 推论组 C：怎么让 AI 不反复碰壁

> 前两组解决"拦什么、怎么拦"。但"拦"这个动作本身如果不告知 AI，AI 会在下一轮再试同一个操作，陷入反复碰壁。这一组是权限系统的自我反馈。

## 七、拒绝追踪：防止 AI 反复尝试被拒绝的操作

当某个操作被拒绝，如果不告知 AI，AI 可能在下一轮循环再次尝试，反复碰壁直到 `maxIterations`。

**Alice 的解法**：维护一个"本次会话拒绝记录"，在每轮迭代开始时，把最近的拒绝摘要追加到 system 消息：

```
注意：以下操作在本次会话中已被拒绝：
- bash: git push origin main
- bash: rm -rf /tmp/cache

请不要再次尝试这些操作。
```

**关键判据**：追加到 system 消息**末尾**（不是开头），对 KV Cache 友好——开头变化会使整个 cache 失效。

**我们的实现（G2）**：
- **工具级别拒绝**：loop.ts 的 `state.deniedTools` 追踪（已有）
- **命令级别拒绝**：shell_exec 内部被沙箱拦截的命令原本不进追踪（G2 修复前的 gap）。G2 增加 `state.deniedCommands`，在 Observe 阶段检测 tool_result 包含 `[SANDBOX BLOCKED]` 标记时提取命令并追入。`buildDeniedToolsPromptSuffix` 扩展为同时注入 deniedTools + deniedCommands。

## 八、决策可审计：每个决策带 reason，便于后续调试

权限决策不是"黑盒"（允许/拒绝），而是"可审计"（为什么允许/拒绝）。

**CC 的设计**：`PermissionDecisionReason` 枚举，每个决策携带结构化原因：

```typescript
type PermissionDecisionReason =
  | { type: 'rule', rule: PermissionRule }           // 规则命中
  | { type: 'mode', mode: PermissionMode }          // 模式决定
  | { type: 'safetyCheck', reason: string }         // 安全检查
  | { type: 'classifier', classifier: string }      // AI 分类器
  | ...
```

**关键判据**：结构化 reason 利于 DevPanel 展示权限决策链，也利于后续审计日志。plain string reason 无法区分"被哪条规则拦截"。

**我们的实现（G4）**：`PermissionCheckResult` 新增 `decisionType: DecisionType` 字段，枚举值：`custom-rule` / `approval-store` / `dangerous` / `sandbox-policy` / `default-allow`。原有 `reason` 字段保留（向后兼容），`decisionType` 提供结构化分类。

## 九、持久审批：用户的审批决策跨会话保留

用户对某个命令的审批决策（允许/拒绝），应该在下次启动时仍然生效——否则每次重启都要重新审批一遍。

**判据**：持久审批的边界在"用户的显式授权"。系统自动判断的决策（safe 命令放行）不需要持久，用户手动点击"允许"的决策需要持久。

**我们的实现（G3）**：
- **session 审批**：内存 Map，会话结束清空（已有）
- **persistent 审批**：内存 Map 镜像 + SQLite 落盘（G3 新增）。`loadPersistentApprovals()` 在 app.whenReady 时预加载，`recordApproval()` persistent 时异步写 SQLite + persist()。保持 `checkApproval()` 同步 API 不变（权限链依赖同步读取）。

---

# 第二部分：实战记录

## M6 阶段做了什么

对照 Alice Ch.07 + CC utils/permissions/ 审计当前实现，识别 4 项 Gap（P0×1 / P1×1 / P2×2），全部落地。

**改动范围**：不动沙箱架构（五层责任链保持），只修正三个安全缺口 + 一个可观测性增强。

- **G1 bypass-immune**：`command-guard.ts` 把危险命令检测移到 full-access 判断前（1 行前移），危险命令无论模式均拦截。
- **G4 DecisionType**：`permission-engine.ts` 新增 `DecisionType` 枚举 + `PermissionCheckResult.decisionType` 字段（5 处返回点），利于 DevPanel 展示权限决策链。
- **G2 deniedCommands**：`loop.ts` 新增 `state.deniedCommands` + `extractBlockedCommand()` + Observe 阶段检测 `[SANDBOX BLOCKED]`，防止 AI 反复重试被沙箱拦截的命令。
- **G3 persistent 审批**：`approval-store.ts` 接入 SQLite（`persistent_approvals` 表），内存缓存镜像 + 异步落盘 + app.whenReady 预加载，跨会话保留用户审批决策。

单测 138 → 140（+2），tsc 零错误。

## 决策：不照搬 Alice 的五模式，只吸收责任链原则

学习时一度纠结"要不要改成 Alice 的五模式"。最后判断是不改——Alice 的 `plan / default / accept_edits / dont_ask / bypass` 是为 CLI 场景设计的，我们的三级沙箱 + 三级执行模式更适合桌面应用（UI 友好、正交可组合）。但 Alice 的三个原则完全适用，都焊进来了：责任链优先级（G4 DecisionType）、bypass-immune（G1）、拒绝追踪（G2）。

**沉淀**：对照学习不是"把对方的实现搬过来"，是"识别对方哪些是本质原则、哪些是场景特化的实现"。原则可迁移，实现要看定位。

## 坑 1：测试预期需要反转（G1 的副作用）

G1 让危险命令 bypass-immune 后，原有测试 `full-access 模式放行所有命令` 失败——测试预期 `rm -rf /` 在 full-access 下应该放行，但 G1 改成了拦截。

**根因**：测试写在 G1 之前，当时认为 full-access 是"完全信任"。G1 引入 bypass-immune 原则后，full-access 变成"信任用户意图，但不信任危险操作"。

**修复**：把测试改成 `危险命令 bypass-immune — full-access 模式也拦截`，增加 `safe 命令在 full-access 下放行` 测试（验证 full-access 不是"全拦"）。

**沉淀**：测试不只是"验证代码正确"，也是"记录设计意图"。当设计意图变化（引入新原则），测试预期也要同步更新。测试失败不一定是代码错，可能是设计演进了。

## 坑 2：持久审批的同步 / 异步边界

G3 要让 persistent 审批写 SQLite，但 sql.js 的 `getDatabase()` 是 async，而 `checkApproval()` 是同步 API（权限链和 shell_exec 依赖同步读取）。

**根因**：权限检查在工具执行前，必须同步返回（允许/拒绝），不能 await。但 SQLite 读写是异步的。

**解法**：内存缓存镜像 + 启动时预加载 + 写时异步落盘。`loadPersistentApprovals()` 在 app.whenReady 时把 SQLite 全量加载到内存 Map，`checkApproval()` 同步读内存，`recordApproval()` 同步更新内存 + 异步落盘（void promise，不 await）。

**沉淀**：同步 API 依赖异步数据源时，用"预加载 + 内存镜像"模式。写时异步落盘不影响读（因为内存已更新），但要确保 app 退出时 `persist()` 已调用（我们在 `will-quit` 里有 `closeDatabase()` → `persist()`）。

## 坑 3：deniedCommands 的提取边界

G2 要从 tool_result 里提取被拦截的命令，但 `[SANDBOX BLOCKED]` 后面跟的是原因文字（如 `危险命令被拦截: recursive delete at root`），不是命令本身。

**根因**：shell_exec 返回的错误信息只有标记 + 原因，没有原始命令。原始命令在 tool_call 的 arguments 里。

**解法**：`extractBlockedCommand()` 从 `parsedArgs.get(call.id)?.command` 提取原始命令，从 `result.content` 提取原因。命令截断到 120 字符（防止超长命令撑爆 prompt）。

**沉淀**：错误信息和原始输入是两个维度，提取时要分别处理。错误信息适合给 AI 看（解释为什么拦截），原始输入适合去重（判断是否同一条命令）。

## 暂缓项

无。四个 Gap 全部落地，无暂缓。

## 沉淀：权限系统的设计检查清单

1. 新增的沙箱模式，危险命令检测是否 bypass-immune？
2. 新的拒绝路径（工具/命令/路径），有没有追踪到 denied* 并注入 prompt？
3. 权限决策带 `decisionType` 了吗？利于后续 DevPanel 展示吗？
4. 持久审批的边界清楚吗？哪些需要持久、哪些只需要 session？
5. 责任链优先级对吗？用户自定义规则 > 历史审批 > 命令分级 > 沙箱策略？
6. bypass-immune 的边界清楚吗？哪些是"致命"（必须拦），哪些是"危险"（可配置）？
