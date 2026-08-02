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

- 全面测试补充经验（2026-08-02）：
  - 建立「全量回归入口」tools/run_full_tests.cjs：语法检查 + 注入式 E2E + 真实链路一键执行，功能变更后必跑
  - 测试钩子设计：修改配置必须「原地变更」保持引用一致（如 clearHist 用 length=0），否则测试读写分离产生假失败
  - 涉及标题/通知类 UI 断言，必须先等状态恢复再验证「关闭后不触发」
  - 系统提示行（已连接等）不过滤属业务语义，过滤断言只查数据行

- 真机全项测试扩展（2026-08-02，tools/realmachine_test.cjs，157/157）：
  - **真实鼠标点击**：headed 可见 Chrome + page.mouse 坐标点击（boundingBox 中心，完整事件序列），所有按钮交互不用 element.click()
  - **截图判断**：每阶段 shot() 存档；关键截图用视觉模型复核（HEX 全字节/过滤/突发/乱码）
  - **串口模拟**：tools/realmachine_sim.py 命令驱动（命名模式/分帧/BOM/流式大流量/接收回读）
  - 关键经验：
    1. Chrome headed 启动会清空结构不完整的 serial_chooser_data → 每次启动前预检注入完整结构（含 file://,* 与 file:///*,* 两个 URL key）
    2. VSPE getPorts 顺序不稳定 → 用"连接+发送→对端回读"校准 COM10 实际索引，连接失败自动换索引重试
    3. VSPE stop/start 后连接栈不可靠；大数据（2MB）后 Pair 会话损坏（流 done 结束）→ 应用需识别 done 为断开（v0.6 D8 修复）；空闲稳定性测试移到 burst 前
    4. 消费速率约 85KB/s → 自动日志 2MB 轮转真实链路不可触发（注入式覆盖）；大写入用 1KB 慢速流式避免驱动缓冲卡死
    5. 同端口多客户端共享打开不稳定 → 端口切换验证用独占连接 + 对端回读
