# Agent 生产资产全量审计与自动登记 v1 施工合同

> 状态：已落地（2026-08-17）
> 生命周期：已完成施工快照（冻结）；当前事实以代码注册表、模块卡、Architecture、Quality 和 Decisions 为准。
> 统一称呼：施工合同

## 1. 需求背景（Why）

项目已经为 Prompt、伙伴、Memory、Permission / Sandbox、Eval、Provider、Tool、Skill、MCP、Lucide 图标和 UI 组件建立了不同程度的注册与 Debug 展示能力，但仍存在两类会影响产品行为或开发体验的资产没有统一身份：主题 / Design Token 与 SubAgent 角色预设。同时，资产治理目前依赖各家族自己的单元测试，没有一条统一的 fail-closed 门禁来阻止新增资产静默漏登。

本合同完成一次可重复的全量资产盘点，并建立“自动发现 + 显式语义注册 + 自动门禁 + 机器审计报告”的闭环。审计报告是 dated snapshot，不成为第二真相源；生产注册表和真实 loader / factory 仍是唯一事实来源。

## 2. 功能目标（What）

1. 盘点所有会影响 Agent 行为、开发者可见能力或正式 UI 设计语言的生产资产家族，记录数量、入口、key 规则、自动发现方式、Debug / Playground 展示面和运行证据边界。
2. 新增 Theme / Design Asset 注册表，消除 Settings、Playground、MarkdownRenderer 对主题集合的重复维护。
3. 新增 SubAgent Role 生产资产注册表，登记 `researcher`、`coder`、`analyst` 的角色描述、默认工具集、只读边界和 Prompt 来源，并接入 Debug 资产目录及真实运行证据。
4. 提供 `npm run assets:check`：检查家族治理清单、来源路径、stable key 唯一性、ModelContextAssetType 覆盖、主题单一来源和 staged 新资产漏登。
5. 生成 `var/asset-audit/latest.json` 与 `var/asset-audit/latest.md` 机器审计报告；报告不得读取用户记忆正文、运行日志正文、凭据或用户权限记录。
6. 将资产门禁接入本地 Git hooks 和 GitHub Actions，保证后续资产生产可自动整理、登记、发现和阻断漏登。

## 3. 技术方案（How）

### 3.1 资产家族治理协议

新增治理清单 `scripts/asset-governance.mjs`，每个家族声明：`id`、中文名称、生产来源、注册表入口、发现方式、稳定 key 规则、展示面、运行证据和 staged 文件匹配规则。动态 Skill、MCP、Tool 明确标记为 runtime auto-discovered；静态家族必须有显式注册表。

采用“静态清单校验 + 真实注册表导入 + 目录构建测试”组合，不用正则从任意业务代码猜语义 key。无法可靠自动发现语义的新增静态资产，必须修改其注册表，否则门禁失败。

### 3.2 Theme / Design Asset

新增 `src/shared/design-asset-registry.ts`，登记主题 ID、中文名、描述、代表色、明暗模式、Token 分组和字体比例。Settings 与 Playground 直接消费注册表；MarkdownRenderer 从注册表派生浅色主题集合。主题注册表只描述生产设计事实，不进入主进程 ModelContextAsset，也不记录 Agent 运行证据。

### 3.3 SubAgent Role

新增 `electron/main/agent/subagent-asset-registry.ts`，从生产角色预设生成稳定资产：

- `subagent-role:researcher`
- `subagent-role:coder`
- `subagent-role:analyst`

注册表提供角色中文名、角色 Prompt addon、默认工具、只读与权限说明、源文件和版本。Debug 聚合器将其作为 `assetType: subagent-role` 的生产资产；`runSubAgent` 使用预设时通过现有 usage evidence 记录 `subagent-role` 资产与 `subagent-role` usage kind，不复制任务正文或用户输入。

### 3.4 审计与门禁

`scripts/asset-registry-check.mjs` 负责：

- 校验治理清单自身结构和稳定 key 规则；
- 校验静态注册表 source path 存在、key 唯一；
- 校验 `ModelContextAssetType` 每个值都有生产来源；
- 校验主题消费方没有继续维护主题 ID 集合；
- 校验 staged 文件落在自动发现目录，或同步修改对应注册表；
- 生成 `var/asset-audit/latest.json` / `.md`；
- 发现未知静态资产家族或新增未登记生产文件时返回非零退出码。

报告只保存资产家族和注册表元信息、数量、key 样例、缺口与生成时间，不保存 Prompt 正文、用户数据、运行参数、凭据或完整 Debug 内容。

## 4. 影响范围评估

- 共享类型：增加 `subagent-role` 资产类型和 usage kind。
- 主进程：SubAgent 角色注册表、Debug 资产聚合、运行证据。
- 渲染进程：主题来源统一到设计资产注册表。
- 工具链：新增审计脚本、npm 命令、Git hooks、CI 工作流。
- 文档：施工合同、资产管理方法论落地记录、Architecture / Quality / Runtime 模块卡、progress / changelog / decisions / wishlist（仅记录实际变化与未排期缺口）。
- 不改：人格 Prompt 正文、用户记忆与运行时世界数据、凭据、远程压缩配置、Playground 生产写入边界。

## 5. 实施步骤（每步可验证）

1. 复核现有注册表、Debug 聚合和 UI 主题消费路径；形成治理清单与初始审计基线。
2. 实现设计资产注册表并替换三处主题重复定义；运行 typecheck 与主题单元测试。
3. 实现 SubAgent Role 注册表，接入类型、Debug 聚合与 usage evidence；补充角色资产测试。
4. 实现统一资产审计脚本、机器报告、npm 命令和 staged 漏登检查。
5. 接入 pre-commit、pre-push 与 CI；补充治理清单、报告和门禁测试。
6. 更新模块卡、Architecture、Quality、progress、changelog、decisions；运行 docs:validate。
7. 按完成闸顺序执行自审、测试、build、lint / diff 检查，精确提交并推送。

## 6. 风险与权衡

- **自动发现 vs 语义准确**：不尝试从任意代码自动猜 key；对动态运行时资产自动发现，对静态语义资产显式登记并 fail-closed。
- **报告 vs 第二真相源**：报告只做审计快照，绝不被产品运行时读取；事实仍来自生产注册表和 loader。
- **SubAgent 自由角色**：自由字符串角色保持向后兼容，不伪造为内置角色资产；只有命中稳定预设才登记角色资产。
- **UI 资产 vs Agent 资产**：Theme / UI 组件 / Icon 不进入主进程 ModelContext 目录，避免把设计系统误当模型上下文；它们由 Renderer 注册表和 Playground 管理。
- **门禁误报**：staged 检查只覆盖声明过的生产来源模式；参考资料、测试夹具和用户数据目录不被误判为资产。

## 7. 完工标准

- 全部已识别资产家族可从治理清单追溯到真实生产来源；
- 主题 ID 在 Settings、Playground、MarkdownRenderer 只有一个注册事实源；
- 三个 SubAgent 角色可在 Debug 看到且真实使用可留 usage evidence；
- `npm run assets:check`、测试、typecheck、build、docs:validate 全部通过；
- 审计报告生成且不含敏感正文；
- 后续新增静态资产若未登记会在 hook / CI 中失败。
