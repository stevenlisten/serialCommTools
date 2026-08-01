# M001 GitHub 凭据安全配置（Windows 凭据管理器）

- 场景：需要向 GitHub 仓库推送代码，但禁止把 token 写入项目文件/明文落盘
- 方法：
  1. 确认 `git config --global credential.helper` 为 `manager`（Windows Git 默认）
  2. 执行 `git credential approve` 写入凭据管理器（加密存储）：
     `"protocol=https`nhost=github.com`nusername=<用户名>`npassword=<token>`n`n" | git credential approve`
  3. 验证：`git ls-remote https://github.com/<owner>/<repo>.git` 无需再输凭据
- 验证方式：ls-remote 返回 HEAD 哈希即成功
- 来源任务：T000
- 日期：2026-08-02
- 备注：token 属于敏感信息，**禁止写入任何项目文件或 commit**；如 token 泄漏应立即在 GitHub 吊销并重新配置