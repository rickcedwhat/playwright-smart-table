// CI Group B: integration tests requiring dedicated app servers.
// Spins up MUI DataGrid (3050), RDG grid (3060), the mui.com docs replica (3070) and the
// Glide "Add data" story replica (3080).
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
    {
      command: 'npm run dev',
      cwd: 'tests/apps/mui-docs',
      port: 3070,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      cwd: 'tests/apps/glide-grid',
      port: 3080,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
