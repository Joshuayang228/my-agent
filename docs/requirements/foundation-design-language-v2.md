# Foundation Design Language v2 施工合同

> 状态：进行中（2026-08-28）
> 生命周期：Phase P0 Playground 研究与候选施工；未完成人工验收前，不回流正式产品。
> 统一称呼：施工合同

## 1. 需求背景（Why）

当前 Playground 已能展示颜色、主题、圆角、动效和基础组件，但展示方式仍偏“变量目录”：开发者能看到 token 名称，却不容易判断颜色如何用于背景 / hover / pressed / focus，主题是否真正适合产品，也看不出基础组件与成熟设计系统之间的行为差距。继续直接改颜色会让主题、组件和正式页面再次漂移。

本合同把本阶段目标从“增加颜色卡 / 组件卡数量”改为“建立可判断的 Foundation 设计语言”。先在 Playground 建立候选与对照，再由用户选择方向，最后才允许回流正式 UI。

## 2. 研究结论（Research）

本轮研究了 Radix Colors、Ant Design、Primer、Carbon、Mantine、MUI 和 shadcn/ui 的公开设计系统 / 源码资料。只提炼方法，不引入整套依赖或复制其视觉：

- **Radix Colors**：颜色尺度必须绑定使用场景；背景、组件默认 / hover / pressed、边框、低对比文本和高对比文本不能只靠一个泛化 `accent`。其 12 阶模型把色阶与交互角色直接关联。
- **Ant Design**：主题适合按 Seed → Map → Alias 推导；基础色改变时，交互色阶和组件语义应成组变化，而不是逐个散落覆盖。
- **Primer**：基础色、功能语义色、组件色应分层；业务代码应优先引用功能 / 组件 token，不直接引用原始色值。主题 override 只记录差异。
- **Carbon**：动效需要同时记录 duration 与 easing，并区分 standard、entrance、exit；动效应服务于状态变化，不以炫技为目的。
- **Mantine / MUI**：主题不仅是 palette，还应包含 radius、spacing、typography、focus ring、transitions 等共同约束；组件状态应能从主题统一获得。
- **shadcn/ui**：组件源码应由项目拥有、可审阅、可按产品语义改造；注册表可以描述组件与依赖，但不能替代真实实现和使用证据。

## 2.1 审美判断原则（Aesthetic Principles）

本轮把“高级、精致、典雅”转成可验收的界面判断，而不是依赖个人口味：

1. **层级先于装饰**：先通过位置、尺寸、字重、留白和底色建立主次，再使用颜色、边框和阴影；不能用更多颜色掩盖信息层级问题。
2. **关系协调**：页面边界、卡片、控件和文字之间要有一致的对齐线、间距节奏和圆角角色；同一层级不应出现互相竞争的容器。
3. **克制而有重点**：每一屏只保留一个主要视觉重心；辅助信息降低对比度但仍可读，开发者证据通过省略、hover 或渐进披露出现。
4. **内容优先**：背景、材料和阴影只负责建立层级，不覆盖或抢夺正文；装饰不能让用户误判哪些元素可交互。
5. **状态可感知**：hover、pressed、focus、disabled、loading、error 都要有可见但克制的变化；状态不能只依赖颜色，尤其不能只靠红 / 绿区分。
6. **密度有节奏**：长页面通过分组、留白和稳定网格形成节奏；避免把所有内容压成目录，也避免用巨型卡片制造空洞。
7. **动效服从任务**：微交互使用 productive motion；进入、退出和重要反馈才使用更明显的 expressive motion；不使用 bounce、stretch 或突然停止的曲线。
8. **跨主题保持气质**：主题可以改变色温和明暗，但不能改变结构、阅读顺序、交互状态和组件角色。

因此，本轮每个候选主题必须用同一套微型界面比较；每个基础组件必须用同一套状态矩阵比较。只要结构、对齐或信息层级不成立，就算颜色漂亮也不能进入候选回流名单。

