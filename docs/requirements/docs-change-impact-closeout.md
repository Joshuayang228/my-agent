# 文档变更影响与收工闭环施工合同

> 状态：已完成施工快照（冻结，2026-08-16）
> 生命周期：已完成施工快照（冻结）；当前门禁以 `scripts/`、`.githooks/`、GitHub Actions 和 `docs/quality.md` 为准。
> 施工范围：文档门禁、Git 自动触发、变更影响映射、Wishlist / DEC 关联和施工合同收工检查；不修改产品运行逻辑。

## 一、需求背景（Why）

当前文档体系已经有 canonical source、历史归档和 `npm run docs:check`，但它仍主要依赖 Agent 主动记得执行。代码变更后，系统还不能自动提醒必须复核哪些模块卡、质量门禁或施工合同；Wishlist 缺少稳定 ID；模块卡没有相关决策索引；施工合同虽然有状态，但缺少机械可检查的收工门禁。

本轮把“文档已经分层”继续推进为“变更后能自动回到分层”。

## 二、功能目标（What）

1. `docs:check` 接入统一验证入口、Git pre-commit / pre-push 和 GitHub Actions。
2. 新增 `docs-impact-check`，读取 staged 文件并输出必须复核的模块卡、架构、质量、进度和变更日志。
3. 活跃 Wishlist 每个未完成条目拥有唯一稳定 `WISH-xxx` ID 和来源字段。
4. 模块卡增加“相关决策”薄索引，只列 DEC 编号，不复制正文。
5. 施工合同 README 增加收工门禁；自动检查进行中合同具备实施 / 验收结构，冻结合同具备冻结生命周期标记。
6. 保持所有人工判断边界：产品是否完成、是否需要新决策、Persona 语气是否合格，不能由脚本代替。

## 三、技术方案（How）

### 3.1 自动触发

- `.githooks/pre-commit`：运行 `npm run docs:validate`，覆盖 staged 文档结构和变更影响。
- `.githooks/pre-push`：再次运行 `npm run docs:check`，防止 `--no-verify` 绕过本地 commit 检查后直接推送。
- `scripts/install-git-hooks.mjs`：通过 `npm prepare` 设置 `core.hooksPath=.githooks`；无 Git 环境时安全跳过。
- `.github/workflows/docs-quality.yml`：Pull Request / push 运行 `npm ci` 和 `npm run docs:check`。

### 3.2 变更影响映射

| 变更路径 | 必须复核 |
|---|---|
| `electron/main/companion/` | 伙伴模块卡、相关 Persona Eval、Progress / Changelog |
| `electron/main/storage/`、`electron/main/memory/` | 记忆模块卡、质量、Progress / Changelog |
| `electron/main/sandbox/`、文件 / Shell 工具 | 权限模块卡、质量、安全 Skill、Progress / Changelog |
| `electron/main/agent/`、`llm/`、`tools/`、`mcp/`、`ipc/` | Agent Runtime、Architecture、Quality、Progress / Changelog |
| `src/components/playground/` | Playground 施工合同、UI E2E、Progress / Changelog |
| `__tests__/`、Eval 配置 | Quality；行为变化时补对应模块卡 |

脚本只对能机械判断的路径给出硬性要求；不自动判断产品语义。

### 3.3 稳定 ID

- Wishlist 使用 `WISH-001` 形式，ID 永不复用；完成后进入历史快照。
- DEC 继续使用 `DEC-xxx`，模块卡只维护相关编号和一句用途索引。
- 施工合同沿用文件名作为稳定入口，状态由文首和 README 索引共同表达。

### 3.4 施工合同收工门禁

- 进行中合同必须包含实施步骤和验收 / 收工结构。
- 冻结合同必须包含“已完成施工快照（冻结）”生命周期标记。
- 完工前由 Agent 人工确认：稳定事实已回流模块卡 / Architecture / Quality / Decisions，未排期缺口已进入 Wishlist，Progress / Changelog 已收口。

## 四、影响范围

- `scripts/docs-check.mjs`
- 新增 `scripts/docs-impact-check.mjs`、`scripts/install-git-hooks.mjs`
- 新增 `.githooks/`、`.github/workflows/docs-quality.yml`
- `package.json`
- `AGENTS.md`、`docs/docs-system.md`、`docs/quality.md`
- `docs/wishlist.md`、`docs/modules/*.md`、`docs/modules/README.md`
- `docs/requirements/README.md` 与本合同

## 五、实施步骤

1. 编写并登记本合同。
2. 为 Wishlist、模块卡和施工合同补充稳定元数据与收工要求。
3. 实现变更影响脚本，并接入 `docs:validate`。
4. 添加 tracked Git hooks、安装脚本和 GitHub Actions。
5. 运行自审、文档门禁、Unit、Eval、TypeScript、Build、UI E2E 和依赖审计。
6. 将本合同标为已完成施工快照并提交推送。

## 六、风险与权衡

- Git hooks 不能阻止用户显式使用 `--no-verify`；因此 pre-push 和 CI 仍保留文档结构门禁。
- 变更影响映射必须避免过严，否则会让纯测试或小型修复产生无意义文档负担；脚本只对明确路径做要求。
- Wishlist ID 会增加少量文案维护成本，但能防止同一缺口重复登记和来源丢失。
- 产品语义、人格审美和是否真正完成仍由人审，不交给正则或脚本决定。

## 七、验收标准

- [x] `npm run docs:validate` 同时运行结构检查和 staged 变更影响检查。
- [x] npm prepare 可安装 tracked Git hooks；pre-commit / pre-push 路径可执行。
- [x] GitHub Actions 在 PR / push 上运行 docs 门禁。
- [x] 所有活跃 Wishlist 未完成项都有唯一 WISH ID 和来源。
- [x] 四张模块卡都有相关 DEC 索引。
- [x] 进行中 / 冻结施工合同通过收工结构检查。
- [x] 纯文档任务不被要求修改产品模块卡；代码任务能输出对应复核文档。
- [x] `npm run docs:check`、`npm run test`、`npm run eval:run`、`npm run eval:skill`、`npx tsc --noEmit`、`npm run build`、`npm run test:e2e` 和两次 `npm audit` 通过。
