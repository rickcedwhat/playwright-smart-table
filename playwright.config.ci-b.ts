// CI Group B: integration tests requiring dedicated app servers.
// Spins up MUI DataGrid (port 3050) and RDG grid (port 3060).
// Group A (playwright.config.ci-a.ts) handles unit tests and core/playground specs.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  testMatch: '**/*.spec.ts',
  // Exclude the self-contained dedupe test — it lives in Group A
  testIgnore: [
    '**/virtualized-horizontal-dedupe.spec.ts',
    '**/mui-datagrid-live*.spec.ts',
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
    {
      command: 'npm run dev',
      cwd: 'tests/apps/rdg-grid',
      port: 3060,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
