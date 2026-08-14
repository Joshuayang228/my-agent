# Skill 管理器 2.0 施工合同

> 状态：已落地（2026-08-14）
> 统一称呼：施工合同

## 1. 需求背景（Why）

当前 Skill 已具备加载、CRUD、版本快照、回滚和模型可见目录展示能力，但能力分散：

- Skill 编辑页能创建、编辑、删除和刷新，却没有展示历史版本与回滚入口；
- 后端已有版本快照，但前端无法使用；
- Frontmatter 解析失败、工具引用错误和命名冲突缺少面向开发者的校验反馈；
- Debug 能看静态 Skill 内容，但看不到一次真实调用中的激活原因、注入正文和 Skill 工具链路；
- Skill 缺少不写设置、不写真实会话的隔离试跑入口。

Skill 是会改变 Agent 行为和工具使用边界的生产资产，需要像 Prompt 一样具备可审阅、可回滚、可隔离验证和可追踪的管理闭环。

## 2. 功能目标（What）

本阶段实现 Skill 管理器 2.0：

1. 在 Skills 管理页展示历史版本、查看版本内容并安全回滚；
2. 保存前执行 Frontmatter、名称、工具引用和正文完整性校验，返回用户可读错误；
3. 提供 Skill 隔离试跑，实验内容只进入一次隔离模型调用，不写设置、不写真实会话、不覆盖生产文件；
4. 在 Debug LLM 调用详情中展示本次请求实际激活的 Skill、激活工具、来源、版本和注入状态；
5. 保持职责边界：Debug 负责生产真相只读观察，Skills 管理页负责用户资产编辑，Playground 只接收显式实验副本；
6. 保留后续扩展位：Skill Eval、差异审阅、导入导出不在本阶段实现，写入 wishlist 防遗忘。

## 3. 技术方案（How）

### 3.1 数据与校验

- 扩展 `SkillDefinition` 与共享 IPC 返回类型，保留现有 `source`、`filePath`、`version` 和 Frontmatter 字段。
- 在 `electron/main/skills/loader.ts` 增加纯函数式校验结果：错误码、字段、中文消息；保存和试跑入口共用校验器。
- 工具引用校验读取当前 `ToolRegistry` 的名称集合；Skill 自身激活工具名由统一 `getSkillToolName` 生成。
- 历史版本继续使用用户目录下的 `.versions/vN.md`，保留最近 10 版；回滚仍复用保存流程，先备份当前内容再写入目标版本。

### 3.2 IPC

新增或扩展以下能力，并同步共享类型、preload、主进程 handler、`src/vite-env.d.ts`：

- `skills:validate`：校验待保存内容，不写文件；
- `skills:versions`：返回版本号、时间和当前版本信息；
- `skills:version-content`：读取指定历史正文；
- `skills:rollback`：确认后回滚并重新加载；
- `skills:playground-run`：以显式实验内容执行一次隔离模型调用；
- `debug:llm-calls` 的请求详情扩展 Skill 激活追踪字段（兼容旧记录）。

### 3.3 Skill 激活追踪

- Skill 激活工具执行时生成可关联的 Skill trace：名称、版本、来源、工具名、激活原因和注入正文指纹；
- 真实 LLM 调用的 `requestExtra` 只保存必要的来源与指纹元数据，最终正文仍以该请求的 Messages / Tools 为事实源；
- 用户 Skill 和外部内容不做中文化，不把用户 Skill 正文复制进生产 Prompt 注册表。

### 3.4 UI 边界

- `src/components/SkillsPanel.tsx`：列表、详情、编辑、校验、版本抽屉、回滚确认、隔离试跑；
- `src/components/debug/PromptManagerPanel.tsx`：继续只读展示模型可见 Skill 资产和来源，不增加生产编辑；
- Playground 不新增 Skill 生产目录，只接受从管理页显式载入的实验草稿。

## 4. 影响范围评估

### 破坏性

- 不改变现有 Skill 文件格式；
- 不改变 Skill 工具名生成规则；
- 旧版本 IPC 调用保持兼容；
- 历史 LLM 调用缺少 Skill trace 时按“无记录”展示，不删除历史数据。

### 测试

- Skill frontmatter / 工具引用 / 空正文校验单测；
- 版本保存、列出、回滚和超 10 版清理单测；
- Skill 隔离试跑不写设置、不写会话的单测；
- Skill 激活 trace 和旧日志兼容单测；
- Skills 管理 UI 的创建、校验失败、版本查看、回滚、隔离试跑 E2E；
- Unit、TypeScript、Vite Build、UI E2E 全量门禁。

### 文档

- 更新 `docs/modules/agent-runtime.md` 的 Skill 已落地能力和现状；
- 更新 `docs/architecture.md` 的 Skill 数据流与观测边界；
- 更新 `docs/quality.md` 的 Skill 校验与追踪门禁；
- 更新 `docs/changelog.md`、`docs/progress.md`；
- Skill Eval、差异审阅、导入导出写入 `docs/wishlist.md`。

## 5. 实施步骤

1. 盘点现有 Skill loader、IPC、SkillsPanel、LLM Debug 数据契约，补齐共享类型；
2. 实现 Frontmatter / 工具引用校验，并将保存流程改为先校验后写盘；
3. 暴露版本历史、版本正文、回滚能力，完成前端版本管理交互；
4. 接入隔离试跑，复用统一 LLM 配置和 Prompt 追踪，不产生生产副作用；
5. 接入 Skill 激活 trace，并在 Debug LLM 调用详情展示；
6. 补单测、UI E2E、文档和 wishlist，执行完整门禁；
7. commit + push。

## 6. 风险与权衡

- **版本文件不是数据库**：继续使用 `.versions`，减少迁移；代价是版本元数据简单，只记录序号和文件时间。
- **校验不能替代模型判断**：本阶段只保证结构、工具引用和基本完整性，不判定 Skill 行为质量；行为质量留给后续 Skill Eval。
- **隔离试跑不等于真实会话**：试跑使用实验内容和独立请求，Debug 必须明确标记“实验调用”，避免误认为生产结果。
- **动态激活正文不进入静态目录指纹**：只记录来源、版本和正文指纹，隐私内容仍以真实调用详情为准。
