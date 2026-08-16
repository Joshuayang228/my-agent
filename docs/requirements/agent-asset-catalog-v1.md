# Agent 生产资产目录 v1 施工合同

> 状态：已落地（2026-08-14）
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 统一称呼：施工合同

## 1. 需求背景（Why）

Prompt 注册表已经让生产 Prompt 具备稳定 key、来源、版本、指纹、动态插槽和 Debug 追踪。但伙伴系统仍有一批会影响 Agent 行为的生产资产分散在 Role Pack 文件、世界默认 JSON、场景 Markdown 和生活内容常量中，开发者只能通过最终 Prompt 或世界态间接判断来源。

本合同建立一个统一的只读生产资产目录，第一期只接入“伙伴与人格资产”，为下一阶段的小航主角与默认生活世界激活提供可追踪的来源、版本和运行审阅基础。不把用户记忆记录、运行时世界状态或 API 凭据伪装成生产资产。

## 2. 功能目标（What）

1. 建立可复用的 Agent 资产描述协议，沿用现有 Prompt / Model Context 资产字段，支持稳定 key、资产类型、用途、来源、所有权、版本、指纹、内容形态和状态。
2. 将每个可加载 Role Pack 的伙伴资产纳入目录：角色 manifest、人物 profile、默认世界、角色场景文案；已有 Prompt 注册表资产不重复复制。
3. 将角色生活内容常量纳入目录：衣柜 / 书架 starter 资产，以角色和内容 kind 形成稳定 key；运行后数据库中的用户资产仍归世界态 / 伙伴资产数据，不进入静态目录。
4. Debug「提示词管理器」扩展为生产资产目录视图，开发者可以按“伙伴世界”筛选、搜索、查看正文 / JSON、来源、版本、指纹和运行 / 静态属性；生产资产保持只读。
5. Playground 暂不直接编辑生产资产；本阶段只保留生产资产可被 Debug 识别的边界，为后续“载入为实验草稿”预留来源字段。
6. 目录聚合必须复用真实 Role Pack loader 和生活资产单一事实源，不在 Debug 或 Playground 复制伙伴正文。

## 3. 技术方案（How）

### 3.1 资产模型

- 扩展 `ModelContextAssetType`：`companion-manifest`、`companion-profile`、`companion-world`、`companion-scene`、`companion-life`。
- `ModelContextAsset` 继续作为 Debug IPC 的统一展示契约，伙伴资产使用 `category: 'companion'`；`contentKind` 区分 `schema`、`static` 和 `runtime`，`mode` 区分 `static` 与 `dynamic`。
- key 规则：
  - `companion:<universeId>:<roleId>:manifest`
  - `companion:<universeId>:<roleId>:profile`
  - `companion:<universeId>:<roleId>:world-default`
  - `companion:<universeId>:<roleId>:scene:<display|interact|execute>`
  - `companion:<universeId>:<roleId>:life:<wardrobe|bookshelf>`
- 指纹对实际 JSON / Markdown / starter 常量内容计算；动态场景若由默认派生，source 和 fingerprint 必须明确标记派生来源。

### 3.2 主进程聚合

新增伙伴资产注册 / 聚合模块，调用：

- `listAvailableRoleIds`
- `loadUniverseManifest`
- `loadRolePack`
- `loadRoleProfile`
- `loadRoleWorldDefaults`
- `loadCastScenePrompt`
- 生活资产 starter 的生产常量工厂

`getModelContextAssets` 在现有 Prompt、Tool schema、Skill 聚合后追加伙伴资产。聚合失败的单个可选资产只跳过并记录可诊断错误，不影响已有 Prompt / Tool 目录返回。

### 3.3 Debug / Playground 边界

- Debug 是生产真相：显示所有已加载 Role Pack 的静态伙伴资产，正文来自 loader / 常量，不允许编辑。
- Playground 是隔离实验：本期不增加真实伙伴资产编辑入口；未来载入实验草稿时使用 `derivedFrom` / `source` 关联原资产，不回写生产文件。
- 当前运行时 `companion_role_state`、`companion_assets` 和用户记忆不作为静态生产资产目录项；它们继续由世界态 / 记忆 Debug 查看。

### 3.4 IPC / 类型同步

本阶段复用现有 `debug:model-context-assets`，不新增 IPC channel；同步扩展共享 `ModelContextAssetType` 和前端展示标签，保持 preload / `src/vite-env.d.ts` 类型检查通过。

## 4. 影响范围评估

- 主进程：`companion/identity`、`companion/cast`、`companion/life`、`debug/model-context-assets`。
- 共享类型：伙伴资产类型枚举与统一资产描述字段兼容。
- Debug UI：提示词管理器的分类、资产类型标签、详情展示和空态文案。
- 测试：伙伴资产聚合、稳定 key / 指纹、缺失可选资产、Debug UI 目录展示。
- 不改：伙伴行为 Prompt 正文、用户记忆数据、运行时世界状态 schema、Settings 编辑流程、Playground 生产写入边界。

## 5. 实施步骤

1. 阅读并确认 Role Pack / scene / life starter 的真实加载路径，定义资产 key 和类型映射。
2. 扩展共享资产类型，新增伙伴资产聚合器，复用生产 loader / 常量。
3. 接入 `getModelContextAssets`，为所有可加载角色生成稳定资产目录。
4. 更新 Debug 提示词管理器中文分类、类型标签、详情展示和生产只读说明。
5. 补 Unit / UI E2E，验证不重复 Prompt、不混入运行态、不泄露凭据。
6. 更新模块卡、架构、质量、进度、changelog；执行完整门禁并提交推送。

## 6. 风险与权衡

- Role Pack 当前部分角色缺少 profile / world 文件；这些可选资产不虚构默认正文，只显示 manifest 与已有 scene / life 资产。
- 伙伴资产目录可能展示较多正文；列表只返回有界预览，详情仍遵循 Debug 既有文本预算，避免一次刷新撑大渲染 payload。
- 资产目录只解决“来源可追踪”，不替代真实请求详情；动态世界状态和最终 Prompt 仍以真实 LLM 调用记录为准。
- 本阶段不实现资产编辑、导入导出、版本历史和多语言；这些后续按具体资产类型单独立项。