## 2.2 本轮持续迭代（2026-08-28）

在首版候选基础上，本轮不增加新的 Playground 工作域或目录层级，重点收口“看起来是否高级、精致、典雅”的界面表达：

- 故事 Tab 从厚重的灰色容器改为轻量横向文字导航，用底部细线表达当前项，减少与内容卡片竞争的边框和底色。
- 主题候选支持明确选择“当前比较方向”，选中卡片有克制的边界反馈；这只是 Playground 内的研究状态，不保存设置、不写入正式主题。
- 设计语言继续保留实际样张和必要的 token 证据，但不再增加说明块、参考库或组件目录入口。
- Foundation 状态检查矩阵继续作为单行辅助信息，不承担导航职责。

本轮验收重点从“元素是否存在”提升为“层级是否清楚、是否有唯一视觉重心、是否能快速比较和选择”。

## 2.3 本轮高级感迭代（2026-08-28）

- Playground 主画布采用极低对比度的主题氛围层，导航、页头、故事块和 token 卡使用统一的浅深节奏；不新增导航层或装饰性组件。
- 故事块从厚重的次级底色改为卡片底 + 细边界 + 克制悬停反馈，隐藏“边缘”标签，把边缘态保留为无障碍文本和 `data-edge` 证据。
- 设计语言的 token 卡统一圆角、边界和轻微悬停层次，颜色样本仍是主视觉，阴影不得替代结构。
- Playground 在窄屏下的导航选择器同步修正为真实 `aside` 结构，保证一级导航仍能横向浏览。

## 3. 功能目标（What）

1. Playground「设计语言」从平级变量展示升级为三类可判断的研究面：颜色角色、主题候选、圆角 / 动效角色；每一面都用层级、对齐、留白和状态反馈作为审美验收条件。
2. 颜色展示必须同时表达：基础层级、交互状态、语义状态和文字对比；不要求一次引入完整色阶到生产 CSS。
3. 主题对照先提供 4 个候选方向：宣纸、曜石、松烟、铜版。候选仅是 Playground 隔离 fixture，不改变 `DESIGN_THEME_ASSETS` 和正式主题。
4. 每个主题候选使用同一套微型产品界面预览：页面底、侧栏 / 次底、卡片、主文本、次文本、主操作、hover / focus、成功 / 警告 / 错误。
5. 圆角展示从“数值”升级为“角色”：控件、卡片、面板、弹层、胶囊；保留自定义滑杆，但滑杆只影响样张。
6. 动效展示同时表达时长、easing、用途和开关；打开时持续播放，关闭时停止，并保留 reduced-motion 行为。
7. Foundation 基础组件继续按交互家族组织；本轮增加统一的成熟度检查矩阵：默认、hover、pressed、focus、disabled、loading / error、窄宽、键盘与 ARIA，并额外检查对齐、密度、层级和状态是否过度依赖颜色。没有真实生产契约的候选继续保持 `playground` 生命周期。
8. Playground 不新增“参考库”或“组件目录”一级入口；研究来源落在施工合同、代码注释和紧凑开发者证据中。

## 4. 非目标（Out of scope）

- 不安装 Ant Design、MUI、Mantine、Radix、Carbon 或 shadcn/ui 作为生产依赖。
- 不直接修改正式产品默认主题、正式组件 API、Chat / 设置 / 人物世界布局。
- 不把候选主题写入生产设计资产注册表，不把候选主题显示为 `adopted`。
- 不为了数量补齐新的业务组件，不引入 Storybook。
- 不在 Playground 复制生产资产目录；候选只允许作为显式、只读、可删除的实验 fixture 存在。

## 5. 技术方案（How）

### 5.1 设计语言数据边界

