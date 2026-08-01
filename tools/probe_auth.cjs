const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const ctx = await chromium.launchPersistentContext('C:/tools/chrome-serial-profile', {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-first-run']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html');
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const ports = await navigator.serial.getPorts();
    return { count: ports.length, info: ports.map(p => { try { return p.getInfo(); } catch (e) { return {}; } }) };
  });
  console.log(JSON.stringify(r));
  await ctx.close();
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });