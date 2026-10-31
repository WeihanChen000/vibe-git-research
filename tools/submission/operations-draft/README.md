# 未完成的 1CRN 操作视频草稿

**不是成片，不是完整验收结果。** 上次录制因窗口最小化及用户停止电脑控制中断。只确认拍到：
1. SciencePAL 模拟 Agent 选择。
2. 成员提案输入（保存前）。

图片见 `../assets/01-agent-select.png` 和 `02-proposal-before.png`。邀请链接、模拟会话令牌、临时端口、浏览器自动化脚本和本机运行目录没有上传，队友须新建自己的模拟现场。

## 已准备的隔离模拟器

`server.mjs` 复用冻结版 Host、原 UI、连接器和状态机，使用临时数据库；`fixture.mjs` 提供确定性 Agent 输出。上游数值复制自已有公开 1CRN 文件并带 synthetic 标记，**不进行新的 SciencePAL 科学计算**。

在仓库 `vibe-git` 目录完成 npm ci / npm run build 后：
```powershell
node ../tools/submission/operations-draft/server.mjs
```
本机 `output/video-operations-v2/session/START-HERE.md` 与 session.json 会生成队长/成员入口和邀请，只给本机演示使用。模拟 Key 只能用 `SIMULATED-ONLY`，不要输入真实密钥。关闭终端结束模拟。

计划路径（尚未完整走通）：绑定 Agent → 保存提案 → 上传 1CRN → 对齐发布 → 上游交回 → 缺代码日志退回 → 补证复审 → 报告交接 → 仅改报告 → 沿用上游获批成果。两个脚本仅检查语法，fixture 另做了导入和输入文件读取检查；服务器及后续流程未在此次交接重跑；若模拟器在后续步骤失败，不应修改产品门禁来配合演示。

已完整验证的通用模拟优先用 `npm run research:experiment -- calibration` 或 `-- kinetics`。真实补证与复用证据在 `docs/research/latest-governance-live/`；这份草稿没有新增真实证据。

## 不要照旧版小图排版

先短暂显示全界面定位，再放大实际按钮与状态；说明“谁操作、点哪里、结果是什么”。动作截图只能说明所拍动作；不能给未录制步骤配上“实操已完成”的旁白。字幕、焦点框是视频注释，不要修改原 UI 的颜色、布局或按钮来方便拍摄。
