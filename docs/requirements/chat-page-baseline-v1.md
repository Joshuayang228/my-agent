# Chat 页面设计基线 v1 施工合同

> 状态：已完成施工快照（冻结）（2026-08-17）
> 生命周期：已完成施工快照（冻结）；稳定事实已回流 `docs/modules/agent-runtime.md`。
> 统一称呼：施工合同

## 1. 需求背景（Why）

当前暖色纸感主题方向已经成立，但 Sidebar、主画布、欢迎区、顶栏和输入卡视觉权重接近；Codex 分栏或窄窗口下，持久化 Sidebar 允许扩到 420px，会明显挤压对话区。主内容顶栏重复显示左侧已有的角色名，产品入口与 Debug / Playground 开发入口也缺少层级区分。

本轮不换视觉体系、不增加功能，只建立一版可共同标注的 Chat 整页基线，并让正式页面与已确认规则保持一致。UI 收口后转入人物故事和人格 Prompt 调优。

## 2. 功能目标（What）

1. Sidebar 宽度调整为 216–320px，默认 248px；窄窗口下优先保障主对话宽度。
2. 主内容顶栏不再重复显示“小林”等常规角色名；左侧显示会话标题，只有召唤 / 角色错配等异常上下文保留状态提示。
3. Sidebar 底部只保留产品入口；Debug / Playground 固定在会话列表上方，避免窗口变矮或进入开发模式时被挤到底部。
4. 欢迎区减少固定顶部留白，按可用高度居中；三个主要建议与“换个主角”次级入口分层。
5. 输入卡与消息区统一宽度，压缩默认高度与阴影；项目文案改为中文，权限 / 模型 / 发送层级更清楚。
6. `Playground → 设计 → 页面组合 → Chat 壳` 使用正式 Sidebar、正式 token 和正式 class 展示标准 / 窄宽组合态，不连接真实数据。
7. 非 Chat 全页视图不再继承空白会话顶栏；欢迎区主角联动说明使用轻量引用样式。
8. 设置页取消重复的顶部标题 / 保存栏，表单修改后自动保存；未修改 API Key 时继续保护安全存储中的原值。

## 3. 技术方案（How）

- 调整 `src/shared/panel-layout.ts` 的 Sidebar bounds；沿用 `usePersistedNumber` clamp，不新增状态系统。
- 修改 `PrimarySidebar.tsx` 的入口分组与默认宽度；开发入口固定在会话列表上方，产品入口留在底栏，仍使用现有 `ShellView` 和回调。
- 修改 `App.tsx` 的顶栏、欢迎区和输入区展示：Chat 保留会话顶栏，Debug / Playground / 其它全页视图不渲染空壳顶栏；不改变会话、权限、模型和项目选择业务逻辑。
- 升级 `SurfaceBaselinePanel.tsx` 的 Chat story，复用 `PrimarySidebar`；所有交互使用静态 noop，不写真实会话、设置或 LLM。
- 保留 Debug / Playground 独立全页边界，不改变产品 IA。
- `SettingsPanel.tsx` 复用既有 settings IPC，将原手动保存和首次配置例外统一为 800ms 防抖自动保存；失败通过 Toast 提示。

## 4. 影响范围

- Renderer：Chat 壳、Primary Sidebar、Playground 页面基线、Settings 页面。
- 共享布局：Sidebar 持久化边界。
- 测试：panel-layout Unit、Renderer E2E、深浅主题和窄宽人工截图。
- 文档：运行时模块卡、Progress、Changelog；本合同验收后冻结。
- 不改：人物故事、人格 Prompt、世界状态、记忆、主进程、IPC、真实会话数据。

## 5. 实施步骤

1. 已在 Playground Chat story 建立 248px Sidebar、52px Chat 顶栏、居中欢迎区和紧凑输入卡。
2. 已在内置浏览器收集标注：移除非 Chat 顶部空壳、开发入口上移、主角说明改引用样式、设置取消保存栏。
3. 已将确认后的 Sidebar、顶栏、欢迎区、输入卡和设置自动保存规则同步到正式组件。
4. 已补 Renderer E2E，覆盖开发入口顺序、Playground 顶部起点和设置无保存栏。
5. 已更新模块卡和账本，并按收工门禁执行完整验证。

## 6. 风险与权衡

- 旧 localStorage 可能保存大于新上限的 Sidebar 宽度；`usePersistedNumber` 初始化 clamp 会自动收敛到 320px，不做迁移。
- 常规角色名从主顶栏移除，但召唤 / 会话角色错配仍需保留可见状态，避免丢失上下文安全提示。
- 当前先调整结构和层级，不在第一轮同时重做颜色、动效与全部图标，避免难以判断改动效果。

## 7. 验收标准

- 内置浏览器分栏下主对话不再被 Sidebar 挤成细长列；
- 主顶栏不重复显示常规角色名；
- 产品入口留在底栏，开发入口固定在会话列表上方；
- 欢迎区和输入框有清晰主次，中文文案一致；
- Playground story 与正式页面使用相同设计规则；
- Debug / Playground 主内容从顶部开始，不再出现 52px 空白；
- 设置页没有手动保存按钮，字段修改后自动落盘；
- Unit、E2E、Typecheck、Build、docs:validate 通过。
