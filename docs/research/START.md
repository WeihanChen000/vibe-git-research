# 队友三条最短路径

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

**演练 worker 固定生成 data / analysis 两类合成任务，请使用自定义提案，不要套用 1CRN / Iris 的专用成果 schema。** 自动合成 Codex worker 只属于此演练；真实 Codex 要处理任务包。

## 3. 用自己的账号研究

跟随 [完整接入指南](../../vibe-git/SCIENCEPAL-TEAM-START.md)。队长先启动 Host、本人面板，跨电脑准备可信 HTTPS 地址；队友只启动本人面板并加入邀请。

每个人在本人电脑选择自己的平台、可用专家与提案。Key 不发给队长。默认新建自己的研究；示例藏在“使用公开案例（可选）”，不会限定课题。

本仓库公开可读，无需登录即可查看与克隆。需要直接提交代码的队友，由队长在 GitHub Settings → Collaborators 授予协作权限；阅读与演示不需要权限邀请。不要发送个人访问令牌。

```powershell
git clone https://github.com/WeihanChen000/vibe-git-research.git
cd vibe-git-research/vibe-git
```

真实执行会使用本人 SciencePAL 额度。当前真人双账号联合验收还未完成；请填写 [验收表](../../vibe-git/SCIENCEPAL-TEAM-ACCEPTANCE.md)，未触发的流程如实写“未触发”。
