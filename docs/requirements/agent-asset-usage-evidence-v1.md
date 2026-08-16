# 生产资产使用证据链 v1 施工合同

> 状态：已落地（2026-08-15）
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 统一称呼：施工合同

## 1. 需求背景（Why）

My Agent 已经把 Prompt、伙伴与人格、记忆策略、权限与沙箱、Tool schema、Skill、Eval Case / Grader、模型 Provider 和 MCP 纳入 Debug「提示词管理器」的生产资产目录。开发者现在可以回答“系统里有什么”，但一次真实运行结束后，仍难以完整回答：

- 这次 LLM 请求实际引用了哪些 Prompt、Role Pack、Skill 和 Tool schema？
- 实际路由到了哪一个 Provider 适配器，自动检测、Thinking、Vision 或 Failover 哪些策略真的触发过？
- 本轮是否执行了向量召回、画像提取、去重或引用纠错？
- 某个工具为什么被允许、拒绝或要求确认，命中了哪类权限 / 沙箱策略？
- 从某项生产资产出发，最近在哪些调用或工具执行中实际使用过？
- 目录里存在的资产，和一次运行真实生效的资产，如何避免被误认为同一件事？

当前已有三块基础：

1. `llm_debug_logs` 使用 tracer Span ID 持久化真实 LLM 请求 / 响应，`requestExtra.promptAssets` 已保存调用级 Prompt 来源；
2. tracer 已有 `interaction`、`llm_request`、`tool`、`tool_blocked`、`tool_execution`、`compress`、`subagent` 等 Span，并分离等待用户确认与实际执行耗时；
3. 每类生产资产已有稳定 key、source、version、fingerprint、ownership、status 和 dependencies。

缺口不是再建一套日志，而是建立一层**“运行记录 ↔ 生产资产稳定 key”关联索引**。

### 1.1 参考结论

先研究现有参考，再决定本项目方案：

- Claude Code SDK 使用 `agentId`、`requestId`、`tool_use_id` 和 usage 统计维持稳定执行身份；值得学习的是“每个运行节点都有可引用 ID”，不是复制它的产品 UI。
- Alice 可观测性把一次交互拆为 LLM、Tool、压缩和子 Agent Span，并强调 `blocked_on_user` 与 `execution` 分离；权限系统要求每个决策可审计，同时默认不记录 Prompt、工具参数等敏感正文。
- My Agent 已经具备 Span ID、LLM Debug 持久化和生产资产稳定 key，因此不引入完整 OpenTelemetry SDK，也不重写现有 Debug Store；只补关联证据和反向查询。

## 2. 功能目标（What）

1. 定义统一的 `AgentAssetUsageEvidence`：记录某个真实运行节点与某个生产资产之间的关系，不复制资产正文。
2. 在真实 LLM 调用中记录实际使用或可用的 Prompt、Provider、Tool schema、Skill、记忆策略和运行策略证据。
3. 在真实工具执行中记录 Tool schema、权限责任链、审批流程和有效沙箱证据，并继续区分等待确认与执行耗时。
4. 在记忆关键路径中记录向量召回、画像提取、语义去重、反馈分桶、生命周期和引用纠错是否实际运行；只保留计数、结果状态等脱敏元数据。
5. 新增有界的资产使用关联索引，使 Debug 可以：
   - 按一次 LLM / Tool / Memory 运行查看资产证据；
   - 按资产 key 反查最近使用记录；
   - 从资产详情跳转到对应运行记录。
6. 将 LLM 调用详情现有“Prompt 资产”升级为“资产证据”，Prompt 旧字段继续兼容，不破坏历史记录。
7. Debug 继续只读；Playground、Settings 和生产资产文件不因证据链发生写入。
8. 对没有真实执行点的资产不伪造“已使用”：模型预设、默认世界、Eval Case 等只有在生产路径明确选择 / 运行时才记录。

## 3. 技术方案（How）

### 3.1 统一证据模型

共享类型新增类似：

