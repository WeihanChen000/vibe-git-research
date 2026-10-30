# 队友三条最短路径

**第一次真正接入，请先看 [三步快速开始](../../vibe-git/SCIENCEPAL-QUICKSTART.md)。** 只看作品直接[播放视频](https://weihanchen000.github.io/vibe-git-research/submission/watch.html)，无需安装。

## 1. 只看作品，不配置账号

先读 [完整展示](SHOWCASE.md) 和 [原版对照](COMPARISON.md)。要自己点击：下载仓库，安装 Node.js 24+，进入 `vibe-git`，双击 `open-replay.cmd`；或者运行：

```powershell
npm ci
npm run build
npm run research:replay
```

保留终端，用输出链接打开。默认 1CRN 完成阶段，点“从头播放”查看退回与接续；下拉切到 Iris。无需模型 Key，不是在线新跑实验。

## 2. 先体验协作，不用真实账号

在同一目录构建后：

```powershell
npm run research:simulate-ui
```

打开终端给出的启动页，从该页分别进入队长、队友面板。仅演练使用 `DEMO-KEY`，输出为合成数据；队长选 Codex，队友选 SciencePAL。

双方保存自定义简短提案，例如队长核对输入数据、队友根据获批数据复核结果。队长建立项目、对齐、发布。队友在自己的待办点击“启动本人连接器并领取”。退回后由队长安排返工，直到完成。

**演练 worker 固定生成 data / analysis 两类合成任务，请使用自定义提案，不要套用 1CRN / Iris 的专用成果 schema。** 自动合成 Codex worker 只属于此演练；真实项目可在本人待办启动已安装的 Agent，或复制说明处理任务包。

## 3. 用自己的账号研究

跟随 [完整接入指南](../../vibe-git/SCIENCEPAL-TEAM-START.md)。队长双击 `open-captain.cmd` 一次启动 Host 与本人面板，跨电脑另准备可信 HTTPS 地址；队友双击 `open-research.cmd`，按“邀请 → Agent → 提案”加入。已有房间用 `open-research.cmd --captain`，不会重复启动 Host。

每个人在本人电脑选择自己的平台、可用专家与提案。Key 不发给队长。默认新建自己的研究；示例藏在“使用公开案例（可选）”，不会限定课题。

本仓库公开可读，无需登录即可查看与克隆。需要直接提交代码的队友，由队长在 GitHub Settings → Collaborators 授予协作权限；阅读与演示不需要权限邀请。不要发送个人访问令牌。

```powershell
git clone https://github.com/WeihanChen000/vibe-git-research.git
cd vibe-git-research/vibe-git
```

真实执行会使用本人 SciencePAL 额度。当前真人双账号联合验收还未完成；请填写 [验收表](../../vibe-git/SCIENCEPAL-TEAM-ACCEPTANCE.md)，未触发的流程如实写“未触发”。

当前七种平台接入、原界面操作步骤及环境限制见 [多 Agent 整合说明](MULTI-AGENT-INTEGRATION.md)。


## 执行时只跟着“现在轮到谁”

| 当前提示 | 谁操作 | 在原界面做什么 |
|---|---|---|
| 等待本人执行 / 评审 | 对应成员 | Codex：准备本人任务包 → 启动本人 Codex → 完成后检查并交回成果；SciencePAL：启动本人连接器并领取 |
| 评审退回 | 队长 | 查看评审 → 查看返工待办 → 安排返工；修改要求自动带入，原成果保留 |
| 执行失败 | 队长 | 核对原任务及失败原因后点“重试失败任务”；保留原记录，再由对应成员处理新尝试 |
| 启动结果待核对 | 本人 | 核对原进程、原线程和任务目录，先找回回执，不另建目录重复运行 |
| 等待本人回答 | 对应 SciencePAL 成员 | 在本人待办打开 SciencePAL 原线程回答，保持连接器运行，随后自动接回；无需重新建项目 |

本地页面在线、Agent 执行结束、成果校验通过、科学评审通过是四种不同状态。已配置的数值检查、独立评审与交接依据都通过后，获批文件才交给下游；不要为了让图变绿手工覆盖任务状态。

最新真实整合的文件、退回与恢复证据见 [10 月 31 日联调记录](INTEGRATED-LIVE-20261031.md)。其中有界联调脚本由操作者显式调用，不等同于两位真人的自动协作或首次接入可用性测量。


要离线核对最新整合案例的原始文件及获批交接，在 `vibe-git` 目录运行 `npm run test:integrated-live`。只需要 Node.js，不需要 API Key，不执行产物内的 Python。它核对公开字节、评审与返工顺序、批准记录与交接绑定；不能代替远端账号的执行审计。

## 数值检查如何使用

1CRN 模板自动冻结独立参考和求和检查。自己的研究在发布前打开“协议 → 可执行科学检查”，选择任务、求和字段或独立参考值及容差，无需写 JSON。已配置的检查在成果提交、批准和交接时由 Host 执行；失败后原文件保留，按原待办修正重试。检查不能由 Agent 评审绕过，发布后也不能删除或放宽。没有配置检查的任务会明确显示缺少检查记录，不追认历史成果。
