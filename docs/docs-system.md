# 文档体系：当前事实与生命周期

> 状态：已落地（2026-08-16）。本文件只定义文档职责和生命周期，不记录产品能力或施工进度。

## 当前事实矩阵

| 事实类型 | 唯一 canonical source | 说明 |
|---|---|---|
| 当前代码行为 | 生产代码、共享类型、测试 | 文档与代码冲突时先核对代码和测试 |
| 产品能力和边界 | `docs/modules/*.md` | “有什么能力”只在模块卡维护 |
| 分层、依赖和主数据流 | `docs/architecture.md` | 不维护工具数、IPC 数、测试数等动态清单 |
| 质量门禁 | `docs/quality.md` | 当前通过数量以命令 / CI 输出为准 |
| 技术取舍、非目标、接受风险 | `docs/decisions.md` | 变更既有取舍前按关键词搜索 DEC |
| 正在施工的范围和验收 | `docs/requirements/` 的进行中合同 | 完工后冻结为施工快照 |
| 未排期缺口和灵感 | `docs/wishlist.md` | 活跃文件只保留未完成项 |
| 当前阶段和下一步 | `docs/progress.md` | 完整历史进入 `_archive/ledgers/` |
| 用户可见变化 | `docs/changelog.md` | 不记录内部测试流水和提交过程 |
| 深 Why | `methodology/` | 理念章不冒充当前实现；代码章是 dated snapshot |
| 共享规则 | 根目录 `AGENTS.md` | `CLAUDE.md` 仅为 Claude 导入入口 |
| 场景 SOP | 根目录 `agent-skills/` | 只回答“这类活怎么干” |
| 历史快照 | `_archive/` | 默认不读、不搜，不作为当前事实源 |

## 四维与旁路

- **产品**：`docs/modules/README.md` + 有实质边界的模块卡。
- **技术**：`docs/architecture.md`。
- **质量**：`docs/quality.md`。
- **账本**：progress / changelog / wishlist / pitfalls / decisions / rules-feedback。
- **施工合同**：`docs/requirements/`，大改开工前对齐 Why/What/How/验收。
- **暂缓评估**：[`docs/deferred/README.md`](./deferred/README.md)，达到开工条件后升格为施工合同。
- **方法论**：[`methodology/README.md`](../methodology/README.md)，记录深层认知和取舍。
- **协作规则**：`AGENTS.md` + `agent-skills/`。

## AI 路由模型

文档发现不是“所有文件都先经过一个总 README”，而是按文档职责分层：

```text
AGENTS.md
├── 集合型文档 → 分类 README → 具体文档
├── 单体型 canonical 文档 → 按任务触发条件直接进入
└── Skill → 场景匹配后直接进入具体 agent-skills/*.md
```

- **集合型文档**适合有多个子文档、需要状态或依赖分发的目录：模块、施工合同、Deferred、Methodology。
- **单体型文档**本身就是唯一事实源，不为增加跳转层级再套一层 README：Architecture、Quality、Progress、Changelog、Wishlist、Decisions、Pitfalls、Rules Feedback 和本文件。
- **Skill** 是场景化执行规程，由 `AGENTS.md` 直接点读具体文件；`agent-skills/README.md` 只做目录说明。
- **根目录 README** 是人类 / GitHub 公共入口，不能替代 `AGENTS.md` 的 AI 启动路由。
- **任何 README** 只负责索引、分发和边界说明，不复制子文档事实正文。

## 生命周期

### 施工合同

1. 开工前创建，状态为“进行中”。
2. 验收后把稳定事实吸入模块卡、Architecture、Quality 或 Decisions。
3. 合同改为“已完成施工快照（冻结）”，保留原始范围和验收，不再持续同步当前实现。

### 账本

- Progress 只保留当前阶段、最近完成、下一步和阻塞。
- Changelog 只保留用户 / 开发者可感知变化。
- Wishlist 只保留未完成项。
- Rules Feedback 只保留待审视项。
- 收口前的完整原文进入 `_archive/ledgers/`。

### 审计与方法论

- dated audit 完成后进入 `_archive/audits/`；有效缺口必须先迁入 Wishlist 或 Decisions。
- Methodology 理念章可长期演进；`*-code.md` 必须标最近核对日期，视为实现快照。
- 普通搜索默认排除 `_archive/`，历史回溯时才读取。

## 自动门禁

运行：

```bash
npm run docs:check      # 当前文档结构和事实路由
npm run docs:impact     # staged 变更影响映射
npm run docs:validate   # 两者合并入口
```

`npm prepare` 会启用版本库内 `.githooks/`；pre-commit 运行 `docs:validate`，pre-push 再运行 `docs:check`。GitHub Actions 在 Push / Pull Request 上运行 `docs:check`。检查活跃链接、施工合同状态、DEC 引用、Wishlist ID、模块决策索引、文档标题、规则入口、AI 文档启动路由 / 任务触发 / 分类索引和 Architecture 易漂移数量。完整测试门禁见 `docs/quality.md`。

周期复盘：`npm run docs:self-review` 只读扫描最近提交并生成 `var/docs-self-review/latest.json` / `latest.md`；`npm run docs:self-review:prompt` 生成供 AI 阅读的语义复盘提示词。每周 GitHub Actions 只上传复盘 artifact，不调用模型、不提交修改、不写 canonical 文档。

## 历史

旧文档体系和本次收口前的完整快照见 [`../_archive/README.md`](../_archive/README.md)。