```ts
interface AgentAssetUsageEvidence {
  id: string
  assetKey: string
  assetType: ModelContextAssetType
  relation: 'used' | 'available' | 'triggered' | 'matched'
  usageKind:
    | 'llm-input'
    | 'provider-route'
    | 'provider-policy'
    | 'tool-available'
    | 'tool-execution'
    | 'skill-activation'
    | 'memory-operation'
    | 'permission-decision'
  sessionId?: string
  interactionSpanId?: string
  spanId: string
  parentSpanId?: string
  occurredAt: number
  status: 'running' | 'success' | 'error' | 'blocked' | 'denied'
  metadata: Record<string, string | number | boolean | string[]>
}
```

字段约束：

- `assetKey` 必须能由生产资产目录解析；未知 key 不静默写入，进入 warning 和测试失败路径。
- `relation` 明确区分：
  - `used`：正文 / 策略已实际参与运行；
  - `available`：例如 Tool schema 进入模型请求，但模型未必调用；
  - `triggered`：Vision 降级、Failover、审批等事件真的发生；
  - `matched`：配置与某个内置模板匹配，但不能宣称用户通过该预设选择。
- `metadata` 采用每种 `usageKind` 的 allowlist，不接受任意对象透传。
- 证据只引用资产稳定 key；资产名称、版本、指纹在查询时从当前注册表解析，并同时保留运行时 fingerprint 快照，避免资产更新后无法解释历史。

### 3.2 资产 key 单一事实源

禁止在 Agent Loop、LLM、Memory 和 Tool 中散落裸字符串。各所有者模块导出稳定 key 常量 / 工厂：

```text
PROMPT_KEYS
MEMORY_STRATEGY_ASSET_KEYS
PERMISSION_ASSET_KEYS
PROVIDER_ASSET_KEYS
TOOL_ASSET_KEY_FACTORY
SKILL_ASSET_KEY_FACTORY
```

统一目录聚合器提供只读解析函数：

```ts
resolveModelContextAsset(key)
```

用途仅限：

- 校验证据 key 是否存在；
- 生成运行时 version / fingerprint 快照；
- Debug 查询时补齐展示字段。

运行算法不能反过来从 Debug 聚合器读取策略参数，继续遵守“注册表不是第二事实源”。

### 3.3 轻量证据事件与依赖方向

新增类似：

```text
electron/main/utils/asset-usage.ts
```

它只定义：

- `recordAssetUsage(evidence)`；
- 可选 `AssetUsageSink`；
- 有界内存缓冲和失败降级。

主进程启动时注册 Storage Sink。LLM、Agent、Memory、Tools / Sandbox 只依赖 `utils/asset-usage.ts` 和共享类型，不直接 import Debug IPC，也不形成 `llm → agent`、`storage → agent` 等反向依赖。

证据写盘失败只记录 warning，不得中断对话、工具或记忆主链路。

### 3.4 LLM / Provider 证据

真实 `streamChat` / `chatComplete` 调用记录：

| 运行事实 | 资产关系 |
|---|---|
| 实际 Prompt key | `used · llm-input` |
| 传给模型的 Tool schema | `available · tool-available` |
| 已激活 Skill | `used · skill-activation` |
| 实际 Provider 适配器 | `used · provider-route` |
| `provider: auto` 命中检测规则 | `used · provider-policy:auto-detection` |
| 辅助配置实际由策略挂上 `thinking.disabled` | `used · provider-policy:aux-thinking` |
| Agent Loop 实际使用家族窗口 / 保守回退计算预算 | `used · provider-policy:context-window` |
| 图片请求失败后去图重试 | `triggered · provider-policy:vision-fallback` |
| 主模型失败并开始备用尝试 | `triggered · provider-policy:sequential-failover` |

Provider 证据必须记录“实际适配器”和“策略是否触发”，不能只根据目录存在推断。

模型预设边界：

- 仅 Base URL + Model 与内置预设相同，最多记录 `matched`，不得写成 `used`；
- v1 不新增“当前预设”设置字段，也不改变用户配置 schema；
- API Key、认证 header、完整 Base URL query、Fallback 凭据不进入证据。

`LLMConfig` 可携带只供本进程使用的脱敏 `runtimeAssetKeys`，但该字段不得发送给 Provider，也不得包含凭据或用户正文。

### 3.5 Tool / Permission / Sandbox 证据

Agent Loop 已有每个工具的独立 Span。v1 在同一 Span 上关联：

