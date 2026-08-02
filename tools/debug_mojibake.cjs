const { chromium } = require('C:/tools/node-selftest/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file:///C:/01_Dev/Ai/chatgpt/serialCommTools/serial-monitor.html?test=1');
  await page.waitForFunction(() => window.__test !== undefined);
  await page.click('#btn-connect');
  await page.waitForFunction(() => window.__test.state().connected === true);

  const out = {};
  // 场景1：设备发 GBK 中文，工具默认 UTF-8
  await page.click('#btn-clear'); await page.waitForTimeout(200);
  await page.selectOption('#sel-enc', 'utf-8');
  await page.evaluate(() => window.__test.feedBytes([0xD6,0xD0,0xCE,0xC4,0x0A])); // GBK: 中文
  await page.waitForTimeout(400);
  out.gbkAsUtf8 = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('#viewer .line.txtline'));
    return els.map(e => e.textContent).join('|').replace(/\[\d\d:\d\d:\d\d\.\d\d\d\]/g, '');
  });

  // 场景2：UTF-8 BOM 头
  await page.click('#btn-clear'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__test.feedBytes([0xEF,0xBB,0xBF,0xE4,0xB8,0xAD,0x0A])); // BOM + 中
  await page.waitForTimeout(400);
  out.bom = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('#viewer .line.txtline'));
    return els.map(e => Array.from(e.textContent).map(ch => ch.codePointAt(0).toString(16)).join(' ')).join('|');
  });

  // 场景3：二进制字节在文本模式
  await page.click('#btn-clear'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__test.feedBytes([0x01,0x02,0x80,0xFF,0xFE,0x0A]));
  await page.waitForTimeout(400);
  out.binary = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('#viewer .line.txtline'));
    return els.map(e => Array.from(e.textContent).map(ch => ch.codePointAt(0).toString(16)).join(' ')).join('|');
  });

  // 场景4：跨重连的多字节字符（解码器重置）
  await page.click('#btn-clear'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__test.feedBytes([0xE4, 0xB8])); // “中”的前 2 字节
  await page.waitForTimeout(300);
  await page.selectOption('#sel-baud', '9600'); // 触发热更新 → 新解码器
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__test.feedBytes([0xAD, 0x0A])); // 尾字节
  await page.waitForTimeout(400);
  out.reconnectSplit = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('#viewer .line.txtline'));
    return els.map(e => Array.from(e.textContent).map(ch => ch.codePointAt(0).toString(16)).join(' ')).join('|');
  });
  await page.selectOption('#sel-baud', '115200');

  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });