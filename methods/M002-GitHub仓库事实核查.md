# M002 GitHub 仓库事实核查（ls-remote + License API）

- 场景：引用 GitHub 项目作为设计参考前，核查仓库真实存在、分支可用、许可证合规（规则 8/10）
- 方法步骤：
  1. 存在性：`git ls-remote https://github.com/<owner>/<repo>.git HEAD`，返回 40 位哈希即存在
  2. 许可证：`Invoke-RestMethod -Uri "https://api.github.com/repos/<owner>/<repo>/license" -Headers @{ "User-Agent"="codex" }` 取 `license.spdx_id`
  3. 将结果登记到 `docs/参考项目.md`（含核查日期）
- 验证方式：两条命令输出与官方页面一致
- 来源任务：T000（框架搭建）
- 日期：2026-08-02
- 备注：NOASSERTION/缺失 LICENSE 的项目标注「以仓库 LICENSE 为准」，借鉴代码前必须人工复核