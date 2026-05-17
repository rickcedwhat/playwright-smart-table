import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  console.log('Navigating...');
  await page.goto('https://grid.glideapps.com/', { waitUntil: 'networkidle' });
  
  const signals = await page.evaluate(() => {
    const classes = new Set();
    const roles = new Set();
    const data = new Set();
    
    document.querySelectorAll('*').forEach(el => {
      el.classList.forEach(c => classes.add(c));
      const role = el.getAttribute('role');
      if (role) roles.add(role);
      for (const attr of el.getAttributeNames()) {
        if (attr.startsWith('data-') || attr.startsWith('aria-')) data.add(attr);
      }
    });
    
    const canvasCount = document.querySelectorAll('canvas').length;
    
    return {
      classes: Array.from(classes).slice(0, 50), // top 50
      roles: Array.from(roles),
      data: Array.from(data),
      canvasCount
    };
  });
  
  console.log(JSON.stringify(signals, null, 2));
  await browser.close();
}

run().catch((err) => {
  console.error('dump_glide failed:', err);
  process.exit(1);
});
