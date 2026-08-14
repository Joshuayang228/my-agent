# 施工合同：Playground 对齐 Alice（组件场 + 运行时试验）

> 状态：**已落地 Phase 0 + Phase 1 + 页面基线**（矩阵加厚 + 多轮试验 + Shell / Surface 组合态；未装 Storybook）
> 日期：2026-08-06  
> 上位：[`methodology/m32-experience-debug-playground.md`](../../methodology/m32-experience-debug-playground.md) · [`experience-debug-playground.md`](./experience-debug-playground.md)（G1–G7 已落地）  
> **壳与目录对照**：`_reference/framework-harness/repos/alice-source/_extract/page-playground-DH91WfGW.js`  
> **思路辅证**：Storybook 社区共识（隔离 / Props 驱动 / 边缘态故事 / 活文档）——**只学思路，不引入 Storybook 工程**  
> 过程纪律：xs_vibe「先建场 · 同步更新 · 只增不删」（不冒充 Alice UI）  
> 路线：**Alice 定壳与目录；Storybook 定组件故事怎么写；实现落在产品内轻量 Playground**  
> 落点：`src/components/playground/` · DevPanel `surface=playground` → `PlaygroundShell`

---

## 0. 三源对齐（别再混）

| 来源 | 我们取什么 | 我们不取什么 |
|------|------------|--------------|
| **Alice Playground / Debug 源码** | Playground 取设计系统、UI **变体矩阵**与隔离试验；Debug 取 Prompt 管理器和真实数据 | 28 tab 博物馆、狼人杀/邮件等产品专属 |
| **Storybook 思路**（知乎文一类） | **隔离性**、Props 驱动、一状态一故事、边缘案例也是故事、组件即文档、先核心后周边 | `npx storybook init`、独立 :6006 站点、CSF/addons/CI 静态站、完整插件生态 |
| **xs_vibe 三条** | 动效先建场、需求同步更新、demo 只增不删 | 「左预览右滑条」冒充 Alice 主形态 |

上一版误把「左预览 · 右参数」当 Alice 主形态——**与源码不符**（教学 demo / Storybook Controls 气质，不是 Alice `components` 页）。

### 0.1 Alice 壳（事实摘要）

- 独立全页；**顶栏横向 tab**；内容默认 `max-w-2xl`  
- 默认 tab：`design-system`  
- UI 控件：从正式 `src/components/ui` 导出，子 tab + **变体并排**（非通用 Controls 面板）  
- Prompt 全量目录属于 Debug；Playground 仅保留隔离的 Prompt / 对话试验
- `chat`：隔离 session（如 `playground-{timestamp}`）

### 0.2 Storybook 思路 → 我们的「轻量故事」规则

痛点认同：在巨型主应用里改按钮要背全项目上下文；集成后样式漂移。解药是**隔离展厅**，不是再挂一套重型构建。

写入工程时可执行的对应物：

| Storybook 概念 | 我们轻量落点（产品内 Playground） |
|----------------|-----------------------------------|
| 隔离性 | 组件故事只跑在 Playground tab；不依赖真会话 / 路由 / 全局业务 store |
| Story（一状态一章） | 矩阵里的一格，或夹具里的一张卡 = 固定 props/状态 |
| Props 驱动 | 优先展示「纯 props / 纯 class」能表达的态；强依赖 Provider 时用薄 Decorator 包一层主题即可 |
| 边缘案例 | 空 / 长文 / loading / disabled / error **必须有故事格**，不只秀 happy path |
| 活文档 | 每格旁标注来源路径；禁止另写一份易过期的 Markdown 组件说明书 |
| 采用状态 | 只给已进入正式产品的故事显示统一小图标；壳层开关统一显示/隐藏并记住选择，不依赖逐项 hover；无图标不分类，不另标实验中、备用或候选 |
| 别贪大 | Phase 0 只覆盖高频核心：按钮样例、输入、工具卡、空态 + 已有错误/确认夹具 |
| Controls 面板 | **不作为 Phase 0**；高变动效再考虑迷你调参（Phase 2），仍不装 Storybook |

**硬禁令**：不新增 `@storybook/*` 依赖；不要求 `npm run storybook`；验收以 App 内 Playground 全页为准。

### 0.3 我们刻意不抄

Alice 产品专属 tab；Storybook 全套；Webhook 实验室等——M32「两周无人用即噪音」。

