# M006 Playwright 串口 UI 自动化测试（注入式 + 真实链路）

- 场景：串口网页应用需要自动化测试，但系统串口选择器无法自动化
- 方法 A（注入式，测全部 UI 逻辑，无硬件）：
  - URL 带 ?test=1 时用 FakePort（ReadableStream/WritableStream）替换 navigator.serial
  - 暴露 window.__test：feed(bytes)/txAll()/drop()/setPorts()/state()/settings() 等钩子
  - Playwright 正常点击 UI，数据通过 __test.feed 注入
- 方法 B（真实链路，测真实 Web Serial）：
  1. VSPE 创建虚拟串口对 COM10<->COM11（见 M005）
  2. 按 M004 把授权注入专用 Chrome profile（Preferences serial_chooser_data）
  3. Python 模拟设备（serial_sim.py）占用 COM11：持续发送已知模式 + 记录收到的字节到文件
  4. Playwright 以该 profile 启动 headless Chrome -> 打开应用 -> 点击连接（直接连已授权端口）-> 断言接收/发送
- 常见坑：
  - CSS 隐藏的 checkbox（自定义开关 input{display:none}）：Playwright check() 不可见 -> 点击 label 或 force
  - 串口被占用时第二个客户端打不开：接收验证应在「占用端」侧（模拟设备自行记录）
  - 断言特殊字节序列按实际字节顺序写（如 FE FF，勿想当然写 00 FF）
- 来源任务：T001；日期：2026-08-02
