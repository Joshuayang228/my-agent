# 施工合同：Skills Playground 详情与文件预览 v1

> 状态：进行中
> 生命周期：进行中
> 范围：P0 Playground 候选；不修改正式 Settings、Skill IPC、生产存储或真实 Skill 内容。
> 关联：`docs/requirements/settings-information-architecture-v1.md`、`docs/requirements/skill-management-2.md`

## 1. 需求背景（Why）

当前 Skills 候选把名称、用途、来源、作用范围、启用动作和版本信息堆在同一条卡片里，用户无法判断主任务。Skills 页面首先应该帮助用户决定“哪些 Skill 可以被伙伴使用”，需要的详细信息则应在用户主动查看时出现。

## 2. 功能目标（What）

1. Skills 列表只呈现 Skill 名称和启用开关。
2. 列表行不承载重复的“启用 + 名称”文案，不嵌套第二张开关卡片。
3. 名称打开对应详情；标题与开关同行，先展示触发条件，再展示描述，元信息和文件放在下方。返回使用基础 ArrowLeft 图标。
4. 覆盖单个列表、多个列表和详情审阅等隔离状态。

## 3. 技术方案（How）

- `SettingsExperienceCandidate.tsx` 维护隔离启用状态和选中 Skill；不调用 `window.electronAPI`。
- 列表使用独立卡片，每张只保留名称和纯开关；点击名称查看对应详情，返回后保留独立开关状态。
- 详情、文件树与内容预览作为独立 Playground 状态样张存在，不与默认列表同屏；默认列表仍只验证名称与纯开关。
- 用户指定采用真实 Skill 样张：候选文件仅通过 `?raw` 导入内置 `code-review`、`content-creator` 两个 SKILL.md，不复制正文、不扫描生产目录。现有 js-yaml 读取 name / when_to_use / description / author / version；缺失作者显示“未声明”。
- 完整源文件作为只读文本预览；不虚构其他文件、不执行正文、不增加工具或确认约束摘要。

## 4. 影响范围评估

- 破坏性：删除旧 Skills 候选中的描述、标签、版本行、详情展开和隔离试跑入口；这些是用户明确要求从主候选中移除的混杂层级。
- 测试：验证真实全文一致性、独立开关、详情状态与返回保留、触发条件顺序、标题开关对齐及深浅主题窄宽截图。
- 文档：同步本合同、`docs/progress.md` 与 `docs/changelog.md`；正式 Skill 管理能力不变。

## 5. 实施步骤

1. 新增本施工合同并明确列表 / 详情边界。
2. 重构 Skills 候选为极简列表，并提供与默认列表分离的详情审阅样张。
3. 更新隔离 E2E 断言，覆盖列表减法、多个 Skill、详情元信息和文件预览。
4. 执行类型检查、单测、构建、文档和差异门禁。
5. 通过验证后提交并推送。

## 6. 风险与权衡

- 极简列表降低理解成本；版本和作者保留在独立详情样张，避免普通用户被元数据打断。
- 只读样张来自两个指定内置文件；正式 Skill 管理仍由原有管理页和 IPC 负责，Playground 不写生产状态。
- 详情采用 Playground 状态样张而非新增 Settings 一级入口，避免把每个 Skill 变成持久导航项。
