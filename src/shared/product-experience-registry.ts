/**
 * 产品体验资产注册表：声明成品入口、真实来源及其基础组件依赖。
 *
 * 背景：AI 开发产品体验时容易在业务页面中直接复制按钮、反馈或布局样式。
 * 设计意图：让“先基础、后成品”成为可校验契约，而不是只靠开发约定。
 * 关键约束：这里只登记依赖关系，不复制组件实现；反向 usedBy 必须从 usesFoundation 派生。
 */

import type { FoundationComponentKey, UiComponentStatus } from './ui-component-registry'

export type ProductExperienceStatus = UiComponentStatus
export type ProductExperienceTabId = 'chat' | 'world' | 'memory' | 'settings' | 'workspace' | 'business-states'

export interface ProductExperienceDefinition {
  key: `experience.${string}`
  labelZh: string
  descriptionZh: string
  status: ProductExperienceStatus
  playgroundTabId: ProductExperienceTabId
  sourcePaths: readonly string[]
  /** Playground-only 媒体夹具；归属体验但不出现在开发者源码提示行。 */
  fixtureAssetPaths?: readonly string[]
  /** 业务语义与页面组成；不参与 Foundation 依赖校验。 */
  experienceParts: readonly string[]
  usesFoundation: readonly FoundationComponentKey[]
}

function experience<const T extends ProductExperienceDefinition>(definition: T): T {
  return definition
}

export const PRODUCT_EXPERIENCE_ASSETS = [
  experience({
    key: 'experience.chat',
    labelZh: 'Chat',
    descriptionZh: '伙伴身份、会话导航、欢迎区和消息阅读组成的主对话体验。',
    status: 'playground',
    playgroundTabId: 'chat',
    sourcePaths: ['src/App.tsx', 'src/components/shell/PrimarySidebar.tsx'],
    experienceParts: ['伙伴身份', '会话导航', '欢迎区', '消息流'],
    usesFoundation: ['state.empty', 'state.toast', 'state.permission-confirm', 'state.error'],
  }),
  experience({
    key: 'experience.world',
    labelZh: '人物世界',
    descriptionZh: '朋友圈、角色与生活事件组成的人格化生活面。',
    status: 'playground',
    playgroundTabId: 'world',
    sourcePaths: ['src/components/playground/SurfaceBaselinePanel.tsx', 'src/components/MomentsPanel.tsx'],
    fixtureAssetPaths: ['src/assets/playground/moment-tea-by-window.jpg'],
    experienceParts: ['朋友圈', '物什', '名册'],
    usesFoundation: ['behavior.tabs', 'state.empty'],
  }),
  experience({
    key: 'experience.memory',
    labelZh: '记忆',
    descriptionZh: '结构化记忆的筛选、空态、敏感项和编辑体验。',
    status: 'playground',
    playgroundTabId: 'memory',
    sourcePaths: ['src/components/MemoryPanel.tsx'],
    experienceParts: ['记忆列表', '记忆筛选', '敏感项', '编辑态', '记忆引用'],
    usesFoundation: ['behavior.tabs', 'state.empty', 'state.error'],
  }),
  experience({
    key: 'experience.settings',
    labelZh: '设置',
    descriptionZh: '配置分组、字段编辑、自动保存和失败恢复体验。',
    status: 'playground',
    playgroundTabId: 'settings',
    sourcePaths: ['src/components/playground/SurfaceBaselinePanel.tsx', 'src/components/SettingsPanel.tsx'],
    experienceParts: ['设置分组', '角色架', '字段编辑', '自动保存', '失败恢复'],
    usesFoundation: ['behavior.tabs', 'state.toast', 'state.error'],
  }),
  experience({
    key: 'experience.workspace',
    labelZh: '工作区',
    descriptionZh: '文件、预览、审阅和终端组成的右侧任务工作区。',
    status: 'playground',
    playgroundTabId: 'workspace',
    sourcePaths: ['src/components/chat/right-dock/ChatRightDock.tsx', 'src/components/FileBrowser.tsx'],
    experienceParts: ['文件', '预览', '审阅', '终端'],
    usesFoundation: ['developer.file-tree', 'developer.markdown', 'layout.resize-handle', 'behavior.tabs'],
  }),
  experience({
    key: 'experience.business-states',
    labelZh: '业务状态',
    descriptionZh: '空态、确认、伙伴状态和错误反馈在真实业务语义中的组合。',
    status: 'playground',
    playgroundTabId: 'business-states',
    sourcePaths: ['src/components/playground/BusinessStatesPanel.tsx'],
    experienceParts: ['空态', '权限确认', '错误反馈'],
    usesFoundation: ['state.empty', 'state.permission-confirm', 'state.error', 'state.toast'],
  }),
] as const satisfies readonly ProductExperienceDefinition[]

export type ProductExperienceAsset = (typeof PRODUCT_EXPERIENCE_ASSETS)[number]
export type ProductExperienceKey = ProductExperienceAsset['key']

export const PRODUCT_EXPERIENCE_REGISTRY = Object.fromEntries(
  PRODUCT_EXPERIENCE_ASSETS.map((asset) => [asset.key, asset]),
) as unknown as Record<ProductExperienceKey, ProductExperienceAsset>

/** adopted 成品只能依赖 adopted 基础；Playground 成品可使用已采用或已建场的基础。 */
export function isFoundationStatusAllowed(experienceStatus: ProductExperienceStatus, foundationStatus: UiComponentStatus): boolean {
  if (experienceStatus === 'archived') return true
  if (experienceStatus === 'candidate') return foundationStatus === 'candidate' || foundationStatus === 'playground' || foundationStatus === 'adopted'
  if (experienceStatus === 'playground') return foundationStatus === 'playground' || foundationStatus === 'adopted'
  if (experienceStatus === 'adopted') return foundationStatus === 'adopted'
  return foundationStatus === 'adopted' || foundationStatus === 'deprecated'
}

/** archived 只保留历史证据，不参与当前产品体验依赖图。 */
export function isActiveProductExperience(asset: ProductExperienceDefinition): boolean {
  return asset.status !== 'archived'
}

/** 反向关系始终由活跃产品体验的 usesFoundation 派生，禁止另建 usedBy 清单。 */
export function productExperiencesUsingFoundation(key: FoundationComponentKey): readonly ProductExperienceAsset[] {
  return PRODUCT_EXPERIENCE_ASSETS.filter(
    (asset) => isActiveProductExperience(asset) && (asset.usesFoundation as readonly FoundationComponentKey[]).includes(key),
  )
}
