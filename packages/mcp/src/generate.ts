import { proposalSchema, type Proposal } from './workflow-contracts.js';

/** Only JSON literals are inserted into trusted source. No arbitrary JS proposals. */
export function generateConfig(raw: Proposal) {
    const proposal = proposalSchema.parse(raw);
    return `import { Strategies, type TableConfig, type TableContext } from '@rickcedwhat/playwright-smart-table';
import type { Page } from '@playwright/test';
export const proposal: { root: string; header: string; row: string; cell: string; idAttribute: 'data-id'; pagination?: { next: string; previous: string } } = ${JSON.stringify(proposal, null, 2)};
export function createConfig(page: Page, beforeAction: (selector: string, name: string) => Promise<void>): TableConfig {
  const root = page.locator(proposal.root);
  const fingerprint = () => root.locator(proposal.row).evaluateAll(rows => JSON.stringify(rows.map(row => [row.getAttribute('data-id'), (row.textContent ?? '').trim()])));
  const strategies: NonNullable<TableConfig['strategies']> = {
    dedupe: async row => {
      const id = await row.getAttribute('data-id');
      if (!id) throw new Error('Missing identity candidate during extraction');
      return id;
    },
  };
  ${proposal.pagination ? `const controls = proposal.pagination!;
  const click = Strategies.Pagination.click({ next: () => page.locator(controls.next), previous: () => page.locator(controls.previous) }, {
    timeout: 1000,
    stabilization: async (_context, action) => {
      const before = await fingerprint(); await action();
      const end = Date.now() + 1000;
      while (Date.now() < end) {
        if (await fingerprint() !== before) return true;
        await page.waitForTimeout(25);
      }
      return false;
    },
  });
  const move = (selector: string, name: string, action: NonNullable<typeof click.goNext>) => async (context: TableContext) => {
    if (await page.locator(selector).isDisabled()) return false;
    await beforeAction(selector, name);
    return action(context);
  };
  const goNext = move(controls.next, 'next', click.goNext!);
  const goPrevious = move(controls.previous, 'previous', click.goPrevious!);
  strategies.pagination = { goNext, goPrevious, goToFirst: async context => {
    while (!await page.locator(controls.previous).isDisabled()) {
      if (!await goPrevious(context)) return false;
    }
    return true;
  } };` : 'void fingerprint; void beforeAction;'}
  return { headerSelector: proposal.header, rowSelector: proposal.row, cellSelector: proposal.cell, autoScroll: false, strategies };
}
`;
}
