/**
 * 真实串口链路 E2E 测试（VSPE COM10↔COM11）
 * 前置：1) VSPE 虚拟串口对已创建并仿真运行；2) Chrome profile C:\tools\chrome-serial-profile
 *       已一次性人工授权 COM10（file:// 页面点连接→选 COM10）
 * 流程：启动 Python 模拟设备(COM11) → headless Chrome 打开应用 → 连接 COM10 →
 *      断言收到模拟数据 → 页面发送 → 验证 Python 收到 → 截图
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
const PY = process.env.PYTHON || 'python';

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  OK ' + name); }
  else { failed++; failures.push(name + (extra ? ' :: ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  // 1) 启动 Python 模拟设备（COM11 持续发送）
  const sim = spawn(PY, [path.join(__dirname, 'serial_sim.py'), '--port', 'COM11', '--baud', '115200'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let simOut = '';
  sim.stdout.on('data', (d) => { simOut += d.toString(); });
  sim.stderr.on('data', (d) => { simOut += d.toString(); });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('== python sim status ==');
  console.log(simOut.trim());
  check('python sim 已打开 COM11', simOut.includes('opened COM11'));

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

  // 3) 检查已授权端口（getPorts）
  const granted = await page.evaluate(async () => {
    const ports = await navigator.serial.getPorts();
    return ports.length;
  });
  check('profile 已授权串口(getPorts>0)', granted > 0, 'granted=' + granted);

  // 4) 点击连接（应直接连接已授权端口，不弹系统对话框）
  await page.click('#btn-connect');
  await page.waitForFunction(() => document.querySelector('#st-text').textContent.includes('已连接'), null, { timeout: 10000 }).catch(() => {});
  const st = (await page.textContent('#st-text')).trim();
  check('真实端口连接成功', st.includes('已连接'), 'status=' + st);
  await page.waitForTimeout(2500);

  // 5) 断言收到模拟数据
  const v = await page.evaluate(() => document.querySelector('#viewer').textContent);
  check('收到 HELLO-FROM-SIM', v.includes('HELLO-FROM-SIM'));
  check('收到中文 UTF-8 行', v.includes('中文测试数据行'));
  check('收到 ALERT 关键字', v.includes('ALERT: temperature high'));
  const rx = await page.evaluate(() => document.querySelector('#st-rx').textContent);
  check('RX 计数已增加', rx !== '0 B', 'rx=' + rx);
  await page.screenshot({ path: path.join(SHOT_DIR, 'real-01-receive.png') });

  // 6) HEX 模式检查特殊字节
  await page.click('#seg-mode button[data-mode="hex"]');
  await page.waitForTimeout(500);
  const vh = await page.evaluate(() => document.querySelector('#viewer').textContent);
  check('HEX 显示特殊字节 00 FF', vh.includes('00 FF'));
  await page.click('#seg-mode button[data-mode="ascii"]');
  await page.waitForTimeout(300);

  // 7) 发送：页面发文本 → Python 端接收验证（通过 sim 的 stdout 无法读，另起接收脚本）
  // 简便方案：发送后读取 sim 日志不可能，改用串口回环：页面发→COM10→VSPE→COM11→sim 收不到（sim 只发不收）。
  // 因此发送验证用独立接收进程：
  const rxScript = path.join(__dirname, 'serial_echo.py');
  fs.writeFileSync(rxScript, [
    'import serial, sys, time',
    "s = serial.Serial('COM11', 115200, timeout=3)",
    'data = s.read(64)',
    "open(r'C:/tools/serial_rx_result.bin','wb').write(data)",
    's.close()',
    'print("RXOK", data)'
  ].join('\n'));
  await page.fill('#in-send', 'PING-FROM-BROWSER');
  await page.selectOption('#sel-crlf', 'CRLF');
  await page.click('#btn-send');
  await page.waitForTimeout(400);
  const echo = spawn(PY, [rxScript]);
  let echoOut = '';
  echo.stdout.on('data', (d) => { echoOut += d.toString(); });
  await new Promise((r) => echo.on('close', r));
  const rxBytes = fs.existsSync('C:/tools/serial_rx_result.bin') ? fs.readFileSync('C:/tools/serial_rx_result.bin') : Buffer.alloc(0);
  check('浏览器发送→COM11 收到 PING', rxBytes.includes(Buffer.from('PING-FROM-BROWSER\r\n')), 'got=' + JSON.stringify(rxBytes.toString()));
  console.log('echo out:', echoOut.trim());

  check('全程无 JS 控制台错误', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

  await page.screenshot({ path: path.join(SHOT_DIR, 'real-02-final.png') });
  sim.kill();
  await browser.close();

  console.log('\n========== REAL RESULT: ' + passed + ' passed / ' + failed + ' failed ==========');
  if (failures.length) { console.log('failures:\n- ' + failures.join('\n- ')); process.exit(1); }
})().catch((e) => { console.error('REAL TEST ERROR:', e.message); process.exit(2); });