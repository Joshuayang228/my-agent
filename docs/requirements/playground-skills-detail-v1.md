# 施工合同：Skills Playground 详情与文件预览 v1

> 状态：进行中
> 生命周期：进行中
> 范围：P0 Playground 候选；不修改正式 Settings、Skill IPC、生产存储或真实 Skill 内容。
> 关联：`docs/requirements/settings-information-architecture-v1.md`、`docs/requirements/skill-management-2.md`

## 1. 需求背景（Why）

当前 Skills 候选把名称、用途、来源、作用范围、启用动作和版本信息堆在同一条卡片里，用户无法判断主任务。Skills 页面首先应该帮助用户决定“哪些 Skill 可以被伙伴使用”，需要的详细信息则应在用户主动查看时出现。

## 2. 功能目标（What）

1. Skills 列表只呈现 Skill 名称和启用开关。
2. 点击名称进入独立详情态，不在列表条目内嵌套详情卡片。
3. 详情展示版本、内容摘要、作者、来源和启用状态。
4. 详情提供 Skill 文件树，默认预览 `SKILL.md`，点击文件切换内容。
5. 详情展示使用范围：触发场景、允许工具和确认要求。
6. 覆盖空态、单个列表、多个列表和详情文件切换等隔离状态。

## 3. 技术方案（How）

- 仅修改 `SettingsExperienceCandidate.tsx` 中的 Renderer fixture；不调用 `window.electronAPI`。
- `CapabilityPage` 在 `mode === 'skills'` 时维护 `skillsView: 'list' | 'detail'`、当前文件和启用状态。
- 列表使用扁平行结构；名称是进入详情的按钮，开关是唯一直接管理动作。
- 详情使用页面级返回按钮和两栏布局：左侧文件树，右侧内容预览；窄屏改为上下布局。
- 文件内容为隔离样张，不复制生产 Skill 资产目录；不展示真实路径、密钥或生产配置。

## 4. 影响范围评估

- 破坏性：删除旧 Skills 候选中的描述、标签、版本行、详情展开和隔离试跑入口；这些是用户明确要求从主候选中移除的混杂层级。
- 测试：更新 Skills Playground E2E，验证列表减法、详情元信息、文件树切换和返回列表。
- 文档：同步本合同、`docs/progress.md` 与 `docs/changelog.md`；正式 Skill 管理能力不变。

## 5. 实施步骤

1. 新增本施工合同并明确列表 / 详情边界。
2. 重构 Skills 候选为极简列表和详情态。
3. 更新隔离 E2E 断言，覆盖主要交互和文件切换。
4. 执行类型检查、单测、构建、文档和差异门禁。
5. 通过验证后提交并推送。

## 6. 风险与权衡

- 极简列表降低理解成本，但版本和作者必须通过详情态保留，否则高级用户无法审阅 Skill 来源。
- 文件预览先使用固定 fixture，只验证信息架构与交互；真实 Skill 载入仍由正式管理页和后续 IPC 合同负责。
- 详情采用页面内状态而非新增 Settings 一级入口，避免把每个 Skill 变成持久导航项。
