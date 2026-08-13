# docs/requirements/ — 施工合同索引

> **统一称呼：施工合同**（勿称需求文档 / 需求合同 / 开工合同）。  
> **只放**开工前对齐 Why/What/How/验收的合同；完工后标已落地，作长期不变量参照。  
> **不是**能力清单——「有什么」见各 [`../modules/`](../modules/) 模块卡的「已落地能力」节。  
> **不是**文档体系说明——见 [`../docs-system.md`](../docs-system.md)。  
> **不是**暂缓评估 / 历史批次——评估见 [`../deferred/`](../deferred/)；已完成批次见 [`../../_archive/docs-legacy/`](../../_archive/docs-legacy/)。

## 怎么放文件

| 类型 | 含义 | 处置 |
|------|------|------|
| **进行中** | 仍指导未完成施工 | 保留；改行为时同步改文 |
| **已落地** | 主线已通，仍作长期不变量/验收参照 | 保留；文首标「已落地」；细节以代码为准 |

不要把灵感写进本目录（去 `wishlist.md`）；不要把进度写进本目录（去 `progress.md`）；不要把文档元规则、可行性评估、已完成工程批次写进本目录。

---

## 已落地（长期参照）

| 文档 | 说明 |
|------|------|
| [companion-character-profile-world.md](./companion-character-profile-world.md) | 小航候选：档案/世界结构已接入，人物故事内容待定；旧状态不迁移 |
| [chat-right-dock.md](./chat-right-dock.md) | Chat 右侧能力坞 Phase 1：文件 / 审阅 / 终端；Debug 覆盖；命令控制台 |
| [debug-llm-call-storage.md](./debug-llm-call-storage.md) | 对齐 Alice 的 LLM Debug 调用记录存储、IPC 同步与侧栏恢复 |
| [playground-component-fitting-room.md](./playground-component-fitting-room.md) | Playground：Alice 壳 + Storybook 思路（Phase 0） |
| [frontend-alice-shell.md](./frontend-alice-shell.md) | 前端壳层对齐 Alice 布局（大气改造 Phase A） |
| [experience-debug-playground.md](./experience-debug-playground.md) | 体验调试 Phase 0：DevPanel 两面 + 工具手测 + Prompt 会话覆盖 |
| [frontend-visual-language.md](./frontend-visual-language.md) | 前端视觉语言 + 设置 IA + Chat 气质（Phase1–3） |
| [companion-world-framework.md](./companion-world-framework.md) | 产品终局：三槽、单活跃、Catch-up、生活世界 |
| [companion-architecture.md](./companion-architecture.md) | 模块边界与依赖方向 |
| [companion-tech-spec.md](./companion-tech-spec.md) | W0–W6 验收与技术方案 |
| [companion-mutable-reflection.md](./companion-mutable-reflection.md) | 自动反思写 MUTABLE（门闸 / 入队 / Settings） |
| [companion-cast-content.md](./companion-cast-content.md) | 三角色文案定位 + 分味剧本/衣柜约定 |
| [companion-protagonist-persona.md](./companion-protagonist-persona.md) | 主角行为人格已进入 Playground / Eval 验收；人物故事待定 |
| [eval-remote-persona-acceptance.md](./eval-remote-persona-acceptance.md) | 已落地：真实/Mock 分层、B02–B07 pass^k 与远程报告 |
| [prompt-chinese-unification.md](./prompt-chinese-unification.md) | 已落地：自有模型可见 Prompt、内置工具 schema 与 Eval Judge 统一为简体中文 |
| [frontend-companion-surfaces.md](./frontend-companion-surfaces.md) | Alice 对照前端表面：生活/工具 IA、P0–P2 验收 |
| [first-run-and-ui-e2e.md](./first-run-and-ui-e2e.md) | 首次配置旅程与 UI E2E 稳定门禁 |

---

## 与模块卡的关系

- 模块卡：横切边界 + 必读文件 +「已落地能力」表  
- 施工合同：大改开工前对齐——**开工前读，完工后标已落地，不删历史合同**
