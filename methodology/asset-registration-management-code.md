# 注册与管理：当前代码走读

> 本文只记录当前实现如何落到代码；设计取舍见 [`asset-registration-management.md`](./asset-registration-management.md)。
> 最近核对：2026-08-17。

## 1. 统一展示契约

Debug 当前复用 `ModelContextAsset` 作为生产资产目录的 IPC 展示契约，保留 Prompt 既有字段，并扩展：

```text
status
derivedFrom
dependencies
```

资产类型包括：

```text
prompt
companion-*
memory-strategy
permission-policy
sandbox-policy
eval-case
eval-grader
provider-capability
provider-policy
provider-preset
subagent-role
tool-schema
skill
eval-judge
```

类型定义位于：

```text
src/shared/types.ts
```

## 2. 聚合入口

生产资产目录的主聚合入口是：

```text
electron/main/debug/model-context-assets.ts
```

它从多个单一事实源聚合：

```text
electron/main/prompts/registry.ts
 electron/main/skills/registry.ts
 electron/main/tools/registry.ts
 electron/main/companion/asset-registry.ts
 electron/main/memory/strategy-registry.ts
 electron/main/sandbox/asset-registry.ts
 electron/main/llm/provider-asset-registry.ts
 src/shared/provider-presets.ts
 evals/scenario-registry.ts
 evals/asset-registry.ts
```

Debug IPC 仍使用：

```text
debug:model-context-assets
```

没有为每一种资产另造一套重复 IPC。

## 3. 伙伴资产

伙伴资产注册表位于：

```text
electron/main/companion/asset-registry.ts
```

它复用：

- Role Pack loader
- 场景 loader
- 生活 starter 工厂

并生成：

- manifest
- profile
- world default
- display / interact / execute scene
- wardrobe / bookshelf starter

当前世界运行态、数据库衣柜和用户记忆不会进入静态目录。

## 4. 记忆策略

记忆策略注册表位于：

```text
electron/main/memory/strategy-registry.ts
```

策略参数来自：

```text
electron/main/agent/profile-extractor.ts
electron/main/storage/memory-store.ts
electron/main/memory/vector-store.ts
electron/main/memory/citation-correct.ts
```

当前登记：

```text
memory-strategy:profile-extraction
memory-strategy:semantic-deduplication
memory-strategy:feedback-bucket
memory-strategy:vector-recall
memory-strategy:vector-lifecycle
memory-strategy:citation-correction
```

注册表只生成展示对象，运行代码仍从原模块常量和纯函数读取事实。

## 5. 权限与沙箱策略

权限与沙箱资产注册表位于：

```text
electron/main/sandbox/asset-registry.ts
```

它从以下生产事实生成只读资产：

```text
sandbox/policy.ts
sandbox/permission-engine.ts
sandbox/exec-policy.ts
sandbox/file-path-guard.ts
sandbox/approval-store.ts
sandbox/effective-sandbox.ts
```

当前登记沙箱档位、权限责任链、命令安全分级、路径边界、审批生命周期和有效沙箱映射。用户 permissionRules、真实审批记录和当前 executionMode 不进入 builtin 目录。

## 6. Eval Case / Grader

普通场景唯一注册入口：

```text
evals/scenario-registry.ts
```

它统一提供 F01–F08、P01–P06、B01–B07、C01–C02，供 Vitest、CLI 和资产目录共同消费，避免平行数组漂移。`evals/asset-registry.ts` 再从真实 Scenario、`EvalGrader.assetDefinition` 和 `SKILL_EVAL_CASES` 生成 `eval-case` / `eval-grader`。

静态资产只保存场景描述、套件、默认模式、required、Grader 顺序和结构化 criteria；实际初始 messages、System Prompt、Agent 回复、Judge 结论和人工审阅仍只在“质量 / Eval”报告查看。

## 7. 模型 Provider

Provider 生产资产注册表位于：

```text
electron/main/llm/provider-asset-registry.ts
```

它登记三类协议能力：

```text
provider-capability:openai
provider-capability:anthropic
provider-capability:gemini
```

协议摘要不是手写厂商宣传，而是使用脱敏合成配置调用 `request-builders.ts`、`buildAnthropicBody` 和 `buildGeminiBody`，再只提取 endpoint、认证方式、header 名、query 参数名、body key 和当前构造器能表达的能力。合成 API Key 若进入序列化资产会立即抛错。

跨 Provider 策略来自：

```text
provider-router.ts
thinking.ts
agent/model-context-window.ts
vision.ts
failover.ts
```

内置预设唯一注册表位于 `src/shared/provider-presets.ts`。Settings 消费全部九项，Chat 只过滤四项 `quickAccess`；Debug 为每项生成 `provider-preset`，不读取用户 API Key、自定义端点、Fallback 配置、Thinking 能力缓存或 Vision deny cache。

## 8. 测试边界

应覆盖：

- key 唯一
- source 可定位
- fingerprint 稳定
- dependencies 正确
- 缺失可选资产不虚构
- 目录不读取用户记忆正文、用户权限规则、审批记录正文、Eval 运行报告、Provider 能力缓存或环境凭据
- Debug 分类和资产类型标签完整

生产资产目录的测试属于 Unit；真正的行为效果仍由 Persona / Skill / Memory Eval、Permission 单测 / Eval 和真实 Eval Runner 负责，不能用目录存在替代行为验收。

