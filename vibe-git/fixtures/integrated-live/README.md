# 2026-10-31 真实整合证据

一个 SciencePAL 账号的官方 Biology Agent 与本机 Codex，两个工作流成员身份。原始任务、评审文件与返工副本保持字节不变；不代表两位真人或两个 SciencePAL 账号。1CRN 是通用平台的一次计算验证材料。

在 vibe-git 目录运行 `npm run test:integrated-live`。无需账号，不启动模型、不执行附件里的代码。12 个原始附件（含公共 PDB 和两个返工副本），20 条公开输入回执，9 个任务/评审运行。

| 阶段 | 平台 | 收集状态 / 科学结果 | 原始文件 |
|---|---|---|---|
| Biology 探索计算 | sciencepal | COLLECTED / pilot-100-exploratory | [07fde0dd-4a0e-48af-bea1-3607e70b8b02.json](07fde0dd-4a0e-48af-bea1-3607e70b8b02.json) |
| Codex 评审格式失败 | codex | INVALID / request_changes | [cfd55ce0-4378-47e4-be4b-bb33fb299731.json](cfd55ce0-4378-47e4-be4b-bb33fb299731.json) |
| Codex 探索阶段退回 | codex | COLLECTED / request_changes | [f0a15d6a-78b5-4c96-843c-4106276ffbd7.json](f0a15d6a-78b5-4c96-843c-4106276ffbd7.json) |
| Biology 收敛返工 | sciencepal | COLLECTED / final-1000-primary-with-5000-convergence | [d66660eb-1ad0-4bb2-8730-ecb834277164.json](d66660eb-1ad0-4bb2-8730-ecb834277164.json) |
| Codex 收敛再评审 | codex | COLLECTED / approve | [a9c9ccd2-1fa3-4199-92bb-74f1fa10a5ab.json](a9c9ccd2-1fa3-4199-92bb-74f1fa10a5ab.json) |
| Codex 首次综合分析（阻塞） | codex | COLLECTED / blocked_missing_upstream_scientific_approval_evidence | [c7d5915f-0fe4-42a6-80e0-a8f4577aa5ff.json](c7d5915f-0fe4-42a6-80e0-a8f4577aa5ff.json) |
| Biology 综合分析退回 | sciencepal | COLLECTED / request_changes | [a309e34b-c99e-41da-902c-64e858f1ccf2.json](a309e34b-c99e-41da-902c-64e858f1ccf2.json) |
| Codex 综合分析返工 | codex | COLLECTED / completed_pending_independent_Biology_review | [ca091406-6cdc-49f1-b15c-67a3279a0f80.json](ca091406-6cdc-49f1-b15c-67a3279a0f80.json) |
| Biology 终审 | sciencepal | COLLECTED / approve | [9b2c4f06-f083-4d2d-a395-5ab3e89826dc.json](9b2c4f06-f083-4d2d-a395-5ab3e89826dc.json) |

原始源文件：[source-1crn.pdb](source-1crn.pdb)，RCSB PDB / 1CRN；原上游输入的固定字节。来源与参数见 [完整联调说明](../../../docs/research/INTEGRATED-LIVE-20261031.md)。

[manifest.json](manifest.json) 是从本机真实 Host 数据导出的索引，包含每个运行的字节清单、时间、平台、任务状态和批准依据摘录。完整私有 context、对齐文本、账号凭据和数据库不公开；9 个 context 回执只核对清单一致性，不声称能够从公开材料独立验证其原文。批准依据摘录由操作者从原始 context 导出，其指向的原始评审字节可以独立核对。

离线核验能发现附件篡改、未完成阶段、错版交接和不符的批准绑定，但它不是远端平台签发的执行证明，不能单独证明历史工具调用或科学结论必真。探索退回是预先声明的检查点；缺少批准依据导致的综合分析阻塞是实跑发现的工程问题，两者不混淆。