---

## 1. 需求背景（Why）

已有：Prompt Lab、工具手测、token 色板、精简夹具。缺口：

1. IA 不像 Alice（缺设计系统 / UI 控件等实验室目录）
2. UI 场缺「正式组件 × 多状态故事矩阵」  
3. Chat 专用件常要进真会话才看得见

目标：产品内 **轻量组件展厅 + 运行时试验台**——隔离、可回归、文档即现场；成本 ≪ Storybook。

---

## 2. 功能目标（What）

### 2.1 心智模型

| 层 | 回答 | Alice | Storybook 思路 | 我们 |
|----|------|-------|----------------|------|
| 设计系统 | token 是否可信？ | `design-system` | Design Tokens 场 | 升级 TokensTab |
| UI 故事矩阵 | 各 props 态好不好看？ | `components` | Stories + 边缘态 | **新建**矩阵 |
| 运行时试验 | Prompt/工具/对话？ | `chat`/`tools` | （非 SB 核心） | 保留隔离试验；生产目录归 Debug |
| 体验夹具 | 空态/错误/确认 | `error-card` 等 | 边缘故事 | 保留 Fixtures |
| Debug | 系统现在怎样？ | `/debug` | — | 不动 |

### 2.2 过程纪律（xs_vibe + SB「先核心」）

| # | 规则 |
|---|------|
| 1 | 新交互控件 / 页面动效 → 先出现在 Playground 故事格，再进正式页 |
| 2 | 形态变了 → 同轮更新对应故事格 |
| 3 | 只增不删（可 `archived` 弱化） |
| 4 | 每个核心组件至少：默认态 + 1 个边缘态（空/错/禁用/长文之一） |
| 5 | 已采用图标是单向事实标记；未显示图标的故事保持开放，不附加状态语义 |

### 2.3 Phase

#### Phase 0 — 骨架（本轮）

| ID | 目标 | 验收 |
|----|------|------|
| **A0** | Playground IA | `设计系统` · `UI 控件` · `页面基线` · `对话试验` · `模型测试` · `工具` · `体验夹具` |
| **A1** | 设计系统 | CSS 变量分组；写明「主题 token 可信来源」 |
| **A2** | UI 故事矩阵 | 子区：按钮、输入、工具卡、空态；**正式组件/class**；每区含边缘态格 |
| **A3** | Prompt 边界 | 生产目录进 Debug；Playground 只保留隔离 Lab |
| **A4** | 文档 | guidelines（含 SB 思路 / 禁 Storybook 工程）· M32 · changelog · progress · 模块卡 |

**不做**：`@storybook/*`；DemoHost 主路径；Alice 产品 tab；G8 aside。

#### Phase 1 — 加厚

A5 更多故事格（确认框、记忆芯片、状态条）· A6 设计例外色（若有债）· A7 多轮隔离对话。

#### Phase 2 — 可选

A8 单组件迷你 Controls（高变动效）· A9 M32-G8 aside。

#### 页面基线 — 设计确认层（2026-08-09）

在能力渐进披露之前，新增一层页面级组合态故事，用于先确认 Alice 对齐的壳层比例与视觉语言：

- Chat 壳：身份、状态条、消息流、输入区
- Primary Sidebar：伙伴身份、会话列表、底栏入口
- Right Dock：文件、审阅、终端容器与主区关系
- 人物世界：WorldHub tab 与生活面节奏
- 记忆：MemoryPanel 列表、空态、敏感项与编辑态，静态夹具不读写真实记忆
- 设置：设置分组与详情区密度

页面基线故事格复用正式组件，使用静态 props 隔离真实会话 / LLM / 设置写入；用户确认后才回流正式页面。该层确认的是组合态设计，不提前决定最终产品 IA。

---

## 3. 技术方案（How）

### 3.1 目录

```text
src/components/playground/
  PlaygroundShell.tsx
  DesignSystemPanel.tsx
  UiControlsPanel.tsx      # 故事矩阵（非 *.stories.ts）
  catalog.ts               # tab / 故事 id；只增不删
src/components/debug/
  PromptManagerPanel.tsx   # 模型可见文本统一目录 + 当前装配；生产源只读
DevPanel.tsx
```

不引入 `*.stories.tsx` / `.storybook/`——避免与「未安装 Storybook」混淆；故事就是矩阵里的 React 段。

