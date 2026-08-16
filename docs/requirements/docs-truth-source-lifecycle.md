# 文档真相源与生命周期收口施工合同

> 状态：已完成施工快照（冻结，2026-08-16）
> 施工范围：文档体系、规则路由、历史账本、审计快照与自动一致性门禁；不修改产品运行逻辑。

## 一、需求背景（Why）

项目已形成产品、技术、质量、账本、施工合同、方法论和协作 SOP 的完整文档结构，但活跃目录同时保留当前事实、历史施工快照、审计报告和愿景记录。同一事实因此需要在多处手工同步，并已经出现施工合同状态冲突、架构数量过时、Progress 当前摘要落后、旧方法论链接失效和规则 canonical source 路由错误。

本轮目标不是减少记录量，而是减少需要持续同步的活跃真相源：历史信息完整保留，当前事实只由明确的 canonical source 负责。

## 二、功能目标（What）

1. 明确每类事实的唯一 canonical source，以及其他文档的引用责任。
2. 修复已经确认的状态、路径、标题、数量和行为描述漂移。
3. 将历史 Progress、Changelog、Wishlist、规则反馈和审计报告冻结为可追溯快照；活跃账本只保留当前需要维护的内容。
4. 将施工合同区分为“进行中”和“已完成施工快照（冻结）”，完工合同不再承担当前能力真相。
5. 将 Methodology 定义为深 Why；代码走读是带日期的实现快照，不替代模块卡或代码。
6. 统一所有当前规则入口指向 `AGENTS.md`，`CLAUDE.md` 只作为 Claude 适配入口。
7. 增加 `npm run docs:check`，自动检查链接、合同状态、DEC 引用、标题和易漂移事实。

## 三、技术方案（How）

### 3.1 当前事实矩阵

| 事实 | 唯一事实源 |
|---|---|
| 当前代码行为 | 生产代码、共享类型与测试 |
| 产品能力和边界 | `docs/modules/*.md` |
| 分层、依赖和主数据流 | `docs/architecture.md` |
| 质量门禁 | `docs/quality.md` |
| 技术取舍、非目标、接受风险 | `docs/decisions.md` |
| 正在施工的范围与验收 | `docs/requirements/` 的进行中合同 |
| 未排期缺口和灵感 | `docs/wishlist.md` 的未完成项 |
| 当前阶段和下一步 | `docs/progress.md` |
| 用户可见变化 | `docs/changelog.md` |
| 深层设计哲学 | `methodology/` 理念章 |
| 协作规则 | `AGENTS.md` |
| 场景化工作流程 | `agent-skills/` |
| 历史施工、审计和账本 | `_archive/` |

### 3.2 生命周期

- 施工合同开工时进入“进行中”。
- 主线验收后，将稳定能力吸入模块卡、架构、质量或决策；合同标成“已完成施工快照（冻结）”。
- 冻结合同保留完整 Why/What/How/验收，但不再被当作当前能力清单。
- Dated audit 完成后迁入 `_archive/audits/`；仍有效缺口必须先进入 wishlist 或 decisions。
- Progress、Wishlist、Rules Feedback 等账本定期做无损快照；活跃文件只保留当前需要维护的部分。
- Methodology 的 `*-code.md` 标明最近核对日期，属于实现快照；当前行为仍以代码和模块卡为准。

### 3.3 自动门禁

新增无第三方依赖的 Node 脚本，检查：

- 活跃 Markdown 相对链接存在；
- 施工合同全部被索引且索引分区与文首状态一致；
- DEC 引用存在；
- 当前文档首个结构标题正确；
- Architecture 不再手写内置工具数和 IPC 模块数；
- 当前规则入口不把 `CLAUDE.md` 描述成 canonical source；
- Changelog 和 Progress 基本结构正确。

## 四、影响范围

### 文档

- `AGENTS.md`
- 根目录 README / CONTRIBUTING / `agent-skills/README.md`
- `docs/docs-system.md`
- `docs/architecture.md`
- `docs/quality.md`
- `docs/modules/README.md` 与相关模块卡
- `docs/requirements/README.md` 及合同状态说明
- `docs/progress.md`、`docs/changelog.md`、`docs/wishlist.md`、`docs/rules-feedback.md`
- `methodology/README.md` 及审计索引
- `_archive/` 新增账本、审计快照和索引

### 工程

- 新增 `scripts/docs-check.mjs`
- `package.json` 新增 `docs:check`，不增加依赖

### 破坏性

- 不修改产品代码和用户数据。
- 历史内容不删除；活跃账本改写前保存完整归档快照。
- Dated audit 路径变化时同步修正当前文档链接。

## 五、实施步骤

1. 写入本施工合同并登记为进行中。
2. 修复合同状态、规则路由、失效链接和已确认的架构事实漂移。
3. 为 Progress、Changelog、Wishlist、Rules Feedback 创建完整归档快照，再重写活跃入口。
4. 将 dated audit 迁入 `_archive/audits/`，把有效缺口迁移到 Wishlist / Decisions。
5. 更新文档体系、方法论和施工合同生命周期规则。
6. 实现并运行 `npm run docs:check`。
7. 运行自审、单元测试、TypeScript、Build；完成后将本合同标为已完成施工快照。

## 六、风险与权衡

- **风险：归档后不易发现历史细节。** 通过活跃文档中的历史索引和归档 README 保持可发现性。
- **风险：一次移动过多文件造成链接失效。** 本轮只移动 dated audit 和新建账本快照；已完成施工合同先采用“冻结”状态，避免大规模路径迁移。
- **风险：自动检查过严阻碍正常写作。** 只检查可机械证明的结构事实，不尝试判断自然语言语义。
- **权衡：保留配对方法论代码章。** 它们继续作为带日期的代码走读，不再额外维护全局“当前实现”矩阵。

## 七、验收标准

- [x] 施工合同索引不存在“进行中暂无”与文首状态冲突。
- [x] 活跃 Markdown 相对链接检查通过。
- [x] Architecture 不再出现互相冲突的工具 / IPC 数量和错误的向量索引语义。
- [x] Progress 只保留当前快照，完整旧内容已归档。
- [x] Wishlist 活跃文件只保留未完成项，完整旧内容已归档。
- [x] Rules Feedback 只在一个位置表达状态，完整旧内容已归档。
- [x] Dated audit 已冻结归档，有效缺口未丢失。
- [x] 当前规则入口统一指向 `AGENTS.md`。
- [x] `npm run docs:check` 通过。
- [x] `npm run test`、`npx tsc --noEmit`、`npm run build` 通过。
