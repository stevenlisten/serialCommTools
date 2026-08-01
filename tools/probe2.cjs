const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-first-run']
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html');
  const cdp = await ctx.newCDPSession(page);
  try {
    await cdp.send('Browser.grantPermissions', { origin: 'file://', permissions: ['serial'] });
    console.log('grantPermissions ok');
  } catch (e) { console.log('grantPermissions fail:', e.message); }
  await page.waitForTimeout(500);
  await page.click('#btn-connect');
  await page.waitForTimeout(5000);
  const btn = (await page.textContent('#btn-connect')).trim();
  const st = (await page.textContent('#st-text')).trim();
  const selOptions = await page.locator('#sel-port option').count();
  console.log('after 5s: btn=' + btn + ' | status=' + st + ' | port options=' + selOptions);
  await browser.close();
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });