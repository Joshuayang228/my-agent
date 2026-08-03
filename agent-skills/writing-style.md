# Writing Style

## 使用场景

写项目文档、README、文章、变更记录、说明文档时参考本文档。

## 语言

- 使用简体中文。
- 技术术语保留英文原文，例如 Agent、Token、Prompt。
- 中英文之间加空格，例如“使用 React 框架”。

## 技术文档结构

```md
# 标题

## 概述
一句话说明这个模块或功能是什么、解决什么问题。

## 架构 / 设计
关键设计决策和原因。

## 使用方式
代码示例或操作步骤。

## API 参考
接口定义、参数说明、返回值。

## 注意事项
已知限制、常见问题、踩坑记录。
```

## 项目文档职责

四维模型见 `docs/docs-system.md`。

| 文件 | 维 | 用途 | 更新时机 |
|------|----|------|----------|
| `modules/product-module-map.md` + `modules/*.md` | 产品 | 产品模块地图与横切卡 | 模块契约变化时 |
| `architecture.md` | 技术 | 系统分层与主数据流 | 架构变更时 |
| `quality.md` | 质量 | Unit / Eval / E2E 总控 | 门禁或分层策略变化时 |
| `progress.md` | 账本（对内） | 当前阶段与下一步 | 状态变化时 |
| `changelog.md` | 账本（对外） | 用户可见变更 | 发版、功能、修 bug |
| `wishlist.md` | 账本（缺口） | 暂缓与灵感 | 识别到缺口时（硬约束） |
| `pitfalls.md` | 账本（坑） | 踩坑记录 | 发现新坑时 |
| `decisions.md` | 账本（决策） | 技术决策 | 选型或架构决策时 |
| `rules-feedback.md` | 账本（规则） | 规则问题 | 规则不合理时 |

已归档至 `_archive/docs-legacy/`：features / api-contracts / testing / eval-design / glossary。

## 格式规范

- 标题层级不超过 4 级。
- 代码块标注语言类型。
- 列表项格式保持一致。
- 重要信息可以加粗。
- 警告信息用引用块。

## Commit Message 中的文档引用

修改文档时，commit type 使用 `docs:`。

```text
docs: update architecture with memory layer details
docs: add tool system pitfalls
```

## README 结构

```md
# 项目名

简介

## 功能特性

## 快速开始

### 环境要求
### 安装
### 运行

## 技术栈

## 项目结构

## 开发指南

## 许可证
```
