# 1CRN 操作录像模拟器

2026-11-01 已通过实际工作台完成建项、对齐、发布、退回、补证复审、报告、报告变更与 R2 复用。没有调用真实模型。成片与可复核记录见 [操作演示](../../../docs/submission/operations-demo/README.md)。

本轮修复模拟器两处问题：默认 SciencePAL Agent 的 `platform` 可省略；模拟评审需要逐项引用成果文件名，并将每项修改要求绑定到失败的原验收项。修复通过同一套未改动的 Host 检查，未放宽产品门禁。

## 自己复现

在仓库 `vibe-git` 下完成 `npm ci`、`npm run build`，然后：

```powershell
node ../tools/submission/operations-draft/server.mjs 1crn
```

打开本机 `output/video-operations-v2/session/START-HERE.md`，从私有 session.json 获取队长和成员入口；在两个浏览器标签中操作。该目录含本机邀请和会话凭据，禁止上传。模拟 Key 仅用 `SIMULATED-ONLY`。

1. 队长绑定 Codex；成员用邀请加入，绑定模拟 SciencePAL。分别保存生成的两份提案。
2. 队长建项，上传生成的 `1crn.pdb`，填写 RCSB 来源。两人均须选中。
3. 启动对齐。Codex 每次选择“准备本人任务包”，等待模拟结果后“检查并交回成果”；不要启动真实模型。
4. 发布前可冻结 `method = Shrake-Rupley`，参考 `total_A2 = 2973.1627706139175`，绝对容差 `59.46325541227835`（参考值的 2%），说明来源。
5. 发布后，成员启动本人连接器。计算完成后队长交回模拟评审，会因缺原代码和日志退回。
6. 选择“补充证据复审”，注明模拟范围，粘贴已公开历史案例的原代码与执行记录。再次准备并交回评审；随后准备并交回报告。成员连接器会评审报告。
7. 提出“只补报告中文摘要与局限；上游输入、方法、参数、数值规则与验收不变”。完成变更评审，确认、重新对齐、发布，执行 R2 报告。
8. 检查“沿用 R1 获批成果”。`verification-state.json` 包含完整本机状态及模拟调用计数；不要直接公开未经检查的会话目录。按 Ctrl+C 停止这个模拟器。

本次完整录制为 10 项模拟作业：2 次对齐、1 次计算、2 次计算评审、2 次报告执行、2 次报告评审、1 次变更评审。模拟审查是确定性测试替身，不会判断任意用户材料的科学真实性；不可把模拟通过当成真实 Agent 能力证明。

## 检查

从仓库根目录执行：

```powershell
node --test tools/submission/operations-draft/fixture.test.mjs
python tools/submission/operations-video/verify.py
```

前者对模拟器使用实际 Host 评审契约做 6 项回归测试；后者对公开的已录制模拟证据做 16 项离线核验。它们不重新调用 SciencePAL。历史真实案例保持原样，见 `docs/research/latest-governance-live/`。

`capture.mjs` 通过已授权的 ego 页面 CDP screencast 捕获实际浏览器帧。它不更改页面 DOM、协议、权限或产品状态。截图按原始帧保存在制作源包中，剪辑只放大、停留、调节时间并添加来源角标和字幕。
