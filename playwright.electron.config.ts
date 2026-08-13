import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: ['electron.test.ts', 'onboarding.test.ts'],
  timeout: 60000,
  retries: 0,
  workers: 1,
})
