// CI Group A: unit tests + all core/playground specs
// Spins up the playground server only (port 3000).
// Group B (playwright.config.ci-b.ts) handles external-URL and MUI DataGrid integration tests.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // Exclude the specs that belong to Group B (external URLs + MUI DataGrid server)
  testIgnore: [
    '**/integration/mui-data-grid.spec.ts',
    '**/integration/glide.spec.ts',
    '**/integration/rdg.spec.ts',
    '**/integration/mui-table.spec.ts',
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
      cwd: 'playground',
      port: 3000,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
