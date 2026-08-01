/**
 * 真实串口链路 E2E 测试（VSPE COM10↔COM11）
 * 前置：VSPE 虚拟串口对已创建并仿真运行；专用 profile C:\tools\chrome-serial-profile
 *       已含 COM10 授权（serial_chooser_data 注入）
 * 运行：node tools/realport_test.cjs
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = 'C:/tools/chrome-serial-profile';
const APP_URL = 'file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html';
const SHOT_DIR = 'C:/01_Dev/Ai/chatgpt/serialCommTools/records/T001-step6';
const RX_LOG = 'C:/tools/serial_rx_result.bin';
const PY = process.env.PYTHON || 'python';

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  OK ' + name); }
  else { failed++; failures.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  if (fs.existsSync(RX_LOG)) fs.unlinkSync(RX_LOG);

  // 1) 启动 Python 模拟设备（COM11 持续发送 + 记录接收）
  const sim = spawn(PY, [path.join(__dirname, 'serial_sim.py'), '--port', 'COM11', '--baud', '115200'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let simOut = '';
  sim.stdout.on('data', (d) => { simOut += d.toString(); });
  sim.stderr.on('data', (d) => { simOut += d.toString(); });

  // 等待 sim 就绪（最多 8s）
  let simReady = false;
  for (let i = 0; i < 16; i++) {
    await sleep(500);
    if (simOut.includes('opened COM11')) { simReady = true; break; }
  }
  check('python sim 已打开 COM11', simReady, simOut.trim().slice(0, 200));

  // 2) 用已授权 profile 启动 Chrome（headless）
  const browser = await chromium.launchPersistentContext(PROFILE, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    args: ['--no-first-run']
  });
  const page = browser.pages()[0] || await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(APP_URL);
  await page.waitForTimeout(1200);

  const granted = await page.evaluate(async () => (await navigator.serial.getPorts()).length);
  check('profile 已授权串口(getPorts>0)', granted > 0, 'granted=' + granted);

  // 3) 连接
  await page.click('#btn-connect');
  await page.waitForFunction(() => document.querySelector('#st-text').textContent.includes('已连接'), null, { timeout: 10000 }).catch(() => {});
  const st = (await page.textContent('#st-text')).trim();
  check('真实端口连接成功', st.includes('已连接'), 'status=' + st);
  await sleep(3000);

  // 4) 接收断言
  const v = await page.evaluate(() => document.querySelector('#viewer').textContent);
  check('收到 HELLO-FROM-SIM', v.includes('HELLO-FROM-SIM'));
  check('收到中文 UTF-8 行', v.includes('中文测试数据行'));
  check('收到 ALERT 关键字', v.includes('ALERT: temperature high'));
  const rx = await page.evaluate(() => document.querySelector('#st-rx').textContent);
  check('RX 计数已增加', rx !== '0 B', 'rx=' + rx);
  await page.screenshot({ path: path.join(SHOT_DIR, 'real-01-receive.png') });

  // 5) HEX 模式（含不足 16 字节尾部冲刷）
  await page.click('#seg-mode button[data-mode="hex"]');
  await sleep(4500);
  const vh = await page.evaluate(() => document.querySelector('#viewer').textContent);
  check('HEX 显示特殊字节 FE FF', vh.includes('FE FF'));
  await page.screenshot({ path: path.join(SHOT_DIR, 'real-03-hex.png') });
  await page.click('#seg-mode button[data-mode="ascii"]');
  await sleep(400);

  // 6) 发送：浏览器发 PING → sim 记录
  await page.fill('#in-send', 'PING-FROM-BROWSER');
  await page.selectOption('#sel-crlf', 'CRLF');
  await page.click('#btn-send');
  await sleep(2500);
  const rxBytes = fs.existsSync(RX_LOG) ? fs.readFileSync(RX_LOG) : Buffer.alloc(0);
  check('浏览器发送→COM11 收到 PING', rxBytes.includes(Buffer.from('PING-FROM-BROWSER\r\n')), 'rx=' + JSON.stringify(rxBytes.toString().slice(0, 120)));
  const tx = await page.evaluate(() => document.querySelector('#st-tx').textContent);
  check('TX 计数已增加', tx !== '0 B', 'tx=' + tx);
  await page.screenshot({ path: path.join(SHOT_DIR, 'real-02-send.png') });

  check('全程无 JS 控制台错误', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

  sim.kill();
  await browser.close();

  console.log('\n========== REAL RESULT: ' + passed + ' passed / ' + failed + ' failed ==========');
  if (failures.length) { console.log('failures:\n- ' + failures.join('\n- ')); process.exit(1); }
})().catch((e) => { console.error('REAL TEST ERROR:', e.message); process.exit(2); });