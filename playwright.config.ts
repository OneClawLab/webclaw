import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  use: {
    // Electron tests don't use a browser baseURL
  },
  // Run E2E tests serially (Electron app is a singleton)
  workers: 1,
})
