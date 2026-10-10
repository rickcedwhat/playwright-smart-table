// Non-blocking drift check against the real third-party sites (#474).
// PR CI runs these same specs against local replicas; see tests/support/sites.ts.
import { defineConfig } from '@playwright/test';

process.env.SMART_TABLE_LIVE_SITES = '1';

export default defineConfig({
  testDir: './tests',
  testMatch: [
    'integration/mui-datagrid-live*.spec.ts',
    'integration/mui-table.spec.ts',
    'integration/glide.spec.ts',
    'readme_verification.spec.ts',
  ],
  workers: 1,
  retries: 1,
  reporter: 'line',
  use: {
    headless: true,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 900 },
  },
});