- 被模型实际调用的 Tool schema：`used · tool-execution`；
- `permission-policy:decision-chain`：每次权限判定；
- `permission-policy:approval-flow`：真正进入用户确认时；
- `sandbox-policy:effective-mode`：本次工具实际采用的有效沙箱；
- `permission-policy:command-safety-grading`：`shell_exec` 实际执行命令分级时；
- `permission-policy:path-boundaries`：文件工具或命令路径守卫实际运行时；
- `sandbox-policy:modes`：沙箱策略参与最终判断时。

Tool 层需要看到真实判定结果，因此允许通过 `ToolContext` 增加一个内部 evidence callback，供 `shell_exec`、文件路径守卫等实际执行点上报；禁止让 Tool 直接写数据库。

允许记录：

```text
toolName
outcome（allow / deny / needs_approval / approved / rejected）
decisionType
chain
sandboxMode
blockedOnUserMs
executionMs
isError
```

禁止记录：

```text
完整工具参数
shell command 正文
文件正文
用户权限规则 pattern / description
审批备注原文
工具返回正文
```

若命中用户自定义规则，只记录 `matchedUserRule: true`，不保存规则 ID、pattern 或 reason 原文。

### 3.6 Memory 证据

在拥有真实事实的模块内记录：

| 生产路径 | 资产 key | 脱敏元数据 |
|---|---|---|
| `safeVectorSearch` | `memory-strategy:vector-recall` | attempted、resultCount、citationCount、status |
| 画像提取 | `memory-strategy:profile-extraction` | triggered、candidateCount、writtenCount、status |
| 语义去重 | `memory-strategy:semantic-deduplication` | comparedCount、duplicateCount |
| 伙伴反馈分桶 | `memory-strategy:feedback-bucket` | bucket、acceptedCount；不含内容 |
| 向量生命周期 | `memory-strategy:vector-lifecycle` | operation、affectedCount |
| 引用纠错 | `memory-strategy:citation-correction` | checkedCount、correctedCount |

不保存 query、记忆正文、摘要、用户画像字段值、向量、memory ID 或 citation 文本。

### 3.7 关联索引与持久化

新增数据库迁移和类似表：

```sql
CREATE TABLE agent_asset_usage (
  id                  TEXT PRIMARY KEY,
  asset_key           TEXT NOT NULL,
  asset_type          TEXT NOT NULL,
  relation            TEXT NOT NULL,
  usage_kind          TEXT NOT NULL,
  session_id          TEXT,
  interaction_span_id TEXT,
  span_id             TEXT NOT NULL,
  parent_span_id      TEXT,
  occurred_at         INTEGER NOT NULL,
  status              TEXT NOT NULL,
  asset_version       TEXT NOT NULL,
  asset_fingerprint   TEXT NOT NULL,
  metadata            TEXT NOT NULL
);
```

索引：

```text
asset_key + occurred_at
span_id
session_id + occurred_at
interaction_span_id
```

这张表是**关联索引，不是第二套运行日志**：

- LLM 请求 / 响应正文仍只在 `llm_debug_logs`；
- TraceSpan 结构仍由 tracer 负责；
- Eval 输入 / 判定仍在 Eval 报告；
- 资产正文仍在生产注册表。

持久化规则：

- `metadata` 经过 allowlist、`sanitizeLogData` 和 `safeStorage`；
- 上限 20,000 行或约 32 MB，超过后按最旧记录裁剪；
- 清空某会话 LLM Debug 时同步清理该会话证据；全量清空时全部清理；
- 导出 LLM Debug JSON / JSONL 时可附带该 span 的证据，但继续排除敏感正文；
- 不因证据表损坏或迁移失败阻断 Agent 主链路。

### 3.8 Debug UI

#### 请求与运行 → LLM 调用

将“Prompt 资产”升级为“资产证据”，按分组展示：

```text
Prompt
伙伴 / Skill
Provider
Tool schema（可用）
Memory
Permission / Sandbox
```

历史兼容：

- 旧记录只有 `requestExtra.promptAssets` 时仍按 Prompt 资产展示；
- 新记录优先读取关联索引，同时合并旧字段并按 `assetKey + usageKind + spanId` 去重；
- 不改 System / Messages / Tools / 参数 / 响应 / JSON 的真实内容入口。

