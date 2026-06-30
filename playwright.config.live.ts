import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  testMatch: '**/mui-datagrid-live*.spec.ts',
  workers: 1,
  retries: 1,
  reporter: 'line',
  use: {
    headless: true,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
});
