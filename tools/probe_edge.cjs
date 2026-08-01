const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    args: ['--no-first-run']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html');
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => ({
    serial: typeof navigator.serial,
    baud: document.querySelectorAll('#sel-baud option').length,
    viewer: !!document.querySelector('#viewer'),
    title: document.title
  }));
  console.log(JSON.stringify(r));
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch(e => { console.error('EDGE FAIL:', e.message); process.exit(1); });