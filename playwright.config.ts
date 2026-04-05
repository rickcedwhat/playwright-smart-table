// playwright.config.ts
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  /* Run tests in files in parallel */
  // Run all tests in parallel.
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: isCI,

  // Retry on CI only.
  retries: isCI ? 2 : 0,

  // CI: use 2 workers on typical 2-vCPU GHA runners (was 1, which serialized everything).
  workers: isCI ? 2 : undefined,

  // Reporter to use
  reporter: 'html',

  use: {
    // Local: full trace/video for debugging. CI: keep artifacts only on failure (much faster).
    trace: isCI ? 'retain-on-failure' : 'on',
    video: isCI ? 'retain-on-failure' : 'on',

    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev',
      cwd: 'playground',
      port: 3000,
      reuseExistingServer: !isCI,
      timeout: 120 * 1000, // Increase to 2 minutes for slow CI environments
    },
    {
      command: 'npm run dev',
      cwd: 'tests/apps/mui-datagrid',
      port: 3050,
      reuseExistingServer: !isCI,
      timeout: 120 * 1000,
    },
  ],
});