# 固定 1CRN 输入的交接对照

Executed isolated original doneTask with repository/event stubs; executed production research envelope/schema/review functions, not an end-to-end original UI trial. Manual checklist was carried out by Codex, not a human participant. No remote model execution.

| 样本 | 原版任务完成门槛 | 完整人工检查表（Codex代做） | 科研版自动门禁＋给定评审 |
|---|---|---|---|
| 正确产物 | 完成 | 接受 | 接受 |
| 旧协议版本 | 完成 | 拒绝 | 拒绝 |
| 错误输入回执 | 完成 | 拒绝 | 拒绝 |
| 未交付代码 | 完成 | 拒绝 | 拒绝 |
| 探针参数偏离 | 完成 | 拒绝 | 拒绝 |
| 没有独立评审 | 完成 | 拒绝 | 拒绝 |
| 评审明确退回 | 完成 | 拒绝 | 拒绝 |
| 数值偏移且文字评审错误同意 | 完成 | 拒绝 | 接受 |

正确样本三组均接受。六类协议/交付问题被科研版拦截；数值错误但评审错误同意的挑战仍被接受。认真执行科学复算的人工组拒绝全部七类错误，不能宣称系统比认真人工更准确。原版组的“完成”只代表既有任务生命周期校验，不等于原作者或人类会认可错误科研成果。原版已有的接口集成契约能力不在本次普通任务探针范围内。

省去的是逐任务手动版本、输入回执、必填代码与参数格式的检查负担；没有测得真人时间、点击或错误率，不报告百分比效率提升。漏掉版本核对的独立受控扰动使人工组接受旧版，平台仍拒绝，证明该检查可成为强制门禁。

盲点说明：当前通用平台不能把 Agent 的文字批准当成独立数值验证。本轮原拓扑新增的专业证据区把原始工具产物与独立复算分开；只有哈希绑定且该阶段已收集的复算记录才显示已有证据。它不会偷偷替代后端科学验收。

复现：先运行 fixtures/expert-case/reference.py 生成 data/crn-comparison/independent-reference.json，再 npm run build，执行 node apps/host/scripts/compare-crn-handoffs.mjs。需持有本仓库原版 Git 基线；源码 ZIP 无 .git，不声称可执行原版探针。完整原始结果：data/crn-comparison/results.json。
