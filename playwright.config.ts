import { defineConfig } from '@playwright/test'

// 多个 Playwright 命令可能同时启动 UI webServer；共享 outDir 会让 Vite 复制静态文件时互相锁定。
// 按一次 Playwright 运行隔离构建目录与端口；worker 会重新加载配置，端口必须通过环境变量保持一致。
const uiPort = Number.parseInt(process.env.MY_AGENT_UI_E2E_PORT ?? '', 10) || (5200 + (process.pid % 200))
process.env.MY_AGENT_UI_E2E_PORT = String(uiPort)
const uiDist = `var/verification/ui-dist-${uiPort}`

const localNoProxy = ['127.0.0.1', 'localhost']
for (const key of ['NO_PROXY', 'no_proxy']) {
  const existing = process.env[key]?.split(',').map((value) => value.trim()).filter(Boolean) ?? []
  process.env[key] = [...new Set([...existing, ...localNoProxy])].join(',')
}
export default defineConfig({
  testDir: './__tests__/e2e',
  timeout: 60000,
  retries: 0,
  projects: [
    {
      name: 'ui',
      testMatch: ['chat.test.ts', 'chat-input-boundaries.test.ts', 'markdown-theme.test.ts', 'checkbox.test.ts', 'mcp-oauth-ui.test.ts', 'design-language.test.ts', 'contacts-candidate.test.ts', 'debug-candidate.test.ts', 'debug-schedule-production.test.ts', 'debug-recent-production.test.ts', 'debug-recent.test.ts', 'debug-activity.test.ts', 'debug-now.test.ts', 'debug-now-production.test.ts', 'debug-character.test.ts', 'debug-character-production.test.ts', 'debug-location.test.ts', 'debug-location-production.test.ts', 'debug-residence.test.ts', 'debug-residence-production.test.ts', 'debug-footprints.test.ts', 'debug-footprints-production.test.ts', 'debug-growth.test.ts', 'debug-growth-production.test.ts', 'debug-moments.test.ts', 'debug-moments-production.test.ts', 'debug-relations.test.ts', 'debug-relations-production.test.ts', 'debug-proactive.test.ts', 'debug-proactive-production.test.ts', 'debug-wardrobe.test.ts', 'debug-wardrobe-production.test.ts', 'debug-culture.test.ts', 'debug-culture-production.test.ts', 'debug-links.test.ts', 'debug-links-production.test.ts', 'debug-context.test.ts', 'debug-profile.test.ts', 'debug-profile-production.test.ts', 'debug-memories.test.ts', 'debug-memory-production.test.ts', 'debug-traces.test.ts', 'debug-traces-production.test.ts', 'debug-events.test.ts', 'debug-events-production.test.ts', 'debug-system.test.ts', 'debug-quality.test.ts', 'debug-skill-production.test.ts', 'debug-persona-production.test.ts', 'debug-tools.test.ts', 'debug-runs.test.ts', 'debug-capability-candidate.test.ts'],
      use: {
        baseURL: `http://127.0.0.1:${uiPort}`,
        channel: 'chrome',
        trace: 'retain-on-failure',
      },
    },
  ],
  webServer: {
    // 开发目录变动曾在操作中触发整页重载；测试使用一次性 ui-e2e 构建，保留隔离模式但不连接 HMR。
    // 独立端口且禁止复用已有服务，防止测试命中用户开发页或过期构建；5174 继续留给人工验收。
    command: `npx vite build --mode ui-e2e --outDir ${uiDist} && npx vite preview --mode ui-e2e --outDir ${uiDist} --host 127.0.0.1 --port ${uiPort} --strictPort`,
    url: `http://127.0.0.1:${uiPort}`,
    reuseExistingServer: false,
    timeout: 60000,
  },
})
