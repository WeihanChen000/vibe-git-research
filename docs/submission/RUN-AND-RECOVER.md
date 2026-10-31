# 冻结版本：启动与恢复

功能基线 `dda48233f57ee20e9c8be2d6b21c782b46ece7ba`；材料 final-20261031-v1。先按目的选择，不要为了看演示配置账号。

## 只看作品

打开 [视频](https://weihanchen000.github.io/vibe-git-research/submission/watch.html)、[PDF](https://weihanchen000.github.io/vibe-git-research/submission/project-brief.pdf) 和 [SciencePAL 历史只读核查](https://sciencepal.ai/share/3b6302a7-f055-460e-9e3d-588287a7b3ca)。[原拓扑回放](https://weihanchen000.github.io/vibe-git-research/replay/?case=isolated&step=members) 是历史只读案例，不调用模型，也不能上传新任务。

## 核对本次真实证据（不需要模型账号）

安装 Node.js 24+ 和 Git。下载固定版本后：
```powershell
git clone https://github.com/WeihanChen000/vibe-git-research.git
cd vibe-git-research
git checkout dda48233f57ee20e9c8be2d6b21c782b46ece7ba
cd vibe-git
npm run test:latest-live
```
该脚本只用 Node 内置模块检查已保存文件，不执行附件代码，不读取密钥。预期 31 附件、34 回执、两轮、上游计算 1、上游评审 2、报告执行 2。它不是远端重跑。

## 模拟体验

在上述 vibe-git 目录：
```powershell
npm ci
npm run build
npm run research:experiment -- calibration
```
按终端给出的队长与成员地址进入。此处为确定性模拟执行器，不连接真实账号。保留终端；关闭后按脚本提示重新开一个模拟场景，不把临时模拟当成持久项目。完整使用记录见 [历史界面走查](../research/USER-RECOVERY-WALKTHROUGH-20261031.md)。

## 用本人账号重新运行

已有 Node.js 24+、依赖和构建后，按 [三步开始](../../vibe-git/SCIENCEPAL-QUICKSTART.md) 与 [团队指南](../../vibe-git/SCIENCEPAL-TEAM-START.md) 操作：队长运行 open-captain.cmd，成员运行 open-research.cmd，使用队长邀请绑定本人 Agent、保存提案，再由队长建项、对齐、发布。不要把演练密钥用于真实账号。

需要 Codex 可用登录、SciencePAL API 权限及可用 Biology Agent；Key 只存本人项目外认证文件，不发给队长。连接器和 Host 需保持运行。跨电脑需要受信任的 HTTPS Host 和实际网络可达，本轮未完成真人跨电脑验证。真实执行使用各自账号资源，无法从作业次数推断价格。

## 出错后只处理对应环节

| 当前状态 | 下一步 | 成果与调用影响 |
|---|---|---|
| 上传替换失败 | 重选，或明确选择继续原文件 | 不调用模型；原文件来源保留 |
| 对齐遗漏原要求 | 查看缺项后重新对齐 | 不能发布；新增对齐调用 |
| 结果或方法错误 | 队长按原标准安排返工 | 重新执行该任务并独立评审 |
| 原成果正确、缺代码/日志 | 符合条件时补充证据复审 | 保留原成果；新增评审，非免费 |
| 评审执行/格式失败 | 只重试评审 | 保留计算成果，原失败记录保留 |
| 读取成果/复核记录失败 | 检查连接后重新读取 | GET 与校验，不启动模型；校验失败不可强行放行 |
| 等待输入 | 对应成员打开原 SciencePAL 线程回答，保持连接器 | 续接原线程，计入运行预算 |
| 连接器断开 | 在原成员面板检查状态并恢复连接器 | 先核对已有作业，勿另建目录重复启动 |
| 只改报告 | 正式提出变更，经影响评审、队长应用、重新对齐发布 | 仅未受影响且批准有效的上游可复用 |

未保存草稿只在当前页面保留；刷新或关闭浏览器可能丢失。不要为了让拓扑变绿覆盖状态或放宽检查。若冻结版无法启动，保留错误信息与版本，先定位阻塞再更新，不在交付阶段扩展功能。
