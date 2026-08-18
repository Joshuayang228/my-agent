# Sidebar 导航基线 v2 施工合同

> 状态：进行中（2026-08-18）
> 生命周期：Phase P0 只在 Playground 展示候选态；用户明确确认后才允许回流正式 UI。
> 统一称呼：施工合同

## 1. 需求背景（Why）

上一轮把 Debug / Playground 上移到新对话下方，虽然避免了底部挤压，但占用了会话首屏的稳定空间；用户希望开发入口回到产品区上方的固定底部位置。Primary Sidebar 单独暴露“记忆”也与设置 / 工具二级导航重复。另一个真实缺口是：在记忆等二级页面收起 Primary Sidebar 后，Chat 专属顶栏不渲染，页面没有重新展开入口。

本轮严格执行 Playground → 用户确认 → 生产回流。Phase P0 不改变正式产品行为。

## 2. 功能目标（What）

1. Playground 候选态中，Debug / Playground 固定在底部“产品”区上方。
2. Primary Sidebar 产品入口候选只保留“人物世界 / 设置”；记忆继续通过设置 / 工具二级导航进入。
3. 增加“二级页面”候选场景：收起 Primary Sidebar 后，Secondary Nav 仍显示“展开主侧栏”入口，可恢复双栏。
4. 正式 `App.tsx`、`PrimarySidebar.tsx` 默认行为在用户确认前保持不变。
5. 把 UI 两阶段施工硬门写入 `AGENTS.md`，防止再次越过 Playground 直接改生产 UI。

## 3. 技术方案（How）

- 只修改 `SurfaceBaselinePanel.tsx`：继续复用正式 `PrimarySidebar` / `MemoryPanel`，通过 Playground-only wrapper、静态 fixture 和作用域样式展示候选布局。
- 候选样式只在 `.playground-sidebar-candidate` 下生效：视觉上把开发入口固定到产品区上方、隐藏产品区“记忆”入口并调整为两列。
- 新增“二级页收起”视口场景：复用正式 `MemoryPanel`，Secondary Nav 内提供可点击的 Primary Sidebar 恢复按钮。
- Renderer E2E 只验证 Playground 候选态；不修改当前生产 Sidebar 的断言。
- 用户确认后再另行执行 P1：修改正式壳层、补生产 E2E、更新模块卡 / Changelog 并冻结本合同。

## 4. 影响范围

- Phase P0：`AGENTS.md`、Playground 页面组合、Renderer E2E、施工合同与规则反馈。
- Phase P1（待确认）：正式 Primary Sidebar、App 全页展开入口、设置 / 二级导航、生产 E2E 和模块卡。
- 不改：会话、记忆数据、LLM、IPC、主进程、Prompt、真实设置写盘。

## 5. 实施步骤

1. 在 Playground Chat 壳中展示底部开发入口、两项产品入口候选。
2. 加入“二级页收起”交互，验证收起与重新展开。
3. 运行浅色 / 深色、标准 / 窄宽截图与 Renderer E2E。
4. 等用户明确确认候选态。
5. 获得许可后回流正式页面，补生产测试并冻结合同。

## 6. 风险与权衡

- Playground-only 作用域样式只表达候选视觉顺序，不作为最终生产实现；正式回流时应按组件结构重排，不能把绝对定位直接复制到生产。
- “记忆放进设置”本轮只移除 Primary Sidebar 候选入口，不删除 MemoryPanel、记忆模块或现有二级导航能力。
- Secondary Nav 的恢复入口必须在 Primary Sidebar 隐藏时始终可见，不能依赖 Chat 顶栏。

## 7. Phase P0 验收标准

- Playground 中 Debug / Playground 位于产品区正上方且不随会话列表滚动；
- 产品区只显示人物世界和设置；
- “二级页收起”场景能收起并重新展开 Primary Sidebar；
- 正式生产页面行为与本轮开始前一致；
- 用户明确给出是否回流的结论。
