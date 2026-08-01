# M005 Win11 虚拟串口对搭建（VSPE + pyserial 回环自测）

- 场景：无真实串口设备时，需要一对互通 COM 端口用于串口软件自测；Win11 下 com0com 驱动签名失败（Code 52）
- 结论先行：**Win11 用 VSPE（Eterlogic）1.5.8+，驱动签名有效；com0com 3.0.0.0 测试签名驱动不可用**
- 方法步骤：
  1. 安装 VSPE：下载 SetupVSPE_64_<ver>.zip → `msiexec /i SetupVSPE_64.msi /qn /norestart`（提权）
  2. 验证驱动：Get-PnpDevice 应有 "Eterlogic Virtual Serial Ports Bus" 且 Status=OK
  3. 创建 Pair（评估版 CLI 受限，走 GUI 自动化）：
     - 打开 VSPEmulator.exe → 评估对话框点 Continue
     - 主窗口发 `WM_COMMAND 1001` → New device 向导
     - 设备类型 ComboBox(id=1029) 用 CB_GETCOUNT/CB_GETLBTEXT/CB_SETCURSEL 选 "Virtual Pair"（注意发 CBN_SELCHANGE 通知）
     - 下一页(id=12324) → 端口 1 ComboBox(id=2002)、端口 2 ComboBox(id=2004) 选目标端口 → 完成(id=12325)
     - 主窗口发 `WM_COMMAND 32803`（Start emulation）→ 端口出现
  4. 回环验证（pyserial）：
     ```python
     a = serial.Serial('COM10', 115200, timeout=2)
     b = serial.Serial('COM11', 115200, timeout=2)
     a.write(b'PING'); got = b.read(4); assert got == b'PING'
     ```
  5. 端口号选择避开已占用 ComDB 端口（如本机 COM5/6 曾被 com0com 占用）
- 验证方式：GetPortNames() 含新端口 + pyserial 回环 PASS
- 来源任务：T001 步骤 1
- 日期：2026-08-02
- 备注：VSPE 评估版限制 5 个设备、不自动加载配置（重启后需重建 Pair）；注册版可持久化