# 变更日志

> 只记录用户或开发者可以感知的能力变化。完整早期施工流水见 [`../_archive/ledgers/changelog-through-2026-08-16.md`](../_archive/ledgers/changelog-through-2026-08-16.md)。

## [未发布]

### Changed — 文档真相源与生命周期（2026-08-16）

- 文档入口明确区分当前能力、架构、质量、决策、施工合同、待办、进度和历史快照，降低开发者读到过时结论的风险。
- Progress、Wishlist 和 Rules Feedback 改为只显示当前内容；完整旧记录仍可从归档索引读取。
- 已完成的安全、实现和缺口审计冻结为 dated snapshot，不再冒充当前事实。
- 新增文档一致性检查命令，自动发现失效链接、施工合同状态错位和不存在的 DEC 引用。

### Fixed — 安全设置与 MCP 凭据边界（2026-08-16）

- 设置界面不再接收 API Key 和 MCP 环境变量原文；未修改 Key 时不会用空值覆盖已保存凭据。
- MCP 配置统一校验结构、数量、参数和 secret 恢复；启用或修改外部连接需要主进程确认。

## 历史版本与施工记录

项目公开 alpha 前尚未建立稳定版本切分。2026-06 至 2026-08-16 的完整逐项记录保存在：

- [完整历史 Changelog](../_archive/ledgers/changelog-through-2026-08-16.md)
- [完整历史 Progress](../_archive/ledgers/progress-through-2026-08-16.md)
