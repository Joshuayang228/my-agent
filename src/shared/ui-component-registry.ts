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
  component({ key: 'behavior.button', labelZh: '按钮', labelEn: 'Button', descriptionZh: '触发提交、确认、导航和恢复动作的基础控件。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['主要操作', '次要操作', '生成动作', '禁用态', '加载态'], accessibilityNotes: ['按钮名称清楚', '禁用态不能只靠颜色', '加载时保留动作语义'] }),
  component({ key: 'behavior.input', labelZh: '输入框', labelEn: 'Input', descriptionZh: '承载短文本、长文本和搜索输入的基础控件。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['空值', '有值', '长文', '禁用态'], accessibilityNotes: ['标签与输入关联', '长文不挤出容器', 'IME 组合输入不误提交'] }),

  component({ key: 'behavior.dialog', labelZh: '对话框', labelEn: 'Dialog', descriptionZh: '需要焦点陷阱和明确关闭语义的模态交互。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', reference: 'Radix Dialog 候选，尚未引入依赖', stories: ['默认态', '高风险确认', '长内容'], accessibilityNotes: ['打开后焦点进入对话框', 'Esc 与遮罩关闭策略必须显式', '关闭后焦点回到触发元素'] }),
  component({ key: 'behavior.popover', labelZh: '弹出层', labelEn: 'Popover', descriptionZh: '依附触发元素的轻量详情或筛选面板。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', reference: 'Radix Popover 候选，尚未引入依赖', stories: ['默认态', '视口边缘'], accessibilityNotes: ['触发器与内容建立语义关系', '处理视口碰撞', '键盘可关闭'] }),
  component({ key: 'behavior.dropdown-menu', labelZh: '下拉菜单', labelEn: 'Dropdown Menu', descriptionZh: '行级更多操作和上下文命令。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', reference: 'Radix Dropdown Menu 候选，尚未引入依赖', stories: ['默认态', '禁用项', '危险操作'], accessibilityNotes: ['方向键导航', '焦点不落到禁用项', '危险操作有明确语义'] }),
  component({ key: 'behavior.tooltip', labelZh: '提示浮层', labelEn: 'Tooltip', descriptionZh: '为无文字图标按钮提供低频解释。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', reference: 'Radix Tooltip 候选，尚未引入依赖', stories: ['默认态', '延迟显示'], accessibilityNotes: ['不能替代可见标签', '键盘聚焦时可见', '内容保持简短'] }),
  component({ key: 'behavior.tabs', labelZh: '标签切换', labelEn: 'Tabs', descriptionZh: '同一任务域内切换互斥内容。', category: 'behavior', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['Playground 子分类', 'Debug 分组导航'], accessibilityNotes: ['选中态可被读屏识别', '键盘左右切换', '不把页面级导航伪装成 Tabs'] }),
  component({ key: 'behavior.select', labelZh: '下拉选择', labelEn: 'Select', descriptionZh: '从稳定枚举中选择单项。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', reference: 'Radix Select 候选，尚未引入依赖', stories: ['默认态', '禁用态', '长选项'], accessibilityNotes: ['键盘选择', '标签与控件关联', '当前值可被读屏读取'] }),
  component({ key: 'behavior.combobox', labelZh: '可搜索选择', labelEn: 'Combobox', descriptionZh: '模型、Skill 或角色数量较多时的搜索选择。', category: 'behavior', status: 'candidate', implementation: 'reference-only', reference: '仅登记交互需求，尚未选择实现来源', stories: ['空结果', '键盘选择', '长列表'], accessibilityNotes: ['输入与列表语义关联', '高亮项不等于已选择', '空结果需要可读提示'] }),
  component({ key: 'behavior.command', labelZh: '命令面板', labelEn: 'Command', descriptionZh: '跨页面搜索动作和低频命令。', category: 'behavior', status: 'candidate', implementation: 'reference-only', reference: '仅登记产品候选，尚未进入当前 IA', stories: ['搜索结果', '无结果', '快捷键入口'], accessibilityNotes: ['不抢占输入法组合状态', '搜索结果键盘可达', '动作范围必须透明'] }),
  component({ key: 'behavior.context-menu', labelZh: '右键菜单', labelEn: 'Context Menu', descriptionZh: '文件、资产和会话的上下文操作。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', reference: 'Radix Context Menu 候选，尚未引入依赖', stories: ['文件操作', '危险操作'], accessibilityNotes: ['必须有非右键替代入口', '键盘菜单键可打开', '不隐藏核心操作'] }),
  component({ key: 'behavior.scroll-area', labelZh: '滚动区域', labelEn: 'Scroll Area', descriptionZh: 'Debug 长内容和资产目录的稳定滚动容器。', category: 'behavior', status: 'candidate', implementation: 'radix-candidate', reference: 'Radix Scroll Area 候选，尚未引入依赖', stories: ['长列表', '横向溢出'], accessibilityNotes: ['保留系统滚动能力', '不要阻断触控板', '焦点元素滚入可视区'] }),

  // 状态反馈。
  component({ key: 'state.toast', labelZh: '提示条', labelEn: 'Toast', descriptionZh: '应用内成功、警告、错误和后台任务反馈。', category: 'state', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/Toast.tsx', stories: ['信息', '成功', '警告', '错误', '长文'], accessibilityNotes: ['错误信息不能只靠颜色', '重要消息保留足够阅读时间', '不覆盖关键操作'] }),
  component({ key: 'state.empty', labelZh: '空状态', labelEn: 'Empty State', descriptionZh: '没有数据或尚未开始时的引导。', category: 'state', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['默认态', '窄宽长文'], accessibilityNotes: ['说明为什么为空', '操作入口不应伪造能力', '文本层级清楚'] }),
  component({ key: 'state.error', labelZh: '错误状态', labelEn: 'Error State', descriptionZh: '请求、权限和配置失败时的恢复入口。', category: 'state', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['未配置', '权限拒绝', '上游失败'], accessibilityNotes: ['提供可执行恢复动作', '不暴露内部堆栈', '错误语义可读'] }),
  component({ key: 'state.spinner', labelZh: '加载指示器', labelEn: 'Spinner', descriptionZh: '短时未知进度的加载反馈。', category: 'state', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/UiControlsPanel.tsx', stories: ['生成中', '按钮内加载'], accessibilityNotes: ['补充可读状态文本', '避免无限旋转无说明', '尊重减少动效偏好'] }),
  component({ key: 'state.progress', labelZh: '进度条', labelEn: 'Progress', descriptionZh: '已知进度或阶段任务反馈。', category: 'state', status: 'candidate', implementation: 'reference-only', reference: '等待真实长任务进度契约后实现', stories: ['确定进度', '阶段进度'], accessibilityNotes: ['暴露当前值和范围', '阶段变化有文本说明', '不能伪造精确百分比'] }),
  component({ key: 'state.skeleton', labelZh: '骨架屏', labelEn: 'Skeleton', descriptionZh: '布局已知、内容仍在加载时保持结构稳定。', category: 'state', status: 'candidate', implementation: 'reference-only', reference: '等待真实页面加载场景后实现', stories: ['列表', '详情'], accessibilityNotes: ['不让读屏重复朗读装饰块', '加载完成后焦点不跳跃', '减少动效模式可用'] }),
  component({ key: 'state.permission-confirm', labelZh: '权限确认', labelEn: 'Permission Confirm', descriptionZh: '展示工具风险、命令和批准范围。', category: 'state', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/PermissionConfirmCard.tsx', stories: ['默认确认', '高风险命令'], accessibilityNotes: ['风险和动作文本可读', '默认不选危险操作', '确认与取消顺序稳定'] }),

  // 开发工具。
  component({ key: 'developer.tool-callback', labelZh: '工具调用卡', labelEn: 'Tool Callback', descriptionZh: '显示工具运行、结果和失败状态。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/callbacks/ToolCallbackList.tsx', stories: ['运行中', '完成折叠', '失败展开'], accessibilityNotes: ['状态变化可读', '折叠按钮有名称', '长结果可以滚动'] }),
  component({ key: 'developer.asset-table', labelZh: '资产目录', labelEn: 'Asset Table', descriptionZh: '展示 Prompt、Skill、Provider 等生产资产。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/debug/PromptManagerPanel.tsx', stories: ['分类筛选', '资产详情', '空结果'], accessibilityNotes: ['筛选状态清楚', '表格不只依赖横向滚动', '敏感内容保持脱敏'] }),
  component({ key: 'developer.file-tree', labelZh: '文件树', labelEn: 'File Tree', descriptionZh: '浏览工作区文件和目录。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/FileBrowser.tsx', stories: ['目录展开', '空目录', '长文件名'], accessibilityNotes: ['树节点展开状态可读', '键盘导航可达', '路径截断保留完整提示'] }),
  component({ key: 'developer.markdown', labelZh: 'Markdown 渲染器', labelEn: 'Markdown Renderer', descriptionZh: '渲染 Agent 回复、代码和受控富文本。', category: 'developer', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/MarkdownRenderer.tsx', stories: ['正文', '代码块', '长文 aside'], accessibilityNotes: ['标题层级连续', '代码块可复制', '外部链接经过安全处理'] }),
  component({ key: 'developer.diff-viewer', labelZh: '差异查看器', labelEn: 'Diff Viewer', descriptionZh: '查看 Prompt、Skill 或文件版本变化。', category: 'developer', status: 'candidate', implementation: 'reference-only', reference: 'WISH-014 Skill Diff 的共享候选', stories: ['并排差异', '行内差异', '长文件'], accessibilityNotes: ['新增删除不能只靠颜色', '键盘可定位变更', '保留原始文本复制'] }),
  component({ key: 'developer.trace-timeline', labelZh: '调用链时间线', labelEn: 'Trace Timeline', descriptionZh: '按时间展示请求、工具和资产证据。', category: 'developer', status: 'candidate', implementation: 'reference-only', reference: '现有运行记录的下一层共享抽象候选', stories: ['正常链路', '失败分支', '并发节点'], accessibilityNotes: ['时间顺序可读', '并发关系不能只靠位置', '失败节点有文本证据'] }),
  component({ key: 'developer.json-viewer', labelZh: '结构查看器', labelEn: 'JSON Viewer', descriptionZh: '查看 schema、配置和脱敏结构数据。', category: 'developer', status: 'candidate', implementation: 'reference-only', reference: '等待 Debug 多处重复结构查看需求确认', stories: ['折叠结构', '搜索字段', '大对象'], accessibilityNotes: ['树结构键盘可达', '复制时保持原始 JSON', '大对象需要资源上限'] }),

  // 伙伴世界。
  component({ key: 'companion.status-bar', layer: 'experience', labelZh: '伙伴状态条', labelEn: 'Companion Status Bar', descriptionZh: '显示当前伙伴身份和人物世界入口。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/CompanionStatusBar.tsx', stories: ['默认态', '超长角色名'], accessibilityNotes: ['角色名称完整可读', '生活入口有明确按钮名', '长名称不挤压操作'] }),
  component({ key: 'companion.memory-citations', layer: 'experience', labelZh: '记忆引用芯片', labelEn: 'Memory Citation Chips', descriptionZh: '展示回复使用的记忆证据。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/MemoryCitationChips.tsx', stories: ['多条引用', '敏感引用'], accessibilityNotes: ['引用来源可解释', '敏感标记不只靠颜色', '芯片可键盘聚焦'] }),
  component({ key: 'companion.moment-card', layer: 'experience', labelZh: '生活事件卡', labelEn: 'Moment Card', descriptionZh: '朋友圈时间线中的生活事件截面。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/MomentsPanel.tsx', stories: ['普通事件', '长文事件'], accessibilityNotes: ['时间和正文顺序可读', '图片有替代文本', '不伪造可交互入口'] }),
  component({ key: 'companion.role-card', layer: 'experience', labelZh: '角色卡', labelEn: 'Role Card', descriptionZh: '角色架中的身份、状态和切换入口。', category: 'companion', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/CharacterShelfPanel.tsx', stories: ['活跃角色', '非活跃角色'], accessibilityNotes: ['活跃状态可读', '切换动作说明后果', '会话中不可切换时给出原因'] }),

  // 布局导航。
  component({ key: 'layout.primary-sidebar', layer: 'experience', labelZh: '主侧栏', labelEn: 'Primary Sidebar', descriptionZh: '会话、人物世界和开发入口的一级导航。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/shell/PrimarySidebar.tsx', stories: ['展开态', '折叠态'], accessibilityNotes: ['导航区域有名称', '折叠后保留可发现入口', '键盘顺序符合视觉顺序'] }),
  component({ key: 'layout.secondary-nav', layer: 'experience', labelZh: '二级导航', labelEn: 'Secondary Navigation', descriptionZh: '生活、工具和开发分组的二级入口。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/shell/SecondaryNav.tsx', stories: ['生活分组', '开发分组'], accessibilityNotes: ['当前项可读', '分组标题不冒充按钮', '窄宽可滚动'] }),
  component({ key: 'layout.right-dock', layer: 'experience', labelZh: '右侧工作坞', labelEn: 'Right Dock', descriptionZh: '终端、Review 和辅助任务的侧边工作区。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/chat/right-dock/ChatRightDock.tsx', stories: ['终端', 'Review', '关闭态'], accessibilityNotes: ['面板标题和关闭按钮可读', '焦点不被侧坞吞掉', '窄宽时不遮挡主操作'] }),
  component({ key: 'layout.resize-handle', labelZh: '分栏拖拽柄', labelEn: 'Resize Handle', descriptionZh: '调整主区和辅助面板宽度。', category: 'layout', status: 'adopted', implementation: 'custom', sourcePath: 'src/components/shell/ResizeHandle.tsx', stories: ['默认宽度', '最小宽度', '最大宽度'], accessibilityNotes: ['键盘可调整或提供替代设置', '暴露当前尺寸', '命中区域足够大'] }),
  component({ key: 'layout.playground-layout', layer: 'experience', labelZh: 'Playground 统一布局', labelEn: 'Playground Layout', descriptionZh: '为 Playground 一级页面提供统一页头、内容边界和故事筛选。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/PlaygroundLayout.tsx', stories: ['统一页头', '故事筛选', '窄宽滚动'], accessibilityNotes: ['当前故事可读', '分组标签可读', '窄宽时故事条可滚动'] }),
  component({ key: 'layout.foundation-workbench', layer: 'experience', labelZh: '基础组件工作台', labelEn: 'Foundation Workbench', descriptionZh: '集中展示可复用基础组件与隔离故事。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/FoundationComponentsPanel.tsx', stories: ['按钮', '输入', '工具卡', '空态', '确认框', '错误与反馈'], accessibilityNotes: ['故事筛选状态可读', '基础层边界说明可见', '不把业务文案伪装成基础组件'] }),
  component({ key: 'layout.business-states-workbench', layer: 'experience', labelZh: '业务状态工作台', labelEn: 'Business States Workbench', descriptionZh: '展示基础能力在产品业务状态中的组合。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/BusinessStatesPanel.tsx', stories: ['空态', '确认', '伙伴状态', '错误与反馈'], accessibilityNotes: ['业务状态筛选状态可读', '失败与恢复操作有文本说明', '不复制基础组件来源'] }),
  component({ key: 'layout.product-experience-dependencies', layer: 'experience', labelZh: '体验基础依赖摘要', labelEn: 'Experience Foundation Dependencies', descriptionZh: '展示产品体验声明使用的基础组件及生命周期。', category: 'layout', status: 'playground', implementation: 'custom', sourcePath: 'src/components/playground/ProductExperienceDependencies.tsx', stories: ['基础依赖标签', '体验状态'], accessibilityNotes: ['依赖关系有可读标签', '不只依赖颜色表达状态', '来源由注册表派生'] }),
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
