# 最终视频讲稿

材料版本 final-20261031-v1；功能基线 dda48233f57ee20e9c8be2d6b21c782b46ece7ba。英文合成配音，烧录中文字幕。情境示意、模拟界面和已完成真实案例分别标注；不是连续实时录屏，也没有在冻结代码上重新调用模型。

## 00:00:00 一个团队，三个独立对话

性质：情境示意 · 不是多人真实联调

A captain and two researchers want to study the exposed surface of a protein. One member calculates in Science Pal, another works in Codex. Each has a useful agent, but their conversations are separate.

一位队长、两位研究者研究蛋白表面。各自有 Agent，但对话分散。

A file arrives in the group chat. Which input and method produced it? Is it the approved version? Before writing the report, someone must ask all over again.

群里收到一个文件：用了什么输入和方法？哪版获批？写报告前还得重新确认。

## 00:00:21 我们管理的是交接依据

性质：产品机制 · 沿用原 Vibe-Git 操作顺序

Vibe Git Research keeps a shared research protocol around those separate agents. Members propose their work, the team aligns the requirements, and the captain publishes the agreed tasks.

成员提案、共同对齐、队长发布，让各自的 Agent 遵守同一份协议。

The next task receives an approved artifact together with its version and review evidence. A completed agent response alone is not enough to release a file downstream.

下游拿到成果，也拿到版本和批准依据。Agent 说完成，不等于可以交接。

## 00:00:40 沿用原界面，保留原贡献

性质：历史界面素材 · 展示操作位置，不冒充本轮实跑

The original project supplies the topology, captain permissions, proposals and change governance. Our teammate supplies the common agent interface, registry and execution adapters. We preserve those contributions.

原版提供拓扑、权限、提案与变更治理；队友提供通用接口、注册表和执行器。

Our extension connects Science Pal and adds research input checks, independent review, evidence recovery and approved result reuse. The product remains a general workflow, not a dedicated protein calculator.

新增 SciencePAL 接入、科研检查、补证与成果复用。1CRN 是案例，不是产品范围。

## 00:01:04 从界面进入：建项与发布

性质：确定性模拟界面 · 不调用真实模型

In the existing project controls, members bind their agents and save proposals. The captain uploads the input, checks its source, and confirms the method and acceptance rules before publishing.

在原入口绑定 Agent、保存提案；队长上传输入，核对来源、方法和验收规则。

The screen shown here is a labeled interface example. The next sections use exported records from a completed real run, rather than pretending that these pictures are one continuous live recording.

这里是界面示例；接下来使用真实运行导出记录，不把不同素材拼成连续实录。

## 00:01:24 真实问题：固定结构的表面积

性质：已完成的真实 1CRN 案例 · 单操作者、单机

For the real case, we use the public one C R N structure. The question is its solvent accessible surface area under a fixed geometric protocol: chain A, three hundred twenty seven heavy atoms, and forty six residues.

真实案例计算固定 1CRN 结构的溶剂可及面积：A 链、327 重原子、46 残基。

Science Pal's Biology environment executes the calculation with Biopython, one thousand sampling points and a one point four angstrom probe. This is actual tool execution, not just writing a scientific explanation.

SciencePAL Biology 实际执行 Biopython，1000 点、1.4 Å 探针；不只是撰写说明。

## 00:01:48 结果可比较，结论有边界

性质：真实成果 + 预先独立 NumPy 参考

The reported total is two thousand nine hundred sixty seven point six two square angstroms. It differs from the independent five thousand point NumPy reference by about zero point one nine percent, within the agreed two percent tolerance.

总面积 2967.6165 Å²；与独立 5000 点参考相差约 0.1865%，低于约定 2%。

Codex checks the input, method, reference and sum. This is a geometric reproduction for one structure. It is not a new biological discovery, and these checks do not guarantee every scientific conclusion.

Codex 核查输入、方法、参考和求和。这是固定结构的几何复现，不是生物学新发现。

