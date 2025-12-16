import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Generator Tools', () => {

  // Setup a dummy table for the tests
  test.beforeEach(async ({ page }) => {
    await page.setContent(`
      <div class="container">
        <table id="test-table">
          <thead>
            <tr><th>Name</th><th>Role</th></tr>
          </thead>
          <tbody>
            <tr><td>Alice</td><td>Admin</td></tr>
            <tr><td>Bob</td><td>User</td></tr>
          </tbody>
        </table>
        <button id="next-page">Next</button>
      </div>
    `);
  });

  test('generateConfigPrompt outputs to console by default', async ({ page }) => {
    const table = useTable(page.locator('#test-table'));
    
    // Spy on Node.js console.log
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: any) => logs.push(String(msg));

    try {
      await table.generateConfigPrompt();
    } finally {
      console.log = originalLog; // Restore
    }

    const output = logs.join('\n');
    expect(output).toContain("COPY INTO GEMINI/ChatGPT");
    expect(output).toContain("Generate config for:");
    expect(output).toContain("<tr><th>Name</th><th>Role</th></tr>");
  });

  test('generateConfigPrompt includes types by default', async ({ page }) => {
    const table = useTable(page.locator('#test-table'));
    
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: any) => logs.push(String(msg));

    try {
      await table.generateConfigPrompt(); // Default includeTypes: true
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    expect(output).toContain("Useful TypeScript Definitions");
    expect(output).toContain("interface TableConfig");
  });

  test('generateConfigPrompt excludes types when requested', async ({ page }) => {
    const table = useTable(page.locator('#test-table'));
    
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: any) => logs.push(String(msg));

    try {
      await table.generateConfigPrompt({ includeTypes: false });
    } finally {
      console.log = originalLog;
    }

    const output = logs.join('\n');
    expect(output).not.toContain("Useful TypeScript Definitions");
    expect(output).not.toContain("interface TableConfig");
  });

});