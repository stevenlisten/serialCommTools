const path = require('path');
const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-first-run', '--enable-experimental-web-platform-features']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['serial']
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html');
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => ({ serial: typeof navigator.serial, granted: (navigator.serial ? navigator.serial.getPorts().then(p => p.length) : -1) }));
  console.log('before:', JSON.stringify(before));
  await page.click('#btn-connect');
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => window.__test ? 'test-mode' : ({
    connected: window.__appState ? window.__appState.connected : 'unknown',
    btn: document.querySelector('#btn-connect') ? document.querySelector('#btn-connect').textContent.trim() : '?'
  }));
  // 页面没有暴露 __appState；改用按钮文案与状态栏判断
  const btn = await page.textContent('#btn-connect').then(t => t.trim()).catch(() => '?');
  const st = await page.textContent('#st-text').catch(() => '?');
  console.log('after click btn:', btn, '| status:', st);
  console.log('console logs:', logs.filter(l => l.includes('error') || l.includes('Error')).slice(0, 3));
  await browser.close();
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });