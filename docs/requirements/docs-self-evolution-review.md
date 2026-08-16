# 文档自进化复盘闭环施工合同

> 状态：已完成施工快照（冻结，2026-08-16）
> 生命周期：已完成施工快照（冻结）；当前复盘以 `scripts/docs-self-review.mjs`、`scripts/docs-review-prompt.mjs` 和周期工作流为准。
> 施工范围：只读文档扫描、复盘报告、AI 复盘提示词、周期触发与问题路由；禁止自动修改 canonical 文档、规则、决策或产品代码。

## 一、需求背景（Why）

文档真相源、变更影响检查和施工收工门禁已经建立，但这些能力主要在 commit / push 时触发，不能定期回答“文档体系本身是否正在退化”。长期开发中仍可能出现：重复真相源、代码与模块卡不同步、规则多次被绕过、Wishlist 项目长期悬置、施工合同状态迟迟不收口，以及同一问题在多个账本重复登记。

本轮增加一个只读的文档自进化复盘层：脚本负责证据采集和结构扫描，AI 负责语义复盘和提出建议，用户确认后才把结论沉淀回现有 canonical source。

## 二、功能目标（What）

1. 新增 `npm run docs:self-review`，按最近提交范围生成 JSON / Markdown 复盘报告。
2. 新增 `npm run docs:self-review:prompt`，从报告生成给 AI 的结构化复盘提示词。
3. 报告覆盖：变更影响、缺失文档、重复长句、过大活跃文档、施工合同生命周期、Wishlist / DEC / 模块索引和已有 `docs:check` 结果。
4. 报告产物写入 `var/docs-self-review/`，加入 `.gitignore`，不成为当前真相源，也不触碰用户已有 `.tmp/`。
5. GitHub Actions 每周生成一次复盘 artifact，同时保留 Push / Pull Request 文档门禁。
6. 明确 AI 复盘的安全边界：只提出候选修复，不直接写入 `AGENTS.md`、模块卡、施工合同、`docs/decisions.md`、Prompt 生产源或产品代码。
7. 问题按现有账本路由：规则问题 → `docs/rules-feedback.md`；未排期缺口 → `docs/wishlist.md`；已接受取舍 → `docs/decisions.md`；当前能力 → 模块卡；历史报告 → `_archive/audits/`。

## 三、技术方案（How）

### 3.1 复盘范围

- 默认比较最近 10 个提交；支持 `--since <git-ref>` 指定起点。
- 使用 Git diff 读取变更路径，不读取 API Key、`.env`、用户记忆、运行报告或隐藏 reasoning。
- 运行 `docs:check`，但报告只记录命令状态和错误摘要，不复制无关日志。

### 3.2 静态扫描

- 代码变更与模块卡 / Architecture / Quality / Progress / Changelog 的影响映射。
- 活跃 Markdown 中重复的长句和疑似能力重复陈述，标记为候选，不自动判定冲突。
- 活跃文档超过 500 行时提示拆分或归档评估。
- 施工合同状态、验收结构、冻结生命周期。
- Wishlist 稳定 ID / 来源、模块 DEC 索引、链接与规则入口。
- 已有文档门禁的通过 / 失败摘要。

### 3.3 AI 提示词

提示词必须要求 AI 输出：复盘范围、证据、真相源冲突、规则执行失败、建议路由、暂不修改项和需要用户确认的决策。AI 不得把历史快照当当前事实，不得把重复文本直接判定为冲突。

### 3.4 周期触发

GitHub Actions 在每周固定时间运行 `docs:self-review`，上传 `var/docs-self-review/` 为 artifact；本地开发者可按 7 天、10 次提交、完成施工合同或 3 条规则反馈等条件手动运行。CI 不调用模型、不提交代码、不创建自动修复 PR。

## 四、影响范围

- `scripts/docs-self-review.mjs`
- `scripts/docs-review-prompt.mjs`
- `package.json`、`.gitignore`
- `.github/workflows/docs-quality.yml`
- `docs/quality.md`、`docs/docs-system.md`、`AGENTS.md`
- 本施工合同、`docs/progress.md`、`docs/changelog.md`

## 五、实施步骤

1. 编写并登记本合同。
2. 实现只读静态复盘扫描和报告输出。
3. 实现 AI 复盘提示词生成，明确禁止自动写盘。
4. 接入 npm 命令、`.gitignore` 和每周 GitHub Actions。
5. 更新规则、质量和文档体系说明。
6. 运行自审、文档门禁、Unit、Eval、TypeScript、Build、UI E2E 和依赖审计。
7. 将本合同标为已完成施工快照并提交推送。

## 六、风险与权衡

- AI 可能把合理的文档重复误报为双真相源，因此所有语义冲突必须带证据并标为候选。
- 自动修改规则会放大错误，第一版只生成报告和提示词，不自动写 canonical 文档。
- 周期报告可能积累噪音，因此产物放在 ignored `var/`，只在确认后把真正问题写回现有账本。
- 没有模型凭据时仍然可以完成静态扫描；AI 复盘是第二阶段人工触发，不阻塞文档门禁。

## 七、验收标准

- [x] `npm run docs:self-review` 生成 JSON / Markdown 报告。
- [x] `npm run docs:self-review:prompt` 生成结构化 AI 复盘提示词。
- [x] 报告默认覆盖最近 10 个提交，并支持 `--since`。
- [x] 报告不读取或写入 `.tmp/`、`.env`、用户数据和产品 canonical 文档。
- [x] 重复长句只标候选，不自动判定双真相源。
- [x] GitHub Actions 每周生成复盘 artifact，不调用模型、不提交修改。
- [x] 规则文档明确 AI 复盘的只读边界和问题路由。
- [x] `npm run docs:check`、`npm run docs:validate`、`npm run test`、`npm run eval:run`、`npm run eval:skill`、`npx tsc --noEmit`、`npm run build`、`npm run test:e2e` 和两次 `npm audit` 通过。
