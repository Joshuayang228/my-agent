# 权限与沙箱策略资产注册 v1 施工合同

> 状态：已落地（2026-08-15）
> 统一称呼：施工合同

## 1. 需求背景（Why）

Agent 生产资产目录已经覆盖 Prompt、Skill、Tool schema、伙伴与人格资产和记忆策略，但 Debug 仍不能从同一入口回答“当前权限为什么允许、拒绝或要求确认”。权限系统本身已经落地，现有事实分散在沙箱策略、命令分级、路径守卫、审批记录和责任链代码中。

本合同的目标是补齐“安全控制面”的生产资产来源链，而不是重新设计权限系统。目录只登记稳定的内置安全规则和决策流程；用户自定义规则、审批记录、当前执行模式和每次工具调用结果继续属于用户 / 运行时数据。

## 2. 功能目标（What）

1. 新增 `permission-policy` / `sandbox-policy` 相关资产，登记现有三级沙箱、命令安全分级、路径保护边界、权限责任链、审批流程和有效沙箱推导。
2. 每项资产具有稳定 key、真实 source、版本、自动 fingerprint、ownership、status，并在有跨资产因果关系时记录 dependencies / derivedFrom。
3. Debug「提示词管理器」可以按“权限与沙箱”筛选和查看这些生产安全资产，显示来源、版本、指纹、依赖、结构化规则摘要和只读状态。
4. 资产内容必须从现有生产常量、规则表、纯函数或稳定决策函数生成；注册表不能复制一套会被运行时使用的权限配置。
5. Debug 目录明确区分“内置安全策略”和“当前运行时证据”：当前 executionMode、用户 permissionRules、ApprovalStore 命中、实际决策链和工具调用结果应由运行视图展示，不伪装成静态内置资产。
6. Playground 本期不编辑生产权限策略，不提供绕过权限的实验入口；未来如需实验，只能显式载入隔离草稿并保留真实权限门禁。

## 3. 技术方案（How）

### 3.1 资产分类与稳定 key

建议登记以下稳定资产（最终 key 以实现前复核为准）：

```text
sandbox-policy:modes
permission-policy:decision-chain
permission-policy:command-safety-grading
permission-policy:path-boundaries
permission-policy:approval-flow
sandbox-policy:effective-mode
```

资产内容只包含：

- 沙箱档位及其允许边界
- 权限责任链顺序与决策来源
- 命令分级、危险命令不可绕过约束
- 工作区、受保护目录和路径校验边界
- session / persistent 审批的生命周期与超时拒绝规则
- executionMode 到有效 SandboxMode 的纯函数映射
- 生产模块来源、依赖和版本指纹

### 3.2 事实源

注册表应直接读取或调用以下生产事实：

- `electron/main/sandbox/policy.ts`：`SandboxMode`、`buildPolicy`、受保护路径和网络边界
- `electron/main/sandbox/permission-engine.ts`：规则类型、动作、决策来源和责任链顺序
- `electron/main/sandbox/exec-policy.ts`：命令安全分级、白名单 / 黑名单和危险命令判定
- `electron/main/sandbox/command-guard.ts`：命令路径边界与审批分支
- `electron/main/sandbox/file-path-guard.ts`：文件路径保护和工作区边界
- `electron/main/sandbox/approval-store.ts`：审批记录类型、有效期和清理规则（不读取具体审批记录）
- `electron/main/sandbox/effective-sandbox.ts`：executionMode 到有效沙箱的映射

如果现有实现把稳定规则写成局部变量，应先将其以导出常量或纯函数形式暴露；不得在 registry 中重新手写另一套阈值、正则或分支逻辑。

### 3.3 Debug / Playground / Settings 边界

- **Debug**：展示内置策略定义、来源、版本、指纹、依赖和当前运行时决策的关联；生产资产只读。
- **Playground**：只展示权限确认、拒绝、超时等隔离夹具；不得绕过真正的权限引擎，也不直接写入生产规则。
- **Settings**：继续承载用户自己的 permissionRules、默认执行偏好和可视化编辑器；这些用户资产不进入 builtin 资产目录。
- **运行记录 / 世界态**：展示具体工具调用、命中的 rule、审批结果和决策链证据；不与静态资产混为一类。

## 4. 影响范围评估

- 共享类型：扩展 `ModelContextAsset` 的分类 / 类型标签，必要时增加权限与沙箱资产的结构化内容类型。
- 主进程：新增权限 / 沙箱资产注册表，接入 `electron/main/debug/model-context-assets.ts`。
- Debug UI：增加“权限与沙箱”分类、资产类型标签和只读详情；结构化策略禁止载入 Prompt 实验副本。
- 测试：覆盖 key 唯一性、事实源一致性、决策链顺序、沙箱边界、无用户审批正文、统一目录聚合和 UI 分类。
- 文档：更新权限模块卡、架构、质量、进度、changelog、施工合同索引；若形成新的暂缓项同步 wishlist。
- 不改：权限责任链的实际顺序、用户规则语义、审批数据库 schema、OS 级沙箱、Python 嵌入沙箱和工具执行权限。

## 5. 实施步骤

1. 读取并复核权限 / 沙箱模块的稳定事实，标出可直接导出的常量和纯函数；先补测试保护现有行为。
2. 建立权限 / 沙箱策略注册表，生成只读结构化资产，确保不读取用户规则与审批记录正文。
3. 扩展统一生产资产类型和 Debug 分类，接入注册表，并禁止结构化权限资产载入 Prompt 实验。
4. 补充单元测试与 UI E2E，验证目录来源链和运行行为未回归。
5. 更新权限模块卡、架构 / 质量账本与本合同状态；按项目门禁完成自审、测试、build、commit 和 push。

每一步都必须能独立验证；如果发现需要改变权限行为，应停止并另立施工合同，不在本合同中扩大范围。

## 6. 风险与权衡

- **事实漂移风险**：注册表若复制规则会与运行时分叉，因此必须从生产导出事实生成，并用测试锁定来源一致性。
- **安全误解风险**：Debug 展示策略不等于用户可以修改策略；UI 必须清楚标记 builtin / user / runtime 边界。
- **敏感信息风险**：规则模式和路径摘要可能暴露环境细节；不得输出 token、密码、完整用户路径或审批历史正文。
- **范围膨胀风险**：本合同不包含 OS 级强隔离、Python 沙箱、权限编辑器重做、Eval Case / Grader 注册或 Provider 注册。OS/Python 强隔离由 DEC-037 明确不排期；其余能力若需要应另立施工合同。
- **行为回归风险**：权限系统是 fail-closed 安全控制面，任何目录接入都不能改变原有拒绝、确认和超时语义。
