import type { Proposal } from './workflow-contracts.js';
export function generateVirtualConfig(proposal: Proposal) {
    return `import { Strategies, type TableConfig } from '@rickcedwhat/playwright-smart-table';
import type { Page } from '@playwright/test';
export const proposal: {root:string;header:string;row:string;cell:string;idAttribute:'data-id';virtualization:{scroller:string;rowHeight:number};expectedState?:{sessionId:string;revision:number;fingerprint:string}} = ${JSON.stringify(proposal, null, 2)};
export function createConfig(page: Page, beforeAction: (selector: string, name: string) => Promise<void>): TableConfig {
  const scroller = page.locator(proposal.virtualization.scroller);
  const ready = async () => {
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.getAttribute('aria-busy') === 'false';
    }, proposal.root, {timeout:1500});
  };
  const pagination = Strategies.Pagination.infiniteScroll({ action:'js-scroll', scrollTarget: () => scroller,
    stabilization: async (_context, action) => { const before = await scroller.evaluate(el=>el.scrollTop); await action(); await ready(); return await scroller.evaluate(el=>el.scrollTop) !== before; }
  });
  const next = pagination.goNext!, first = pagination.goToFirst!;
  pagination.goNext = async context => {
    const bottom = await scroller.evaluate(el=>el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    if(bottom)return false;
    await beforeAction(proposal.virtualization.scroller, 'scroll');
    return next(context);
  };
  pagination.goToFirst = async context => {
    if(await scroller.evaluate(el=>el.scrollTop===0 && el.scrollLeft===0))return true;
    await beforeAction(proposal.virtualization.scroller, 'scroll');
    await first(context); await ready(); return await scroller.evaluate(el=>el.scrollTop===0);
  };
  return {headerSelector:proposal.header,rowSelector:proposal.row,cellSelector:proposal.cell,autoScroll:false,
    strategies:{pagination,
      dedupe:async row=>{const id=await row.getAttribute('data-id');if(!id)throw new Error('identity-unknown');return id;},
      resolveRowIndex:async row=>{
        const value=await row.getAttribute('data-index'); const index=value?.trim()?Number(value):NaN;
        if(!Number.isInteger(index)||index<0)throw new Error('Invalid logical index');
        const selector=await row.evaluate(el=>'[data-id="'+CSS.escape(el.getAttribute('data-id')!)+'"]');
        return {index,selector};
      },
      viewport:Strategies.Viewport.dataAttribute({scrollContainer:proposal.virtualization.scroller,rowAttribute:'data-index',columnAttribute:'aria-colindex',columnOffset:1,rowHeight:proposal.virtualization.rowHeight,scrollPadding:0})
    }};
}
`;
}
