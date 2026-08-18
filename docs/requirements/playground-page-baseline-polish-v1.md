# Playground 页面基线精修 v1 施工合同

> 状态：进行中（2026-08-18）
> 生命周期：Phase P0 候选施工；未取得用户明确回流许可前，不改变正式页面默认行为。
> 统一称呼：施工合同

## 1. 需求背景（Why）

页面组合故事已经能复用正式 Sidebar、Right Dock、人物世界和记忆组件，但最新人工验收暴露出七类组合态问题：Toast 关闭按钮横向位置不统一；候选 Sidebar 底栏没有真正贴底；已被否决的工具二级导航仍作为故事存在；“开发 / 产品”区块标签制造了多余噪声；Right Dock 与朋友圈仍显示空态，无法判断真实内容密度；记忆分类按钮在窄宽下图标和文字换行。

本轮只完善 Playground 的页面基线和静态样张。设置中已经存在“记忆”以及“工具 → Skills”，不新增第二套入口或二级页。

## 2. 功能目标（What）

1. Toast 四态在同一故事格内等宽展示，关闭按钮沿统一右边界对齐。
2. Chat / Primary Sidebar 候选中，Debug、Playground、人物世界、设置组成稳定贴底区；不显示“开发 / 产品”标签。
3. 删除“二级页收起”视口和“工具 / 记忆 / Skills”Secondary Nav 候选，不再把记忆或 Skills 作为主侧栏外的独立页面入口。
4. Right Dock 使用静态项目文件树和文件预览样张；不读取真实目录、不调用项目 IPC、不写盘。
5. 人物世界朋友圈使用静态 Moments / Catch-up 样张；不读取真实伙伴状态、不调用 companion IPC。
6. 记忆页面候选中，分类图标、名称与数量保持同一行。
7. 所有候选继续复用正式组件和正式设计 token；新增 preview props 必须可选、只读，且不改变未传 preview 时的生产行为。

## 3. 技术方案（How）

- `SurfaceBaselinePanel.tsx`
  - 移除 `collapsed` viewport、Secondary Nav 和恢复入口故事；只保留标准宽度、分栏窄宽。
  - 使用 Playground-only wrapper / scoped CSS 让正式 `PrimarySidebar` 撑满故事视口、隐藏区块标签、隐藏主侧栏“记忆”按钮并把产品候选调整为两列。
  - 为 Right Dock、WorldHub、MemoryPanel 传入静态夹具；不连接真实会话、文件、伙伴或记忆 IPC。
- `FileBrowser.tsx` / `ChatRightDock.tsx`
  - 增加可选只读文件预览数据入口；存在预览数据时跳过项目 IPC，树点击只读取夹具映射。
- `MomentsPanel.tsx` / `WorldHub.tsx`
  - 增加可选只读朋友圈预览数据入口；存在预览数据时跳过 companion IPC 与角色变更订阅。
- `UiControlsPanel.tsx`
  - 仅在 Toast Playground 故事作用域内统一气泡宽度。
- Renderer E2E 覆盖被删除的二级导航、底栏贴底、标签隐藏、设置内记忆 / Skills、文件样张、Moment 样张、记忆筛选同行和 Toast 右对齐。

## 4. 影响范围

- 修改：Playground 页面组合、系统反馈故事、只读 preview props、Renderer E2E、施工合同与进度文档。
- 不改：正式 Sidebar 默认入口、正式设置 IA、正式记忆布局、真实文件浏览、真实 Moments 数据流、IPC、LLM、Prompt、会话与写盘。
- preview props 仅为 Playground / 测试提供静态数据，未传入时继续沿用当前生产加载路径。

## 5. 实施步骤

1. 冻结旧 Sidebar v2 中已被用户否决的 Secondary Nav 候选，建立本合同作为新的 P0 真相源。
2. 删除二级页故事并收紧 Sidebar 候选布局。
3. 为文件与 Moments 增加隔离 preview 数据入口，接入静态样张。
4. 调整 Toast 与记忆筛选的 Playground-only 视觉候选。
5. 补 Renderer E2E、类型检查、单测、构建、资产与文档门禁。
6. 启动本地 Playground，等待用户明确决定是否回流正式页面。

## 6. 风险与权衡

- 可选 preview props 会进入正式组件类型，但必须通过显式传参才生效；不得依据环境或 URL 隐式切换。
- 静态样张用于验证信息密度，不代表新增真实产品数据或改变现有内容模型。
- Sidebar 标签隐藏和底栏布局先用 Playground 作用域表达；正式回流时应按组件结构实现，不能直接复制脆弱选择器。
- 用户已明确否决 Secondary Nav 候选，因此旧合同中相关目标不再继续施工，避免形成两个相互冲突的活跃事实源。

## 7. Phase P0 验收标准

- Chat 候选只显示“标准宽度 / 分栏窄宽”，不存在“二级页收起”与 Secondary Nav；
- Debug / Playground / 人物世界 / 设置贴近故事视口底部，不显示“开发 / 产品”标签，主侧栏不显示“记忆”；
- Settings 故事可见“记忆”和“工具”，工具页说明 Skills 位于设置内；
- Right Dock 可见静态项目名、文件树和选中文件预览；
- 人物世界可见至少两条静态朋友圈样张；
- 记忆分类图标与文字保持同行；
- Toast 四态关闭按钮右边界一致；
- 真实 IPC 与写盘均未触发，正式页面默认行为未改变；
- 用户在 Playground 实际验收后明确给出是否回流。
