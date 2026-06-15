import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  timeout: 60000,
  retries: 0,
  projects: [
    {
      name: 'ui',
      testMatch: 'chat.test.ts',
      use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
      },
    },
    {
      name: 'electron',
      testMatch: 'electron.test.ts',
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
