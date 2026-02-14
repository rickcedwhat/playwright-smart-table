// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  /* Run tests in files in parallel */
  // Run all tests in parallel.
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only.
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  use: {
    // Collect trace when retrying the failed test.
    // Setting to 'on' forces it for every run (useful for debugging now).
    trace: 'on',

    // Record video for every run
    video: 'on',

    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    cwd: 'playground',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});