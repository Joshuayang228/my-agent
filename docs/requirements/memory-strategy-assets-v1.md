# 记忆策略资产注册 v1 施工合同

> 状态：已落地（2026-08-14）
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 统一称呼：施工合同

## 1. 需求背景（Why）

伙伴与人格生产资产已经进入统一生产资产目录，但记忆目录目前只展示模型可见的画像提取 / 用户画像注入 / 向量召回 Prompt。开发者仍看不到“为什么提取、为什么去重、为什么召回、为什么淘汰、为什么纠正分流”的策略事实。

本合同只注册记忆系统的生产策略，不注册用户实际记忆内容。目标是让 Debug 能回答记忆行为来源，同时保持用户数据、运行态和生产策略的边界。

## 2. 功能目标（What）

1. 新增 `memory-strategy` 资产类型和 `memory` 分类，登记记忆提取、语义去重、反馈分桶、向量召回、陈旧提示、向量生命周期、引用纠错 / 删除等生产策略。
2. 每项策略具有稳定 key、来源、版本、内容指纹、依赖 Prompt / 工具 / 存储模块和可读的结构化参数；不复制用户记忆正文。
3. Debug「提示词管理器」的生产资产目录可以按“记忆策略”筛选和查看；策略保持只读，实际命中的用户记忆仍去记忆 / 请求与运行视图查看。
4. 目录中的参数必须从生产常量或纯函数事实源生成，禁止在注册表中重新维护一份可漂移的阈值副本。
5. 方法论记录注册表的分类、生命周期、事实源、运行追踪和 Debug / Playground / Settings 边界；`AGENTS.md` 写入不可违反的简明规则。

## 3. 技术方案（How）

### 3.1 策略资产

新增稳定 key：

```text
memory-strategy:profile-extraction
memory-strategy:semantic-deduplication
memory-strategy:feedback-bucket
memory-strategy:vector-recall
memory-strategy:vector-lifecycle
memory-strategy:citation-correction
```

策略内容只包含：

- 触发条件和门槛
- 分类 / 分桶规则
- 阈值、上限和淘汰策略
- 纠正 / 删除分支
- 依赖的 Prompt key、存储模块或向量模块
- 来源函数 / 文件和版本指纹

### 3.2 事实源

新增 `electron/main/memory/strategy-registry.ts`，从生产模块导出或引用既有常量 / 纯函数：

- `profile-extractor.ts` 的提取门槛、窗口和有效分类
- `memory-store.ts` 的语义去重阈值、反馈分桶和查询限制
- `vector-store.ts` 的召回阈值、陈旧天数、会话向量上限和淘汰函数
- `citation-correct.ts` 的纠错分流结果

第一期允许为当前仍是代码内稳定规则的值建立“代码事实映射”，但不在注册表中再写一套可被运行时使用的配置。

### 3.3 Debug / Playground 边界

- Debug 显示策略定义、来源、版本、指纹、依赖和状态；不显示用户记忆原文。
- 用户实际记忆、召回命中、引用芯片和删除结果继续由 MemoryPanel / 世界态 / 请求与运行展示。
- Playground 本期不编辑记忆策略；未来只能载入为隔离实验策略，不能直接改变生产阈值。
- Settings 不提供策略编辑入口；用户可操作的是记忆本身的查看、纠正和删除。

## 4. 影响范围评估

- 共享类型：`PromptAssetKind`、`ModelContextAssetType`、`ModelContextContentKind` 扩展。
- 主进程：新增策略注册表，接入 `debug/model-context-assets.ts`。
- Debug UI：新增“记忆策略”分类和 `memory-strategy` 类型标签。
- 测试：策略 key 唯一、参数来自事实源、依赖正确、无用户正文、统一目录可读取。
- 文档：方法论、AGENTS、记忆模块卡、质量、架构、进度、changelog、wishlist。
- 不改：记忆数据库 schema、记忆提取行为、召回算法、用户记忆内容和 Settings 操作。

## 5. 实施步骤

1. 导出记忆生产常量 / 纯函数所需的稳定事实，并建立策略注册表。
2. 扩展统一生产资产类型与 Debug 分类，接入记忆策略目录。
3. 补策略聚合与统一目录测试，验证不读取用户数据库正文。
4. 写注册与管理方法论，并将硬边界写入 `AGENTS.md`。
5. 更新模块卡和账本，执行完整门禁、提交并推送。

## 6. 风险与权衡

- 代码中仍有少量隐式规则；本期优先登记已有稳定常量和纯函数，不借注册表之名重构记忆算法。
- 策略参数未来若需要用户配置，必须另立施工合同，把“生产默认值”和“用户覆盖”分开记录。
- Debug 能看到策略不代表能解释每条用户记忆；单条记忆的来源链需要后续运行时证据继续补强。