#### 请求与运行 → Trace

Tool、Blocked、Execution Span 显示：

- 关联资产 key；
- 权限 outcome / chain；
- `blocked_on_user` 与 `execution` 时间；
- 不展示工具参数和命令正文。

#### 提示词管理器 → 资产详情

新增“最近使用”只读区：

- 最近 20 条；
- 时间、usageKind、relation、状态、caller / toolName 等有限元数据；
- 可跳转到对应 LLM 调用或 Trace；
- 无证据时显示“尚无可证明的运行记录”，不能把“未记录”写成“未使用”。

跨面板跳转由 `DevPanel` 维护选中记录 ID；不新增全局路由，不把运行记录复制进资产目录 payload。

### 3.9 IPC 四处同步

新增或扩展：

```text
src/shared/types.ts
electron/preload/index.ts
electron/main/ipc/debug.ts
src/vite-env.d.ts
```

实际 IPC：

```text
debug:asset-usage-query
```

通过白名单查询对象统一支持 `spanId / assetKey / sessionId / interactionSpanId / usageKind / limit / offset`，避免为同一关联索引维护三套接口。

所有输入验证：

- key / spanId / sessionId 必须为有界字符串；
- limit 上限 100；
- offset 非负；
- 不允许由 renderer 传 SQL、路径或任意排序字段。

### 3.10 不在 v1 中做

- 不引入 OpenTelemetry SDK、远程 telemetry、云端上报或埋点平台；
- 不记录隐藏 reasoning、Prompt / Tool / Memory 正文或凭据；
- 不建立资产使用次数排行榜、用户画像或行为分析；
- 不允许从“最近使用”直接修改生产资产；
- 不把目录浏览、复制按钮点击等 UI 行为算作资产使用；
- 不自动宣称模型预设被用户选择；
- 不重做 Eval 报告、会话日志或 LLM Debug Store。

## 4. 影响范围评估

### 4.1 主要改动

- Shared：证据类型、查询类型、Debug IPC 返回类型。
- Utils / Tracer：轻量 AssetUsage Sink 与 Span 关联。
- Storage：数据库迁移、关联索引 Store、裁剪 / 清理 / 查询。
- LLM：Prompt / Provider / Tool availability / Skill 证据；Vision / Failover 实际触发点。
- Agent：Context Window、Tool execution、Permission、Memory 调用证据。
- Sandbox / Tools：命令分级、路径边界和有效沙箱实际判定证据。
- Debug UI：LLM 资产证据、Trace 证据、资产详情反向使用记录和跨面板跳转。
- Tests / Docs：Unit、数据库迁移、IPC、UI E2E、模块卡、架构、质量、方法论和账本。

### 4.2 不改变

- 不改变 Prompt 正文、模型请求 body、Provider 选择顺序、Failover 顺序；
- 不改变权限判定、审批行为、沙箱模式或工具执行结果；
- 不改变记忆算法、召回阈值、画像写入和引用纠错逻辑；
- 不改变用户设置 schema、Role Pack 文件和生产资产正文；
- 不改变 Debug / Playground / Settings 的职责边界。

## 5. 实施步骤

1. 导出各资产所有者的稳定 key 常量 / 工厂，新增统一解析与证据共享类型；验证无裸字符串扩散。
2. 新增 AssetUsage Sink、数据库迁移和有界 Store，完成按 span / asset key / session 查询与清理。
3. 接入 LLM / Provider：Prompt、Tool availability、Skill、Provider 路由、Thinking、Context、Vision、Failover。
4. 接入 Agent / Tool / Permission：Tool execution、blocked / approved / denied、有效沙箱、命令分级和路径边界。
5. 接入 Memory：召回、画像、去重、反馈、生命周期和引用纠错；验证不保存正文或 ID。
6. 扩展 Debug IPC 四处同步，补输入校验、分页和导出关联。
7. 更新 LLM 调用详情、Trace 和资产详情“最近使用”，完成跨面板跳转与旧记录兼容。
8. 补 Unit / Storage / IPC / UI E2E；运行完整门禁并做真实 Electron 深浅主题验收。
9. 更新施工合同状态、模块卡、架构、质量、方法论、progress、changelog 和 wishlist，拆分提交并推送。

