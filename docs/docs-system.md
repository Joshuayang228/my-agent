# 文档体系（四维 + methodology）

> 状态：已落地（2026-07-30）。  
> 原路径 `docs/requirements/docs-system-restructure.md`；2026-08-03 迁出 requirements（本文件不是施工合同）。

## Why

缺产品横切入口；部分文档与代码双真相。`methodology/` 保留（深 Why，慢更）。

## What（四维 + methodology）

| 维 | 职责 | 落点 |
|----|------|------|
| 产品 | 能力边界、任务入口、横切导航、已落地能力表 | `docs/modules/README.md` + 各模块卡（卡内「已落地能力」） |
| 技术 | 分层与连接（一张图） | `docs/architecture.md` |
| 质量 | Unit / Eval / E2E 总控 | `docs/quality.md` |
| 账本 | 对内进度 / 对外变更 / 缺口 / 坑 / 决策 / 规则反馈 | `progress` · `changelog` · `wishlist` · `pitfalls` · `decisions` · `rules-feedback` |

旁路（**不是**四维之一）：

| 旁路 | 职责 | 落点 |
|------|------|------|
| **施工合同** | 大改开工前 Why/What/How/验收（唯一称呼） | `docs/requirements/` |
| 深 Why | 设计哲学与取舍 | `methodology/` |
| 暂缓评估 | 未升格为施工合同的调研 | `docs/notes/` |
| 规则 / SOP | 协作入口 | `CLAUDE.md` · 根目录 `agent-skills/` |

## 约定

- **术语**：`docs/requirements/` 内文件一律称**施工合同**，禁止「需求文档 / 需求合同 / 开工合同」别名
- 产品模块导览：`docs/modules/README.md`；模块卡含「已落地能力」
- progress 对内、changelog 对外；pitfalls / decisions 属账本
- 真相：代码行为 > 模块卡现状 > architecture > methodology 愿景

## 归档

已迁入 `_archive/docs-legacy/`：

`features.md` · `api-contracts.md` · `testing.md` · `eval-design.md` · `glossary.md`

## 验收

- [x] modules/README（产品导览）+ companion/memory/permission/agent-runtime（persona 空壳卡已删）
- [x] quality.md
- [x] CLAUDE / writing-style / architecture 对齐
- [x] 旧文档归档
- [x] 账本含 pitfalls / decisions
- [x] 「有什么」写入各模块卡「已落地能力」（2026-08-03 取消总 `capability-catalog`；补 features 归档缺口）
- [x] `requirements/README.md` 只索引施工合同（进行中 / 已落地）；元规则本文件、历史批次进 `_archive/docs-legacy/`、评估进 `docs/notes/`（2026-08-03）
