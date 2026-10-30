# 真实 SciencePAL 退回与返工验证

日期：2026-10-29（Asia/Shanghai）。项目：`9b8e7d34-d65e-4361-b27e-3e339381c590`，标题“真实退回返工验证 · 错误总和修复”。

## 测试性质

这是用户要求的负向集成测试。首份数据由真实 Agent A 按故意缺陷基线生成：`values=[1,2,3,4,5]`，但 `reported_total=14`。固定验收始终要求真实总和 15。测试没有预写评审结论，没有编辑远端产物，也没有篡改本机状态绕过门禁。

实际作者为 `d3b9e520-3ae0-46d0-a2a9-d3df80f5c23d`，独立评审者为 `ba5dc9e9-a01c-4563-848f-5c2a082de793`。下游任务由 B 执行、A 评审。

## 已观察到的路径

1. 真实 ALIGN 保留了故意缺陷方案、两项任务及硬依赖；人工审阅对齐稿后通过原平台发布。
2. A 的首份 `produce_sum.json` 实际包含总和 14。
3. B 独立计算得到 15，返回 `request_changes`，明确指出总和验收不通过，并要求修复后保留原数据和 nonce。
4. 在未触发返工期间保存两份间隔至少 15 秒的快照，项目持续处于 CHANGES_REQUESTED，下游执行次数为 0，没有下游 TASK Run。
5. 通过网页“按评审意见返工”按钮触发原平台流程。A 收到真实评审意见与 `previous-produce_sum.json`，后者字节和 SHA-256 与原错误文件相同。
6. A 输出新文件，将总和修复为 15；values 和 nonce 完全保留。没有覆盖旧文件。
7. B 在独立沙箱重新评审，四条原始验收标准全部通过，返回 approve；下游此后才获派发。
8. 下游 B 实际计算得到 verified_total=15、mean=3、upstream_total=15，并保留上游 nonce。A 最终评审五项验收全部通过，项目状态为 COMPLETED，两项任务均为 APPROVED。

最终核验：7 次真实运行全部 COLLECTED，15 份冻结文件；通用证据检查 66/66 通过，返工专用检查 29/29 通过。结果分别保存为证据目录中的 `verification.json` 与 `rework-verification.json`。

| 步骤 | 真实 Run ID |
|---|---|
| 对齐 | `5dd6e8e3-5a21-4736-9e51-2b86e13c6ee3` |
| 首次执行 | `68ed1e3f-ffdb-40ba-b9b4-378ac988f477` |
| 首次评审：退回 | `350d327e-76bd-4c0e-9923-844d1bf4463d` |
| 返工执行 | `14bc5ab4-10dc-46bb-abbb-0c8a3fa869f7` |
| 重新评审：通过 | `743264fa-aa43-4dc0-8d2d-ed08eb2a2c09` |
| 下游执行 | `e46f62fa-440c-4415-a49d-6389bb2d6ef1` |
| 最终评审：通过 | `2b0f1da0-81ef-4285-859e-6991f9cdb703` |

| 证据 | 首次执行 | 返工执行 |
|---|---|---|
| 文件 ID | `344f3e2b-f93f-4d09-bdf3-b936cee3ab60` | `91aab85e-eb67-4638-96db-247473d125f5` |
| reported_total | 14 | 15 |
| values | [1,2,3,4,5] | [1,2,3,4,5] |
| nonce | `4d75fbaf87237a3da0d8b880847e024a` | `4d75fbaf87237a3da0d8b880847e024a` |
| 评审 | request_changes | approve |

## 复核入口

本机证据目录：`data/sciencepal/evidence/9b8e7d34-d65e-4361-b27e-3e339381c590/`。退回快照为 `rejected-before.json` 和 `rejected-after-wait.json`，包含实际运行列表与观察时间。

本次已执行以下检查，可重复运行复核：

```powershell
node apps/host/scripts/verify-sciencepal-live.mjs 9b8e7d34-d65e-4361-b27e-3e339381c590
node apps/host/scripts/verify-sciencepal-rework.mjs 9b8e7d34-d65e-4361-b27e-3e339381c590
```

第一份脚本按原始字节复核所有成功运行的文件回执、身份、版本和依赖；第二份脚本检查真实失败项、稳定阻断期、旧成果作为返工附件、固定验收、真实修复与重审、下游使用修复后的文件。测试夹具保存在 `data/sciencepal/evidence/rework-fixture.json`。

本次恢复连接时生成了获准的 1 天测试 Key，保存在项目外固定目录；未写入仓库或证据。原 Key 未撤销。以上数据均为合成数据，不代表科学发现。
