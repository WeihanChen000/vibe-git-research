# SciencePAL 统一任务入口（兼容 Codex 等平台）

**团队任务优先使用 [Codex + SciencePAL 混合团队入口](SCIENCEPAL-MIXED-TEAM.md)**：成员身份下的 next/take/submit 已接入同一项目的评审、返工和文件交接。下文 sciencepal:call 保留为独立任务桥，不会自动将旧任务导入团队。

2026-10-30：产品主线已改为 [SciencePAL 优先的科研协作](RESEARCH-FIRST-DECISION.md)，此入口保留为各平台可调用的本地任务桥，不要求 Codex 成为主程序。Agent 列表已改用官方可用目录，包含本账号有使用权限的内置、自建与共享 Agent。

本地统一入口已实现：Codex 可以通过一个 JSON CLI 完成列出 Agent、提交任务、查询、取回文件、原线程反馈、恢复未知提交。它复用现有 SciencePAL 客户端和 `data/sciencepal/workspace.db`，不需要启动浏览器或 Host 网页，也没有新 npm 依赖。它不是已经安装的 MCP 工具。

单账号或尚未配置账号时，可先运行 `npm run sciencepal:simulate` 做离线演练。它使用真实本地控制流程与模拟远端，不消耗 SciencePAL 额度；操作成本、团队整合缺口和下一阶段优先级见 [可用性评审](SCIENCEPAL-USABILITY-REVIEW.md)。

## 运行

在源码 `vibe-git/` 目录构建后执行。Node.js 24+；Key 文件放在仓库外，格式为 `{"apiKey":"..."}`，不上传、不提交、不打印。

```powershell
npm run build
$env:SCIENCEPAL_AUTH_FILE = Join-Path $env:LOCALAPPDATA 'VibeGit/sciencepal-auth.json'
npm --silent run sciencepal:call -- agents
npm --silent run sciencepal:call -- submit request.json
npm --silent run sciencepal:call -- status <task-id>
npm --silent run sciencepal:call -- collect <task-id>
npm --silent run sciencepal:call -- respond <task-id> feedback.json
```

`request.json` 示例（Agent ID 从 `agents` 返回值选择）：

```json
{
  "requestId": "my-project-analysis-v1",
  "agentId": "actual-agent-id",
  "kind": "execution",
  "prompt": "读取附件，实际计算并写 result.json；说明方法、单位、输入哈希和局限。",
  "inputFiles": ["data.csv"],
  "outputs": ["result.json"]
}
```

输入路径相对于请求 JSON 所在目录。最多 8 个输入、合计 5 MiB；1–8 个输出，每个最多 5 MiB。输出须为普通文件名，不接受目录、Windows 设备名或大小写冲突。产物需要保存在 SciencePAL `/workspace/` 下。`parentTaskId` 可引用先前的任务；`kind` 可为 `execution`、`review` 或 `capability`。

同一 `requestId`、同一内容重新提交返回原任务；改变内容要使用新 ID。网络超时后先 `show/status`，不能为绕过未知状态而换 ID 重发。

反馈 JSON：

```json
{"requestId":"my-project-fix-v2","feedback":"根据独立评审修正单位，保留旧版，重新实际计算；输出 result-r2.json。"}
```

`respond` 在原 SciencePAL 线程添加消息并启动新运行，自动生成 `-r2`、`-r3` 等输出名（最多六轮）；旧结果留在数据库及本地独立目录。可用于返工或回答 Agent 的问题。目前只续接文本反馈；需要新增附件时，创建带 `parentTaskId` 的新任务。新评审应上传修订后的真实文件，不仅发送摘要。

## 状态和恢复

| 状态 | Codex 下一步 |
| --- | --- |
| RUNNING | 稍后 `status`；不要重复提交 |
| NEEDS_INPUT | 读取 SciencePAL 原线程问题，明确 `respond`；不是完成 |
| COMPLETED | `collect` 下载声明的成果；缺文件仍不能视为交付 |
| COLLECTED | 核查内容、交给独立评审或反馈返工；不等于科学批准 |
| MESSAGING / MESSAGE_SAVED | 同一反馈文件重试 `respond`，保持消息 ID；不能新建反馈绕过 |
| UNKNOWN | 核对原线程运行 ID 后 `recover <task-id> <thread-id> <run-id>`；禁止自动重发启动 |
| FAILED | 查看错误和原线程，不自动续接失败运行 |

`collect` 导出到 `data/sciencepal/bridge-results/<task-id>/rN/`。输入和输出 SHA-256、大小及字节冻结保存；再次采集不覆盖已修改的本地文件。`show`、`list` 可读取任务记录。`VIBE_GIT_DATA_DIR` 可以显式选取数据目录。

CLI 通过 `bridge.lock` 阻止并行写入。进程异常退出时，先确认锁中 PID 已结束，再删除这个锁；不要删除数据库。启动结果未知的任务仍须按 UNKNOWN 恢复。启动前已经保存为 READY 的任务可用相同请求安全恢复。

## 与多人控制面的关系

这个入口当前使用**操作者自己的账号**，任务日志和团队项目共享存储位置，但不会自动成为已批准的团队提案或成果。`parentTaskId` 是关联，不是授权凭据；不能凭它替队友提交提案，也不能把裸 Agent ID 当作成员身份。

跨成员执行走 [成员连接器](SCIENCEPAL-TEAM-QUICKSTART.md)：SciencePAL 成员在自己的机器保存自己的 Key，Codex 成员通过 take/submit 操作本人的冻结任务。两者已共用项目、任务、评审和交接；独立桥任务没有直接导入批准状态。当前没有声称 DSH 或真实第二账号已联调。

## 已准备的真实案例

[1CRN 结构分析案例](fixtures/structure-case/README.md) 包含公开原始数据、候选脚本、独立数值基线、评审交接和返工操作。工具探测与科学内容验证分别保留证据，不能从一次闭环推断 SciencePAL 全面优于其他平台。

[本次真实验收](SCIENCEPAL-STRUCTURE-LIVE.md) 已完成：执行返工及评审器返工均在原线程发生，59 项证据检查、10 项本地重放通过。SciencePAL 专用科研工具的比较优势仍未证实。
