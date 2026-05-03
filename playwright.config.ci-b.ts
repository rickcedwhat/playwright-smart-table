// CI Group B: external-URL integration tests + MUI DataGrid server test
// Spins up the MUI DataGrid app server only (port 3050).
// Group A (playwright.config.ci-a.ts) handles unit tests and core/playground specs.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  testMatch: '**/*.spec.ts',
  // Exclude the self-contained dedupe test — it lives in Group A
  testIgnore: [
    '**/virtualized-horizontal-dedupe.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: true,
  retries: 2,
  workers: 2,
  reporter: 'html',
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: 'tests/apps/mui-datagrid',
      port: 3050,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
