/**
 * E2E 测试 — UI 交互测试（Vite dev server 环境）
 *
 * 这些测试通过浏览器验证 UI 渲染和交互逻辑。
 * IPC/LLM 相关功能在 electron.test.ts 中测试。
 */
import { test, expect } from '@playwright/test'

/**
 * 正式 Chat 右坞的 UI 契约测试只替身 Electron 边界，不替身右坞本身。
 * 这样可以验证真实 App → ChatRightDock → FileBrowser 的状态共享，同时不连接本机会话、文件系统或模型。
 */
async function installProductionElectronStub(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const noopCleanup = () => {}
    ;(window as any).electronAPI = {
      session: {
        list: async () => [],
        get: async () => null,
        create: async () => ({ id: 'e2e-session' }),
        delete: async () => ({ success: true }),
        rename: async () => ({ success: true }),
        onFileChange: () => noopCleanup,
        listFileChanges: async () => [],
        getFileChangeDiff: async () => ({ diff: '' }),
        clearFileChanges: async () => ({ success: true }),
      },
      settings: {
        get: async () => ({ llmApiKeyConfigured: 'true', llmModel: 'e2e-model', executionMode: 'confirm-all', pinnedSessions: '[]' }),
        set: async () => ({ success: true }),
      },
      companion: {
        getActive: async () => ({ id: 'lin', name: '测试伙伴', description: '测试用伙伴' }),
        listProtagonists: async () => [],
        getRoster: async () => ({ cast: [] }),
      },
      project: {
        get: async () => ({ path: 'C:\\\\e2e-project', name: '测试项目' }),
        list: async () => [{ path: 'C:\\\\e2e-project', name: '测试项目' }],
        listFiles: async () => ([
          { name: 'src', path: 'C:\\\\e2e-project\\\\src', isDir: true, children: [
            { name: 'App.tsx', path: 'C:\\\\e2e-project\\\\src\\\\App.tsx', isDir: false },
          ] },
        ]),
        readFile: async (filePath: string) => ({ kind: 'text', content: 'const ready = true', languageHint: filePath.endsWith('.tsx') ? 'typescript' : 'text', size: 18 }),
        openExternal: async () => ({ ok: true }),
      },
      tasks: { sync: async () => ({ active: [], pendingNotify: [] }), onEvent: () => noopCleanup },
      chat: { onEvent: () => noopCleanup, onConfirmRequest: () => noopCleanup },
      mcp: {},
    }
  })
}

