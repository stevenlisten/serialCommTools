# M004 纯 HTML + Web Serial API 实现串口工具（无后端）

- 场景：需要「只运行一个 HTML」的串口工具（无前后端、无构建、无依赖）
- 关键事实（已实证，2026-08-02，Chrome/Edge 150）：
  1. file:// 下 isSecureContext=true，navigator.serial 可用 -> 双击 HTML 即可
  2. requestPort() 必须用户手势触发，且总是弹系统选择器（CDP/Playwright 无法自动化）
  3. 已授权端口用 getPorts() 获取（无需手势）
- 核心实现模式：
  - 读循环：port.readable.getReader() + TextDecoder(enc,{stream:true})，按换行分帧；断线时 reader.cancel() -> port.close()
  - 参数热更新：连接中改参数 -> 先 close 再 open（保留 port 对象，无需重新授权）
  - 大数据：DOM 上限 6000 行 + requestAnimationFrame 批量追加；HEX 尾部不足 16 字节用 300ms 定时冲刷
  - 编码：UTF-8/GBK/Latin-1（TextDecoder('gbk') 浏览器原生支持）
- 自动化授权（免用户点击）：
  1. 获取设备实例 ID：Get-PnpDevice 取 Class=Ports 的 InstanceId（如 ETERLOGIC_VSPE\ETERLOGIC_VSPE_PORT\COM10）
  2. 写入 profile 的 Default\Preferences：content_settings.exceptions.serial_chooser_data 增加键 "file:///*,*"，值 {last_modified, setting:{chosen-objects:[{device_instance_id, name}]}}
  3. 之后同 profile 启动 headless Chrome，getPorts() 即可返回该端口
- 验证方式：注入式 E2E（?test=1 替换 navigator.serial）+ 真实链路（VSPE 虚拟口 + Python 模拟设备）
- 来源任务：T001；日期：2026-08-02
- 备注：参考 SerialTerminal（MIT）与 googlechromelabs/serial-terminal（Apache-2.0）设计，代码原创