## 00:02:12 数值通过，仍可能缺证据

性质：真实 R1 · 首次评审退回

The first calculation passes its numerical checks, but its delivery lacks version evidence and the original code. Codex rejects the handoff. Missing version evidence was planned; the missing code was not.

首个结果通过数值检查，但缺版本证据和原代码，被 Codex 退回；缺代码并非预设。

The operator retrieves the original script and tool log from the Science Pal conversation. This human intervention is part of the evidence record. We do not describe the workflow as fully unattended.

操作者从原 SciencePAL 对话取回脚本与日志，人工介入如实记录，不称无人值守。

## 00:02:35 补证复审，不重新执行上游

性质：真实 R1 · 相同执行 ID、成果 ID 与哈希

The captain submits supplementary evidence using the existing review action. Codex reviews again and approves. The calculation artifact, its identifier and its hash remain unchanged. Science Pal does not rerun that upstream task.

通过补证入口提交原记录，Codex 复审通过；原成果和哈希不变，上游未重跑。

There are still two upstream reviews, and review itself can include independent calculations. We claim avoided upstream reruns, not zero review cost or proven overall savings.

上游仍有两次评审，复核也可能计算。证明的是避免上游重跑，不是总费用已降低。

## 00:02:58 只改报告，保留获批计算

性质：真实 R2 · 变更评审后复用

Next, the captain requests a Chinese summary and two limitations in the report. Change review identifies only the report as affected. After alignment and publication, the approved surface calculation is carried into revision two.

随后只新增中文摘要和两条限制。影响评审确认只改报告，再对齐、发布。

Codex updates the report, and Science Pal reviews it. The upstream result and its approval are reused. A separate malformed review was retried without rerunning the report, and that failure remains in the record.

Codex 更新报告，SciencePAL 评审；上游成果与批准沿用。格式失败的评审重试也保留记录。

## 00:03:23 错误后的下一步，要看得懂

性质：当前界面走查 · 模拟执行器，非真实 1CRN 截图

The same controls explain what is preserved and what action comes next. A method mismatch blocks release. Supplementary review preserves the result when eligible. A failed file read can be retried without starting a model.

方法不符会阻断交接；符合条件可保留成果补证复审；读取失败可重读，不启动模型。

These interface checks use a deterministic simulator. They support recovery behavior, not scientific results. The original dark topology, navigation, permissions and order of operations stay in place.

这些界面检查使用模拟执行器，只验证恢复行为。原版拓扑、导航、权限与操作顺序保留。

## 00:03:48 证据完整，也公开失败和范围

性质：修复后的成功项目 · 11 次 Agent 作业

The successful project contains eleven agent jobs, thirty one original attachments and thirty four input receipts. The offline verifier checks file bytes and workflow identities. It does not independently repeat remote scientific computation.

成功项目有 11 次作业、31 份附件、34 条回执；离线核验验证字节与身份，不重跑远端计算。

An earlier misconfigured attempt remains separate. One operator used one computer and one Science Pal account. Cross computer collaboration and human time savings have not been established by this case.

此前误配置尝试单独保留。本例是单人单机、一个 SciencePAL 账号，未验证真人跨电脑或节时效果。

## 00:04:13 先看证据，再决定是否复用

性质：功能冻结 dda4823 · 材料版本 final-20261031-v1

The video page links to the five page brief, the evidence package and a public Science Pal verification replay. That replay is historical and read only; rerunning the full workflow requires your own accounts and local connectors.

播放页提供说明、证据包和 SciencePAL 历史只读核查；完整重跑需本人账号与本地连接器。

Our contribution is a reliable handoff contract across agents: agree on the method, check the result, preserve the approval, and recover without unnecessary upstream reruns. Configuration effort and real user benefits still need measurement.

我们的增量是跨 Agent 的可核查交接：约定方法、检查成果、保留批准、按影响恢复。配置成本仍待测量。