## 9. 生产资产运行证据链

运行证据不复制资产正文，而是保存：

```text
运行节点 Span ID
  ↕
AgentAssetUsageEvidence
  ↕
生产资产稳定 key + version / fingerprint 快照
```

核心文件：

```text
electron/main/utils/asset-usage.ts
electron/main/storage/asset-usage-store.ts
electron/main/debug/model-context-assets.ts
electron/main/tools/asset-keys.ts
electron/main/llm/provider-asset-keys.ts
electron/main/memory/asset-keys.ts
electron/main/sandbox/asset-keys.ts
```

主进程启动时注入 Resolver 与 Sink。LLM、Agent、Memory、Tools / Sandbox 只依赖轻量分发器，不直接 import Debug IPC 或 Store。Tool Registry 把 `callId → tool span` 注入工具上下文，因此 shell 权限责任链和文件路径守卫可以报告真实 decision，而不是由外层按工具名猜测。

持久化表 `agent_asset_usage` 只保存 key、运行身份、关系、状态、版本 / 指纹快照和扁平 allowlist metadata；20,000 行或约 32 MB 超限后持续删除最旧记录。LLM Debug JSON / JSONL 导出按 span 批量附加证据，避免逐条 N+1 查询。

Debug 查询统一使用：

```text
debug:asset-usage-query
```

支持按 asset、span、session、interaction span 和 usage kind 查询。提示词管理器负责“资产 → 最近运行”的反向入口，请求与运行负责“运行 → 本次资产”的正向入口；两者共享同一关联索引，但不互相复制正文。

## 10. UI 组件与图标资产

前端设计资产不进入主进程 `ModelContextAsset` 聚合，也不记录 Agent 运行证据。它们由 Renderer 侧注册表提供稳定身份，并在 Playground 做只读筛选和人工验收。

图标注册表：

```text
src/shared/icon-registry.ts
```

当前登记导航、对话、开发、伙伴、文件与证据、状态与风险六类 Lucide 语义图标。每项包含稳定 key、中文名、英文术语、用途、P0 / P1 优先级和真实 `lucide-react` 组件。Playground 入口位于：

```text
Playground → 设计 → 组件 → 图标
```

UI 组件注册表：

```text
src/shared/ui-component-registry.ts
```

当前字段包括：

```text
key
labelZh / labelEn
descriptionZh
category
status
implementation
sourcePath / reference
stories
accessibilityNotes
accessibilityStatus
layer: foundation / experience
```

`candidate` 项可以引用尚未安装的 Radix 或其他参考来源，但必须明确写“尚未引入依赖”；`adopted` 项必须指向真实组件源码。采用状态与无障碍验证状态彼此独立，当前未完成专项审计的组件明确标记为 `needs-review`。Playground 入口位于：

```text
Playground → 设计 → 组件 → 组件目录
```

组件目录和图标目录都只读，不会动态安装包、复制 SVG、修改生产组件或把实验状态写回正式页面。对应测试：

```text
__tests__/unit/icon-registry.test.ts
__tests__/unit/ui-component-registry.test.ts
__tests__/e2e/chat.test.ts
```

Unit 检查稳定 key、分类覆盖、状态与来源契约；Renderer E2E 检查目录入口、筛选和中英层级。视觉与交互仍需要在深色 / 浅色、窄宽和键盘场景下人工验收，不能只以注册表测试通过代替。

产品体验依赖位于 `src/shared/product-experience-registry.ts`。每项登记 `experience.*` key、Playground 入口、真实 source 和 `usesFoundation`。`FoundationComponentKey` 由 UI 组件注册表的字面量 key 与 `layer` 派生，因此拼错或引用 experience 层资产会在 TypeScript / Unit 阶段失败。`productExperiencesUsingFoundation()` 负责反向关系，Renderer 不维护 `usedBy`。对应门禁：

```text
__tests__/unit/product-experience-registry.test.ts
npm run assets:check
```


## 11. 全量审计与自动登记门禁

2026-08-17 的实现新增治理清单与统一检查入口：

```text
scripts/asset-governance.mjs
scripts/asset-registry-check.mjs
npm run assets:check
```

治理清单覆盖 13 个资产家族：Prompt、伙伴、Memory Strategy、Permission / Sandbox、Eval、Provider、SubAgent Role、Tool、Skill、Lucide Icon、UI Component、Product Experience、Theme / Design。前 7 类是 Agent / ModelContext 生产资产；Tool、Skill 与其 MCP bridge 明确由运行时 ToolRegistry / loader 自动发现；Icon、UI、Product Experience、Theme 是 Renderer 设计资产，不进入 ModelContext 或 Agent usage evidence。

门禁会检查：

- 每个 `ModelContextAssetType` 都能回到治理清单和真实来源；
- 静态家族注册表入口与 source path 存在；
- Settings、Playground、MarkdownRenderer 不重复声明主题集合；
- staged 生产来源变更必须同步注册表，未登记即失败；
- 生成 `var/asset-audit/latest.json` 与 `.md`，报告只保存数量、入口、发现方式和缺口，不保存正文、用户数据或凭据。

这套机制不是“任意代码自动猜资产”，而是用自动发现覆盖动态能力，用显式语义注册保证静态身份，再用 fail-closed 门禁阻止漏登。
