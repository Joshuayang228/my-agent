/**
 * 产品体验资产注册表：声明成品入口、真实来源及其基础组件依赖。
 *
 * 背景：AI 开发产品体验时容易在业务页面中直接复制按钮、反馈或布局样式。
 * 设计意图：让“先基础、后成品”成为可校验契约，而不是只靠开发约定。
 * 关键约束：这里只登记依赖关系，不复制组件实现；反向 usedBy 必须从 usesFoundation 派生。
 */

import type { FoundationComponentKey, UiComponentStatus } from './ui-component-registry'

export type ProductExperienceStatus = UiComponentStatus
export type ProductExperienceTabId = 'chat' | 'world' | 'settings' | 'workspace'

export interface ProductExperienceDefinition {
  key: `experience.${string}`
  labelZh: string
  descriptionZh: string
  status: ProductExperienceStatus
  playgroundTabId: ProductExperienceTabId
  sourcePaths: readonly string[]
  /** 正式产品入口；不能只登记 Playground 来源。 */
  formalEntryPaths: readonly string[]
  /** 正式页面实际读取或写入的 IPC / service / storage 边界。 */
  realDataPaths: readonly string[]
  /** 验收测试导航；文件存在不代表测试已运行或整项已采用。 */
  evidencePaths: readonly string[]
  /** Playground-only 媒体夹具；归属体验但不出现在开发者源码提示行。 */
  fixtureAssetPaths?: readonly string[]
  /** 业务语义与页面组成；不参与 Foundation 依赖校验。 */
  experienceParts: readonly string[]
  usesFoundation: readonly FoundationComponentKey[]
  /** 仅隔离候选使用的基础能力，不代表正式采用。 */
  playgroundUsesFoundation?: readonly FoundationComponentKey[]
}

function experience<const T extends ProductExperienceDefinition>(definition: T): T {
  return definition
}