test.describe('My Agent UI', () => {
  test('应用标题和基础 UI 可见', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="chat-messages"] h1')).toContainText('我是')
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible()

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveAttribute('placeholder', /说说/)

    const sendBtn = page.getByTitle('发送')
    await expect(sendBtn).toBeVisible()
    await expect(sendBtn).toBeDisabled()
  })

  test('侧边栏可见且可折叠', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible()
    await expect(page.getByRole('button', { name: '新对话', exact: true })).toBeVisible()

    await page.getByTitle('收起侧栏 Ctrl+B').click()
    await expect(page.locator('[data-testid="primary-sidebar"]')).not.toBeVisible()

    await page.getByTitle('展开侧边栏 (Ctrl+B)').click()
    await expect(page.locator('[data-testid="primary-sidebar"]')).toBeVisible()
  })

  test('输入框支持文本输入和清除', async ({ page }) => {
    await page.goto('/')

    const textarea = page.locator('textarea')
    const sendBtn = page.getByTitle('发送')

    await expect(sendBtn).toBeDisabled()

    await textarea.fill('测试消息')
    await expect(sendBtn).toBeEnabled()

    await textarea.fill('')
    await expect(sendBtn).toBeDisabled()
  })

  test('空白消息区显示欢迎内容', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('[data-testid="chat-messages"] h1')).toContainText('我是')
    await expect(page.getByRole('button', { name: '打个招呼', exact: true })).toBeVisible()
  })


  test('正式右坞默认预览且文件与预览共享选中文件', async ({ page }) => {
    await installProductionElectronStub(page)
    await page.goto('/')

    await page.getByTitle('项目文件').click()
    const dock = page.locator('[data-testid="chat-right-dock"]')
    await expect(dock.getByTestId('right-dock-tab-preview')).toBeVisible()
    await expect(dock.getByTestId('right-dock-tab-files')).toHaveCount(0)
    await expect(dock).not.toContainText('隔离样张')

    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '文件', exact: true }).click()
    await expect(dock.getByTestId('right-dock-tab-files')).toBeVisible()
    await dock.getByTestId('file-browser-tree').getByRole('button', { name: 'App.tsx', exact: true }).click()
    await expect(dock.getByTestId('file-browser-tree')).toContainText('App.tsx')

    await dock.getByTestId('right-dock-tab-preview').click()
    await expect(dock.getByTestId('file-browser-preview')).toContainText('const ready = true')
    await expect(dock.getByTestId('file-browser-preview')).toContainText('App.tsx')

    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '审阅', exact: true }).click()
    await expect(dock.getByText('无活跃会话', { exact: true })).toBeVisible()
    await expect(dock).not.toContainText('隔离样张')

    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    await expect(dock.getByText('命令控制台（非完整终端）', { exact: false })).toBeVisible()
    await expect(dock.getByPlaceholder('输入命令…')).toBeVisible()
    await expect(dock).not.toContainText('隔离样张')
  })


  test('Playground 基础与产品体验分层且可独立验收', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()

    const nav = page.locator('[data-testid="playground-nav"]')
    await expect(page.locator('[data-testid="primary-sidebar"]')).toHaveCount(0)
    await expect(page.getByRole('switch', { name: '显示已采用' })).toHaveCount(0)
    await expect(page.locator('section[aria-label="基础"]')).toBeVisible()
    await expect(page.locator('section[aria-label="产品体验"]')).toBeVisible()
    await expect(page.locator('section[aria-label="Agent 实验"]')).toBeVisible()
    await expect(nav.getByRole('button', { name: '基础组件', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: '人物世界', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: '业务状态', exact: true })).toBeVisible()
    await expect(nav.getByRole('button', { name: '组件目录', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('button', { name: '页面组合', exact: true })).toHaveCount(0)

    await nav.getByRole('button', { name: '基础组件', exact: true }).click()
    await expect(page.locator('[data-testid="foundation-components-panel"]')).toBeVisible()
    await expect(page.getByTestId('foundation-state-matrix')).toContainText('键盘 / ARIA')
    await expect(page.locator('[data-testid="playground-story-nav"]')).toBeVisible()
    await expect(page.locator('[data-testid="playground-story-nav"] [role="tablist"]')).toHaveCount(1)
    await expect(page.getByRole('tab', { name: '组件索引', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: '记忆引用', exact: true })).toHaveCount(0)
    for (const tab of ['按钮', '输入与表单', '标签与选择', '弹层', '菜单与提示', '徽标与标签', '状态反馈', '加载与进度', '工具卡', 'Markdown 与资产', '文件与差异', '布局与滚动', '卡片']) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible()
    }
    await expect(page.locator('[data-testid="foundation-asset-inventory"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="playground-story-nav"]')).not.toContainText('基础控件')
    await expect(page.getByText('生成动作', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Markdown 与资产', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^正文与代码块/ })).toBeVisible()
    const markdownStory = page.locator('section').filter({ hasText: '正文与代码块' }).first()
    const markdownCodeBlock = markdownStory.getByTestId('markdown-code-block')
    await expect(markdownCodeBlock).toBeVisible()
    await expect(markdownCodeBlock).toHaveCSS('background-color', /^(?!rgb\(255, 255, 255\)$)/)
    await page.getByRole('tab', { name: '文件与差异', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^文件树/ })).toBeVisible()
    await page.getByRole('tab', { name: '标签与选择', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^标签切换/ })).toBeVisible()
    const foundationTabs = page.getByRole('tablist', { name: 'Foundation 标签样张' })
    await foundationTabs.getByRole('tab', { name: '产品体验', exact: true }).click()
    await expect(foundationTabs.getByRole('tab', { name: '产品体验', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('产品体验只负责语义、数据和页面组合。', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^下拉选择/ })).toBeVisible()
    await page.getByRole('tab', { name: '弹层', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^对话框/ })).toBeVisible()
    await page.getByRole('tab', { name: '菜单与提示', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^下拉菜单/ })).toBeVisible()
    await page.getByRole('tab', { name: '状态反馈', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^Chat 空态/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^进度条/ })).toHaveCount(0)
    await page.getByRole('tab', { name: '加载与进度', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^进度条/ })).toBeVisible()
    await page.getByRole('tab', { name: '卡片', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^通用卡片/ })).toBeVisible()
    await page.getByRole('tab', { name: '徽标与标签', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^徽标与标签/ })).toBeVisible()
    await page.getByRole('tab', { name: '按钮', exact: true }).click()
    await expect(page.getByRole('heading', { name: '图标按钮', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '布局与滚动', exact: true }).click()
    await expect(page.getByRole('heading', { name: /^分隔线/ })).toBeVisible()
    await expect(page.getByTestId('divider-boundary-samples')).toBeVisible()
    await expect(page.getByText('分隔线的边界', { exact: true })).toHaveCount(0)

    await nav.getByRole('button', { name: '设计语言', exact: true }).click()
    const designSource = page.getByTestId('playground-source')
    await expect(designSource).toBeVisible()
    await expect(designSource).toHaveAttribute('title', /DesignSystemPanel\.tsx/)
    await expect(designSource).toHaveClass(/w-\[18rem\]/)
    await expect(page.getByTestId('color-role-groups')).toBeVisible()
    await expect(page.getByTestId('color-interaction-matrix')).toContainText('focus / disabled')
    await page.getByRole('button', { name: '主题对照', exact: true }).click()
    await expect(page.getByTestId('theme-study-grid')).toBeVisible()
    for (const studyId of ['porcelain-blue', 'yao-stone', 'song-smoke', 'deep-plum']) {
      await expect(page.getByTestId(`theme-study-${studyId}`)).toBeVisible()
    }
    await expect(page.getByTestId('theme-study-selection')).toContainText('瓷青')
    await page.getByTestId('theme-study-yao-stone').getByRole('button', { name: '设为比较', exact: true }).click()
    await expect(page.getByTestId('theme-study-selection')).toContainText('曜石')
    await expect(page.getByTestId('theme-study-yao-stone')).toContainText('当前比较')
    await expect(page.getByTestId('production-theme-strip')).toContainText('薄雾')
    await page.getByRole('button', { name: '形态与动效', exact: true }).click()
    const radiusSlider = page.getByTestId('radius-controls').getByRole('slider', { name: '自定义圆角', exact: true })
    await expect(radiusSlider).toBeVisible()
    await radiusSlider.fill('24')
    await expect(radiusSlider).toHaveValue('24')
    await expect(page.getByTestId('material-studies')).toBeVisible()
    await expect(page.getByTestId('material-mask')).toContainText('仅浮层')
    const motionSamples = page.getByTestId('motion-samples')
    await expect(motionSamples).toBeVisible()
    await expect(page.getByText('点击播放', { exact: true })).toHaveCount(0)
    await expect(page.getByText('150ms', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '标准', exact: true })).toBeVisible()
    const motionSwitch = motionSamples.getByRole('switch', { name: '动效播放', exact: true })
    await expect(motionSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(motionSamples.getByTestId('motion-sample-motion-fast').getByTestId('motion-sample-bar')).not.toHaveCSS('animation-name', 'none')
    await motionSwitch.click()
    await expect(motionSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(motionSamples.getByTestId('motion-sample-motion-fast').getByTestId('motion-sample-bar')).toHaveCSS('animation-name', 'none')

    await nav.getByRole('button', { name: '图标与视觉', exact: true }).click()
    const visualTitleRow = page.getByTestId('playground-page-title-row')
    const visualSource = page.getByTestId('playground-source')
    await expect(visualSource).toHaveAttribute('title', /UiControlsPanel\.tsx/)
    await expect(visualTitleRow).toContainText('图标与视觉')
    const visualTitleBox = await visualTitleRow.locator('h1').boundingBox()
    const visualSourceBox = await visualSource.boundingBox()
    expect(visualTitleBox).not.toBeNull()
    expect(visualSourceBox).not.toBeNull()
    expect(Math.abs((visualTitleBox?.y ?? 0) - (visualSourceBox?.y ?? 0))).toBeLessThan(12)
    const iconInventory = page.locator('[data-testid="icon-inventory"]')
    await expect(iconInventory).toBeVisible()
    await expect(iconInventory.getByTestId('icon-count')).toBeVisible()
    const iconStory = iconInventory.locator('section').filter({ hasText: 'Lucide 语义图标目录' }).last()
    const iconHeading = iconStory.locator('h4').filter({ hasText: 'Lucide 语义图标目录' }).first()
    const iconCount = iconStory.getByTestId('icon-count')
    await expect(iconStory.getByTestId('story-block-header').getByRole('button', { name: '打开图标搜索', exact: true })).toBeVisible()
    await expect(iconStory.locator('code')).toContainText('src/shared/icon-registry.ts')
    await expect(iconStory.getByTestId('icon-source')).toHaveAttribute('title', /src\/shared\/icon-registry\.ts/)
    await expect(iconStory.getByTestId('icon-source')).toHaveClass(/w-\[10rem\]/)
    const [headingBox, countBox] = await Promise.all([iconHeading.boundingBox(), iconCount.boundingBox()])
    expect(headingBox).not.toBeNull()
    expect(countBox).not.toBeNull()
    expect(Math.abs((headingBox?.y ?? 0) - (countBox?.y ?? 0))).toBeLessThan(4)
    const iconSizeControls = iconInventory.getByTestId('icon-size-controls')
    await expect(iconSizeControls).toBeVisible()
    await expect(iconSizeControls.getByTestId('icon-size-scale')).toContainText('12px')
    await expect(iconSizeControls.getByTestId('icon-size-scale')).toContainText('20px')
    const catalogIcon = iconInventory.getByTestId('icon-catalog-grid').locator('div.flex.h-8.w-8 svg').first()
    await expect(catalogIcon).toHaveAttribute('width', '16')
    const iconSlider = iconSizeControls.getByRole('slider', { name: '自定义图标尺寸', exact: true })
    await expect(iconSlider).toBeVisible()
    await iconSlider.fill('24')
    await expect(iconSlider).toHaveValue('24')
    await expect(iconSizeControls.getByTestId('icon-custom-preview')).toContainText('24px')
    await expect(iconSizeControls.getByTestId('icon-custom-preview').locator('svg').first()).toHaveAttribute('width', '24')
    await expect(catalogIcon).toHaveAttribute('width', '16')
    await iconInventory.getByRole('button', { name: '打开图标搜索', exact: true }).click()
    await expect(page.getByPlaceholder('搜索中文或 English')).toBeVisible()
    await expect(page.getByText('navigation.search', { exact: true })).toHaveCount(0)
    await expect(page.getByText('菜单', { exact: true }).first()).toBeVisible()
    const menuIcon = page.locator('[data-testid="icon-inventory"] div').filter({ hasText: /^菜单Menu$/ }).first()
    await expect(menuIcon).toBeVisible()
    const adoptionMark = menuIcon.getByTestId('adoption-mark')
    await expect(adoptionMark).toBeVisible()
    const markPosition = await menuIcon.evaluate((card) => {
      const mark = card.querySelector('[data-testid="adoption-mark"]')
      if (!mark) throw new Error('adoption mark missing')
      const cardBox = card.getBoundingClientRect()
      const markBox = mark.getBoundingClientRect()
      return { topDelta: markBox.top - cardBox.top, rightDelta: cardBox.right - markBox.right }
    })
    expect(markPosition.topDelta).toBeLessThan(24)
    expect(markPosition.rightDelta).toBeLessThan(24)
    await expect(page.getByText('Menu', { exact: true }).first()).toBeVisible()

    await nav.getByRole('button', { name: 'Chat', exact: true }).click()
    const chatDependencies = page.locator('[data-testid="product-experience-dependencies"]')
    await expect(page.locator('[data-testid="playground-page-header"]').getByTestId('product-experience-dependencies')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-main"] > div > .view-transition > [data-testid="product-experience-dependencies"]')).toHaveCount(0)
    await expect(chatDependencies).toContainText('基础引用')
    await expect(chatDependencies.getByTestId('experience-foundation-parts')).toContainText('空状态')
    await expect(chatDependencies).not.toContainText('experience.chat')
    await expect(chatDependencies).not.toContainText('主侧栏')
    await expect(chatDependencies.getByTestId('experience-source')).toContainText('src/App.tsx')
    await expect(page.getByText('页面基线', { exact: true })).toHaveCount(0)
    await expect(page.getByText('页面组合样张', { exact: true })).toHaveCount(0)
    const titleRow = page.getByTestId('playground-page-title-row')
    await expect(titleRow).toContainText('Chat')
    await expect(titleRow).toContainText('确认伙伴身份、会话导航、欢迎区与消息流的组合关系。')
    const titleBox = await titleRow.locator('h1').boundingBox()
    const descriptionBox = await titleRow.locator('p').boundingBox()
    expect(titleBox).not.toBeNull()
    expect(descriptionBox).not.toBeNull()
    expect(Math.abs((titleBox?.y ?? 0) - (descriptionBox?.y ?? 0))).toBeLessThan(8)
    const chatToolbar = page.getByTestId('chat-surface-toolbar')
    await expect(chatToolbar).toBeVisible()
    await expect(chatToolbar).not.toContainText('src/App.tsx')
    await expect(page.getByText('隔离实验', { exact: true })).toHaveCount(0)
    const candidate = page.locator('[data-testid="surface-sidebar-candidate"]')
    await expect(candidate).toBeVisible()
    await expect(candidate.getByRole('button', { name: '记忆', exact: true })).toHaveCount(0)
    await expect(candidate.getByRole('button', { name: '人物世界', exact: true })).toBeVisible()
    await expect(candidate.getByRole('button', { name: '设置', exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="chat-surface-main"]').getByText('新对话', { exact: true })).toHaveCount(0)

    await nav.getByRole('button', { name: '设置', exact: true }).click()
    await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="settings-panel"]').getByRole('button', { name: '记忆', exact: true })).toBeVisible()

    await nav.getByRole('button', { name: '工作区', exact: true }).click()
    const workspaceDependencies = page.locator('[data-testid="product-experience-dependencies"]')
    await expect(page.locator('[data-testid="playground-page-header"]').getByTestId('product-experience-dependencies')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-main"] > div > .view-transition > [data-testid="product-experience-dependencies"]')).toHaveCount(0)
    await expect(workspaceDependencies).toContainText('基础引用')
    await expect(workspaceDependencies.getByTestId('experience-foundation-parts')).toContainText('文件树')
    await expect(workspaceDependencies.getByTestId('experience-source')).toContainText('ChatRightDock.tsx')
    await expect(workspaceDependencies).not.toContainText('experience.workspace')
    await expect(workspaceDependencies).not.toContainText('右侧工作坞')
    const dock = page.locator('[data-testid="chat-right-dock"]')
    await expect(dock).toContainText('my-agent · 样张项目')
    await expect(dock.getByTestId('right-dock-tab-preview')).toBeVisible()

    await nav.getByRole('button', { name: '人物世界', exact: true }).click()
    await expect(page.getByText('把窗帘拉开了一点，泡了杯乌龙茶，准备先把桌面清出一块。', { exact: true })).toBeVisible()
    await expect(page.getByText('路过河边的时候记下了一个想法：慢一点，反而能看见今天真正想做的事。', { exact: true })).toBeVisible()

    await nav.getByRole('button', { name: '记忆', exact: true }).click()
    const identityFilter = page.locator('[data-testid="memory-category-filters"]').getByRole('button', { name: '身份 (1)', exact: true })
    await expect(identityFilter).toBeVisible()
  })

  test('Playground Toast 四态关闭按钮沿统一右边界对齐', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    await page.locator('[data-testid="playground-nav"]').getByRole('button', { name: '业务状态', exact: true }).click()
    await page.getByRole('tab', { name: '错误与反馈', exact: true }).click()

    const toastStory = page.locator('section').filter({ hasText: 'Toast 四态' }).first()
    const closeButtons = toastStory.getByRole('button', { name: '关闭通知' })
    await expect(closeButtons).toHaveCount(4)
    const rightEdges = await closeButtons.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().right))
    expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThan(1)
  })

  test('Debug 与 Playground 采用一级任务导航', async ({ page }) => {
    await page.goto('/')

    const developerNav = page.locator('[data-testid="sidebar-developer-nav"]')
    const sessionList = page.locator('[data-testid="sidebar-session-list"]')
    await expect(developerNav).toBeVisible()
    await expect(sessionList).toBeVisible()
    expect(await sessionList.evaluate((element, dev) => Boolean(element.compareDocumentPosition(dev as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await developerNav.elementHandle())).toBe(true)

    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Debug', exact: true }).click()
    await expect(page.locator('[data-testid="dev-panel"]')).toBeVisible()
    const debugNav = page.locator('[data-testid="dev-panel"] nav')
    await expect(debugNav.getByRole('button', { name: '提示词管理器', exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '请求与运行', exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '伙伴状态', exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '质量 / Eval', exact: true })).toBeVisible()
    await expect(debugNav.getByRole('button', { name: '上下文', exact: true })).not.toBeVisible()
    await expect(debugNav.getByRole('button', { name: 'LLM 调用', exact: true })).not.toBeVisible()
    await debugNav.getByRole('button', { name: '提示词管理器', exact: true }).click()
    await expect(page.locator('[data-testid="prompt-manager-panel"]')).toBeVisible()
    await expect(page.getByText('统一查看生产 Prompt、伙伴与人格资产、记忆策略、权限与沙箱策略、模型 Provider、Tool schema、Skill、Eval Case / Grader、Eval Judge 与当前 MCP 工具。', { exact: false })).toBeVisible()
    const contextCategories = page.getByLabel('生产资产分类')
    await expect(contextCategories.getByRole('button', { name: '内置工具', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '伙伴世界', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '记忆策略', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '权限与沙箱', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '模型 Provider', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: 'Skills', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: 'Eval Judge', exact: true })).toBeVisible()
    await expect(contextCategories.getByRole('button', { name: '外部 / MCP', exact: true })).toBeVisible()

    await debugNav.getByRole('button', { name: '质量 / Eval', exact: true }).click()
    await expect(page.locator('[data-testid="skill-eval-panel"]')).toBeVisible()
    await expect(page.getByText('验证 Skill 的触发、指南注入、工具边界和回复约束', { exact: false })).toBeVisible()
    await expect(page.getByText('还没有 Skill Eval 报告', { exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="persona-eval-panel"]')).toBeVisible()
    await expect(page.getByText('还没有 Persona Eval 报告', { exact: true })).toBeVisible()

    await debugNav.getByRole('button', { name: '请求与运行', exact: true }).click()
    await expect(page.locator('[data-testid="request-runtime-panel"]')).toBeVisible()
    await expect(page.locator('h2:has-text("请求与运行")')).toBeVisible()

    await page.locator('[data-testid="dev-panel"] button[title="返回聊天"]').click()
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const playgroundShell = page.locator('[data-testid="playground-shell"]')
    await expect(playgroundShell).toBeVisible()
    const playgroundBox = await playgroundShell.boundingBox()
    expect(playgroundBox?.y).toBeLessThan(4)
    expect(playgroundBox?.x).toBeLessThan(4)
    await expect(page.locator('[data-testid="primary-sidebar"]')).toHaveCount(0)
    await expect(page.locator('section[aria-label="基础"]')).toBeVisible()
    await expect(page.locator('section[aria-label="产品体验"]')).toBeVisible()
    await expect(page.locator('section[aria-label="Agent 实验"]')).toBeVisible()
    const playgroundNav = page.locator('[data-testid="playground-nav"]')
    await expect(playgroundNav.getByRole('button', { name: '设计语言', exact: true })).toBeVisible()
    await expect(page.locator('[data-testid="design-system-panel"]').getByRole('button', { name: '重新读取', exact: true })).toHaveCount(0)
    await expect(playgroundNav.getByRole('button', { name: '基础组件', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '模型能力', exact: true })).toBeVisible()
    await expect(playgroundNav.getByRole('button', { name: '组件目录', exact: true })).toHaveCount(0)
    await expect(playgroundNav.getByRole('button', { name: '页面组合', exact: true })).toHaveCount(0)

    await playgroundNav.getByRole('button', { name: '基础组件', exact: true }).click()
    await expect(page.locator('[data-testid="playground-page-header"]')).toContainText('基础组件')
    await expect(page.locator('[data-testid="foundation-components-panel"]')).toBeVisible()
    await expect(page.getByRole('tab', { name: '组件索引', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: '记忆引用', exact: true })).toHaveCount(0)
    for (const tab of ['按钮', '输入与表单', '标签与选择', '弹层', '菜单与提示', '徽标与标签', '状态反馈', '加载与进度', '工具卡', 'Markdown 与资产', '文件与差异', '布局与滚动', '卡片']) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible()
    }
    await expect(page.locator('[data-testid="foundation-asset-inventory"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="playground-story-nav"] [role="tablist"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-story-nav"]')).not.toContainText('基础控件')
    await expect(page.getByText('生成动作', { exact: true })).toBeVisible()
    await playgroundNav.getByRole('button', { name: '图标与视觉', exact: true }).click()
    const iconInventory = page.locator('[data-testid="icon-inventory"]')
    await expect(iconInventory).toBeVisible()
    await iconInventory.getByRole('button', { name: '打开图标搜索', exact: true }).click()
    await expect(page.getByPlaceholder('搜索中文或 English')).toBeVisible()
    await expect(page.getByText('navigation.search', { exact: true })).toHaveCount(0)
    await expect(page.locator('[data-testid="ui-controls-panel"] > div').first()).not.toContainText('基础组件样式')

    const playgroundMain = page.locator('[data-testid="playground-main"]')
    await playgroundNav.getByRole('button', { name: '模型能力', exact: true }).click()
    await expect(playgroundMain.getByRole('heading', { name: '模型能力', exact: true })).toBeVisible()
    await playgroundNav.getByRole('button', { name: '对话试验', exact: true }).click()
    await expect(playgroundMain.getByRole('heading', { name: '对话试验', exact: true })).toBeVisible()
    await playgroundNav.getByRole('button', { name: '工具手测', exact: true }).click()
    await expect(playgroundMain.getByRole('heading', { name: '工具手测', exact: true })).toBeVisible()
  })

  test('Playground 产品体验页面保持基础引用边界', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Playground', exact: true }).click()
    const nav = page.locator('[data-testid="playground-nav"]')

    await nav.getByRole('button', { name: '工作区', exact: true }).click()
    const workspaceDependencies = page.locator('[data-testid="product-experience-dependencies"]')
    await expect(page.locator('[data-testid="playground-page-header"]').getByTestId('product-experience-dependencies')).toHaveCount(1)
    await expect(page.locator('[data-testid="playground-main"] > div > .view-transition > [data-testid="product-experience-dependencies"]')).toHaveCount(0)
    await expect(workspaceDependencies).toContainText('基础引用')
    await expect(workspaceDependencies.getByTestId('experience-foundation-parts')).toContainText('文件树')
    await expect(workspaceDependencies).not.toContainText('experience.workspace')
    await expect(workspaceDependencies).not.toContainText('右侧工作坞')
    const dock = page.locator('[data-testid="chat-right-dock"]')
    await expect(dock).toContainText('my-agent · 样张项目')
    await expect(dock.getByTestId('right-dock-tab-preview')).toBeVisible()
    await expect(dock.getByTestId('right-dock-tab-files')).toHaveCount(0)
    await expect(dock.getByTestId('right-dock-tab-review')).toHaveCount(0)
    await expect(dock.getByTestId('right-dock-tab-terminal')).toHaveCount(0)
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '文件', exact: true }).click()
    await expect(dock.getByTestId('right-dock-tab-files')).toHaveCount(1)
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '文件', exact: true }).click()
    await expect(dock.getByTestId('right-dock-tab-files')).toHaveCount(2)
    expect(await dock.getByTestId('right-dock-add-tab').evaluate((add, close) => Boolean(add.compareDocumentPosition(close as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await dock.getByTestId('right-dock-close-tab').elementHandle())).toBe(true)

    await nav.getByRole('button', { name: '人物世界', exact: true }).click()
    await expect(page.getByText('生活广播（非日志表）', { exact: false })).toHaveCount(0)
    await expect(page.getByText('CATCH-UP', { exact: true })).toHaveCount(0)
    await expect(page.getByText('把窗帘拉开了一点，泡了杯乌龙茶，准备先把桌面清出一块。', { exact: true })).toBeVisible()
    await expect(page.getByText('仅展示近期动态 · 内容由主角的生活事件自然派生', { exact: true })).toBeVisible()
    for (const tabId of ['moments', 'assets', 'cast', 'shelf']) {
      await page.getByTestId(`world-tab-${tabId}`).click()
      await expect(page.getByTestId(`world-tab-${tabId}`)).toHaveAttribute('aria-selected', 'true')
    }
    await expect(page.getByTestId('world-shelf-fixture')).toContainText('当前主角')

    await nav.getByRole('button', { name: '记忆', exact: true }).click()
    const memory = page.locator('[data-testid="memory-surface-candidate"]')
    await expect(memory).toBeVisible()
    await expect(memory.getByRole('button', { name: /身份 \(1\)/ })).toBeVisible()
    await expect(memory.getByRole('button', { name: /工作方式 \(1\)/ })).toBeVisible()
    await expect(memory.getByRole('button', { name: /沟通风格 \(1\)/ })).toBeVisible()
  })

  test('Skills 管理页显示校验、版本和隔离试跑入口', async ({ page }) => {
    await page.goto('/')

    await page.click('button[title="设置"]')
    await page.locator('[data-testid="settings-nav"] button').filter({ hasText: '工具' }).click()
    await page.locator('[data-testid="settings-main"]').getByRole('button', { name: /打开 Skills 面板/ }).click()
    await expect(page.locator('[data-testid="skills-panel"]')).toBeVisible()
    await expect(page.getByText('创建、校验、回滚和隔离试跑 Skill', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ 新建 Skill', exact: true })).toBeVisible()
    await expect(page.getByText('选择或新建一个 Skill', { exact: true })).toBeVisible()
  })

  test('设置自动保存覆盖防抖与立即离开场景', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      const writes: Array<[string, string]> = []
      ;(window as any).__settingsWrites = writes
      ;(window as any).electronAPI = {
        settings: {
          get: async () => ({
            llmApiKeyConfigured: 'true',
            llmBaseUrl: 'https://api.openai.com/v1',
            llmModel: 'gpt-4o',
          }),
          set: async (key: string, value: string) => { writes.push([key, value]) },
        },
        companion: {
          getActive: async () => ({ id: 'lin', name: '小林', description: '沉稳体贴的数字伙伴' }),
          listProtagonists: async () => [],
          getMutable: async () => ({ body: '' }),
          listMutableVersions: async () => [],
        },
        mcp: { status: async () => [] },
      }
    })

    await page.click('button[title="设置"]')
    await page.getByRole('button', { name: '模型', exact: true }).click()
    const baseUrl = page.locator('input[placeholder="https://api.openai.com/v1"]')

    await baseUrl.fill('https://autosave.example/v1')
    await expect.poll(() => page.evaluate(() => (window as any).__settingsWrites.some(
      ([key, value]: [string, string]) => key === 'llmBaseUrl' && value === 'https://autosave.example/v1',
    ))).toBe(true)

    await page.evaluate(() => { (window as any).__settingsWrites.length = 0 })
    await baseUrl.fill('https://flush-on-close.example/v1')
    await page.locator('[data-testid="settings-back"]').click()
    await expect.poll(() => page.evaluate(() => (window as any).__settingsWrites.some(
      ([key, value]: [string, string]) => key === 'llmBaseUrl' && value === 'https://flush-on-close.example/v1',
    ))).toBe(true)
  })

  test('设置面板无手动保存栏并可返回聊天', async ({ page }) => {
    await page.goto('/')

    await page.click('button[title="设置"]')
    // Vite 模式下 electronAPI 不存在，但面板结构和自动保存交互文案仍可验收。
    const settingsPanel = page.locator('[data-testid="settings-panel"]')
    await expect(settingsPanel).toBeVisible()
    await expect(page.locator('[data-testid="settings-main"] > div').first()).not.toHaveClass(/border-b/)
    await expect(settingsPanel.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '模型', exact: true }).click()
    await expect(page.getByText('填写内容会自动保存在本机', { exact: false })).toBeVisible()
    await expect(page.locator('[data-testid="test-connection"]')).toBeVisible()

    await page.locator('[data-testid="settings-back"]').click()
    await expect(settingsPanel).not.toBeVisible()
  })
})
