/**
 * E2E 自动化测试：serial-monitor.html（?test=1 注入虚拟串口）
 * 运行：node tools/e2e_test.cjs
 * 依赖：playwright-core（C:\tools\node-selftest）
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP_URL = 'file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html?test=1';
const SHOT_DIR = 'C:/01_Dev/Ai/chatgpt/serialCommTools/records/T001-step6';

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  OK ' + name); }
  else { failed++; failures.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
async function waitTest(page) {
  await page.waitForFunction(() => window.__test !== undefined, null, { timeout: 8000 });
}
async function feed(page, text) {
  await page.evaluate((t) => window.__test.feed(t), text);
}
async function feedBytes(page, arr) {
  await page.evaluate((a) => window.__test.feedBytes(a), arr);
}
(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-first-run']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  console.log('== T1 page load ==');
  await page.goto(APP_URL);
  await waitTest(page);
  check('title correct', (await page.title()).includes('Serial Listener'));
  check('UI rendered', await page.locator('#btn-connect').isVisible() && await page.locator('#viewer').isVisible());

  console.log('== T2 connect ==');
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  check('connected', await page.evaluate(() => window.__test.state().connected));
  const btnText2 = (await page.textContent('#btn-connect')).trim();
  check('button shows disconnect', btnText2 === '断开', 'actual: ' + btnText2);
  check('status shows connected', (await page.textContent('#st-text')).includes('已连接'));

  console.log('== T3 text receive ==');
  await feed(page, 'Hello World\n第二行数据\n');
  await page.waitForTimeout(300);
  const v1 = await page.evaluate(() => window.__test.viewerText());
  check('shows Hello World', v1.includes('Hello World'));
  check('shows chinese line', v1.includes('第二行数据'));
  check('timestamps present', await page.locator('.line .ts').count() > 0);
  check('rx counter > 0', await page.evaluate(() => window.__test.state().rx) > 0);
  await page.screenshot({ path: path.join(SHOT_DIR, 'UI-01-text-receive.png') });

  console.log('== T4 hex mode ==');
  await page.click('#seg-mode button[data-mode="hex"]');
  await feedBytes(page, [0x48, 0x65, 0x00, 0xFF, 0x1A, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x4B, 0x4C]);
  await page.waitForTimeout(300);
  const v2 = await page.evaluate(() => window.__test.viewerText());
  check('hex line shown', v2.includes('48 65 00 FF'));
  check('hex ascii column', v2.includes('He'));
  await page.screenshot({ path: path.join(SHOT_DIR, 'UI-02-hex-mode.png') });
  await page.click('#seg-mode button[data-mode="ascii"]');

  console.log('== T5 timestamp toggle ==');
  await page.uncheck('#chk-ts');
  await feed(page, 'NoTsLine\n');
  await page.waitForTimeout(250);
  const tsOff = await page.evaluate(() => document.body.classList.contains('ts-off'));
  check('ts-off class set', tsOff);
  await page.check('#chk-ts');

  console.log('== T6 filter/highlight/only ==');
  await feed(page, 'alpha beta\nalpha only\nnothing here\n');
  await page.waitForTimeout(250);
  await page.fill('#in-filter', 'alpha');
  await page.waitForTimeout(500);
  check('mark highlight appears', await page.locator('.line mark').count() > 0);
  await page.click('#btn-filteronly');
  await page.waitForTimeout(200);
  const allLines = await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line')).map(l => l.textContent));
  check('filter-only shows matching lines', allLines.every(t => t.includes('alpha')));
  await page.screenshot({ path: path.join(SHOT_DIR, 'UI-03-filter.png') });
  await page.click('#btn-filteronly');
  await page.fill('#in-filter', '');
  await page.waitForTimeout(500);

  console.log('== T7 alarm ==');
  await page.click('.switch');
  await page.fill('#in-alarm', 'ALERT,错误');
  await page.waitForTimeout(500);
  await feed(page, 'normal data\nALERT: temperature high\n');
  await page.waitForTimeout(300);
  const titleAfter = await page.title();
  check('alarm triggered (title)', titleAfter.includes('报警'));
  check('alarm toast shown', await page.locator('.toast.warn').count() > 0);
  await page.waitForTimeout(4500);
  check('title restored', (await page.title()).includes('Serial Listener'));
  await page.screenshot({ path: path.join(SHOT_DIR, 'UI-04-alarm.png') });
  await page.click('.switch');

  console.log('== T8 send text+CRLF ==');
  await page.fill('#in-send', 'AT');
  await page.selectOption('#sel-crlf', 'CRLF');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  check('text send bytes=4', await page.evaluate(() => window.__test.txBytes()) === 4);
  check('tx counter=4', await page.evaluate(() => window.__test.state().tx) === 4);

  console.log('== T9 send hex ==');
  await page.selectOption('#sel-sendmode', 'hex');
  await page.fill('#in-send', '48 65 6C 6C 6F');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  const txAll = await page.evaluate(() => window.__test.txAll());
  const hexBytes = txAll.bytes[1] ? Array.from(txAll.bytes[1]) : [];
  check('hex send 5 bytes', hexBytes.length === 5 && hexBytes[0] === 0x48 && hexBytes[4] === 0x6F);
  await page.selectOption('#sel-sendmode', 'ascii');

  console.log('== T10 quick send ==');
  await page.fill('#in-send', 'QUICK1');
  await page.click('#btn-quickadd');
  await page.waitForTimeout(200);
  check('chip added', await page.locator('.chip').count() >= 5, 'count=' + await page.locator('.chip').count());
  const txBefore = await page.evaluate(() => window.__test.txBytes());
  await page.locator('.chip', { hasText: 'QUICK1' }).click();
  await page.waitForTimeout(300);
  check('chip click sends', await page.evaluate(() => window.__test.txBytes()) > txBefore);

  console.log('== T11 export ==');
  await feed(page, 'EXPORT ME\n');
  await page.waitForTimeout(250);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }),
    page.click('#btn-export')
  ]);
  const dlPath = path.join(SHOT_DIR, 'exported.log');
  await download.saveAs(dlPath);
  const dlContent = fs.readFileSync(dlPath, 'utf8');
  check('log file saved', fs.existsSync(dlPath));
  check('log has timestamp+content', dlContent.includes('EXPORT ME') && dlContent.includes('['));

  console.log('== T12 pause/resume ==');
  await page.check('#chk-pause');
  await feed(page, 'paused line 1\npaused line 2\n');
  await page.waitForTimeout(300);
  check('pause banner visible', await page.locator('#pause-banner').isVisible());
  const pausedCount = await page.evaluate(() => window.__test.state().pausedBuf.length);
  check('paused buffer=2', pausedCount === 2);
  await page.uncheck('#chk-pause');
  await page.waitForTimeout(300);
  check('resume shows buffered', await page.evaluate(() => window.__test.viewerText().includes('paused line 1')));
  check('pause banner hidden', !(await page.locator('#pause-banner').isVisible()));

  console.log('== T13 big data ==');
  const big = 'X'.repeat(65536);
  for (let i = 0; i < 16; i++) await feed(page, big + '\n');
  await page.waitForTimeout(1500);
  const lineCount = await page.evaluate(() => document.querySelectorAll('#viewer .line').length);
  check('dom lines capped (<=6100)', lineCount <= 6100);
  const rxBig = await page.evaluate(() => window.__test.state().rx);
  check('rx >= 1MB', rxBig >= 1048576);

  console.log('== T14 clear ==');
  await page.click('#btn-clear');
  await page.waitForTimeout(250);
  check('viewer empty after clear', await page.evaluate(() => document.querySelectorAll('#viewer .line').length) === 0);
  check('rx reset', await page.evaluate(() => window.__test.state().rx) === 0);

  console.log('== T15 persistence ==');
  await page.fill('#in-filter', 'persistKey');
  await page.waitForTimeout(600);
  await page.reload();
  await waitTest(page);
  check('filter restored after reload', await page.inputValue('#in-filter') === 'persistKey');
  check('settings restored', await page.evaluate(() => window.__test.settings().filter) === 'persistKey');

  console.log('== T16 disconnect/reconnect ==');
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  check('disconnect ok', !(await page.evaluate(() => window.__test.state().connected)));
  check('status shows disconnected', (await page.textContent('#st-text')).includes('未连接'));
  check('button shows reconnect', (await page.textContent('#btn-connect')).trim() === '重连');
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  check('reconnect ok', await page.evaluate(() => window.__test.state().connected));

  console.log('== T17 simulated drop ==');
  await page.evaluate(() => window.__test.drop());
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  check('drop detected', !(await page.evaluate(() => window.__test.state().connected)));
  check('error toast shown', await page.locator('.toast.err').count() > 0);

  console.log('== T18 control chars / history / aria ==');
  // 先重连（T17 已断开）
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  // 控制字符 Ctrl+C -> 0x03
  const txBefore2 = await page.evaluate(() => window.__test.txBytes());
  await page.focus('#in-send');
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(300);
  const added = await page.evaluate(() => window.__test.txBytes()) - txBefore2;
  check('Ctrl+C 发送 0x03', added === 1, 'added=' + added);
  // 命令历史：发送后 ↑ 恢复
  await page.fill('#in-send', 'HISTORY-CMD');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  await page.fill('#in-send', '');
  await page.keyboard.press('ArrowUp');
  check('ArrowUp 恢复历史', await page.inputValue('#in-send') === 'HISTORY-CMD', 'value=' + await page.inputValue('#in-send'));
  await page.keyboard.press('ArrowDown');
  check('ArrowDown 清空', await page.inputValue('#in-send') === '', 'value=' + await page.inputValue('#in-send'));
  // ARIA
  check('ARIA viewer role=log', await page.getAttribute('#viewer', 'role') === 'log');
  check('ARIA connect label', (await page.getAttribute('#btn-connect', 'aria-label')) !== null);

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

  await page.screenshot({ path: path.join(SHOT_DIR, 'UI-05-final.png') });
  await browser.close();

  console.log('\n========== RESULT: ' + passed + ' passed / ' + failed + ' failed ==========');
  if (failures.length) { console.log('failures:\n- ' + failures.join('\n- ')); process.exit(1); }
})().catch((e) => { console.error('E2E error: ', e); process.exit(2); });