export const PRODUCT_EXPERIENCE_ASSETS = [
  experience({
    key: 'experience.chat',
    labelZh: 'Chat',
    descriptionZh: '伙伴身份、会话导航、欢迎区和消息阅读组成的主对话体验。',
    status: 'adopted',
    playgroundTabId: 'chat',
    sourcePaths: ['src/App.tsx', 'src/components/shell/PrimarySidebar.tsx', 'src/components/chat/ChatWelcome.tsx', 'src/components/chat/ChatComposer.tsx', 'src/components/chat/ChatApprovalControl.tsx', 'src/components/chat/ChatMessageFrame.tsx', 'src/components/chat/callbacks/GeneratedImageResult.tsx'],
    formalEntryPaths: ['src/App.tsx', 'src/components/shell/PrimarySidebar.tsx'],
    realDataPaths: ['electron/main/ipc/session.ts', 'electron/main/ipc/chat.ts', 'electron/main/agent/runtime.ts'],
    evidencePaths: ['__tests__/e2e/chat.test.ts', '__tests__/unit/chat-session-lifecycle.test.ts'],
    experienceParts: ['伙伴身份', '会话导航', '欢迎区', '消息流'],
    usesFoundation: ['state.empty', 'state.toast', 'state.permission-confirm', 'state.error', 'developer.tool-callback', 'behavior.button', 'behavior.action-button', 'behavior.icon-button', 'behavior.input'],
  }),
  experience({
    key: 'experience.world',
    labelZh: '人物世界',
    descriptionZh: '朋友圈、角色与生活事件组成的人格化生活面。',
    status: 'adopted',
    playgroundTabId: 'world',
    sourcePaths: ['src/components/shell/WorldHub.tsx', 'src/components/playground/SurfaceBaselinePanel.tsx', 'src/components/playground/CultureExperienceCandidate.tsx', 'src/components/playground/HomeExperienceCandidate.tsx', 'src/components/playground/FootprintsExperienceCandidate.tsx', 'src/components/playground/ContactsExperienceCandidate.tsx', 'src/components/world/WorldHomeGallery.tsx', 'src/components/playground/WardrobeIconOptions.tsx', 'src/components/MomentsPanel.tsx', 'src/components/AssetsPanel.tsx', 'src/components/CastPanel.tsx', 'src/components/WorldDetailsPanel.tsx', 'src/components/world/WorldLivingContent.tsx', 'src/components/world/WorldCultureGallery.tsx', 'src/components/world/WorldAssetEditor.tsx'],
    formalEntryPaths: ['src/components/shell/WorldHub.tsx', 'src/App.tsx', 'src/components/MomentsPanel.tsx', 'src/components/AssetsPanel.tsx', 'src/components/CastPanel.tsx', 'src/components/WorldDetailsPanel.tsx'],
    realDataPaths: ['electron/main/ipc/companion.ts', 'electron/main/companion/life/assets.ts', 'electron/main/companion/life/moments.ts', 'electron/main/companion/life/store.ts'],
    evidencePaths: ['__tests__/e2e/chat.test.ts', '__tests__/e2e/onboarding.test.ts', '__tests__/unit/world-hub.test.ts', '__tests__/unit/world-living-content.test.ts'],
    fixtureAssetPaths: ['src/assets/playground/contact-yao-avatar.png', 'src/assets/playground/contact-xu-avatar.png', 'src/assets/playground/moment-tea-by-window.jpg', 'src/assets/playground/wardrobe-gray-blue-jacket.png', 'src/assets/playground/wardrobe-lin-casual-outfit.png',
      'src/assets/playground/wardrobe-lin-commute-outfit.png', 'src/assets/playground/wardrobe-lin-sport-outfit.png',
      'src/assets/playground/wardrobe-top.png', 'src/assets/playground/wardrobe-bottom.png', 'src/assets/playground/wardrobe-shoes.png',
      'src/assets/playground/wardrobe-shirt.png', 'src/assets/playground/wardrobe-trousers.png', 'src/assets/playground/wardrobe-commute-shoes.png',
      'src/assets/playground/wardrobe-sport-top.png', 'src/assets/playground/wardrobe-sport-bottom.png',
      'src/assets/playground/culture-book.png', 'src/assets/playground/culture-film.png', 'src/assets/playground/culture-music.png', 'src/assets/playground/culture-photo.png',
      'src/assets/playground/home-overview.png', 'src/assets/playground/home-living.png', 'src/assets/playground/home-bedroom.png',
      'src/assets/playground/home-study.png', 'src/assets/playground/home-entry.png', 'src/assets/playground/home-sofa.png',
      'src/assets/playground/home-lamp.png', 'src/assets/playground/home-camera.png', 'src/assets/playground/home-umbrella.png',
      'src/assets/playground/wardrobe-icons/phosphor-t-shirt.svg',
      'src/assets/playground/wardrobe-icons/phosphor-pants.svg',
      'src/assets/playground/wardrobe-icons/phosphor-hoodie.svg',
      'src/assets/playground/wardrobe-icons/phosphor-sneaker.svg',
      'src/assets/playground/wardrobe-icons/phosphor-coat-hanger.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-short-sleeve.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-pants.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-windbreaker.svg',
      'src/assets/playground/wardrobe-icons/iconpark-clothes-suit.svg',
      'src/assets/playground/wardrobe-icons/iconpark-boots.svg',
      'src/assets/playground/travel-canal.png',
    ],
    experienceParts: ['朋友圈', '衣柜', '文化角', '家居', '通讯录', '足迹'],
    playgroundUsesFoundation: ['behavior.badge'],
    usesFoundation: ['behavior.tabs', 'state.empty', 'state.error', 'behavior.action-button', 'behavior.icon-button', 'behavior.button', 'behavior.input', 'behavior.select', 'state.confirm-panel', 'behavior.image-viewer'],
  }),
  experience({
    key: 'experience.settings',
    labelZh: '设置',
    descriptionZh: '配置分组、字段编辑、自动保存和失败恢复体验。',
    status: 'adopted',
    playgroundTabId: 'settings',
    sourcePaths: ['src/components/settings/McpServiceList.tsx', 'src/components/settings/McpServiceCard.tsx', 'src/components/settings/McpConnectionForm.tsx', 'src/components/CharacterShelfPanel.tsx', 'src/components/companion/CharacterShelfContent.tsx', 'src/components/playground/SurfaceBaselinePanel.tsx', 'src/components/playground/SettingsExperienceCandidate.tsx', 'src/components/SettingsPanel.tsx', 'src/components/settings/PermissionSettingsContent.tsx', 'src/components/PermissionRulesEditor.tsx', 'src/components/settings/SettingsLayout.tsx', 'src/components/settings/ModelRoutingSettings.tsx', 'src/components/settings/ModelUsageArrangements.tsx', 'src/components/settings/ModelConnectionCard.tsx', 'src/components/settings/ModelConnectionList.tsx', 'src/components/settings/ModelAdvancedSettings.tsx', 'src/components/settings/AboutSettingsContent.tsx', 'src/components/settings/DataSettingsContent.tsx', 'src/components/settings/AppearanceSettingsContent.tsx', 'src/components/MemoryPanel.tsx', 'src/components/memory/MemoryManagementControls.tsx', 'src/components/SkillsPanel.tsx', 'src/components/settings/SkillViews.tsx'],
    formalEntryPaths: ['src/components/SettingsPanel.tsx', 'src/components/settings/SettingsLayout.tsx', 'src/components/MemoryPanel.tsx', 'src/components/SkillsPanel.tsx'],
    realDataPaths: ['electron/main/ipc/settings.ts', 'electron/main/ipc/memory.ts', 'electron/main/ipc/skills.ts', 'electron/main/ipc/companion.ts', 'electron/main/ipc/mcp.ts', 'electron/main/ipc/data-export.ts'],
    evidencePaths: ['__tests__/e2e/onboarding.test.ts', '__tests__/e2e/chat.test.ts', '__tests__/e2e/mcp-oauth.test.ts', '__tests__/unit/mcp-oauth.test.ts', '__tests__/unit/settings-security.test.ts', '__tests__/unit/memory-foundation-reuse.test.ts'],
    experienceParts: ['设置分组', '角色架', '记忆管理', 'Skills 管理', '字段编辑', '自动保存', '失败恢复'],
    usesFoundation: ['behavior.tabs', 'behavior.input', 'behavior.select', 'behavior.button', 'behavior.icon-button', 'behavior.checkbox', 'state.confirm-panel', 'state.toast', 'state.error'],
  }),
  experience({
    key: 'experience.workspace',
    labelZh: '工作区',
    descriptionZh: '审阅、浏览器、文件、终端与侧边聊天组成的右侧工具区。',
    status: 'adopted',
    playgroundTabId: 'workspace',
    sourcePaths: ['src/components/playground/WorkspaceExperienceCandidate.tsx', 'src/components/chat/right-dock/ChatRightDock.tsx', 'src/components/chat/right-dock/ReviewPanel.tsx', 'src/components/chat/right-dock/WorkspaceFilesPanel.tsx', 'src/components/chat/right-dock/BrowserPanel.tsx', 'src/components/chat/right-dock/TerminalPanel.tsx', 'src/components/chat/right-dock/SideChatPanel.tsx', 'src/components/FileBrowser.tsx', 'src/components/MarkdownRenderer.tsx'],
    formalEntryPaths: ['src/App.tsx', 'src/components/chat/right-dock/ChatRightDock.tsx', 'src/components/chat/right-dock/ReviewPanel.tsx', 'src/components/chat/right-dock/WorkspaceFilesPanel.tsx', 'src/components/chat/right-dock/BrowserPanel.tsx', 'src/components/chat/right-dock/TerminalPanel.tsx', 'src/components/chat/right-dock/SideChatPanel.tsx', 'src/components/FileBrowser.tsx'],
    realDataPaths: ['electron/main/ipc/project.ts', 'electron/main/ipc/session.ts', 'electron/main/ipc/chat.ts', 'electron/main/ipc/browser.ts', 'electron/main/ipc/session-changes.ts', 'electron/main/ipc/terminal.ts'],
    evidencePaths: ['__tests__/e2e/chat.test.ts', '__tests__/e2e/onboarding.test.ts', '__tests__/unit/workspace-backend-contract.test.ts', '__tests__/unit/workspace-foundation-control-audit.test.ts'],
    fixtureAssetPaths: ['src/assets/playground/moment-tea-by-window.jpg'],
    experienceParts: ['审阅', '浏览器', '文件', '终端', '侧边聊天'],
    usesFoundation: ['developer.file-tree', 'developer.markdown', 'developer.diff-viewer', 'layout.resize-handle', 'behavior.tabs', 'behavior.input', 'behavior.icon-button', 'behavior.action-button'],
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

/** 反向关系由活跃体验的正式及候选依赖派生，禁止另建 usedBy 清单。 */
export function productExperiencesUsingFoundation(key: FoundationComponentKey): readonly ProductExperienceAsset[] {
  return PRODUCT_EXPERIENCE_ASSETS.filter(
    (asset) => isActiveProductExperience(asset) && experienceFoundationKeys(asset).includes(key),
  )
}

export function experienceFoundationKeys(asset: ProductExperienceDefinition): readonly FoundationComponentKey[] {
  return [...new Set([...asset.usesFoundation, ...(asset.playgroundUsesFoundation ?? [])])]
}
