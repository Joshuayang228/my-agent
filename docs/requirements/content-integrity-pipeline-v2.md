# 内容完整性管线收口施工合同 v2

> 状态：已完成施工快照（冻结）
> 生命周期：已完成施工快照（冻结）。稳定事实已回流模块卡、Architecture、Quality、Progress 和 Changelog。

## 1. 发现的问题

v1 已经统一了 Companion 领域事件、日记和 Debug 的来源证据，但审计发现 Memory 的写入入口仍各自传递参数，Prompt 动态上下文仍主要以字符串形式流转，来源证据没有作为结构化契约贯穿到最终模型请求。

## 2. 本批目标

- Memory 的用户输入、人物 Tool、画像提炼、深夜反思和引用纠错统一保存 `ContentProvenance`。
- Memory 读取保留来源证据，提炼过程不能把模型推断伪装成用户确认事实。
- Prompt 动态上下文块具备来源类型、作用域、时间和长度边界，编译器只消费经过筛选的文本。
- 架构审计继续检查所有内容写入口是否经过 Application / Domain / Event / Outbox 或 Memory Store 正式入口。
- 增加 Memory、Prompt、跨入口和角色隔离的内容一致性测试。

## 3. 技术方案

### 3.1 Memory Provenance

`memories` 增加可选 `provenance_json`，`MemoryEntry` 和 `AddMemoryOpts` 共享 `ContentProvenance`。所有生产调用方必须标记来源，旧记录读取时保持无来源兼容状态并在 Debug 明确标识。

### 3.2 Prompt Evidence

增加内部 `PromptContextBlock` 结构，包含 key、text、source、scope、occurredAt 和 maxChars。现有编译器继续接收有界文本，Runtime 和 Debug 通过同一结构记录来源，不把来源说明直接混入人物自然语言正文。

### 3.3 Architecture Audit

盘点朋友圈、评论、日记、信物、关系、情绪、资产、Memory、Prompt 和 Outbox 的所有写入口。发现绕过正式入口的调用时，迁移到 Application / Domain Service，或者明确登记为只读查询。

## 4. 验收

- 所有 Memory 生产写入口有来源证据。
- Prompt 动态块来源、作用域和长度可测试、可追踪。
- 画像提炼、反思和用户记忆的 origin 区分正确。
- 跨角色、重复、迟到和无来源内容测试通过。
- 全量 Unit、构建、Electron E2E、资产和文档门禁通过。

## 5. 非目标

- 不改变 Memory 分类和召回算法。
- 不把 provenance 文案注入用户可见的人物正文。
- 不重写 Prompt 编译器的自然语言语义。

## 6. 完工记录

Memory 已统一持久化来源证据，用户 IPC、人物 Tool、画像提炼、引用纠错和深夜反思均标记 origin 与来源。主对话动态上下文的来源、作用域和长度元数据随 Registered System / Model Request 冻结保存，不进入人物自然语言正文。全量 Unit、构建、Electron E2E、资产和文档门禁通过。
