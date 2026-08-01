const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html?test=1');
  await page.waitForFunction(() => window.__test !== undefined);
  // 连接
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true);
  // 清空 + 立即 feed（模拟 T28 时序）
  await page.click('#btn-clear');
  await page.evaluate(() => window.__test.feed('a\r\nb\rc\n'));
  await page.waitForTimeout(600);
  const dump = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#viewer .line').forEach(el => out.push(el.className + ' | ' + JSON.stringify(el.textContent)));
    return { lines: out, pending: window.__test.state().pending, log: window.__test.log().map(e => e.ascii) };
  });
  console.log(JSON.stringify(dump, null, 1));
  console.log('errors:', errs.join(' | ') || 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });