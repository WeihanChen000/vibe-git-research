# 队友用自己的 Agent 接入科研团队

**先按 [三步快速开始](https://github.com/WeihanChen000/vibe-git-research/blob/codex/research-team-share/vibe-git/SCIENCEPAL-QUICKSTART.md) 操作。** 本文是完整参考，不需要从头执行所有命令。

先看原拓扑里的真实案例回放，熟悉“现在轮到谁 → 任务 / 评审 / 文件交接 → 记录”。回放只读，不消耗模型额度；它使用一位用户的 SciencePAL 账号与 Codex，不能替代下面的真实双账号验收。

## 最短接入路径

| 角色 | 打开什么 | 接下来做什么 |
|---|---|---|
| 队长，新建本机房间 | 双击 `open-captain.cmd` | 一次启动 Host 和本人入口，绑定 Agent、保存提案，再邀请队友 |
| 队长，房间已经运行 | `open-research.cmd --captain` | 只开本人入口，复用原房间 |
| 队友 | 双击 `open-research.cmd` | 粘贴邀请 → 绑定自己的 Agent → 保存提案 |
| 评委，只看演示 | [在线播放](https://weihanchen000.github.io/vibe-git-research/submission/watch.html) | 无需安装；要点原拓扑则用 `open-replay.cmd` |

首次启动自动准备依赖和构建，仍需 Node.js 24+。队长入口只监听本机，不自动配置公网；跨电脑仍按下方步骤准备 HTTPS 邀请。遇到端口占用不会停止已有服务，也不会另建身份覆盖原记录。

算力网内显示“加入房间 / Agent 绑定 / 提案保存”三步进度，首次绑定后自动进入提案。完成后按原拓扑的“现在轮到谁”操作。一个 SciencePAL 成员与一个 Codex 成员即可合作，不要求人人都有两个平台账号。

## 第一次来，先选自己的事情

- **只看演示**：双击 `open-replay.cmd`。不需要邀请和 Key；演示入口默认展示 1CRN 的工具参数与独立复核，可切换 Iris 查看两次退回；实际建项默认是自己的研究，示例均为可选。
- **收到邀请的队友**：直接看下方“队友自己做”。不用启动 Host 或配置隧道；只保留本机入口终端。
- **负责房间的队长**：从下一节开始。房间 Host、本人入口、跨电脑 HTTPS 隧道各有职责，关闭 Host / 隧道会使队友无法继续连接。

不确定当前在哪一步时，看原拓扑“现在轮到谁”。未加入时可点“第一次接入？查看队友步骤”，用“返回填写邀请”继续，已填写的邀请不会丢失。加入后，说明可随时从右上角“当前成员 → 队友接入说明”重新打开。

推荐从[当前公开仓库下载源码 ZIP](https://github.com/WeihanChen000/vibe-git-research/archive/refs/heads/codex/research-team-share.zip)，解压后进入 `vibe-git` 子目录。不要把仓库外层目录当运行目录。若队长另外提供了专用接入包和同名 `.sha256`，才需要下面的校验；GitHub 源码 ZIP 不附带这个校验文件。

收到专用接入包 ZIP 与同名 `.sha256` 后，在下载目录运行以下 PowerShell 命令；输出应为 `True`，再解压。校验文件用于确认传输完整，双方应使用队长发来的同一版本。

```powershell
(Get-FileHash .\vibe-git-sciencepal-team-kit.zip -Algorithm SHA256).Hash -eq ((Get-Content .\vibe-git-sciencepal-team-kit.zip.sha256) -split '\s+')[0]
```

## 队长先做：准备房间与邀请

1. 把同一版本仓库链接发给队友；双方下载源码 ZIP，解压后进入 `vibe-git` 子目录，安装 Node.js 24+。也可以提供专用接入包及校验文件。不要发自己的个人配置目录、API Key 或浏览器登录链接。
2. 双击 `open-captain.cmd`，自动准备依赖、启动房间和本人入口，保持一个终端开启。
3. 如果房间已经由 `npm run sciencepal` 启动，使用 `open-research.cmd --captain` 只打开本人入口，不再重复开房间。
4. 跨电脑需要可访问的 HTTPS 房间地址。如果已有可信 HTTPS 入口，复用它；否则在队长终端依次运行：

```powershell
.\scripts\sciencepal-member-env.ps1 -Captain
npm --silent run sciencepal:member -- tunnel status
# 仅在 status 显示 installed=false 时执行下一条
npm --silent run sciencepal:member -- tunnel install
npm --silent run sciencepal:member -- tunnel start
npm --silent run sciencepal:member -- invite
```

`tunnel start` 会实际开放外部 HTTPS 入口；由队长决定何时启动并保持 Host / 隧道运行。本说明与回放不会自动开放公网，也不改变 Wi-Fi 或系统服务。

5. 将返回的 `https://…/join/…` 私下发给队友。`localhost` / `127.0.0.1` 指向各自电脑，不能用作跨电脑邀请。顶部“邀请成员”可再次复制邀请；不要混用本人页面的一次性登录票据。

完成标志：队友能连上 HTTPS 房间，队长原拓扑可看到其独立成员编号。

## 队友自己做：账号、专家、提案

1. 解压同版本源码 ZIP 后进入 `vibe-git`（专用接入包才需核对附带的 `.sha256`），双击 `open-research.cmd`。首次自动安装依赖并构建；保留终端。没有自动打开页面时，使用终端打印的备用链接。本人链接两分钟内单次有效，过期则重开入口。
2. 在本机页面“加入协作房间”粘贴队长邀请。已加入同一房间就不要重复注册，也不要再次运行 CLI join。
3. 登录**自己的** SciencePAL，在账号提供的 API / development 页面生成本人 Key。顶部“算力网”选择 SciencePAL，输入 Key，点“验证账号并读取 Agent”。选择自己账号中实际可用、适合课题的 Agent（1CRN 示例可选 Biology），再点“接入算力网”。不把 Key 发到聊天或交给队长。如果本人使用 Codex，则在同一位置选“Codex 本地执行”并接入，无需 SciencePAL Key；后续按待办准备任务包并交回成果。
4. 点“我的提案”，写研究问题、数据、分工与验收标准并保存。示例：本人使用 Biology 工具计算 1CRN 表面积，独立复核队友几何量；保留单位、方法、代码、工具版本和文件字节回执。
5. 将页面“当前成员”中的成员编号告诉队长。成员编号不是 Key；两个人选择同一个内置 Biology ID 也可以，平台按各自成员身份区分。

完成标志：队长看到两个不同成员，双方都有平台绑定和已保存提案。此时还没有证明模型已经执行。

## 一起做：在原拓扑开始真实任务

队长可使用 Codex，队友使用自己的 SciencePAL；也可双方各用自己的 SciencePAL。**创建项目前选好平台**，已有项目不会随账号绑定变化而改写负责人。

- 通用任务：队长打开“科研项目”，选择两人的提案并“冻结提案并建立项目”，按右侧待办启动对齐、检查协议、发布研究任务。队友可在本人待办直接点“启动本人连接器并领取”，也可在算力网管理连接器；自己的 Codex 任务则从待办“准备本人任务包 → 复制给 Codex 的任务说明 → 检查并交回成果”。
- **界面完成 Iris 实验**：双方在“我的提案 → 使用示例提案（可选）”分别选择数据核验、统计复核，检查后保存。队长打开原“科研项目”，选两人，展开“使用公开案例（可选）”，点“使用 Iris 公开数据复核模板”，检查文件哈希与来源，再“冻结提案并建立项目”。随后按待办对齐、发布、领取、评审与交接；无需 prepare/create 命令。
- **自己的科研数据**：在同一建项弹层选择 UTF-8 CSV、TSV、TXT、JSON、DATA 或 PDB（单文件不超过 256 KiB），补上 HTTPS 来源页或项目说明、署名与许可。原始字节随项目冻结，可在协议抽屉查看文件、大小与 SHA256。输入给参与成员的 Agent，因此请选择公开或已获授权的数据。更换文件会移除案例固定格式；自己的提案应明确输出格式和验收标准。
- **可选 1CRN 模板**：双方在“我的提案 → 使用示例提案（可选）”分别填写几何、专业计算提案。建项时展开“使用公开案例（可选）”并选择 1CRN；该项目才使用专用数据和成果 schema。高级配置仍可使用下方命令。

### 可选高级路径：已经在界面建项请跳过

以下命令是另一种建项方式，已在界面建立项目就不要再次执行。双方分别复制 `fixtures/team-research/captain-proposal.md`（队长）和 `member-proposal.md`（队友）到“我的提案”保存。队长终端执行：

```powershell
.\scripts\sciencepal-member-env.ps1 -Captain
npm --silent run sciencepal:member -- prepare 队友成员编号 .\fixtures\team-research\project-template.json .\team-project.json
npm --silent run sciencepal:member -- create .\team-project.json
```

把“队友成员编号”替换成实际值；`team-project.json` 必须是尚不存在的新文件。prepare 只整理配置，不调用模型；create 冻结提案、身份、数据及成果格式。两端页面刷新后选择新项目。

### 发布前共同检查

如果验收要求可复现代码，成果里必须带实际代码与工具版本；只给出本人沙箱里的脚本文件名，队友仍然无法复核，应先返工。真实 Iris 跨平台验证及其两次退回原因见 `SCIENCEPAL-IRIS-LIVE-RESULT.md`。

队长发布前核对：两人的分工正确；下游依赖上游；评审者不同于作者；源文件与单位、参数、验收标准都明确。运行会消耗各自 SciencePAL 额度，远端等待数分钟属于可能的实际情况。

## 看到这些状态时怎样继续

| 页面状态 | 谁操作、下一步 |
| --- | --- |
| 等待 SciencePAL 领取 | 对应队友在自己的算力网启动本项目连接器；队长不能替另一台电脑启动 |
| 等待 Codex 提交 | 本人 Codex 读取 TASK.md 与 inputs，保存约定的 JSON，再在原待办交回 |
| 评审退回 | 队长查看具体修改项，点“安排返工”；作者处理新任务包，旧版本保留，下游不放行 |
| 等待本人回答 | 该账号本人打开 SciencePAL **原线程**回答，连接器核对后接回；不要另开新研究线程 |
| 心跳超时 / 停止 | 检查本人终端和网络，回到同一本机入口恢复；远端可能仍在运行，不另开重复 worker |
| 启动结果待核对 UNKNOWN | 核对原线程和日志，走 recover；不要删除日志、反复启动或新建任务来绕过 |
| 本轮已完成 | 查看证据与科学结论，确认全部评审通过、文件交接回执正确 |

网页回复不方便时，先在算力网停止本人连接器，确认已停止；在相同个人目录配置项目并提交答复文件：

```powershell
.\scripts\sciencepal-member-env.ps1 -ProjectId 实际项目ID
npm --silent run sciencepal:member -- reply 实际项目ID C:\你的个人目录\answer.md
```

然后回到同一算力网启动本人连接器。队长使用自己的身份时环境脚本加 `-Captain`。不要同时运行网页 worker 与 CLI work。个人目录默认 `%LOCALAPPDATA%\VibeGit\team-research`，自定义 ProfileDir 时各入口必须一致。

## 真正双账号通过的标准

双方分别在自己的 SciencePAL 账号看到对应线程，并各自确认任务归属；两个不同 Key 或两个 Agent ID 本身不是不同账号的证明。用项目的两个成员编号、各自线程 ID、批准成果 SHA256 和交接记录填写 `SCIENCEPAL-TEAM-ACCEPTANCE.md`，不记录 Key。

需要同时满足：两端均从本人入口操作；任务领取无越权；至少一次真实获批文件交接；独立评审通过；发生等待输入时保留原线程并接续；最终页面 COMPLETED。若本轮没有发生返工或等待输入，如实标“未触发”，不要填通过。单账号回放只能证明已完成的跨平台案例。

以后启动同一房间只需双击入口，复用原身份和日志。换新房间使用新的项目外个人目录。更新源码包后，双击入口会核对依赖清单和源码变化，必要时重新安装或构建；不要删除个人配置来升级。手工使用 CLI 时仍应执行 `npm ci`、`npm run build`。