- `src/shared/design-asset-registry.ts` 继续是正式主题 / 字体资产事实源，本轮不扩充正式主题。
- `src/components/playground/DesignSystemPanel.tsx` 增加明确标注为候选的主题研究数据，只供 Playground 预览；每个候选带稳定 `studyId`、中文名、描述、明暗模式和完整语义色槽。
- 颜色角色采用稳定结构：`surface`、`text`、`interaction`、`semantic`；UI 只展示可帮助判断的角色，不暴露过多内部推导细节。
- 圆角与动效只通过局部状态驱动样张，不写入 `document.documentElement`，不影响正式页面。

### 5.2 Playground 展示结构

```text
设计语言
├─ 颜色
│  ├─ 角色色阶：背景 / 默认 / hover / pressed / border / text
│  └─ 语义色：成功 / 警告 / 危险 / 信息
├─ 主题对照
│  ├─ 4 个主题候选微型界面
│  └─ 当前正式主题的紧凑参考条
└─ 圆角 / 动效
   ├─ 角色化圆角预览 + 自定义滑杆
   └─ duration + easing + standard / entrance / exit 动效预览
```

Foundation 基础组件页不增加新的导航层；只在现有故事格中补统一状态检查标识和成熟组件参考维度。

### 5.3 验证边界

- Unit：候选主题字段完整、颜色角色无重复 key、正式主题注册表没有被候选污染。
- Renderer E2E：设计语言三个 Tab 可切换；候选主题四张卡都渲染同一套预览；圆角滑杆只影响样张；动效开关可停 / 可恢复；Foundation 入口和既有故事不回归。
- 人工：至少检查 `mist` / `dark` 正式主题、窄宽、文本溢出、focus、disabled、reduced-motion。

## 6. 实施步骤

1. 建立本合同并登记研究结论、范围与禁止事项。
2. 在 Playground 实现候选主题微型界面、颜色角色分组、圆角角色和动效 easing 展示。
3. 在 Foundation 基础组件故事中补统一状态检查维度，不改变生产默认实现。
4. 补 Unit / Renderer E2E 与 Playground 文档证据。
5. 用户在 Playground 选择主题方向和 token 角色后，另立回流变更或更新本合同，再进入正式 UI。

每一步都必须能单独验证；本合同完成前不得以候选结果替换正式产品主题。

## 7. 风险与权衡

- 候选主题增多会让选择变复杂，因此固定为 4 个方向，并要求每个方向使用同一套微型界面对比。
- 色阶越细越容易变成“调色板展厅”，因此只展示与真实状态判断有关的角色，不先把所有中间色注册为生产 token。
- 外部组件库的行为规范很成熟，但引入整套库会带来样式、包体和 API 迁移成本；本轮只学习其 token / accessibility / motion 方法。
- 主题候选与正式主题并存会有漂移风险，因此候选只存在于 Playground 文件，正式注册表不改；若未来回流，必须经过用户选择和单独审计。

## 8. 收工标准

- 设计语言不再只是变量目录：颜色、主题、圆角、动效均能通过实际样张判断。
- 主题候选明确标注 Playground 研究性质，不影响正式主题。
- Foundation 组件故事保留现有入口，不新增参考库 / 组件目录层级。
- 相关测试、文档和 `docs:validate` 全部通过；未取得用户确认前不回流生产。


## 9. 研究来源

- Radix Colors：`https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale`
- Ant Design Customize Theme：`https://ant.design/docs/react/customize-theme/`
- Carbon Motion：`https://carbondesignsystem.com/elements/motion/overview/`
- Apple Human Interface Guidelines：`https://developer.apple.com/design/human-interface-guidelines/`
- Apple Layout：`https://developer.apple.com/design/human-interface-guidelines/layout`
- Apple Materials：`https://developer.apple.com/design/human-interface-guidelines/materials`
- Primer Foundations：`https://primer.style/product/getting-started/foundations/`
- Primer Primitives：`https://github.com/primer/primitives`
- Radix Colors source：`https://github.com/radix-ui/colors`
- Ant Design source：`https://github.com/ant-design/ant-design`
- Carbon source：`https://github.com/carbon-design-system/carbon`
