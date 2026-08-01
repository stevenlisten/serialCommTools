const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-first-run']
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html');
  await page.waitForTimeout(800);
  const r1 = await page.evaluate(async () => {
    const ports = await navigator.serial.getPorts();
    return 'getPorts=' + ports.length;
  });
  console.log('before:', r1);
  const r2 = await page.evaluate(() => new Promise((res) => {
    let done = false;
    const finish = (s) => { if (!done) { done = true; res(s); } };
    navigator.serial.requestPort().then(
      (p) => finish('requestPort resolved, info=' + JSON.stringify(p.getInfo())),
      (e) => finish('requestPort rejected: ' + e.message)
    );
    setTimeout(() => finish('requestPort timeout(4s)'), 4000);
  }));
  console.log('requestPort:', r2);
  await browser.close();
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });