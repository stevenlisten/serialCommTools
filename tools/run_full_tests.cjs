/**
 * 全量回归入口（功能变更后执行）：
 *   node tools/run_full_tests.cjs
 * 依次执行：JS 语法检查 → 注入式 E2E（177 断言）→ 真实串口链路（16 断言，需 VSPE COM10/11 + 授权 profile）
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const steps = [
  { name: 'JS 语法检查 (node --check)', cmd: 'node', args: ['--check', path.join(root, 'serial-monitor.html')].concat([]), skip: false },
  { name: '注入式 E2E（tools/e2e_test.cjs）', cmd: 'node', args: [path.join(__dirname, 'e2e_test.cjs')], skip: false },
  { name: '真实串口链路（tools/realport_test.cjs）', cmd: 'node', args: [path.join(__dirname, 'realport_test.cjs')], skip: process.env.SKIP_REAL === '1' }
];

// node --check 不支持 .html，先抽取 <script> 到临时文件
const fs = require('fs');
const html = fs.readFileSync(path.join(root, 'serial-monitor.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
const tmp = path.join(require('os').tmpdir(), 'serial_monitor_check_full.js');
fs.writeFileSync(tmp, m[1]);
steps[0] = { name: 'JS 语法检查 (node --check)', cmd: 'node', args: ['--check', tmp], skip: false };

let failed = 0;
for (const s of steps) {
  if (s.skip) { console.log('[跳过] ' + s.name); continue; }
  console.log('\n========== ' + s.name + ' ==========');
  const r = spawnSync(s.cmd, s.args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { failed++; console.log('❌ 失败: ' + s.name + ' (exit=' + r.status + ')'); }
  else console.log('✅ 通过: ' + s.name);
}
console.log('\n========== 全量回归' + (failed ? '：有 ' + failed + ' 项失败' : '：全部通过 ✅') + ' ==========');
process.exit(failed ? 1 : 0);