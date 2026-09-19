/**
 * UI 组件资产注册表。
 *
 * 背景：组件不仅是一段 JSX，还包含行为语义、状态、来源、采用阶段和无障碍约束。
 * 设计意图：让 Playground 能统一发现已采用组件、实验故事与外部 Primitive 候选，避免各页面重复造轮子。
 * 关键约束：注册表只登记身份与证据，不复制组件实现；candidate 不得冒充已安装依赖或已落地能力。
 */

export type UiComponentCategoryId = 'behavior' | 'state' | 'developer' | 'companion' | 'layout'
export type UiComponentStatus = 'candidate' | 'playground' | 'adopted' | 'deprecated' | 'archived'
export type UiComponentImplementation = 'custom' | 'radix-candidate' | 'reference-only'
export type UiComponentLayer = 'foundation' | 'experience'
export type UiAccessibilityStatus = 'verified' | 'needs-review' | 'not-applicable'

export interface UiComponentCategoryDefinition {
  id: UiComponentCategoryId
  label: string
  description: string
}

export interface UiComponentStatusDefinition {
  id: UiComponentStatus
  label: string
  description: string
}

export interface UiComponentAssetDefinition {
  key: string
  labelZh: string
  labelEn: string
  descriptionZh: string
  category: UiComponentCategoryId
  status: UiComponentStatus
  implementation: UiComponentImplementation
  /** foundation 可被产品体验引用；experience 本身是成品或工作台，不能冒充基础。 */
  layer: UiComponentLayer
  sourcePath?: string
  reference?: string
  stories: readonly string[]
  accessibilityNotes: readonly string[]
  accessibilityStatus: UiAccessibilityStatus
}

export const UI_COMPONENT_CATEGORIES: readonly UiComponentCategoryDefinition[] = [
  { id: 'behavior', label: '行为组件', description: '焦点、键盘、浮层和选择行为' },
  { id: 'state', label: '状态反馈', description: '加载、空态、错误和系统反馈' },
  { id: 'developer', label: '开发工具', description: 'Debug、证据、数据和调用链展示' },
  { id: 'companion', label: '伙伴世界', description: '人物身份、关系和生活世界组件' },
  { id: 'layout', label: '布局导航', description: '侧栏、分栏、面板和页面骨架' },
] as const

export const UI_COMPONENT_STATUSES: readonly UiComponentStatusDefinition[] = [
  { id: 'candidate', label: '候选', description: '尚未安装或实现，只记录可能采用的来源' },
  { id: 'playground', label: '实验', description: '已在 Playground 建立故事，但尚未进入正式页面' },
  { id: 'adopted', label: '已采用', description: '已经进入正式产品调用链' },
  { id: 'deprecated', label: '已弃用', description: '保留兼容，但不推荐新代码继续采用' },
  { id: 'archived', label: '已归档', description: '保留历史，不再推荐新代码采用' },
] as const

type UiComponentInput = Omit<UiComponentAssetDefinition, 'accessibilityStatus' | 'layer'> & {
  accessibilityStatus?: UiAccessibilityStatus
  layer?: UiComponentLayer
}

type ResolvedLayer<T extends UiComponentInput> = T extends { layer: infer L extends UiComponentLayer } ? L : 'foundation'

/**
 * 保留 key / layer 的字符串字面量类型，让产品体验依赖在 tsc 阶段即可发现拼写错误。
 * 默认归入 foundation；只有完整页面或工作台需要显式标记 experience。
 */
function component<const T extends UiComponentInput>(definition: T): UiComponentAssetDefinition & T & { layer: ResolvedLayer<T> } {
  return {
    ...definition,
    layer: definition.layer ?? 'foundation',
    accessibilityStatus: definition.accessibilityStatus ?? 'needs-review',
  } as UiComponentAssetDefinition & T & { layer: ResolvedLayer<T> }
}

