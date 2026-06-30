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

| 文件 | 用途 | 更新时机 |
|------|------|----------|
| `progress.md` | 当前进度 | 状态变化时 |
| `architecture.md` | 系统架构 | 架构变更时 |
| `features.md` | 功能清单 | 功能完成时 |
| `changelog.md` | 变更日志 | 发版、修 bug、用户可见变化 |
| `pitfalls.md` | 踩坑记录 | 发现新坑时 |
| `rules-feedback.md` | 规则反馈 | 规则不合理时 |
| `decisions.md` | 技术决策记录 | 技术选型或架构决策时 |
| `testing.md` | 测试策略 | 测试方案变化时 |
| `glossary.md` | 术语表 | 引入新概念时 |
| `api-contracts.md` | 模块间接口契约 | 接口变更时 |

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
