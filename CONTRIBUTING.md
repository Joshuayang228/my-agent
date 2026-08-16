# Contributing

[中文](#中文) · English

Thanks for interest in **My Agent**. We are in **public alpha** — small fixes and clear issues help a lot.

## Before you code

| Change size | What to do |
|-------------|------------|
| Typo / tiny fix | PR directly |
| User-visible behavior | Update the module card **已落地能力** section under `docs/modules/` + `docs/changelog.md` when relevant |
| Large / multi-file feature | Write a **construction contract** in `docs/requirements/` first (see root `AGENTS.md`) |

## Dev loop

```bash
npm install
cp .env.example .env   # your API keys — never commit secrets
npm run dev
npm run test
npm run typecheck
```

## Pull requests

1. Keep the PR focused (one concern).
2. Green `npm run test` + `npm run typecheck`.
3. Describe *why* in the PR body; link issues if any.
4. Do not commit `.env`, keys, or personal data.

## 文档闭环门禁

`npm install` 会通过 `prepare` 启用仓库内 Git hooks：commit 前自动运行 `npm run docs:validate`，push 前再次运行 `npm run docs:check`。Pull Request 还会由 GitHub Actions 执行文档门禁。

## Docs map

- Product modules: [`docs/modules/README.md`](docs/modules/README.md)
- Construction contracts: [`docs/requirements/README.md`](docs/requirements/README.md)
- Doc system: [`docs/docs-system.md`](docs/docs-system.md)

---

## 中文

感谢关注 **My Agent**。仓库处于**公开 alpha**，欢迎小修复与清晰 Issue。

### 动手前

| 改动规模 | 怎么做 |
|----------|--------|
| 错别字 / 小修 | 直接 PR |
| 用户可见行为 | 同步改 `docs/modules/` 对应卡的「已落地能力」+ 必要时 `changelog` |
| 跨多文件大功能 | 先写 `docs/requirements/` 下的**施工合同**（见根目录 `AGENTS.md`） |

### 本地

```bash
npm install
cp .env.example .env   # 填 Key，勿提交密钥
npm run dev
npm run test
npm run typecheck
```

### PR

1. 一个 PR 只做一件事  
2. `test` + `typecheck` 通过  
3. 说明为什么改；关联 Issue  
4. 不提交 `.env` / 密钥 / 个人数据  

许可证：[MIT](LICENSE)