export const UI_COMPONENT_ASSETS = [
  // 行为组件：先登记候选，不因为进入目录就假装已安装 Radix。
  // 基础控件故事：当前以正式样式和隔离 fixture 建场，尚未回流为独立生产组件文件。
  component({ key: 'behavior.action-button', labelZh: '文字动作按钮', labelEn: 'ActionButton', descriptionZh: '用于恢复、打开和确认等带文字的紧凑动作；固定操作槽并复用语义色。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/ActionButton.tsx', stories: ['强调动作', '中性动作', '禁用态', '窄宽与固定高度'], accessibilityNotes: ['按钮名称直接可见', 'hover/focus/disabled 不改变尺寸', '危险色必须由调用方明确选择'] }),
  component({ key: 'behavior.button', labelZh: '按钮', labelEn: 'Button', descriptionZh: '触发提交、确认、导航和恢复动作的基础控件。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['主要操作', '次要操作', '生成动作', '禁用态', '加载态'], accessibilityNotes: ['按钮名称清楚', '禁用态不能只靠颜色', '加载时保留动作语义'] }),
  component({ key: 'behavior.input', labelZh: '输入框', labelEn: 'Input', descriptionZh: '承载短文本、长文本和搜索输入的基础控件；正式工作区与 Foundation 故事共用 TextField。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/TextField.tsx', stories: ['空值', '有值', '长文', '禁用态', '工作区地址/命令/侧聊'], accessibilityNotes: ['标签与输入关联', '长文不挤出容器', 'IME 组合输入不误提交', 'hover/disabled 不改变外部几何'] }),
  component({ key: 'behavior.icon-button', labelZh: '图标按钮', labelEn: 'IconButton', descriptionZh: '只使用图标表达的紧凑操作按钮；基础层固定操作槽尺寸，业务层提供语义和回调。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/IconButton.tsx', stories: ['默认态', '激活态', '禁用态', '危险操作', '固定尺寸'], accessibilityNotes: ['必须有可读名称', 'Tooltip 只能作为辅助', '不能只靠颜色表达危险操作', 'hover/disabled 不改变宽高'] }),
  component({ key: 'behavior.card', labelZh: '卡片', labelEn: 'Card', descriptionZh: '承载独立信息块的通用容器，不携带业务语义。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['静态卡片', '可交互卡片', '长内容'], accessibilityNotes: ['层级由底色和留白表达', '可交互卡片有完整名称', '不把业务状态伪装成通用卡片'] }),
  component({ key: 'behavior.badge', labelZh: '徽标', labelEn: 'Badge', descriptionZh: '表达短状态或轻量分类的非交互标记。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['状态徽标', '语义颜色', '长文本'], accessibilityNotes: ['文字本身可读', '颜色不是唯一状态线索', '不承载主要操作'] }),
  component({ key: 'behavior.tag', labelZh: '标签', labelEn: 'Tag', descriptionZh: '表达分类或可移除筛选条件的小型芯片。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['分类标签', '可移除标签', '长文本'], accessibilityNotes: ['删除动作有名称', '长文本可截断并保留提示', '选中态与普通态有可读区别'] }),

  component({ key: 'behavior.dialog', labelZh: '对话框', labelEn: 'Dialog', descriptionZh: '需要焦点陷阱和明确关闭语义的模态交互。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: 'Radix Dialog 候选，尚未引入依赖', stories: ['默认态', '高风险确认', '长内容'], accessibilityNotes: ['打开后焦点进入对话框', 'Esc 与遮罩关闭策略必须显式', '关闭后焦点回到触发元素'] }),
  component({ key: 'behavior.popover', labelZh: '弹出层', labelEn: 'Popover', descriptionZh: '依附触发元素的轻量详情或筛选面板。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: 'Radix Popover 候选，尚未引入依赖', stories: ['默认态', '视口边缘'], accessibilityNotes: ['触发器与内容建立语义关系', '处理视口碰撞', '键盘可关闭'] }),
  component({ key: 'behavior.dropdown-menu', labelZh: '下拉菜单', labelEn: 'Dropdown Menu', descriptionZh: '行级更多操作和上下文命令。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: 'Radix Dropdown Menu 候选，尚未引入依赖', stories: ['默认态', '禁用项', '危险操作'], accessibilityNotes: ['方向键导航', '焦点不落到禁用项', '危险操作有明确语义'] }),
  component({ key: 'behavior.workspace-tool-menu', labelZh: '工作区工具菜单', labelEn: 'Workspace Tool Menu', descriptionZh: '在工作区固定操作槽中添加工具实例，统一键盘导航与焦点恢复。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/WorkspaceToolMenu.tsx', stories: ['添加工作区内容', '方向键导航', 'Escape 与失焦'], accessibilityNotes: ['菜单项名称清楚', '方向键循环且 Escape 回到触发器', '选择后焦点回到触发器', '菜单不拥有业务资源'] }),
  component({ key: 'behavior.tooltip', labelZh: '提示浮层', labelEn: 'Tooltip', descriptionZh: '为无文字图标按钮提供低频解释。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: 'Radix Tooltip 候选，尚未引入依赖', stories: ['默认态', '延迟显示'], accessibilityNotes: ['不能替代可见标签', '键盘聚焦时可见', '内容保持简短'] }),
  component({ key: 'behavior.tabs', labelZh: '标签切换', labelEn: 'Tabs', descriptionZh: '同一任务域内切换内容，支持常驻关闭槽和键盘导航。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/TabStrip.tsx', reference: 'Foundation 故事、工作区候选和正式 ChatRightDock 共用 TabStrip；场景控制器独立使用 state-switchers.css。', stories: ['基础标签', '可关闭工作区标签', '文件预览标签', '窄宽与键盘'], accessibilityNotes: ['选中态可被读屏识别', '左右/Home/End 切换，Delete 关闭并恢复焦点', '关闭槽常驻且尺寸固定', '不把页面级导航伪装成 Tabs'] }),
  component({ key: 'behavior.segmented-control', labelZh: '分段选择', labelEn: 'Segmented Control', descriptionZh: '同一内容区域内切换有限模式，不承担页面导航或资源生命周期。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/SegmentedControl.tsx', stories: ['预览/源码', '选中态', '禁用态', '固定操作槽'], accessibilityNotes: ['使用 aria-pressed 表达模式', '选中与普通状态有文字和颜色差异', 'hover/disabled 不改变宽高', '不替代页面级 Tabs'] }),
  component({ key: 'behavior.select', labelZh: '下拉选择', labelEn: 'Select', descriptionZh: '从稳定枚举中选择单项。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/SelectField.tsx', reference: '原生 select，与已确认基础故事同源', stories: ['默认态', '禁用态', '长选项'], accessibilityNotes: ['键盘选择', '标签与控件关联', '当前值可被读屏读取'] }),
  component({ key: 'behavior.combobox', labelZh: '可搜索选择', labelEn: 'Combobox', descriptionZh: '模型、Skill 或角色数量较多时的搜索选择。', category: 'behavior', status: 'candidate', implementation: 'reference-only', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: '仅登记交互需求，尚未选择实现来源', stories: ['空结果', '键盘选择', '长列表'], accessibilityNotes: ['输入与列表语义关联', '高亮项不等于已选择', '空结果需要可读提示'] }),
  component({ key: 'behavior.command', labelZh: '命令面板', labelEn: 'Command', descriptionZh: '跨页面搜索动作和低频命令。', category: 'behavior', status: 'candidate', implementation: 'reference-only', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: '仅登记产品候选，尚未进入当前 IA', stories: ['搜索结果', '无结果', '快捷键入口'], accessibilityNotes: ['不抢占输入法组合状态', '搜索结果键盘可达', '动作范围必须透明'] }),
  component({ key: 'behavior.context-menu', labelZh: '右键菜单', labelEn: 'Context Menu', descriptionZh: '文件、资产和会话的上下文操作。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: 'Radix Context Menu 候选，尚未引入依赖', stories: ['文件操作', '危险操作'], accessibilityNotes: ['必须有非右键替代入口', '键盘菜单键可打开', '不隐藏核心操作'] }),
  component({ key: 'behavior.scroll-area', labelZh: '滚动区域', labelEn: 'Scroll Area', descriptionZh: 'Debug 长内容和资产目录的稳定滚动容器。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: 'Radix Scroll Area 候选，尚未引入依赖', stories: ['长列表', '横向溢出'], accessibilityNotes: ['保留系统滚动能力', '不要阻断触控板', '焦点元素滚入可视区'] }),

  component({ key: 'behavior.form-field', labelZh: '表单字段', labelEn: 'Form Field', descriptionZh: '将标签、控件、辅助说明和错误反馈组合为可读字段。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', stories: ['默认字段', '错误字段', '辅助说明'], accessibilityNotes: ['标签与控件关联', '错误文本可被读屏读取', '辅助说明不只靠占位符'] }),
  component({ key: 'behavior.checkbox', labelZh: '复选框', labelEn: 'Checkbox', descriptionZh: '表达可独立开关的布尔选项。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/CheckboxField.tsx', stories: ['选中', '未选中', '禁用'], accessibilityNotes: ['选中状态可读', '点击文字也能切换', '禁用态不只靠颜色', 'hover 与状态变化不改变尺寸'] }),
  component({ key: 'behavior.switch', labelZh: '开关', labelEn: 'Switch', descriptionZh: '表达即时生效或自动保存类的布尔状态。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', stories: ['开启', '关闭', '即时反馈'], accessibilityNotes: ['暴露 switch 语义', '状态变化有文本或可读名称', '不用于需要提交确认的选择'] }),

  // 状态反馈。
  component({ key: 'state.toast', labelZh: '提示条', labelEn: 'Toast', descriptionZh: '应用内成功、警告、错误和后台任务反馈。', category: 'state', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/Toast.tsx', stories: ['信息', '成功', '警告', '错误', '长文'], accessibilityNotes: ['错误信息不能只靠颜色', '重要消息保留足够阅读时间', '不覆盖关键操作'] }),
  component({ key: 'state.empty', labelZh: '空状态', labelEn: 'Empty State', descriptionZh: '没有数据或尚未开始时的引导。', category: 'state', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['默认态', '窄宽长文'], accessibilityNotes: ['说明为什么为空', '操作入口不应伪造能力', '文本层级清楚'] }),
  component({ key: 'state.error', labelZh: '错误状态', labelEn: 'Error State', descriptionZh: '请求、权限和配置失败时的恢复入口。', category: 'state', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['未配置', '权限拒绝', '上游失败'], accessibilityNotes: ['提供可执行恢复动作', '不暴露内部堆栈', '错误语义可读'] }),
  component({ key: 'state.spinner', labelZh: '加载指示器', labelEn: 'Spinner', descriptionZh: '短时未知进度的加载反馈。', category: 'state', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['生成中', '按钮内加载'], accessibilityNotes: ['补充可读状态文本', '避免无限旋转无说明', '尊重减少动效偏好'] }),
  component({ key: 'state.progress', labelZh: '进度条', labelEn: 'Progress', descriptionZh: '已知进度或阶段任务反馈。', category: 'state', status: 'candidate', implementation: 'reference-only', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: '等待真实长任务进度契约后实现', stories: ['确定进度', '阶段进度'], accessibilityNotes: ['暴露当前值和范围', '阶段变化有文本说明', '不能伪造精确百分比'] }),
  component({ key: 'state.skeleton', labelZh: '骨架屏', labelEn: 'Skeleton', descriptionZh: '布局已知、内容仍在加载时保持结构稳定。', category: 'state', status: 'candidate', implementation: 'reference-only', sourcePath: 'src/components/playground/FoundationAdvancedStories.tsx', reference: '等待真实页面加载场景后实现', stories: ['列表', '详情'], accessibilityNotes: ['不让读屏重复朗读装饰块', '加载完成后焦点不跳跃', '减少动效模式可用'] }),
  component({ key: 'state.permission-confirm', labelZh: '权限确认', labelEn: 'Permission Confirm', descriptionZh: '展示工具风险、命令和批准范围。', category: 'state', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/PermissionConfirmCard.tsx', stories: ['默认确认', '高风险命令'], accessibilityNotes: ['风险和动作文本可读', '默认不选危险操作', '确认与取消顺序稳定'] }),
  component({ key: 'state.confirm-panel', labelZh: '应用内确认面板', labelEn: 'Confirm Panel', descriptionZh: '用于删除、覆盖和强制操作的主题内确认面板。', category: 'state', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/ConfirmPanel.tsx', stories: ['危险操作确认', '处理中', '取消'], accessibilityNotes: ['页内 group 关联标题与说明，不伪装模态对话框', '确认与取消操作名称清楚', '处理中不改变操作槽尺寸'] }),

  // 开发工具。
  component({ key: 'developer.tool-callback', labelZh: '工具调用卡', labelEn: 'Tool Callback', descriptionZh: '显示工具运行、结果和失败状态。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/callbacks/ToolCallbackList.tsx', stories: ['运行中', '完成折叠', '失败展开'], accessibilityNotes: ['状态变化可读', '折叠按钮有名称', '长结果可以滚动'] }),
  component({ key: 'developer.asset-table', labelZh: '资产目录', labelEn: 'Asset Table', descriptionZh: '展示 Prompt、Skill、Provider 等生产资产。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/debug/PromptManagerPanel.tsx', stories: ['分类筛选', '资产详情', '空结果'], accessibilityNotes: ['筛选状态清楚', '表格不只依赖横向滚动', '敏感内容保持脱敏'] }),
  component({ key: 'developer.debug-overview', layer: 'experience', labelZh: 'Debug 运行概览', labelEn: 'Debug Overview', descriptionZh: '从正式运行概览进入 Prompt、请求、伙伴状态和系统证据。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/debug/DebugOverview.tsx', stories: ['真实证据入口', '窄宽排列'], accessibilityNotes: ['入口名称和用途清楚', '按钮键盘可达', '不承载诊断副作用'] }),
  component({ key: 'developer.file-tree', labelZh: '文件树', labelEn: 'File Tree', descriptionZh: '浏览工作区文件和目录。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/FileBrowser.tsx', stories: ['目录展开', '空目录', '长文件名'], accessibilityNotes: ['树节点展开状态可读', '键盘导航可达', '路径截断保留完整提示'] }),
  component({ key: 'developer.markdown', labelZh: 'Markdown 渲染器', labelEn: 'Markdown Renderer', descriptionZh: '正文由 MarkdownRenderer 解析；CodeBlock 只消费清洗后的 Prism 主题，与 Mermaid 从所在区域读取语义主题，供基础故事、候选和正式工作区共享。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/MarkdownRenderer.tsx', reference: 'CodeBlock 主题清洗来自 src/components/foundation/syntax-highlight-theme.ts', stories: ['正文', '代码块', '原始代码与围栏', '长文 aside', '局部四主题与图表'], accessibilityNotes: ['标题层级连续', '代码块复制保留原文且操作槽固定', '原始代码不解释为链接或 Mermaid', '图表失败显示提示与原文且可恢复', '外部链接经过安全处理'] }),
  component({ key: 'developer.diff-viewer', labelZh: '差异查看器', labelEn: 'Diff Viewer', descriptionZh: '基础故事、候选工作区与正式审阅共用统一/并排内容及固定尺寸视图切换；接收真实原文，不生成差异。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/foundation/DiffViewer.tsx', stories: ['并排差异', '行内差异', '空稿与缺稿', '长文件'], accessibilityNotes: ['新增删除保留原始符号', '模式按钮可键盘操作且尺寸固定', '缺稿回退统一视图', '保留原始文本复制'] }),
  component({ key: 'developer.trace-timeline', labelZh: '调用链时间线', labelEn: 'Trace Timeline', descriptionZh: '按时间展示请求、工具和资产证据。', category: 'developer', status: 'candidate', implementation: 'reference-only', reference: '现有运行记录的下一层共享抽象候选', stories: ['正常链路', '失败分支', '并发节点'], accessibilityNotes: ['时间顺序可读', '并发关系不能只靠位置', '失败节点有文本证据'] }),
  component({ key: 'developer.json-viewer', labelZh: '结构查看器', labelEn: 'JSON Viewer', descriptionZh: '查看 schema、配置和脱敏结构数据。', category: 'developer', status: 'candidate', implementation: 'reference-only', reference: '等待 Debug 多处重复结构查看需求确认', stories: ['折叠结构', '搜索字段', '大对象'], accessibilityNotes: ['树结构键盘可达', '复制时保持原始 JSON', '大对象需要资源上限'] }),

  // 伙伴世界。
  component({ key: 'companion.memory-management', layer: 'experience', labelZh: '记忆管理控件', labelEn: 'Memory Management Controls', descriptionZh: '正式记忆页与隔离故事共用四类导航、搜索和列表后新增行；基础交互来自 Foundation。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/memory/MemoryManagementControls.tsx', stories: ['四类导航', '搜索与空态', '多行新增与独立草稿'], accessibilityNotes: ['搜索和操作槽尺寸固定', 'Escape 恢复搜索按钮焦点且不退出设置', '输入法组合状态不提交'] }),
  component({ key: 'companion.status-bar', layer: 'experience', labelZh: '伙伴状态条', labelEn: 'Companion Status Bar', descriptionZh: '显示当前伙伴身份和人物世界入口。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/CompanionStatusBar.tsx', stories: ['默认态', '超长角色名'], accessibilityNotes: ['角色名称完整可读', '生活入口有明确按钮名', '长名称不挤压操作'] }),
  component({ key: 'companion.memory-citations', layer: 'experience', labelZh: '记忆引用芯片', labelEn: 'Memory Citation Chips', descriptionZh: '展示回复使用的记忆证据。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/MemoryCitationChips.tsx', stories: ['多条引用', '敏感引用'], accessibilityNotes: ['引用来源可解释', '敏感标记不只靠颜色', '芯片可键盘聚焦'] }),
  component({ key: 'companion.moment-card', layer: 'experience', labelZh: '生活事件卡', labelEn: 'Moment Card', descriptionZh: '朋友圈时间线中的生活事件截面。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/MomentsPanel.tsx', stories: ['普通事件', '长文事件'], accessibilityNotes: ['时间和正文顺序可读', '图片有替代文本', '不伪造可交互入口'] }),
  component({ key: 'companion.role-card', layer: 'experience', labelZh: '角色卡', labelEn: 'Role Card', descriptionZh: '角色架中的身份、状态和切换入口。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/CharacterShelfPanel.tsx', stories: ['活跃角色', '非活跃角色'], accessibilityNotes: ['活跃状态可读', '切换动作说明后果', '会话中不可切换时给出原因'] }),

  // 布局导航。
  component({ key: 'layout.primary-sidebar', layer: 'experience', labelZh: '主侧栏', labelEn: 'Primary Sidebar', descriptionZh: '会话、人物世界和开发入口的一级导航。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/shell/PrimarySidebar.tsx', stories: ['展开态', '折叠态'], accessibilityNotes: ['导航区域有名称', '折叠后保留可发现入口', '键盘顺序符合视觉顺序'] }),
  component({ key: 'layout.secondary-nav', layer: 'experience', labelZh: '二级导航', labelEn: 'Secondary Navigation', descriptionZh: '历史二级入口壳，当前产品不再挂载。', category: 'layout', status: 'deprecated', implementation: 'reference-only', sourcePath: 'src/components/shell/SecondaryNav.tsx', reference: '记忆与 Skills 入口已收进 Settings，避免产品壳重复导航。', stories: [], accessibilityNotes: ['不作为产品入口', '新导航需求先评估独立地址与生命周期'] }),
  component({ key: 'layout.right-dock', layer: 'experience', labelZh: '右侧工作坞', labelEn: 'Right Dock', descriptionZh: '终端、Review 和辅助任务的侧边工作区。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/right-dock/ChatRightDock.tsx', stories: ['终端', 'Review', '关闭态'], accessibilityNotes: ['面板标题和关闭按钮可读', '焦点不被侧坞吞掉', '窄宽时不遮挡主操作'] }),
  component({ key: 'layout.workspace-files', layer: 'experience', labelZh: '文件工作区', labelEn: 'Workspace Files', descriptionZh: '在工作区中组合文件树与多文件预览，不拥有文件读取权限。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/right-dock/WorkspaceFilesPanel.tsx', stories: ['左树右预览', '多文件标签', '读取失败与重试'], accessibilityNotes: ['树与预览拥有独立可读名称', '关闭预览不改变其它标签', '长内容在内部滚动'] }),
  component({ key: 'layout.workspace-browser-shell', layer: 'experience', labelZh: '浏览器工作区壳', labelEn: 'Workspace Browser Shell', descriptionZh: '正式右坞的受限只读网页查看器，通过主进程校验和加载，不支持脚本或登录。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/right-dock/BrowserPanel.tsx', stories: ['地址输入', '加载与失败重试'], accessibilityNotes: ['加载与错误状态明确可读', '固定操作槽', '不暗示完整浏览器交互'] }),
  component({ key: 'layout.workspace-sidechat-shell', layer: 'experience', labelZh: '侧边聊天工作区壳', labelEn: 'Workspace Side Chat Shell', descriptionZh: '正式右坞的独立 workspace 会话，复用真实 Runtime 并隔离主会话与长期记忆。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/right-dock/SideChatPanel.tsx', stories: ['独立流式会话', '创建与发送失败重试', '停止与关闭'], accessibilityNotes: ['创建成功前禁用发送', '错误可见且可重试', '切换父会话不保留旧草稿或确认'] }),
  component({ key: 'layout.divider', labelZh: '分隔线', labelEn: 'Divider', descriptionZh: '在同一容器内建立内容区域的视觉分隔。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['横向分隔', '纵向分隔', '内容分组'], accessibilityNotes: ['不重复使用颜色强调层级', '语义分隔与纯装饰区分', '窄宽下不挤压内容'] }),
  component({ key: 'layout.resize-handle', labelZh: '分栏拖拽柄', labelEn: 'Resize Handle', descriptionZh: '调整主区和辅助面板宽度。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/shell/ResizeHandle.tsx', stories: ['默认宽度', '最小宽度', '最大宽度'], accessibilityNotes: ['键盘可调整或提供替代设置', '暴露当前尺寸', '命中区域足够大'] }),
  component({ key: 'layout.playground-layout', layer: 'experience', labelZh: 'Playground 统一布局', labelEn: 'Playground Layout', descriptionZh: '为 Playground 一级页面提供统一页头、内容边界和故事筛选。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/PlaygroundLayout.tsx', stories: ['统一页头', '故事筛选', '窄宽滚动'], accessibilityNotes: ['当前故事可读', '分组标签可读', '窄宽时故事条可滚动'] }),
  component({ key: 'layout.foundation-workbench', layer: 'experience', labelZh: '基础组件工作台', labelEn: 'Foundation Workbench', descriptionZh: '集中展示 Foundation 故事；故事入口由 foundation-story-registry.ts 派生。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/FoundationComponentsPanel.tsx', stories: [], accessibilityNotes: ['故事筛选状态可读', '基础层边界说明可见', '不把业务文案伪装成基础组件'] }),
  component({ key: 'layout.business-states-workbench', layer: 'experience', labelZh: '业务状态工作台', labelEn: 'Business States Workbench', descriptionZh: '展示基础能力在产品业务状态中的组合。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/BusinessStatesPanel.tsx', stories: ['空态', '确认', '伙伴状态', '错误与反馈'], accessibilityNotes: ['业务状态筛选状态可读', '失败与恢复操作有文本说明', '不复制基础组件来源'] }),
  component({ key: 'layout.product-experience-dependencies', layer: 'experience', labelZh: '体验基础依赖摘要', labelEn: 'Experience Foundation Dependencies', descriptionZh: '展示产品体验声明使用的基础组件及生命周期。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/ProductExperienceDependencies.tsx', stories: ['基础依赖标签', '体验状态'], accessibilityNotes: ['依赖关系有可读标签', '不只依赖颜色表达状态', '来源由注册表派生'] }),
  component({ key: 'layout.model-routing-settings', layer: 'experience', labelZh: '模型路由设置', labelEn: 'Model Routing Settings', descriptionZh: '正式设置中的模型连接与用途安排组合；只承载真实连接、路由和本机密钥管理，不复制 Playground 夹具。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/ModelRoutingSettings.tsx', stories: ['连接清单', '用途路由', '编辑与删除', '长内容滚动'], accessibilityNotes: ['连接和路由操作名称清楚', '删除按钮有 aria-label', '操作槽固定不挤动连接信息', '密钥输入不回显旧值'] }),
  component({ key: 'layout.settings-layout', layer: 'experience', labelZh: '设置布局', labelEn: 'Settings Layout', descriptionZh: 'Playground 与正式设置共用的业务导航和页面滚动容器；组合基础按钮与标签。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/SettingsLayout.tsx', stories: ['桌面导航', '窄宽标签', '长内容滚动'], accessibilityNotes: ['当前页有 aria-current', '移动端标签可键盘操作', 'active/hover 不改变布局'] }),
  component({ key: 'behavior.setting-card', layer: 'experience', labelZh: '设置字段组合', labelEn: 'Settings Fields', descriptionZh: '设置业务的字段分组、作用域与提醒开关组合；不是新的 Foundation 卡片或表单原语。', category: 'behavior', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/SettingsFields.tsx', stories: ['字段分组', '范围徽标', '长内容'], accessibilityNotes: ['字段层级清晰', '不依赖左侧色条', '内容换行不挤出容器'] }),
  component({ key: 'layout.about-settings-content', layer: 'experience', labelZh: '关于设置内容', labelEn: 'About Settings Content', descriptionZh: '正式设置与 Playground 共享的关于页与开发者模式开关；候选只改内存样张。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/AboutSettingsContent.tsx', stories: ['版本信息', '开发者模式开关'], accessibilityNotes: ['开关有可读名称', '关闭不删除数据', '候选与正式数据边界清晰'] }),
  component({ key: 'layout.companion-settings-content', layer: 'experience', labelZh: '伙伴设置内容', labelEn: 'Companion Settings Content', descriptionZh: '正式设置与 Playground 共享的伙伴关系与提醒设置组合。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/CompanionSettingsContent.tsx', stories: ['回答方式', '生活动态提醒', '角色架入口'], accessibilityNotes: ['开关有可读名称', '表单字段可键盘访问', '候选与正式数据边界清晰'] }),
  component({ key: 'layout.data-settings-content', layer: 'experience', labelZh: '数据与隐私内容', labelEn: 'Data Settings Content', descriptionZh: '正式与候选共享备份入口、范围说明及异步反馈，调用方注入真实或隔离操作。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/DataSettingsContent.tsx', stories: ['导入导出', '处理中与取消', '失败重试'], accessibilityNotes: ['操作固定尺寸', '处理中禁止重复提交', '结果使用状态或警报语义'] }),
  component({ key: 'layout.appearance-settings-content', layer: 'experience', labelZh: '外观设置内容', labelEn: 'Appearance Settings Content', descriptionZh: '正式与候选共用主题与字号选项，直接读取设计资产并组合基础按钮。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/AppearanceSettingsContent.tsx', stories: ['四主题', '字号选择', '候选隔离'], accessibilityNotes: ['选中状态可读', '主题标记始终占位', '键盘与 hover 不改变控件尺寸'] }),
  component({ key: 'layout.world-details-panel', layer: 'experience', labelZh: '人物世界生活面详情', labelEn: 'World Details Panel', descriptionZh: '读取角色资产与生活动态；文化角、家居和足迹通过 WorldLivingContent 与 Playground 共享展示，正式页走真实增改删，Playground 只改内存预览。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/WorldDetailsPanel.tsx', stories: ['文化角', '家居', '足迹', '加载与错误重试', '新增与失败保留'], accessibilityNotes: ['内容来自真实 companion IPC', '正式页提供真实 CRUD，Playground 只内存预览', '刷新失败保留内容且可重试', '不同主角响应不混合', '固定尺寸刷新与编辑操作槽', '摘要和关联笔记同时保留'] }),
  component({ key: 'layout.assets-panel', layer: 'experience', labelZh: '人物世界衣柜面板', labelEn: 'Assets Panel', descriptionZh: '衣柜与书架读取活跃主角资产；正式页走真实增改删，Playground 只改内存预览并显式指定穿着中。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/AssetsPanel.tsx', stories: ['穿着中', '库存', '书架', '新增与失败保留'], accessibilityNotes: ['内容来自真实 companion IPC', '正式页提供真实 CRUD，Playground 只内存预览', 'hover 不改变编辑删除槽尺寸', '处理中禁止取消和重复提交'] }),
  component({ key: 'companion.world-asset-editor', layer: 'experience', labelZh: '生活资产编辑器', labelEn: 'World Asset Editor', descriptionZh: '生活面增改删共用 Foundation 表单、确认面板和固定操作槽；不持有 IPC。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/world/WorldAssetEditor.tsx', stories: ['新增', '编辑', '删除确认', '失败保留'], accessibilityNotes: ['字段有标签', '处理中禁止取消和重复提交', '操作槽始终占位', '确认失败保留同一面板'] }),
  component({ key: 'layout.mcp-service-card', layer: 'experience', labelZh: 'MCP 服务卡片', labelEn: 'MCP Service Card', descriptionZh: '正式设置与 Playground 共用服务状态、工具清单和操作组合；纯 props，不负责连接或保存。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/McpServiceCard.tsx', stories: ['已连接与零工具', '连接中与失败', '确认与停用', '长工具清单'], accessibilityNotes: ['状态有可读名称', '未知工具数不当作零', '操作槽尺寸固定', '长清单内部滚动', '没有回调不展示虚假动作'] }),
  component({ key: 'layout.mcp-connection-form', layer: 'experience', labelZh: 'MCP 连接添加表单', labelEn: 'MCP Connection Form', descriptionZh: '正式设置与 Playground 共用的测试后保存连接流程；组件不持有生产连接或凭据存储。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/McpConnectionForm.tsx', reference: 'SettingsPanel 注入正式 MCP IPC；src/components/playground/McpConnectionPreview.tsx 只注入隔离 actions，实际渲染同一表单。', stories: ['远程 Streamable HTTP', '本地 stdio', '测试与工具选择', '取消与保存失败'], accessibilityNotes: ['测试成功前不能保存', '取消后保留草稿，字段改变使旧结果失效', '保存后刷新失败仅重试刷新', '长工具清单内部滚动', '测试、保存操作槽固定'] }),
  component({ key: 'layout.model-connection-form', layer: 'experience', labelZh: '模型连接表单', labelEn: 'Model Connection Form', descriptionZh: '正式与候选共用五类来源、预设和自定义协议的受控表单；保存与凭据存储由调用方负责。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/ModelConnectionForm.tsx', stories: ['五类来源', '新增与原位编辑', '保存失败保留', '切换预设清空临时密钥'], accessibilityNotes: ['来源有单选语义', '输入与选择有可读标签', '保存中禁止重复提交', '窄宽字段换行且操作槽固定'] }),
  component({ key: 'layout.model-usage-arrangements', layer: 'experience', labelZh: '模型用途安排', labelEn: 'Model Usage Arrangements', descriptionZh: '正式与候选共用用途列表、顺序与启停；只接收数据和回调，不读取生产配置。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/ModelUsageArrangements.tsx', stories: ['空用途', '多连接排序', '停用与移除', '长标签与保存失败'], accessibilityNotes: ['选择有标签', '启停具有 switch 语义', '排序按钮标明连接模型', '操作槽固定尺寸'] }),
  component({ key: 'layout.model-connection-list', layer: 'experience', labelZh: '模型连接清单', labelEn: 'Model Connection List', descriptionZh: '正式与候选共用清单标题、数量、添加入口和空态，连接数据及编辑状态由调用方注入。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/ModelConnectionList.tsx', stories: ['连接清单与添加', '空态与编辑禁用'], accessibilityNotes: ['添加位于标题右侧', '操作槽尺寸固定', '候选不读取生产状态'] }),
  component({ key: 'layout.model-advanced-settings', layer: 'experience', labelZh: '模型高级设置', labelEn: 'Model Advanced Settings', descriptionZh: '共享折叠预算、生成参数与当前主用途测试；保存和测试适配器由调用方注入。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/ModelAdvancedSettings.tsx', stories: ['默认折叠', '非法参数与保存失败', '连接测试与迟到结果'], accessibilityNotes: ['输入有标签及错误关联', '测试操作槽固定尺寸', '候选不读取生产状态'] }),
  component({ key: 'layout.model-connection-card', layer: 'experience', labelZh: '模型连接卡片', labelEn: 'Model Connection Card', descriptionZh: '正式与候选共用连接摘要、固定头部操作、模型管理和发现结果；持久化和请求归属由调用方负责。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/settings/ModelConnectionCard.tsx', stories: ['连接摘要与原位编辑', '测试和发现状态', '模型清单与手动添加', '失败恢复与长名称'], accessibilityNotes: ['状态不只由颜色表达', '测试与发现操作槽固定', '模型启停为 switch', '长字段截断可查看全名', '候选不调用生产 IPC'] }),
] as const satisfies readonly UiComponentAssetDefinition[]

export type UiComponentAsset = (typeof UI_COMPONENT_ASSETS)[number]
export type UiComponentKey = UiComponentAsset['key']
export type FoundationComponentAsset = Extract<UiComponentAsset, { layer: 'foundation' }>
export type FoundationComponentKey = FoundationComponentAsset['key']

/** 将注册表联合类型收窄到可被产品体验引用的基础资产，避免调用方自行断言。 */
export function isFoundationComponentAsset(asset: UiComponentAsset): asset is FoundationComponentAsset {
  return asset.layer === 'foundation'
}

export const UI_COMPONENT_REGISTRY = Object.fromEntries(
  UI_COMPONENT_ASSETS.map((asset) => [asset.key, asset]),
) as unknown as Record<UiComponentKey, UiComponentAssetDefinition>