每一步必须独立可验证；不得先写 UI 假数据等待后端补齐，也不得用目录存在代替真实运行证据。

## 6. 验收标准

### 6.1 事实正确

- 每条证据 key 都能解析到真实生产资产；未知 key 不入库。
- Provider 自动检测、Vision 和 Failover 只有真实走过对应分支才标 `used / triggered`。
- Tool schema 明确区分 `available` 和 `used`。
- 模型预设匹配最多标 `matched`，不冒充用户选择。
- 权限 outcome 与实际允许 / 拒绝 / 确认结果一致。
- Memory 证据只在真实函数运行时产生。

### 6.2 隐私与安全

- 数据库、IPC、导出和 UI 中不存在 API Key、Authorization、完整 Base URL query、Prompt 正文、工具参数、shell command、文件正文、用户记忆正文、向量或隐藏 reasoning。
- 用户规则只记录是否命中，不记录 pattern、description 或 reason 原文。
- 证据写入失败不阻断主链路。

### 6.3 可用性

- LLM 调用可以看到本次资产证据分组。
- Tool Trace 可以看到权限 / 沙箱证据和两段耗时。
- 资产详情可以看到最近使用并跳转到对应记录。
- 旧 LLM Debug 记录仍可打开，Prompt 资产不丢失。
- 清空 / 导出行为与关联证据一致。

### 6.4 门禁

必须通过：

```text
npm run test
npm run eval:run
npm run eval:skill
npx tsc --noEmit
npx vite build
npx playwright test --project=ui
真实 Electron：浅色 / 暗色、长列表、空态、跨面板跳转
```

Persona Real Eval 不需要运行，除非实施中修改人格 Prompt、Judge 问题或人格评分标准。

## 7. 风险与权衡

- **证据爆炸**：一次请求可能暴露大量 Tool schema。通过关系去重、批量写入、分页和 20,000 行上限控制；UI 默认折叠 Tool availability。
- **“存在”与“生效”混淆**：必须使用 `available / used / triggered / matched` 四种关系，不用一个模糊的“关联”。
- **历史资产漂移**：同时保存运行时 version / fingerprint 快照；名称与 source 可按当前目录解析，但 UI 要提示历史指纹与当前指纹是否不同。
- **隐私泄漏**：metadata 只接受 allowlist；禁止把原始 args、reason、query 或内容对象直接传给 Sink。
- **性能回归**：写入批量串行化并异步降级；不得在每个 token / stream chunk 上写证据。
- **架构污染**：采用可选 Sink，业务层只发证据事件，不 import Storage / IPC；注册表只解析身份，不反向驱动算法。
- **重复存储**：Prompt 旧字段为兼容保留；新索引只存稳定 key 和运行快照，不复制 Prompt / Tool / Memory 正文。
- **范围膨胀**：v1 只覆盖有真实生产执行点的 LLM、Provider、Tool、Skill、Memory、Permission / Sandbox；目录浏览和静态模板不制造使用记录。

## 8. 落地结果（2026-08-15）

- 数据库升级至 schema v13，新增 `agent_asset_usage`；20,000 行与约 32 MB 双上限均会持续裁剪到边界内。
- LLM / Provider / Tool / Skill / Memory / Permission / Sandbox 已接入真实运行证据；工具内部命令责任链与文件路径守卫通过 tool span 回调上报真实结果。
- Debug「请求与运行 → LLM 调用」按资产类型展示调用级证据；提示词管理器支持资产反向“最近使用”和跨面板跳转。
- 单条 JSON 与批量 JSONL 导出都附带对应 span 的资产证据；列表查询与导出保留相同筛选、排序语义。
- 未保存 API Key、Authorization、Prompt 正文副本、工具参数 / 返回正文、shell command、文件正文、用户记忆正文 / ID / 向量、用户权限规则原文或隐藏 reasoning。
- 验证通过：Unit 114 文件 / 676 项、普通 Eval 23/23、Skill Eval、TypeScript、Vite / Electron Build、UI E2E 7/7、Electron onboarding 2/2；真实 Electron 完成调用证据、最近使用、跨面板跳转和浅色 / 深色验收。Persona Real Eval 未运行，因为本次没有修改人格 Prompt、Judge 或评分标准。
