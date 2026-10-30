# 高级 CLI 参考：两个人、各自账号、科研 Agent

**普通接入只看 [三步快速开始](SCIENCEPAL-QUICKSTART.md)。** 本页保留高级 CLI 路径；已在网页加入房间不要再次注册。

**最新入口：** [队长 / 队友分步接入](SCIENCEPAL-TEAM-START.md) · [原拓扑真实案例回放](SCIENCEPAL-REPLAY.md)。解压后 `open-replay.cmd` 可先看已完成的单账号真实记录；`open-research.cmd` 才是本人接入与新任务入口。

**首次使用优先看 [图形接入与连接器启动](SCIENCEPAL-FIRST-RUN.md)**：解压后双击 open-research.cmd，沿用原版邀请、算力网、提案和成员拓扑。下文保留 CLI 接入与公开 1CRN 专业案例；两条路径复用成员身份，已在网页加入就不要再注册，也不要同时开两个 worker。

需要 Codex 与 SciencePAL 参与同一个团队时，按 [混合团队说明](SCIENCEPAL-MIXED-TEAM.md) 在创建项目前选择平台。Codex 成员使用 bind-codex/next/take/submit，无需 SciencePAL Key；本文其余身份、提案和队长权限流程继续复用。

接入 ZIP 与本文可直接交给队友。**工程隔离联调已完成，真实双账号待两位本人操作。** 两人可以选择相同的内置 Biology 专家，任务按成员绑定区分，平台专家 ID 单独保存。Key 各自留在电脑上，不交给队长。不同 Agent ID 或不同 Key 都不能单独证明不同账号。

## 1. 两人安装同一包

解压 vibe-git-sciencepal-team-kit.zip，进入其中的 vibe-git 文件夹。需要 Node.js 24+、npm、PowerShell；首次安装需要网络。

```powershell
node --version
npm ci
npm run build
```

这是当前开发版源码包，无需全局旧版 CLI，也无需 Codex。双方核对 ZIP 的 .sha256；KIT-MANIFEST.json 含逐文件哈希。包包含公开科研样本的精选只读真实回放，不含 Key、邀请、成员凭据、数据库或私有连接器日志，仅供当前队内联调，不新增开源许可声明。

若下载标记阻止执行 PowerShell 脚本，先核对来源、哈希与代码，再仅对这个文件运行 `Unblock-File .\scripts\sciencepal-member-env.ps1`，不要全局修改执行策略。

## 2. 队长启动 Host

一个终端运行并保持开启：

```powershell
npm run sciencepal
```

默认 http://127.0.0.1:8788。若已有旧版 Host 占端口，由操作者确认是自己的项目进程后正常退出并重启；本轮没有停止旧服务。原 data 与成员身份继续复用，不删除数据库。多人任务不代用 Host 的 Key。

队长在第二个终端、同一目录运行：

```powershell
.\scripts\sciencepal-member-env.ps1 -Captain -SaveKey
npm --silent run sciencepal:member -- agents
npm --silent run sciencepal:member -- bind 10000000-0000-0000-0000-000000000002
npm --silent run sciencepal:member -- plan .\fixtures\team-research\captain-proposal.md
npm --silent run sciencepal:member -- doctor
```

SaveKey 隐藏提示输入本人 SciencePAL API Key，存到个人目录 `%LOCALAPPDATA%\VibeGit\team-research\sciencepal-auth.json`，不写命令历史。已有 Key 时省略 SaveKey；复用其他文件时，脚本运行后设置 `$env:SCIENCEPAL_AUTH_FILE='实际路径'`。示例 Biology ID 来自实测目录，但仍须用 agents 确认本人有权限。doctor 只读，不启动付费任务。

## 3. 队长生成跨电脑邀请

队长第二个终端执行：

```powershell
npm --silent run sciencepal:member -- tunnel status
```

若 installed=false，先执行 `tunnel install`。准备联调时执行：

```powershell
npm --silent run sciencepal:member -- tunnel start
npm --silent run sciencepal:member -- invite
```

复用原 Cloudflare 管理器，默认目标已修正为本 Host 的 8788。start 会实际开放外部 HTTPS 入口，此步留给队长执行，本轮未自动打开。安装/启动超时先查 status；Host 与隧道都需保持运行。已有可信 HTTPS 转发可直接复用。

