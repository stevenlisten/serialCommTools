# M003 Web Serial 在 file:// 下可用性实证（headless Chrome）

- 场景：需要验证「纯 HTML 双击运行（file://）」是否能用 Web Serial API，避免仅凭文档猜测
- 方法步骤：
  1. 生成测试页：输出 `window.isSecureContext` 与 `typeof navigator.serial`
  2. 运行：`chrome.exe --headless --disable-gpu --no-first-run --user-data-dir=<临时目录> --dump-dom file:///<绝对路径>`，从 DOM 中读取结果
  3. Chrome 与 Edge 各测一次，记录版本
- 验证方式：`isSecureContext: true` 且 `serialType: "object"` 即支持
- 来源任务：T001（需求分析阶段）
- 日期：2026-08-02
- 备注：本机实测 Chrome 150 / Edge 150 均可用；`requestPort()` 仍必须由用户手势触发