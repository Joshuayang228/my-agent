# 注册与管理：当前代码走读

> 本文只记录当前实现如何落到代码；设计取舍见 [`asset-registration-management.md`](./asset-registration-management.md)。

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

## 7. 测试边界

应覆盖：

- key 唯一
- source 可定位
- fingerprint 稳定
- dependencies 正确
- 缺失可选资产不虚构
- 目录不读取用户记忆正文、用户权限规则、审批记录正文、Eval 运行报告或环境凭据
- Debug 分类和资产类型标签完整

生产资产目录的测试属于 Unit；真正的行为效果仍由 Persona / Skill / Memory Eval、Permission 单测 / Eval 和真实 Eval Runner 负责，不能用目录存在替代行为验收。
