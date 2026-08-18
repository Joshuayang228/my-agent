# Sidebar 导航基线 v2 施工合同

> 状态：已完成施工快照（冻结，2026-08-18）
> 生命周期：已完成施工快照（冻结）；开发入口位置已完成 P1 回流，原“二级页收起 / Secondary Nav 恢复入口”候选被后续人工验收否决，剩余 Playground 精修转由 `playground-page-baseline-polish-v1.md` 继续。
> 统一称呼：施工合同

## 1. 需求背景（Why）

上一轮把 Debug / Playground 上移到新对话下方，虽然避免了底部挤压，但占用了会话首屏的稳定空间；用户希望开发入口回到产品区上方的固定底部位置。Primary Sidebar 单独暴露“记忆”也与设置 / 工具二级导航重复。另一个真实缺口是：在记忆等二级页面收起 Primary Sidebar 后，Chat 专属顶栏不渲染，页面没有重新展开入口。

本轮严格执行 Playground → 用户确认 → 生产回流。Phase P0 不改变正式产品行为。

## 2. 功能目标（What）

1. Debug / Playground 固定在正式 Sidebar 底部“产品”区上方；Playground 与正式页面已同步。
2. Primary Sidebar 产品入口曾候选只保留“人物世界 / 设置”；记忆入口归入设置。
3. 曾增加“二级页面”候选场景；后续人工验收明确否决 Secondary Nav，不进入生产。
4. 正式 `App.tsx`、`PrimarySidebar.tsx` 的其它默认行为保持不变；本轮只回流开发入口位置。
5. 把 UI 两阶段施工硬门写入 `AGENTS.md`，防止再次越过 Playground 直接改生产 UI。

## 3. 技术方案（How）

- 只修改 `SurfaceBaselinePanel.tsx`：继续复用正式 `PrimarySidebar` / `MemoryPanel`，通过 Playground-only wrapper、静态 fixture 和作用域样式展示候选布局。
- 候选样式只在 `.playground-sidebar-candidate` 下生效：视觉上把开发入口固定到产品区上方、隐藏产品区“记忆”入口并调整为两列。
- 曾新增“二级页收起”视口验证恢复入口；后续人工验收否决该 IA，候选由新合同删除。
- Renderer E2E 只验证 Playground 候选态；不修改当前生产 Sidebar 的断言。
- 用户确认后再另行执行 P1：修改正式壳层、补生产 E2E、更新模块卡 / Changelog 并冻结本合同。

## 4. 影响范围

- Phase P0：`AGENTS.md`、Playground 页面组合、Renderer E2E、施工合同与规则反馈。
- Phase P1 已回流：正式 Primary Sidebar 的开发入口位置、生产 E2E 和模块卡。
- 后续 P0：主侧栏记忆入口、区块标签和底栏组合态由 `playground-page-baseline-polish-v1.md` 继续验收。
- 不改：会话、记忆数据、LLM、IPC、主进程、Prompt、真实设置写盘。

## 5. 实施步骤

1. 已在 Playground Chat 壳中展示底部开发入口、产品入口候选。
2. 曾加入“二级页收起”交互；后续人工验收明确否决，未回流生产。
3. 已完成浅色 / 深色、标准 / 窄宽截图与 Renderer E2E。
4. 用户已明确确认开发入口位置。
5. 已将开发入口位置回流正式 Sidebar；剩余 IA 变化转交新合同，本合同冻结。

## 6. 风险与权衡

- Playground-only 作用域样式只表达候选视觉顺序，不作为最终生产实现；正式回流时应按组件结构重排，不能把绝对定位直接复制到生产。
- “记忆放进设置”只调整入口归属，不删除 MemoryPanel 或记忆模块。
- Secondary Nav 恢复入口属于当时的探索假设，已被后续人工验收否决。

## 7. Phase P0 验收标准

- Playground 中 Debug / Playground 位于产品区正上方且不随会话列表滚动；
- 产品区只显示人物世界和设置；
- 原“二级页收起”场景已完成探索但被后续验收否决；
- 正式生产页面行为与本轮开始前一致；
- 用户明确给出是否回流的结论。
