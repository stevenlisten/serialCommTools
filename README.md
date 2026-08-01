# serialCommTools

串口通信工具集（Serial Communication Tools）

## 当前交付：Serial Listener 串口侦听器（单文件 HTML）

**`serial-monitor.html`** —— 双击即可运行的串口侦听/调试工具，无后端、无构建、无外部依赖（Chrome/Edge 89+）。

### 功能
- 串口连接/断开/重连；参数可配：波特率（常用+自定义）、数据位、停止位、校验、流控、编码（UTF-8/GBK/Latin-1）
- 实时接收：文本/HEX（hexdump+ASCII 列）双模式、时间戳、自动滚动、暂停缓存、清空
- 过滤/搜索：关键字高亮、大小写切换、仅显示匹配行
- 报警：关键字匹配响铃+闪烁，开关可控
- 发送：文本/HEX、CR/LF、快捷发送列表（增删持久化）、命令历史 上/下、Ctrl+C/D 控制字符
- 日志导出：一键 .log（含时间戳与会话信息）
- 配置持久化（localStorage）、RX/TX 计数、暗色现代 UI、ARIA 无障碍标签

### 使用
1. 用 Chrome 或 Edge 打开 `serial-monitor.html`（直接双击即可）
2. 点击「连接」-> 在系统对话框选择串口 -> 开始侦听
3. 快捷键：Enter 发送、Ctrl+L 清空、Ctrl+C/D 发送控制字符、上/下箭头命令历史

## 工作框架（重要）
本项目遵循 `docs/工作协议.md` 中的 11 条工作规则：
计划 -> 交互 -> 目标 -> 执行 -> 自测/验证/对比/修订 -> 持久化记录 -> 方法沉淀 -> C:\tools 安装 -> 参考 GitHub 优秀项目 -> Git 提交 -> 复盘与事实核查。

## 目录结构
- `docs/` — 工作协议、计划模板、参考项目库、环境与工具登记
- `plans/` — 执行计划（含逐步实际执行结果，可重现流程）
- `records/` — 过程持久化记录（含测试证据截图）
- `methods/` — 成功方法库（防重复造轮子）
- `tools/` — 自测脚本（E2E 测试、串口模拟设备）
- `serial-monitor.html` — 产品本体（单文件）

## 自测
- 注入式 E2E（无硬件）：`node tools/e2e_test.cjs` -> 46/46 通过
- 真实串口链路（需 VSPE 虚拟口 COM10/11）：`node tools/realport_test.cjs` -> 11/11 通过
- 详见 `plans/T001-串口侦听软件.md`

## 远程仓库
https://github.com/stevenlisten/serialCommTools （main 分支）
> 安全提示：GitHub token 仅存于 Windows 凭据管理器，不落盘、不入库。
