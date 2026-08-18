# 变更日志

> 只记录用户或开发者可以感知的能力变化。完整早期施工流水见 [`../_archive/ledgers/changelog-through-2026-08-16.md`](../_archive/ledgers/changelog-through-2026-08-16.md)。

## [未发布]

### Changed — Sidebar 导航 Playground 候选态（2026-08-18）

- Playground 页面组合新增 Sidebar 候选：开发入口回到底部产品区上方，产品候选只保留人物世界 / 设置。
- 新增“二级页收起”故事态，验证 Primary Sidebar 隐藏后仍可从工具二级导航重新展开。
- 本轮只改 Playground 故事格和协作规则，尚未回流正式生产页面，等待用户确认。

### Fixed — 记忆后台任务与 CI teardown 竞态（2026-08-17）

- 记忆写入的向量索引后台任务增加可等待生命周期边界，保留正常调用的非阻塞体验。
- GitHub Asset registry 工作流不会再因动态加载辅助模型配置跨过 Vitest teardown 而失败。

### Changed — Chat 页面布局与设置交互（2026-08-17）

- Chat 主区不再重复角色名；Debug / Playground 等全页视图移除了无内容的顶部留白。
- Sidebar 的 Debug / Playground 移到会话列表上方，窗口较矮时仍可直接进入开发工具；产品入口继续留在底部。
- 欢迎页的主角联动规则改为轻量引用提示，页面组合故事与正式 Chat 使用同一套结构。
- 设置页取消手动保存栏，修改后自动保存；API Key 仍遵守安全视图与空值防覆盖规则。

### Fixed — 跨平台删除安全与 GitHub Actions（2026-08-17）

- 永久删除白名单改为只检查工作区内部相对路径，Linux 项目位于 `/tmp` 时不会再把普通文件误判为可永久删除。
- Unit CI 不再为无界面测试下载 Electron 桌面二进制，避免慢速下载触发测试超时和连锁环境销毁报错。
- GitHub Actions 官方组件升级到当前 v7 主版本，消除 Node 20 Action Runtime 弃用警告。

### Added — 全量资产审计与自动登记门禁（2026-08-17）

- 新增设计资产注册表，主题与字体比例由 Settings、Playground、MarkdownRenderer 共享同一生产来源。
- SubAgent researcher / coder / analyst 现在作为可审计生产资产出现在 Debug 目录，真实命中时记录角色 usage evidence。
- 新增 `npm run assets:check`、资产治理清单、机器审计报告和 staged 漏登 fail-closed 门禁，并接入 Git hooks 与 GitHub Actions。
- 完成 12 个资产家族的全量盘点；审计快照归档于 `_archive/audits/asset-registry-audit-2026-08.md`。

### Added — Playground UI 组件资产目录（2026-08-17）

- Playground「组件 → 组件目录」现在统一展示行为、状态、开发工具、伙伴世界和布局导航组件。
- 组件资产可按分类和采用状态筛选，并展示中文主名、英文术语、稳定 key、实现来源、故事数量与无障碍约束。
- Radix 等外部 Primitive 只登记为候选，不会因为出现在目录中就自动安装或冒充已落地能力。

### Added — Playground Lucide 语义图标目录（2026-08-16）

- Playground「组件 → 图标」现在提供可搜索、按分类筛选的 Lucide 图标目录。
- 每个候选图标登记中文主名、灰色英文名、稳定语义 key、使用场景和 P0 / P1 优先级。
- 生产继续只使用 `lucide-react`，Alice 的 Tabler 仅作为视觉参考，不引入第二套生产图标库。

### Added — 文档自进化复盘闭环（2026-08-16）

- 新增只读 `npm run docs:self-review`，定期扫描变更同步缺口、重复真相源候选和文档维护债务。
- 新增 `npm run docs:self-review:prompt`，生成结构化 AI 复盘任务；AI 只提出建议，不自动改规则、决策、模块卡或产品代码。
- GitHub Actions 每周生成复盘 artifact，并保留手动触发入口。
- 复盘问题沿用 rules-feedback / wishlist / decisions / 模块卡 / `_archive/audits/` 路由，不新增平行 backlog。

### Added — 文档变更影响与收工闭环（2026-08-16）

- Wishlist 未完成项增加稳定 `WISH-xxx` ID 和来源字段；模块卡增加相关 DEC 索引。
- 新增 `npm run docs:impact` 与 `npm run docs:validate`，根据 staged 代码路径输出必须复核的文档。
- `npm prepare` 自动启用仓库 Git hooks；commit 前运行文档结构与影响门禁，push 前再次检查结构。
- GitHub Actions 在 Push / Pull Request 上自动运行文档一致性门禁。
- 施工合同增加“稳定事实回流、缺口登记、账本更新、验证通过、生命周期冻结”的收工门禁。

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
