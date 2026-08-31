# Playground 记忆与设置关系旅程 v1 施工合同

> 状态：已完成施工快照（冻结）
> 生命周期：已完成施工快照（冻结）；本合同记录上一阶段“记忆 → 设置 → Chat”关系连线，当前更完整的记忆边界由 `memory-world-boundary-v2.md` 指导。
> 建立日期：2026-08-31
> 统一称呼：施工合同

## 1. 需求背景（Why）

当前 Playground 已经可以从人物世界进入记忆、再进入设置，但只是几个页面互相跳转。用户看不出：为什么这条记忆在这里、它会怎样影响和伙伴的相处、什么时候应该去设置，以及改完后怎么自然回到聊天。

若继续把记忆当作无来源的列表，或把设置当成和关系无关的后台，会削弱人格化产品最重要的连续感。本轮以 Alice 的“记忆按职责分层、可被用户理解和修正，内部检索机制不污染日常体验”原则为参考，先在隔离 Playground 建立可验收的关系闭环。

## 2. 功能目标（What）

用户故事：

```text
Chat / 人物世界
→ 看到有意义的关系内容
→ 查看记忆
→ 理解这条记忆为何存在、会如何影响后续相处
→ 必要时纠正记忆
→ 进入设置调整长期相处方式
→ 回到 Chat
```

本轮候选必须解决四件事：

1. 记忆为什么出现：每条 Playground fixture 记忆显示可理解的来源。
2. 记忆如何被理解：显示简短的后续相处影响，不暴露 Prompt、向量、召回分数或模型提取等内部词。
3. 设置什么时候介入：从记忆页进入设置时，直接落到「记忆」分区，用户能继续回到记忆面板。
4. 用户如何安全返回：设置候选保留明确的「回到 Chat」路径，且始终处于 Playground 隔离状态。

候选场景固定为：

```text
关系证据 / 空态 / 敏感项 / 纠正记忆
```

## 3. 内容与交互边界（What not）

- 本轮不重构生产记忆数据模型、自动提取、向量检索、Prompt、Runtime、IPC 或真实设置保存。
- 不把朋友圈自动转换为记忆；仅用明确标注为 Playground fixture 的静态关系来源。
- 不实现记忆图谱、全量时间线或“模型如何推理”的后台说明。
- 不访问、写入或删除真实记忆；候选编辑、保存和删除只更新 Renderer 内存 fixture。
- 不改变正式 `MemoryPanel`、`SettingsPanel` 的默认入口、默认分区或既有写入路径；所有行为变化都必须由显式 preview props 开启。

## 4. 技术方案（How）

### 4.1 记忆候选

- `MemoryPanel` 新增仅供 Playground 使用的 `previewEvidence` 和 `previewEditable` 显式 props。
- `previewEvidence` 以记忆 ID 映射「来源 / 后续相处影响」；它只在传入 `previewMemories` 的隔离状态展示。
- `previewEditable` 开启时，编辑和删除只更新组件内部 state；不调用 `window.electronAPI`。候选只支持“纠正记忆”所需的局部操作，不开放无目的的添加入口。
- Playground Footer 使用用户语言说明“这些是隔离样张”，不复述生产内部注入机制。

### 4.2 设置候选

- `SettingsPanel` 新增 `previewInitialSection`，且仅在 `preview` 下应用，保证正式默认仍为「通用」。
- Playground Settings 场景增加「记忆管理」候选：显式传入 `previewInitialSection="memory"`，并让「打开记忆面板」真正返回 Playground 记忆页。
- 现有「设置 / 角色架」只是 Playground 场景切换，不能成为正式 Settings 的新一层导航。

### 4.3 旅程编排

- `MemorySurface` 的「去设置」切换到 `memory-management` 场景，再导航到设置面。
- `SettingsSurface` 的「回到 Chat」始终回到 Playground Chat；记忆分区的「打开记忆面板」回到 Playground Memory。
- 所有 fixture、场景状态和导航保持在 Renderer；不得读写真实会话、设置、伙伴或记忆。

## 5. 影响范围评估

| 范围 | 处理 |
|---|---|
| Playground 记忆 / 设置旅程 | 修改，作为本轮唯一产品候选范围 |
| `MemoryPanel` | 仅增加显式 preview 能力；生产默认行为不变 |
| `SettingsPanel` | 仅增加显式 preview 初始分区；生产默认行为不变 |
| Renderer E2E | 修改，验证关系证据、局部纠正、记忆设置落点与返路 |
| 生产 UI、Prompt、Runtime、IPC、持久化 | 不修改 |

风险与控制：

- **候选逻辑渗入生产**：所有新分支以 `previewMemories` / `preview` 显式 props 为前提，并用 E2E 验证正式路径未被替换。
- **关系说明变成技术说明**：只显示「来自」和「之后会」，禁止出现向量、Prompt、召回、模型等词。
- **编辑态看似可用但无反馈**：编辑保存必须在内存 fixture 中真实更新；切换场景后恢复静态 fixture，避免伪装持久化。

## 6. 实施步骤与验收

1. 建立合同与 Playground fixture 的关系证据映射；验证每个默认 fixture 有来源和影响。
2. 实现 `MemoryPanel` 的隔离证据与内存编辑能力；验证生产未传 preview props 时仍走现有 IPC 路径。
3. 实现 `SettingsPanel` 的 preview 初始分区和 Playground「记忆管理」场景；验证能在记忆和设置间来回。
4. 更新 Renderer E2E：验证证据、禁用内部术语、编辑保存、敏感项、设置落点、回到 Chat。
5. 运行自审、Unit、类型、build、E2E、资产与文档门禁；截图检查窄宽、深浅主题和交互。

## 7. 完成判定

- Playground 默认记忆场景显示可理解的来源与后续相处影响。
- 「纠正记忆」场景可以实际编辑、保存并在当前隔离会话内看到结果。
- 「敏感项」保留原因和可控操作，不泄漏或模拟真实敏感数据。
- 从记忆进入设置时，Settings「记忆」分区被选中；能回到记忆，再回到 Chat。
- 正式页面默认行为、真实数据和任何 IPC 均未被 Playground 候选触发。