### 3.2 故事格写法（轻量 CSF 心智，无 SB 运行时）

```ts
// 概念对应，非 Storybook API
type UiStory = {
  id: string           // 稳定 id，只增不删
  title: string        // 如「工具卡 / 执行中」
  edge?: boolean       // 边缘案例标记
  render: () => ReactNode  // 尽量只用 props；需要主题时外层已有 App 主题
}
```

原则：

1. import 正式组件（如 `ToolCallbackList`），禁止复制一份「展厅专用皮肤」  
2. 一格一状态；happy + edge 分开  
3. 格旁标注源码路径  

### 3.3 Prompt 边界

对齐 Alice Debug：生产目录由 `electron/main/prompts/registry.ts` 运行时生成，静态正文直接引用生产常量，Role Pack 从 Identity loader 读取，动态组装项标记 `dynamic`；Debug 只读展示。Playground 的 Lab 仅保留会话级覆盖，文案：*仅当前 Playground 试验有效*。

### 3.4 IA 映射

```text
设计系统 | UI 控件 | 页面基线 | 对话试验 | 模型测试 | 工具 | 体验夹具
```

### 3.5 风险

| 风险 | 缓解 |
|------|------|
| 滑向安装 Storybook | §0.2 硬禁令 + 验收门不查 :6006 |
| 博物馆 | Playground 固定 7 个实验分区 + 精简控件子区 |
| 故事与实装漂移 | 强制 import 正式组件 |
| DevPanel 膨胀 | 抽 `playground/` |

---

## 4. 实施步骤（Phase 0）

1. 确认本合同  
2. `PlaygroundShell` + 顶栏  
3. 设计系统 + UI 故事矩阵  
4. Prompt Lab 保持隔离；生产目录接入 Debug
5. 文档 / 验证门（test · tsc · vite build）  

---

## 5. 决策待拍板

| # | 问题 | 建议 |
|---|------|------|
| D1 | 按本版 Phase 0 开工（Alice 壳 + SB 思路；**不装 Storybook**）？ | **是** |
| D2 | Prompt 目录放哪？ | **Debug；Playground 只留试验** |
| D3 | Skills/MCP 再开 Playground tab？ | **否** |
| D4 | xs_vibe 纪律 +「禁 Storybook 工程」写入 guidelines？ | **是** |

确认：Phase 0 已按 D1–D4 默认落地。后续 Phase 1/2 另开轮次。

---

## 6. Phase 0 落地摘要（2026-08-06）

| 验收 | 落点 |
|------|------|
| A0 Playground 活目录 | `PlaygroundShell` + `PLAYGROUND_TABS` |
| A1 设计系统 | `DesignSystemPanel` |
| A2 UI 故事矩阵 | `UiControlsPanel`（按钮/输入/工具卡/空态 + 边缘格） |
| A3 Prompt 边界 | `PromptManagerPanel` + `debug:model-context-assets`；统一目录留 Debug，Playground 只接收显式实验副本 |
| A4 文档 | guidelines / M32 / changelog / progress / agent-runtime |

### Phase 1 落地摘要（2026-08-06）

| 验收 | 落点 |
|------|------|
| A5 确认/芯片/状态条 | `UiControlsPanel` 子 tab + 共享组件 |
| A7 多轮隔离对话 | `buildPlaygroundMessages.history` · PromptLab transcript |
| 页面基线 | `SurfaceBaselinePanel`（Chat / Sidebar / Right Dock / 人物世界 / 设置组合态） |
| 模块卡 | agent-runtime / memory / permission / companion |

### 实验室加厚（2026-08-10）

| 验收 | 落点 |
|------|------|
| 已采用单向标记 | `AdoptionMark` + `StoryBlock.adopted`；壳层开关统一显隐并持久化；无图标不分类 |
| 主题对照 | 七套生产主题在同页对照结构色、文本与操作色 |
| 组合实验 | 设计系统新增无副作用组合故事；UI 控件新增图标子区与输入/生成动作故事 |
| 页面来源 | 页面基线区分正式组件预览与 Playground 组合故事 |
| 反馈与人格表达 | 正式 Toast 四态 / 长文故事 + MarkdownRenderer aside 默认态 / 边缘态 |
| 记忆页面基线 | 正式 MemoryPanel + 静态只读夹具；列表 / 空态 / 敏感项 / 编辑态 |
