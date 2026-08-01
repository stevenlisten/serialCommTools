const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html?test=1');
  await page.waitForFunction(() => window.__test !== undefined);
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true);
  // 模拟 T28 尾部：暂停→hex feed→恢复→清空
  await page.check('#chk-pause');
  await page.evaluate(() => window.__test.feedBytes(Array.from({ length: 20 }, (_, i) => i)));
  await page.waitForTimeout(600);
  await page.uncheck('#chk-pause');
  await page.waitForTimeout(400);
  await page.click('#btn-clear');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({
    display: document.getElementById('empty-state').style.display,
    lineCount: document.querySelectorAll('#viewer .line').length,
    logLen: window.__test.log().length
  }));
  console.log(JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });