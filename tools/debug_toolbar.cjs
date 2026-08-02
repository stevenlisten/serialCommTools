const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html?test=1');
  await page.waitForFunction(() => window.__test !== undefined);
  const r = await page.evaluate(() => {
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return {
      toolbar: rect('.toolbar'),
      filteronly: rect('#btn-filteronly'),
      slider: rect('.switch .slider'),
      alarm: rect('.alarm'),
      autolog: rect('#chk-autolog'),
      logdir: rect('#btn-logdir'),
      stauto: rect('#st-autolog'),
      export: rect('#btn-export'),
      toolbarScrollW: document.querySelector('.toolbar').scrollWidth,
      toolbarClientW: document.querySelector('.toolbar').clientWidth
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await page.screenshot({ path: 'C:/tools/toolbar_debug.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });