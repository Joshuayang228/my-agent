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

## 5. 测试边界

应覆盖：

- key 唯一
- source 可定位
- fingerprint 稳定
- dependencies 正确
- 缺失可选资产不虚构
- 目录不读取用户记忆正文
- Debug 分类和资产类型标签完整

生产资产目录的测试属于 Unit；真正的行为效果仍由 Persona / Skill / Memory Eval 负责，不能用目录存在替代行为验收。