只把返回的 **https://…/join/…** 私下交给队友，不发送 localhost，不公开邀请，也不把 panel 的本人登录票据当邀请。

## 4. 队友使用自己的账号加入

把收到的完整加入链接保存为项目外 join.txt；替换下面的实际路径：

```powershell
.\scripts\sciencepal-member-env.ps1 -JoinFile 'C:\Users\你的用户名\Downloads\join.txt' -SaveKey
npm --silent run sciencepal:member -- agents
npm --silent run sciencepal:member -- join
npm --silent run sciencepal:member -- bind 10000000-0000-0000-0000-000000000002
npm --silent run sciencepal:member -- plan .\fixtures\team-research\member-proposal.md
npm --silent run sciencepal:member -- doctor
npm --silent run sciencepal:member -- state
npm --silent run sciencepal:member -- panel
```

成员身份保存到个人目录 member.json，join 不覆盖已有身份。选择本人目录中可用的专家，可以同为 Biology。打开 panel 输出的一次性链接查看状态。把 **state.viewer.id** 告诉队长，这是成员编号，不是密钥。

已有原 Vibe-Git 成员可让 VIBE_GIT_MEMBER_FILE 指向 `%USERPROFILE%\.vibe-git\client.json`，省略 join。新终端需重跑环境脚本并重新设置自定义路径。脚本默认个人目录，每人可用 ProfileDir 参数指定自己的目录，不能共用凭据。

## 5. 队长冻结科研任务

两份提案对应公开 1CRN：队长做 BioPython SASA 计算，队友用 NumPy 独立实现复算，双方交叉评审。原 PDB 重命名为 source-1crn.txt 附件，字节不变；不是合成数据，也不宣称新发现。

```powershell
npm --silent run sciencepal:member -- state
npm --silent run sciencepal:member -- prepare 队友NODE_ID .\fixtures\team-research\project-template.json .\team-project.json
npm --silent run sciencepal:member -- create .\team-project.json
```

替换队友NODE_ID。prepare 自动取两人的当前提案 ID、队长身份、公开数据与冻结成果格式，写入新文件，不覆盖旧配置、不运行 Agent。create 返回项目 ID，发给队友。任务键固定 structure / analysis，交付包含方法、Python 代码、工具记录、局限与字节回执。

## 6. 两人分别启动连接器

新终端先重设环境，已有 Key 不加 SaveKey。队长：

```powershell
.\scripts\sciencepal-member-env.ps1 -Captain -ProjectId 实际项目ID
npm --silent run sciencepal:member -- doctor 实际项目ID
npm --silent run sciencepal:member -- work 实际项目ID
```

队友：

```powershell
.\scripts\sciencepal-member-env.ps1 -ProjectId 实际项目ID
npm --silent run sciencepal:member -- doctor 实际项目ID
npm --silent run sciencepal:member -- work 实际项目ID
```

两端 ready=true 后再 work，保持终端开启。个人目录的 connector-项目ID.json 绑定 Host/成员/项目，不互换、不删除重发。Ctrl+C 后同命令续查原运行。一次成功无返工通常需要 5 次 Agent 运行：对齐、执行 A、评审 B、执行 B、评审 A，按实际 SciencePAL 额度。

## 7. 队长对齐与发布

