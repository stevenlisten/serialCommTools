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

  console.log('== T19 hex mode semantics ==');
  // 确保当前为连接状态（T18 结束时可能已连接，避免误触发断开）
  if (await page.evaluate(() => window.__test.state().connected)) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.click('#seg-mode button[data-mode="hex"]');
  await page.waitForTimeout(300);
  await feed(page, 'Hello\nWorld\n');
  await page.waitForTimeout(500);
  check('hex 模式无文本行(txtline=0)', await page.evaluate(() => document.querySelectorAll('#viewer .line.txtline').length) === 0, 'txtline=' + await page.evaluate(() => document.querySelectorAll('#viewer .line.txtline').length));
  check('hex 行含 48 65 6C', await page.evaluate(() => document.querySelector('#viewer').textContent.includes('48 65 6C')));
  // hex 模式报警
  await page.click('.switch'); // 开报警
  await page.fill('#in-alarm', 'ALERT');
  await page.waitForTimeout(500);
  await feed(page, 'ALERT: boom\n');
  await page.waitForTimeout(400);
  check('hex 模式报警触发', (await page.title()).includes('报警'));
  await page.click('.switch'); // 关报警
  await page.waitForTimeout(4200);
  // hex 模式 filterOnly + 高亮
  await page.fill('#in-filter', 'FE');
  await page.waitForTimeout(600);
  await page.click('#btn-filteronly');
  await page.waitForTimeout(300);
  const hexCount0 = await page.evaluate(() => document.querySelectorAll('#viewer .line.hexline').length);
  await feedBytes(page, [0xFE,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  await page.waitForTimeout(500);
  const hexCount1 = await page.evaluate(() => document.querySelectorAll('#viewer .line.hexline').length);
  check('含FE行显示(filterOnly)', hexCount1 === hexCount0 + 1, hexCount0 + '->' + hexCount1);
  check('hex 高亮 mark 出现', await page.locator('#viewer .line mark').count() > 0);
  await feedBytes(page, [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]);
  await page.waitForTimeout(500);
  const hexCount2 = await page.evaluate(() => document.querySelectorAll('#viewer .line.hexline').length);
  check('不含FE行被过滤', hexCount2 === hexCount1, hexCount1 + '->' + hexCount2);
  await page.click('#btn-filteronly');
  await page.fill('#in-filter', '');
  await page.waitForTimeout(600);
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(400);

  console.log('== T20 port switching ==');
  // 先断开（T19 结束时处于连接状态）
  if (await page.evaluate(() => window.__test.state().connected)) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  await page.evaluate(() => window.__test.setPorts(['COM10', 'COM11']));
  await page.waitForTimeout(800);
  const optCount = await page.locator('#sel-port option').count();
  check('下拉出现 2 个端口', optCount === 2, 'count=' + optCount);
  await page.selectOption('#sel-port', '1');
  await page.click('#btn-connect');
  await page.waitForFunction(() => document.querySelector('#st-text').textContent.includes('已连接'), null, { timeout: 5000 });
  check('连接第二个端口(USB#1234:2)', (await page.textContent('#st-text')).includes('USB#1234:2'), await page.textContent('#st-text'));
  await page.click('#btn-connect'); // 断开
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  await page.selectOption('#sel-port', '0');
  await page.click('#btn-connect');
  await page.waitForFunction(() => document.querySelector('#st-text').textContent.includes('已连接'), null, { timeout: 5000 });
  check('切回第一个端口(USB#1234:1)', (await page.textContent('#st-text')).includes('USB#1234:1'), await page.textContent('#st-text'));

  console.log('== T21 param hot reload ==');
  await page.selectOption('#sel-baud', '9600');
  await page.waitForTimeout(1200);
  check('参数热更新后仍连接', await page.evaluate(() => window.__test.state().connected));
  await feed(page, 'after-reload\n');
  await page.waitForTimeout(300);
  check('热更新后仍能接收', await page.evaluate(() => window.__test.viewerText().includes('after-reload')));

  console.log('== T22 clear clears paused buffer ==');
  await page.check('#chk-pause');
  await feed(page, 'paused-x\npaused-y\n');
  await page.waitForTimeout(300);
  check('暂停缓存 2 行', await page.evaluate(() => window.__test.state().pausedBuf.length) === 2);
  await page.click('#btn-clear');
  await page.waitForTimeout(200);
  check('清空后缓存清零', await page.evaluate(() => window.__test.state().pausedBuf.length) === 0);
  await page.uncheck('#chk-pause');
  await page.waitForTimeout(300);
  check('恢复后无残留行', await page.evaluate(() => document.querySelectorAll('#viewer .line').length) === 0);

  console.log('== T23 pending tail line ==');
  await feed(page, 'PARTIAL-TAIL-NO-NEWLINE');
  await page.waitForTimeout(500);
  check('未换行尾部显示为 pending 行', await page.evaluate(() => !!document.querySelector('.line.pending') && document.querySelector('#viewer').textContent.includes('PARTIAL-TAIL-NO-NEWLINE')));
  await feed(page, '\n');
  await page.waitForTimeout(400);
  check('换行后 pending 转为正式行', await page.evaluate(() => !document.querySelector('.line.pending') && document.querySelector('#viewer').textContent.includes('PARTIAL-TAIL-NO-NEWLINE')));

  console.log('== T24 rebuild performance ==');
  // 构造 20000 行日志并测 rebuild 耗时
  const perf = await page.evaluate(async () => {
    const feed = window.__test.feed;
    const chunk = Array.from({ length: 200 }, (_, i) => 'perf-line-' + i + ' 数据' + i).join('\n') + '\n';
    for (let i = 0; i < 100; i++) feed(chunk); // 20000 行
    await new Promise(r => setTimeout(r, 1500)); // 等 rAF 批处理完成
    const ms = window.__test.rebuildMs(); // 直接测量 rebuildView 耗时
    return { ms, logLen: window.__test.log().length, domLines: document.querySelectorAll('#viewer .line').length };
  });
  check('20000 行日志已生成', perf.logLen >= 20000, 'log=' + perf.logLen);
  check('rebuild 后 DOM 行数受控(<=6100)', perf.domLines <= 6100, 'dom=' + perf.domLines);
  check('rebuild 耗时 < 800ms', perf.ms < 800, 'ms=' + perf.ms.toFixed(0));
  await page.click('#btn-clear');
  await page.waitForTimeout(300);

  console.log('== T25 connection state machine & races ==');
  // 确保断开
  if (await page.evaluate(() => window.__test.state().connected)) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  // TC-101/102 无端口 + 取消选择
  await page.evaluate(() => { window.__test.setPorts([]); window.__test.clearLastPort(); window.__test.cancelNextPick(); });
  await page.click('#btn-connect');
  await page.waitForTimeout(800);
  check('无端口取消选择后未连接', !(await page.evaluate(() => window.__test.state().connected)));
  check('无端口提示 toast', await page.locator('.toast.warn').count() > 0);
  // TC-103 双击竞态：只建立一次连接
  await page.evaluate(() => { window.__test.setPorts(['COM10']); });
  await page.evaluate(() => { const b = document.getElementById('btn-connect'); b.click(); b.click(); });
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.waitForTimeout(400);
  const connLines = await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line')).filter(l => l.textContent.includes('已连接')).length);
  check('双击只建立一次连接', connLines === 1, 'connLines=' + connLines);
  // TC-104 busy 禁用 + TC-108 双击断开
  const busyDisabled = await page.evaluate(() => {
    const b = document.getElementById('btn-connect');
    b.click();
    return b.disabled;
  });
  check('点击后立即 busy 禁用', busyDisabled === true);
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  check('双击断开后未连接', !(await page.evaluate(() => window.__test.state().connected)));
  check('断开后按钮显示重连', (await page.textContent('#btn-connect')).trim() === '重连');

  console.log('== T26 connect/disconnect cycles ==');
  for (let i = 0; i < 10; i++) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  check('10 次连接/断开循环稳定', !(await page.evaluate(() => window.__test.state().connected)));
  // TC-107 drop 后立即重连
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.evaluate(() => window.__test.drop());
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  check('drop 后立即重连成功', await page.evaluate(() => window.__test.state().connected));

  console.log('== T27 params ==');
  // 断开状态修改参数仅保存
  if (await page.evaluate(() => window.__test.state().connected)) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  await page.selectOption('#sel-data', '7');
  check('未连接改参数已保存', await page.evaluate(() => window.__test.settings().dataBits) === '7');
  await page.selectOption('#sel-data', '8');
  // 自定义波特率合法
  await page.evaluate(() => { window.prompt = () => '250000'; });
  await page.selectOption('#sel-baud', 'custom');
  await page.waitForTimeout(500);
  check('自定义波特率 250000 生效', await page.evaluate(() => window.__test.settings().baud) === 250000);
  // 非法值
  await page.evaluate(() => { window.prompt = () => 'abc'; });
  await page.selectOption('#sel-baud', 'custom');
  await page.waitForTimeout(500);
  check('非法波特率被拒绝', await page.evaluate(() => window.__test.settings().baud) === 250000);
  await page.evaluate(() => { window.prompt = () => null; });
  await page.selectOption('#sel-baud', 'custom');
  await page.waitForTimeout(500);
  check('取消自定义波特率保持原值', await page.evaluate(() => window.__test.settings().baud) === 250000);
  await page.selectOption('#sel-baud', '115200');
  // 连接 + 热更新 + 持续收数
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  for (let i = 0; i < 5; i++) {
    await page.selectOption('#sel-baud', i % 2 ? '9600' : '115200');
    await page.waitForTimeout(600);
    await feed(page, 'hot-reload-' + i + '\n');
  }
  await page.waitForTimeout(400);
  check('热更新 5 次后仍连接', await page.evaluate(() => window.__test.state().connected));
  check('热更新期间 RX 累计', await page.evaluate(() => window.__test.state().rx) > 0);
  // 编码热更新
  await page.selectOption('#sel-enc', 'gbk');
  await page.waitForTimeout(700);
  await feedBytes(page, [0xD6, 0xD0, 0xCE, 0xC4, 0x0A]);
  await page.waitForTimeout(400);
  check('编码热更新后 GBK 解码', await page.evaluate(() => window.__test.viewerText().includes('中文')));
  await page.selectOption('#sel-enc', 'utf-8');

  console.log('== T28 receive/display ==');
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feed(page, 'a\r\nb\rc\n');
  await page.waitForTimeout(400);
  const c1 = await page.evaluate(() => document.querySelectorAll('#viewer .line.txtline').length);
  check('混合换行分帧 3 行', c1 === 3, 'count=' + c1);
  await feed(page, '\n\n');
  await page.waitForTimeout(400);
  const c2 = await page.evaluate(() => document.querySelectorAll('#viewer .line.txtline').length);
  check('空行 +2', c2 === c1 + 2, 'count=' + c2);
  await feed(page, 'L'.repeat(200 * 1024) + '\n');
  await page.waitForTimeout(600);
  check('200KB 行接收', await page.evaluate(() => window.__test.state().rx) > 200 * 1024);
  // HEX 全字节
  await page.click('#seg-mode button[data-mode="hex"]');
  await page.waitForTimeout(300);
  await feedBytes(page, Array.from({ length: 256 }, (_, i) => i));
  await page.waitForTimeout(700);
  let vh = await page.evaluate(() => document.querySelector('#viewer').textContent);
  check('HEX 全字节首行', vh.includes('00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F'));
  check('HEX 全字节末行', vh.includes('F0 F1 F2 F3 F4 F5 F6 F7 F8 F9 FA FB FC FD FE FF'));
  // HEX 尾部多次累积
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [1, 2, 3]);
  await page.waitForTimeout(600);
  await feedBytes(page, [4, 5, 6, 7, 8]);
  await page.waitForTimeout(600);
  await feedBytes(page, [9, 10, 11, 12, 13, 14, 15, 16]);
  await page.waitForTimeout(600);
  const hc = await page.evaluate(() => document.querySelectorAll('#viewer .line.hexline').length);
  check('HEX 尾部分次累积 3 行', hc === 3, 'count=' + hc);
  // 时间戳对 hex 行
  await page.uncheck('#chk-ts');
  await feedBytes(page, Array.from({ length: 16 }, (_, i) => i));
  await page.waitForTimeout(500);
  const lastTs = await page.evaluate(() => { const els = document.querySelectorAll('#viewer .line.hexline'); const last = els[els.length - 1]; return last ? last.querySelector('.ts') : null; });
  check('ts 关闭后新 hex 行无时间戳', lastTs === null);
  await page.check('#chk-ts');
  // 自动滚动
  await page.uncheck('#chk-scroll');
  await page.waitForTimeout(200);
  for (let i = 0; i < 50; i++) await feed(page, 'scroll-line-' + i + '\n');
  await page.waitForTimeout(800);
  const st1 = await page.evaluate(() => document.querySelector('#viewer').scrollTop);
  const max1 = await page.evaluate(() => document.querySelector('#viewer').scrollHeight - document.querySelector('#viewer').clientHeight);
  check('自动滚动关闭不跳底', st1 < max1 - 10 || max1 <= 0, 'st=' + st1 + ' max=' + max1);
  await page.check('#chk-scroll');
  await feed(page, 'bottom\n');
  await page.waitForTimeout(500);
  const st2 = await page.evaluate(() => document.querySelector('#viewer').scrollTop);
  const max2 = await page.evaluate(() => document.querySelector('#viewer').scrollHeight - document.querySelector('#viewer').clientHeight);
  check('自动滚动开启跳底', Math.abs(st2 - max2) <= 2, 'st=' + st2 + ' max=' + max2);
  // 暂停 HEX
  await page.check('#chk-pause');
  await feedBytes(page, Array.from({ length: 20 }, (_, i) => i));
  await page.waitForTimeout(600);
  const pb = await page.evaluate(() => window.__test.state().pausedBuf.length);
  check('暂停中 HEX 缓存', pb > 0, 'buf=' + pb);
  await page.uncheck('#chk-pause');
  await page.waitForTimeout(400);
  // 清空空状态
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  check('清空后空状态显示', await page.evaluate(() => { const e = document.getElementById('empty-state'); return e && e.style.display !== 'none'; }));

  console.log('== T29 caps ==');
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(300);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  const capChunk = Array.from({ length: 300 }, (_, i) => 'cap-' + i).join('\n') + '\n';
  for (let i = 0; i < 100; i++) await feed(page, capChunk);
  await page.waitForTimeout(2500);
  const capLog = await page.evaluate(() => window.__test.log().length);
  check('日志上限 20000', capLog === 20000, 'log=' + capLog);
  const capDom = await page.evaluate(() => document.querySelectorAll('#viewer .line').length);
  check('DOM 上限 <=6100', capDom <= 6100, 'dom=' + capDom);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feed(page, 'M'.repeat(1048576) + '\n');
  await page.waitForTimeout(1800);
  check('1MB 单行无崩溃', await page.evaluate(() => window.__test.state().rx) >= 1048576);

  console.log('== T30 encodings ==');
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await page.selectOption('#sel-enc', 'utf-8');
  await feedBytes(page, [0xE4]); await page.waitForTimeout(60);
  await feedBytes(page, [0xB8, 0xAD]); await page.waitForTimeout(60);
  await feedBytes(page, [0xE6, 0x96, 0x87, 0x0A]); await page.waitForTimeout(400);
  check('UTF-8 跨 chunk 解码', await page.evaluate(() => window.__test.viewerText().includes('中文')));
  await page.selectOption('#sel-enc', 'gbk');
  await page.waitForTimeout(700);
  await feedBytes(page, [0xD6, 0xD0, 0xCE, 0xC4, 0x0A]);
  await page.waitForTimeout(400);
  check('GBK 解码', await page.evaluate(() => window.__test.viewerText().includes('中文')));
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [0xD6]); await page.waitForTimeout(80);
  await feedBytes(page, [0xD0, 0xCE]); await page.waitForTimeout(80);
  await feedBytes(page, [0xC4, 0x0A]); await page.waitForTimeout(400);
  check('GBK 跨 chunk 解码', await page.evaluate(() => window.__test.viewerText().includes('中文')));
  await page.selectOption('#sel-enc', 'latin1');
  await page.waitForTimeout(700);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [0xE4, 0x0A]);
  await page.waitForTimeout(400);
  check('Latin-1 高字节显示', await page.evaluate(() => window.__test.viewerText().includes('ä')));
  await page.selectOption('#sel-enc', 'utf-8');
  await page.waitForTimeout(700);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [0xFF, 0xFE, 0x0A]);
  await page.waitForTimeout(400);
  check('非法 UTF-8 不崩溃', await page.evaluate(() => document.querySelectorAll('#viewer .line').length) > 0);

  console.log('== T31 filter ==');
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  const regexLine = 'a.b*c+d?e(f)g[h]i{j}k\\l|m^n$';
  await feed(page, regexLine + '\nplain-line\n');
  await page.waitForTimeout(400);
  await page.fill('#in-filter', regexLine);
  await page.waitForTimeout(800);
  check('正则特殊字符过滤词高亮', await page.locator('#viewer .line mark').count() > 0);
  await page.click('#btn-filteronly');
  await page.waitForTimeout(300);
  const fl = await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line')).map(l => l.textContent));
  check('正则词仅匹配', fl.every(t => t.includes('a.b*c+d')));
  await page.click('#btn-filteronly');
  await page.waitForTimeout(300);
  // HTML 字符过滤词
  await page.fill('#in-filter', '<tag>');
  await page.waitForTimeout(800);
  await feed(page, "AT&T <tag> \"q\" 's'\n");
  await page.waitForTimeout(400);
  check('HTML 字符过滤词高亮', await page.locator('#viewer .line mark').count() > 0);
  check('无注入元素(img/script)', await page.evaluate(() => document.querySelectorAll('#viewer img, #viewer script').length) === 0);
  // 中文过滤词
  await page.fill('#in-filter', '传感器');
  await page.waitForTimeout(800);
  await feed(page, '温度传感器 25C\n');
  await page.waitForTimeout(400);
  check('中文过滤词高亮', await page.locator('#viewer .line mark').count() > 0);
  // 清除
  await page.fill('#in-filter', '');
  await page.waitForTimeout(800);
  check('清除过滤后无 mark', await page.locator('#viewer .line mark').count() === 0);
  // 大小写
  await feed(page, 'AbC-DEF\n');
  await page.waitForTimeout(300);
  await page.fill('#in-filter', 'abc');
  await page.waitForTimeout(800);
  check('默认忽略大小写命中', await page.locator('#viewer .line mark').count() > 0);
  await page.click('#btn-case');
  await page.waitForTimeout(500);
  check('大小写敏感后不命中', await page.locator('#viewer .line mark').count() === 0);
  await page.click('#btn-case');
  await page.waitForTimeout(300);
  // 超长过滤词
  await page.fill('#in-filter', 'x'.repeat(10240));
  await page.waitForTimeout(1000);
  check('10KB 过滤词不崩溃', await page.evaluate(() => document.querySelectorAll('#viewer .line').length > 0));
  await page.fill('#in-filter', '');
  await page.waitForTimeout(800);

  console.log('== T32 alarm ==');
  await page.fill('#in-alarm', 'err,警告');
  await page.waitForTimeout(500);
  if (!(await page.evaluate(() => window.__test.settings().alarmOn))) { await page.click('.switch'); }
  await page.waitForTimeout(300);
  await feed(page, 'xxx err xxx\n');
  await page.waitForTimeout(400);
  check('多关键字任一命中', (await page.title()).includes('报警'));
  await page.waitForTimeout(4500);
  await page.fill('#in-alarm', '');
  await page.waitForTimeout(500);
  await feed(page, 'anything\n');
  await page.waitForTimeout(400);
  check('空关键字不触发', !(await page.title()).includes('报警'));
  await page.fill('#in-alarm', 'ALERT');
  await page.waitForTimeout(500);
  for (let i = 0; i < 5; i++) await feed(page, 'ALERT-' + i + '\n');
  await page.waitForTimeout(600);
  check('连续触发标题变化', (await page.title()).includes('报警'));
  await page.waitForTimeout(4500); // 等标题恢复
  check('标题已恢复', !(await page.title()).includes('报警'));
  await page.click('.switch');
  await page.waitForTimeout(300);
  await feed(page, 'ALERT-off\n');
  await page.waitForTimeout(400);
  check('关闭开关后不触发', !(await page.title()).includes('报警'));
  await page.waitForTimeout(4200);
  await page.click('.switch');
  await page.waitForTimeout(300);
  await page.fill('#in-alarm', 'a.b');
  await page.waitForTimeout(500);
  await feed(page, 'xa.bx\n');
  await page.waitForTimeout(400);
  check('报警词按文本匹配触发', (await page.title()).includes('报警'));
  await page.waitForTimeout(4200);
  await page.selectOption('#sel-enc', 'gbk');
  await page.waitForTimeout(700);
  await page.fill('#in-alarm', '错误');
  await page.waitForTimeout(500);
  await feedBytes(page, [0xB4, 0xED, 0xCE, 0xF3, 0x0A]);
  await page.waitForTimeout(400);
  check('GBK 中文报警词触发', (await page.title()).includes('报警'));
  await page.waitForTimeout(4200);
  await page.selectOption('#sel-enc', 'utf-8');
  await page.waitForTimeout(700);
  await page.fill('#in-alarm', '');
  await page.click('.switch');
  await page.waitForTimeout(300);

  console.log('== T33 send ==');
  if (!(await page.evaluate(() => window.__test.state().connected))) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  }
  const t0 = await page.evaluate(() => window.__test.txBytes());
  await page.fill('#in-send', '');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  check('空输入不发送', await page.evaluate(() => window.__test.txBytes()) === t0);
  await page.selectOption('#sel-sendmode', 'hex');
  await page.fill('#in-send', 'ABC');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  check('奇数 HEX 拒绝', await page.evaluate(() => window.__test.txBytes()) === t0);
  check('奇数 HEX toast', await page.locator('.toast.err').count() > 0);
  await page.fill('#in-send', 'GG 11');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  check('垃圾 HEX 拒绝', await page.evaluate(() => window.__test.txBytes()) === t0);
  await page.fill('#in-send', '48,65 6C\t6C');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  const tx1 = await page.evaluate(() => window.__test.txBytes());
  check('HEX 变体发送 4 字节', tx1 === t0 + 4, 'tx=' + tx1);
  await page.selectOption('#sel-sendmode', 'ascii');
  await page.selectOption('#sel-crlf', 'none');
  await page.fill('#in-send', 'S'.repeat(100 * 1024));
  await page.click('#btn-send');
  await page.waitForTimeout(600);
  check('100KB 发送计数', await page.evaluate(() => window.__test.txBytes()) === tx1 + 102400);
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  const t2 = await page.evaluate(() => window.__test.txBytes());
  await page.fill('#in-send', 'X');
  await page.click('#btn-send');
  await page.waitForTimeout(300);
  check('未连接发送提示', await page.locator('.toast.warn').count() > 0);
  check('未连接不发送', await page.evaluate(() => window.__test.txBytes()) === t2);
  // 快捷上限
  await page.evaluate(() => { const s = window.__test.settings(); s.quickSends = []; localStorage.setItem('serialListener.v1', JSON.stringify(s)); });
  for (let i = 0; i < 12; i++) {
    await page.fill('#in-send', 'Q' + i);
    await page.click('#btn-quickadd');
    await page.waitForTimeout(150);
  }
  check('快捷 12 条上限', await page.locator('.chip').count() === 12, 'chips=' + await page.locator('.chip').count());
  await page.fill('#in-send', 'Q13');
  await page.click('#btn-quickadd');
  await page.waitForTimeout(300);
  check('第 13 条被拒', await page.locator('.chip').count() === 12);
  await page.fill('#in-send', 'Q0');
  await page.click('#btn-quickadd');
  await page.waitForTimeout(300);
  check('重复项拒绝', await page.locator('.chip').count() === 12);
  await page.locator('.chip', { hasText: 'Q5' }).locator('.x').click();
  await page.waitForTimeout(300);
  check('删除后 11 条', await page.locator('.chip').count() === 11);

  console.log('== T34 history & CRLF ==');
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.evaluate(() => window.__test.clearHist());
  await page.fill('#in-send', 'DUP');
  await page.click('#btn-send');
  await page.waitForTimeout(250);
  await page.fill('#in-send', 'DUP');
  await page.click('#btn-send');
  await page.waitForTimeout(250);
  check('相邻重复去重', await page.evaluate(() => window.__test.settings().cmdHist.length) === 1);
  for (let i = 0; i < 60; i++) {
    await page.fill('#in-send', 'h' + i);
    await page.click('#btn-send');
    await page.waitForTimeout(80);
  }
  check('历史 50 条上限', await page.evaluate(() => window.__test.settings().cmdHist.length) === 50);
  await page.reload();
  await waitTest(page);
  await page.focus('#in-send');
  await page.keyboard.press('ArrowUp');
  check('刷新后历史保留(最新50条末条h59)', await page.inputValue('#in-send') === 'h59', 'v=' + await page.inputValue('#in-send'));
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.selectOption('#sel-crlf', 'none');
  let tb = await page.evaluate(() => window.__test.txBytes());
  await page.fill('#in-send', 'Z');
  await page.click('#btn-send');
  await page.waitForTimeout(250);
  check('CRLF=none 1 字节', await page.evaluate(() => window.__test.txBytes()) - tb === 1);
  await page.selectOption('#sel-crlf', 'CR');
  tb = await page.evaluate(() => window.__test.txBytes());
  await page.fill('#in-send', 'Z');
  await page.click('#btn-send');
  await page.waitForTimeout(250);
  check('CR 2 字节', await page.evaluate(() => window.__test.txBytes()) - tb === 2);
  await page.selectOption('#sel-crlf', 'LF');
  tb = await page.evaluate(() => window.__test.txBytes());
  await page.fill('#in-send', 'Z');
  await page.click('#btn-send');
  await page.waitForTimeout(250);
  check('LF 2 字节', await page.evaluate(() => window.__test.txBytes()) - tb === 2);
  await page.selectOption('#sel-crlf', 'CRLF');
  tb = await page.evaluate(() => window.__test.txBytes());
  await page.fill('#in-send', 'Z');
  await page.click('#btn-send');
  await page.waitForTimeout(250);
  check('CRLF 3 字节', await page.evaluate(() => window.__test.txBytes()) - tb === 3);
  await page.selectOption('#sel-crlf', 'none');

  console.log('== T35 export ==');
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await page.click('#btn-export');
  await page.waitForTimeout(400);
  check('空日志导出提示', await page.locator('.toast.warn').count() > 0);
  await feed(page, 'EXPORT-A\n');
  await page.waitForTimeout(300);
  const [dl1] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#btn-export')]);
  check('文件名格式', /^serial_log_\d{8}_\d{6}\.log$/.test(dl1.suggestedFilename()), dl1.suggestedFilename());
  await page.click('#seg-mode button[data-mode="hex"]');
  await page.waitForTimeout(300);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [0x48, 0x65]);
  await page.waitForTimeout(600);
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#btn-export')]);
  const p2 = path.join(SHOT_DIR, 'export-hex.log');
  await dl2.saveAs(p2);
  check('HEX 模式导出含 hex', fs.readFileSync(p2, 'utf8').includes('48 65'));
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(300);
  await feed(page, 'TXTLINE-X\n');
  await page.waitForTimeout(300);
  const [dl3] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#btn-export')]);
  const p3 = path.join(SHOT_DIR, 'export-mix.log');
  await dl3.saveAs(p3);
  const c3 = fs.readFileSync(p3, 'utf8');
  check('混合导出含文本行', c3.includes('TXTLINE-X'));
  check('混合导出 hex 条目保留', c3.includes('48 65'));
  check('导出含头部', c3.includes('# Serial Listener 日志') && c3.includes('# 端口'));
  await feed(page, 'AFTER-EXPORT\n');
  await page.waitForTimeout(300);
  check('导出后继续接收', await page.evaluate(() => window.__test.viewerText().includes('AFTER-EXPORT')));

  console.log('== T36 persistence ==');
  if (await page.evaluate(() => window.__test.state().connected)) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  await page.evaluate(() => window.__test.setPorts(['COM10', 'COM11']));
  await page.waitForTimeout(600);
  await page.selectOption('#sel-port', '1');
  await page.click('#btn-connect');
  await page.waitForFunction(() => document.querySelector('#st-text').textContent.includes('USB#1234:2'), null, { timeout: 5000 });
  await page.reload();
  await waitTest(page);
  await page.waitForTimeout(700);
  check('刷新后端口预选 COM11', await page.inputValue('#sel-port') === '1', 'sel=' + await page.inputValue('#sel-port'));
  await page.evaluate(() => localStorage.setItem('serialListener.v1', '{bad json'));
  await page.reload();
  await waitTest(page);
  await page.waitForTimeout(500);
  check('损坏 localStorage 后默认配置', await page.evaluate(() => window.__test.settings().baud) === 115200);
  check('损坏后页面正常', await page.locator('#btn-connect').isVisible());

  console.log('== T37 security/static ==');
  if (!(await page.evaluate(() => window.__test.state().connected))) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  }
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feed(page, '<script>window.__xss=1</script>\n<img src=x onerror="window.__xss=2">\n');
  await page.waitForTimeout(500);
  check('数据 XSS 不执行', await page.evaluate(() => window.__xss === undefined));
  check('XSS 显示为文本', await page.evaluate(() => document.querySelector('#viewer').textContent.includes('<script>')));
  await page.fill('#in-filter', '<img src=x onerror="window.__xss=3">');
  await page.waitForTimeout(800);
  check('过滤词注入不执行', await page.evaluate(() => window.__xss === undefined));
  check('无 img 元素', await page.evaluate(() => document.querySelectorAll('#viewer img').length) === 0);
  await page.fill('#in-filter', '');
  await page.waitForTimeout(700);
  const dupIds = await page.evaluate(() => {
    const seen = {}, dups = [];
    document.querySelectorAll('[id]').forEach(el => { if (seen[el.id]) dups.push(el.id); seen[el.id] = 1; });
    return dups;
  });
  check('DOM 无重复 ID', dupIds.length === 0, dupIds.join(','));
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  check('空状态文案', await page.evaluate(() => document.querySelector('#empty-state') && document.querySelector('#empty-state').textContent.includes('等待串口数据')));
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  await page2.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'serial', { get: () => undefined, configurable: true }); });
  await page2.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html');
  await page2.waitForTimeout(800);
  check('缺 serial 显示不支持横幅', await page2.locator('.unsupported').isVisible());
  await ctx2.close();

  console.log('== T38 error paths ==');
  if (await page.evaluate(() => window.__test.state().connected)) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  await page.evaluate(() => { window.__test.setPorts(['COM10']); window.__test.failNextOpen('模拟打开失败'); });
  await page.click('#btn-connect');
  await page.waitForTimeout(800);
  check('open 失败未连接', !(await page.evaluate(() => window.__test.state().connected)));
  check('open 失败 toast', await page.locator('.toast.err').count() > 0);
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  check('open 失败后可重试', await page.evaluate(() => window.__test.state().connected));
  await page.evaluate(() => window.__test.failNextWrite('模拟写入失败'));
  await page.fill('#in-send', 'X');
  await page.click('#btn-send');
  await page.waitForTimeout(700);
  check('写失败后断开', !(await page.evaluate(() => window.__test.state().connected)));
  check('写失败 toast', await page.locator('.toast.err').count() > 0);
  await page.evaluate(() => { window.__origSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('quota'); }; });
  await page.fill('#in-filter', 'x');
  await page.waitForTimeout(800);
  check('Storage 异常不崩溃', await page.locator('#btn-connect').isVisible());
  await page.evaluate(() => { Storage.prototype.setItem = window.__origSetItem; });
  await page.reload();
  await waitTest(page);
  await page.waitForTimeout(400);

  console.log('== T39 coupling ==');
  await page.evaluate(() => window.__test.setPorts(['COM10']));
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.check('#chk-pause');
  await page.fill('#in-filter', 'COUP');
  await page.waitForTimeout(600);
  await page.click('#seg-mode button[data-mode="hex"]');
  await page.waitForTimeout(300);
  await feedBytes(page, [0x43, 0x4F, 0x55, 0x50, 0x0A]);
  await page.waitForTimeout(500);
  await page.uncheck('#chk-pause');
  await page.waitForTimeout(400);
  check('暂停+过滤+hex 组合稳定', await page.evaluate(() => window.__test.state().pausedBuf.length) === 0);
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(300);
  await page.fill('#in-filter', 'HOT');
  await page.click('#btn-filteronly');
  await page.waitForTimeout(300);
  await feed(page, 'HOT-A\nCOLD-B\n');
  await page.waitForTimeout(400);
  let vis = await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line')).map(l => l.textContent));
  check('过滤下仅 HOT 可见', vis.every(t => t.includes('HOT')));
  await page.selectOption('#sel-baud', '9600');
  await page.waitForTimeout(800);
  await feed(page, 'HOT-C\n');
  await page.waitForTimeout(400);
  vis = await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line.txtline, #viewer .line.hexline')).map(l => l.textContent));
  check('热更新后过滤仍生效(数据行)', vis.every(t => t.includes('HOT')));
  await page.click('#btn-filteronly');
  await page.fill('#in-filter', '');
  await page.waitForTimeout(600);
  for (let i = 0; i < 20; i++) {
    await page.click('#seg-mode button[data-mode="' + (i % 2 ? 'ascii' : 'hex') + '"]');
    await feed(page, 'fast-' + i + '\n');
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(600);
  check('模式快速切换 20 次稳定', await page.evaluate(() => document.querySelectorAll('#viewer .line').length) > 0);
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(300);
  const rx0 = await page.evaluate(() => window.__test.state().rx);
  const tx0 = await page.evaluate(() => window.__test.txBytes());
  for (let i = 0; i < 100; i++) {
    await feed(page, 'R' + i + '\n');
    await page.fill('#in-send', 'S' + i);
    await page.click('#btn-send');
  }
  await page.waitForTimeout(900);
  check('收发 100 轮 RX 增长', await page.evaluate(() => window.__test.state().rx) > rx0);
  check('收发 100 轮 TX 增长', await page.evaluate(() => window.__test.txBytes()) > tx0);
  await page.evaluate(() => { window.__test.settings().alarmWords = '错误'; });
  await page.fill('#in-alarm', '错误');
  await page.waitForTimeout(500);
  if (!(await page.evaluate(() => window.__test.settings().alarmOn))) await page.click('.switch');
  await page.click('#seg-mode button[data-mode="hex"]');
  await page.waitForTimeout(300);
  await page.selectOption('#sel-enc', 'gbk');
  await page.waitForTimeout(700);
  await feedBytes(page, [0xB4, 0xED, 0xCE, 0xF3, 0x0A]);
  await page.waitForTimeout(400);
  check('报警+HEX+GBK 组合触发', (await page.title()).includes('报警'));
  await page.waitForTimeout(4200);
  await page.selectOption('#sel-enc', 'utf-8');
  await page.click('.switch');
  await page.fill('#in-alarm', '');
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(400);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feed(page, 'VISIBLE-LINE\nHIDDEN-LINE\n');
  await page.waitForTimeout(300);
  await page.fill('#in-filter', 'VISIBLE');
  await page.click('#btn-filteronly');
  await page.waitForTimeout(600);
  const [dlC] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#btn-export')]);
  const pC = path.join(SHOT_DIR, 'export-filtered.log');
  await dlC.saveAs(pC);
  const cC = fs.readFileSync(pC, 'utf8');
  check('过滤后导出为全量', cC.includes('HIDDEN-LINE') && cC.includes('VISIBLE-LINE'));
  await page.click('#btn-filteronly');
  await page.fill('#in-filter', '');
  await page.waitForTimeout(600);
  await page.click('#btn-clear');
  await feed(page, 'AFTER-CLEAR-NOW\n');
  await page.waitForTimeout(400);
  check('清空后立即收数显示', await page.evaluate(() => window.__test.viewerText().includes('AFTER-CLEAR-NOW')));
  await feed(page, 'KEEP-ME\n');
  await page.waitForTimeout(300);
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  check('断开后历史保留', await page.evaluate(() => window.__test.viewerText().includes('KEEP-ME')));

  console.log('== T40 extreme ==');
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__test.feed(''));
  await page.waitForTimeout(200);
  check('空 chunk 无异常', await page.evaluate(() => window.__test.state().connected));
  await page.evaluate(() => window.__test.feedBytes(new Array(100).fill(0)));
  await page.waitForTimeout(300);
  check('全 0x00 接收', await page.evaluate(() => window.__test.state().rx) >= 100);
  await page.evaluate(() => window.__test.feedBytes(new Array(100).fill(0xFF)));
  await page.waitForTimeout(300);
  check('全 0xFF 接收', await page.evaluate(() => window.__test.state().rx) >= 200);
  await page.evaluate(() => { for (let i = 0; i < 1000; i++) window.__test.feedBytes([i % 256]); });
  await page.waitForTimeout(700);
  check('1000 次 1 字节', await page.evaluate(() => window.__test.state().rx) >= 1200);
  for (let i = 0; i < 32; i++) await feed(page, 'B'.repeat(65536));
  await page.waitForTimeout(2200);
  check('2MB 突发接收', await page.evaluate(() => window.__test.state().rx) >= 2097152);
  check('2MB 后 DOM 受控', await page.evaluate(() => document.querySelectorAll('#viewer .line').length) <= 6100);
  const stBefore = await page.evaluate(() => window.__test.state().connected);
  await page.waitForTimeout(5000);
  check('空闲 5s 状态稳定', await page.evaluate(() => window.__test.state().connected) === stBefore);

  console.log('== T41 business extras ==');
  check('速率显示存在', await page.locator('#st-rate').isVisible());
  if (!(await page.evaluate(() => window.__test.state().connected))) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  }
  await page.check('#chk-pause');
  await feed(page, 'banner-line\n');
  await page.waitForTimeout(300);
  await page.click('#pause-banner');
  await page.waitForTimeout(400);
  check('点击横幅恢复显示', await page.evaluate(() => window.__test.viewerText().includes('banner-line')));
  check('恢复后横幅隐藏', !(await page.locator('#pause-banner').isVisible()));
  await page.uncheck('#chk-pause');

  console.log('== T42 TX display ==');
  if (!(await page.evaluate(() => window.__test.state().connected))) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  }
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(300);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await page.selectOption('#sel-sendmode', 'ascii');
  await page.selectOption('#sel-crlf', 'none');
  await page.fill('#in-send', 'TX-HELLO');
  await page.click('#btn-send');
  await page.waitForTimeout(400);
  check('TX 行显示(色块类 txline)', await page.locator('#viewer .line.txline').count() > 0);
  check('TX 行含内容与箭头', await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line.txline')).some(e => e.textContent.includes('TX-HELLO') && e.textContent.includes('→'))));
  check('TX 入日志(kind=tx)', await page.evaluate(() => window.__test.log().some(e => e.kind === 'tx' && e.ascii === 'TX-HELLO')));
  // TX 不触发报警
  await page.fill('#in-alarm', 'TX-HELLO');
  await page.waitForTimeout(500);
  if (!(await page.evaluate(() => window.__test.settings().alarmOn))) await page.click('.switch');
  await page.waitForTimeout(300);
  await page.fill('#in-send', 'TX-HELLO');
  await page.click('#btn-send');
  await page.waitForTimeout(500);
  check('TX 不触发报警', !(await page.title()).includes('报警'), 'title=' + await page.title());
  await page.click('.switch');
  await page.fill('#in-alarm', '');
  await page.waitForTimeout(4200);
  // HEX 模式发送 → TX hex 行
  await page.click('#seg-mode button[data-mode="hex"]');
  await page.waitForTimeout(300);
  await page.selectOption('#sel-sendmode', 'hex');
  await page.fill('#in-send', '48 65');
  await page.click('#btn-send');
  await page.waitForTimeout(400);
  check('HEX 模式 TX 显示 hex', await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line.txline')).some(e => e.textContent.includes('48 65'))));
  // 控制字符 Ctrl+C 显示 TX
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(300);
  await page.focus('#in-send');
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(400);
  check('Ctrl+C 显示 TX 行 ^C', await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line.txline')).some(e => e.textContent.includes('^C'))));
  // 过滤仅匹配作用于 TX
  await page.fill('#in-filter', 'TX-HELLO');
  await page.click('#btn-filteronly');
  await page.waitForTimeout(500);
  const txOnly = await page.evaluate(() => Array.from(document.querySelectorAll('#viewer .line.txtline, #viewer .line.txline, #viewer .line.hexline')).map(l => l.textContent));
  check('仅匹配时 TX 命中行可见', txOnly.some(t => t.includes('TX-HELLO')));
  check('仅匹配时 TX 非命中行隐藏', !txOnly.some(t => t.includes('48 65')));
  await page.click('#btn-filteronly');
  await page.fill('#in-filter', '');
  await page.waitForTimeout(500);
  await page.selectOption('#sel-sendmode', 'ascii');
  await page.selectOption('#sel-crlf', 'none');

  console.log('== T43 auto log ==');
  await page.evaluate(() => { window.__test.installFakeDir(); window.__test.setAutoLogLimit(2048); });
  if (await page.evaluate(() => window.__test.state().connected)) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  }
  // 目录模式
  await page.check('#chk-autolog');
  await page.click('#btn-logdir');
  await page.waitForTimeout(500);
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.waitForTimeout(700);
  const ast1 = await page.evaluate(() => window.__test.autoLogState());
  check('自动日志目录模式开启', ast1.mode === 'file', 'mode=' + ast1.mode);
  check('文件名=端口_时间戳', /_\d{8}_\d{6}(_\d{3})?\.log$/.test(ast1.base + '.log') && ast1.base.startsWith('USB'), ast1.base + '.log');
  await feed(page, 'SEP-A\nSEP-B\nAUTOLOG-LINE-1\n');
  await page.waitForTimeout(2700);
  let files = await page.evaluate(() => window.__test.autoLogFiles());
  check('目录模式已写文件', Object.keys(files).length >= 1, Object.keys(files).join(','));
  const allContent = Object.values(files).join('');
  check('文件含头部与数据', allContent.includes('# Serial Listener 自动日志') && allContent.includes('AUTOLOG-LINE-1'));
  check('日志每行一条(\r\n 分隔)', allContent.includes('SEP-A\r\n') && allContent.includes('SEP-B\r\n') && !allContent.includes('SEP-ASEP-B'), allContent.slice(0, 300));
  // 轮转：limit 2048，先灌 4KB 再灌 2KB
  for (let i = 0; i < 8; i++) await feed(page, 'R'.repeat(500) + '-' + i + '\n');
  await page.waitForTimeout(900);
  for (let i = 0; i < 4; i++) await feed(page, 'S'.repeat(500) + '-' + i + '\n');
  await page.waitForTimeout(1600);
  files = await page.evaluate(() => window.__test.autoLogFiles());
  const names2 = Object.keys(files);
  check('超过大小自动轮转新文件', names2.length >= 2, 'files=' + names2.join(','));
  check('轮转文件名带序号', names2.some(n => /_\d{3}\.log$/.test(n)), names2.join(','));
  check('轮转后数据写入新段', Object.values(files).join('').includes('S'.repeat(20)));
  // TX 进自动日志
  await page.selectOption('#sel-sendmode', 'ascii');
  await page.fill('#in-send', 'AUTOLOG-TX');
  await page.click('#btn-send');
  await page.waitForTimeout(2700);
  files = await page.evaluate(() => window.__test.autoLogFiles());
  const diag = await page.evaluate(() => { const s = window.__test.autoLogState(); return { files: Object.keys(window.__test.autoLogFiles()), seg: s.seg, bufBytes: s.bufBytes, mode: s.mode }; });
  check('自动日志含 TX 标记', Object.values(files).join('').includes('→ AUTOLOG-TX'), JSON.stringify(diag));
  // 断开收尾
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  await page.waitForTimeout(600);
  check('断开后自动日志停止', (await page.evaluate(() => window.__test.autoLogState())).mode === 'none');
  // 下载模式（未选目录）
  await page.evaluate(() => window.__test.clearAutoLogDir());
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await page.waitForTimeout(700);
  check('未选目录回退下载模式', (await page.evaluate(() => window.__test.autoLogState())).mode === 'download');
  await feed(page, 'DOWNLOAD-MODE-LINE\n');
  await page.waitForTimeout(2200);
  let dlAuto = null;
  try {
    [dlAuto] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#btn-connect')]);
  } catch (e) { dlAuto = null; }
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });
  if (dlAuto) {
    const dlName = dlAuto.suggestedFilename();
    check('下载文件名=端口_时间戳', /_\d{8}_\d{6}(_\d{3})?\.log$/.test(dlName), dlName);
    const pAuto = path.join(SHOT_DIR, 'autolog-download.log');
    await dlAuto.saveAs(pAuto);
    const dlText = fs.readFileSync(pAuto, 'utf8');
    check('下载内容含数据', dlText.includes('DOWNLOAD-MODE-LINE'));
    check('下载内容按行分隔', dlText.includes('DOWNLOAD-MODE-LINE\r\n'));
  } else {
    check('下载文件名=端口_时间戳', false, 'no download event');
    check('下载内容含数据', false);
  }
  // 关闭开关 → 不再记录
  await page.uncheck('#chk-autolog');
  await page.waitForTimeout(300);
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  await feed(page, 'NO-AUTOLOG\n');
  await page.waitForTimeout(2700);
  files = await page.evaluate(() => window.__test.autoLogFiles());
  check('关闭开关后不记录', !Object.values(files).join('').includes('NO-AUTOLOG'));
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === false, null, { timeout: 5000 });

  console.log('== T44 mojibake fixes (BOM strip + decoder reuse) ==');
  if (!(await page.evaluate(() => window.__test.state().connected))) {
    await page.click('#btn-connect');
    await page.waitForFunction(() => window.__test.state().connected === true, null, { timeout: 5000 });
  }
  await page.selectOption('#sel-enc', 'utf-8');
  await page.waitForTimeout(700);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  // BOM 单块到达
  await feedBytes(page, [0xEF, 0xBB, 0xBF, 0xE4, 0xB8, 0xAD, 0x0A]);
  await page.waitForTimeout(400);
  let vt = await page.evaluate(() => window.__test.viewerText());
  check('单块 BOM 被剥离', vt.includes('中') && !vt.includes('\uFEFF'), 'hasFEFF=' + vt.includes('\uFEFF'));
  // BOM 跨块到达
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [0xEF]);
  await page.waitForTimeout(80);
  await feedBytes(page, [0xBB, 0xBF, 0xE4, 0xB8, 0xAD, 0x0A]);
  await page.waitForTimeout(400);
  vt = await page.evaluate(() => window.__test.viewerText());
  check('跨块 BOM 被剥离', vt.includes('中') && !vt.includes('\uFEFF'));
  // 流中重复 BOM（设备每条报文带 BOM）
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [0x41, 0x0A, 0xEF, 0xBB, 0xBF, 0x42, 0x0A]);
  await page.waitForTimeout(400);
  vt = await page.evaluate(() => window.__test.viewerText());
  check('流中重复 BOM 被剥离', vt.includes('A') && vt.includes('B') && !vt.includes('\uFEFF'));
  // 跨重连解码器复用：'中' 拆在参数热更新前后
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await feedBytes(page, [0xE4, 0xB8]);
  await page.waitForTimeout(300);
  await page.selectOption('#sel-baud', '9600');
  await page.waitForTimeout(900);
  await feedBytes(page, [0xAD, 0x0A]);
  await page.waitForTimeout(400);
  vt = await page.evaluate(() => window.__test.viewerText());
  check('跨重连多字节字符不丢', vt.includes('中') && !vt.includes('\uFFFD'), 'hasFFFD=' + vt.includes('\uFFFD'));
  // 编码变更时正确重建解码器（GBK 残留 + 切换 UTF-8 后正常）
  await page.selectOption('#sel-baud', '115200');
  await page.waitForTimeout(900);
  await page.click('#btn-clear');
  await page.waitForTimeout(300);
  await page.selectOption('#sel-enc', 'gbk');
  await page.waitForTimeout(700);
  await feedBytes(page, [0xD6]);
  await page.waitForTimeout(200);
  await page.selectOption('#sel-enc', 'utf-8');
  await page.waitForTimeout(900);
  await feedBytes(page, [0xE4, 0xB8, 0xAD, 0x0A]);
  await page.waitForTimeout(400);
  vt = await page.evaluate(() => window.__test.viewerText());
  check('编码变更后新编码正常', vt.includes('中'));
  await page.selectOption('#sel-enc', 'utf-8');
  await page.waitForTimeout(700);

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

  await page.screenshot({ path: path.join(SHOT_DIR, 'UI-05-final.png') });
  await browser.close();

  console.log('\n========== RESULT: ' + passed + ' passed / ' + failed + ' failed ==========');
  if (failures.length) { console.log('failures:\n- ' + failures.join('\n- ')); process.exit(1); }
})().catch((e) => { console.error('E2E error: ', e); process.exit(2); });