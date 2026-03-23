import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PLAYWRIGHT_SMART_TABLE_VERSION } from '../../src/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('PLAYWRIGHT_SMART_TABLE_VERSION', () => {
  it('matches root package.json version', () => {
    const pkgPath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
    expect(PLAYWRIGHT_SMART_TABLE_VERSION).toBe(pkg.version);
    expect(typeof PLAYWRIGHT_SMART_TABLE_VERSION).toBe('string');
    expect(PLAYWRIGHT_SMART_TABLE_VERSION.length).toBeGreaterThan(0);
  });
});