推荐先运行 `npm --silent run sciencepal:member -- panel`，在科研拓扑右侧直接启动对齐、检查并发布、安排返工。普通成员可以提出研究变更，应用变更仍由项目队长确认；连接器保持运行。完整界面操作与无需账号的可操作演示见 [混合团队说明](SCIENCEPAL-MIXED-TEAM.md#在拓扑中操作完整研究流程)。下方 CLI 是兼容入口。

另开终端运行环境脚本 -Captain：

```powershell
'{"revision":1}' | Set-Content -Encoding utf8 .\action.json
npm --silent run sciencepal:member -- command 实际项目ID align .\action.json
npm --silent run sciencepal:member -- state
npm --silent run sciencepal:member -- panel
```

等 READY，检查 structure 给队长、analysis 给队友、analysis 依赖 structure，验收条件保留。若 NEEDS_DECISION，用 decide 提交当前 revision、alignmentRunId、issueId、optionId，等待重新对齐，不能跳过冲突。

确认后把 action.json 改成 `{"revision":1,"alignmentRunId":"实际对齐运行ID"}`，执行：

```powershell
npm --silent run sciencepal:member -- command 实际项目ID publish .\action.json
```

两端自动执行、交接、评审。创建项目后重新 bind 不修改已冻结的专家；换专家需新建项目重新对齐。NEEDS_INPUT/FAILED/INVALID/UNKNOWN 都不能当完成。

## 8. 真人验收与导出

两人分别在自己的 SciencePAL 找到对应运行，确认不同账号与实际任务归属。队长导出：

```powershell
npm --silent run sciencepal:member -- evidence 实际项目ID .\team-evidence-r1.json
```

只写新文件。填写 [双账号验收记录](SCIENCEPAL-TEAM-ACCEPTANCE.md)。检查 COMPLETED、allApproved=true、全部 handoffs 通过，再核对科学结论。系统证据包含提案/研究内容，但不含 Key；它不是跨账号所有权的签名证明。

## 9. 返工、变更、恢复

统一形式：`command 项目ID 操作 action.json`，Body 含当前 revision。

| 状态或操作 | 处理 |
| --- | --- |
| CHANGES_REQUESTED | 队长 rework，加 taskKey 与具体 note；保留旧成果再评审，不伪造失败。 |
| R2 | 成员 change 加 request；等 CHANGE_READY 后队长 apply-change 加 changeId，再按 R2 对齐结果发布。 |
| FAILED / INVALID | 查看真实错误，修正后队长 retry 加本地 runId；不得用于 UNKNOWN。 |
| NEEDS_INPUT | 保持 work 运行，在本人 SciencePAL 的原线程回答；发现唯一新 run 后自动接回。或先 Ctrl+C 停止 work，再用 reply 提交本人答复，随后重启 work，见下方。 |
| UNKNOWN | 保留日志；核对唯一原线程的身份与时间后 recover 项目ID 线程ID，再 work；不得重发。 |
| join 超时留下空文件 | 可能已创建节点；先由队长核对加入结果，不反复注册或盲删身份。 |
| doctor 认证失败 | 本人在自己账号更新 Key 文件，再检查；不把 Key 发给队长。 |
| 隧道换地址 | 尚未启动任务时设置 VIBE_GIT_HOST 为新根地址并复用凭据；已有运行时先停 work、核对日志与原任务。日志按 origin 锁定，不能另建日志绕过防重发。 |
| 锁文件遗留 | 先确认锁内 PID 对应连接器已退出，再只处理该日志的 .lock 文件。 |

pause/resume 仅队长可操作，暂停不取消已提交的远端运行。跨账号、真实返工、R2 各自记为已验证或待验证，不互相替代。

## 10. 等待输入后的续接

没有答复时连接器保持 NEEDS_INPUT，不替成员猜测答案。两种回复渠道一次只选一种：

- 网页：在自己的 SciencePAL **原线程**回复，保持 work 运行；连接器验证原线程、专家和唯一新 run 后自动续查、采集，再进入评审及下游任务。
- 本机：先 Ctrl+C 停止该项目的 work（避免日志锁冲突）。把明确答复写入项目外 ANSWER.md，再运行：

```powershell
npm --silent run sciencepal:member -- reply 实际项目ID 'C:\你的个人目录\ANSWER.md'
npm --silent run sciencepal:member -- work 实际项目ID
```

使用原来的环境和 VIBE_GIT_CONNECTOR_STATE，不换日志。reply 保存稳定的 messageId 和答复内容，再把消息追加到原线程并启动新 run。message 保存成功而 start 失败时不会再次发答复；start 超时/崩溃时只查询原线程，不盲目重发启动。若消息回执丢失，使用同一 messageId 和相同内容按官方去重协议重试。

遇到暂时断网、429 或 5xx，work 按保存的阶段重试并退避至最多 30 秒间隔；认证错误或身份冲突停止，等待本人处理。未知启动一直没有可见新 run 时保持等待，不声称成功，也不把“没查到”当成可以重新启动的证明。发现多个新 run、其他专家或过早的运行时停止核对，不猜选。

原线程续接最多 6 次，计入每项目 32 次运行上限；所有转移保留 old/new run ID、来源、时间，本机答复另保留 messageId 和 SHA-256。面板显示续接次数，evidence 导出完整记录。已冻结产物不覆盖，旧 run 的迟到成果会被拒绝。
