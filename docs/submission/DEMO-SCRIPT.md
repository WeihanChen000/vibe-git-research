# 新版故事演示：一位队长、多位成员

英文合成配音（Aria），中文字幕；实际界面操作演练与既有真实科研证据分开标注。不是连续实时录屏；情境中的版本困惑是示意，真实批准依据缺失有单独证据。

## 00:00 先从一个研究任务开始

A research team wants to answer a simple question: which parts of this protein are exposed to water?

一个研究团队想知道：这个蛋白哪些部位暴露在水中？

They use the public one C R N structure as their starting point.

他们从公开的 1CRN 蛋白结构开始。

性质：情境示意 · 一位队长、两位成员

## 00:10 一位队长，多位成员，各用自己的 Agent

There is one captain and two team members. Member A uses Science Pal to calculate the surface area.

队长带两位成员合作。成员 A 用 SciencePAL 计算表面暴露面积。

Member B uses Codex to interpret the results. The captain coordinates the study and reviews their work.

成员 B 用 Codex 分析结果；队长协调研究并审核成果。

性质：情境示意 · 一位队长、两位成员

## 00:24 各自都在推进，团队却没有共同状态

Everyone makes progress in their own agent conversation. But their work is scattered across different platforms.

大家都在各自的 Agent 对话中推进，但工作分散在不同平台。

A calculation finishes. A file is revised. A new requirement appears. Who knows which version everyone else is using?

计算完成、文件修改、要求更新后，谁知道大家用的是不是同一版？

性质：情境示意 · 一位队长、两位成员

## 00:41 “这份文件，我现在能用吗？”

Member B receives a result, but cannot tell whether it is the latest version or whether it has passed review.

成员 B 收到了结果，却不知道是不是最新版、有没有通过评审。

The captain has to chase messages and reconnect the evidence. A finished agent task is not yet a finished team workflow.

队长只能来回问、重新找依据。单个 Agent 做完了，团队流程却没接上。

性质：情境示意 · 一位队长、两位成员

## 00:55 我们补上的是团队协作这一层

Vibe Git Research keeps the original team topology and proposal workflow. We add cross-platform research tasks, frozen inputs, numerical checks, and reviewed file handoffs.

保留原版拓扑与提案流程，新增跨平台科研任务、冻结输入、数值检查与获批文件交接。

Science Pal executes the research task. Codex checks and analyzes the results. Everyone shares one protocol and can see who acts next.

SciencePAL 执行科研任务，Codex 复核与分析。所有人共享协议，看清下一步轮到谁。

性质：情境示意 · 一位队长、两位成员

## 01:17 第一步：每位成员先提交自己的提案

Here is the actual interface, in a clearly labeled three member rehearsal. Each member submits their research plan.

现在看实际界面：这是明确标注的三成员操作演练。每人先提交提案。

The plan describes the question, the method, their responsibility, and what would count as an acceptable result.

写清研究问题、方法、本人分工，以及怎样才算完成。

性质：实际界面操作演练 · Agent 输出为合成结果

## 01:31 第二步：队长建项，上传共同材料

The captain selects the participants and uploads the protein structure. Everyone will work from the same frozen input.

队长选择参与成员，上传蛋白结构；所有人使用同一份冻结输入。

This removes the first source of confusion: different people silently using different files.

首先消除一种混乱：每个人悄悄用了不同的数据文件。

性质：实际界面操作演练 · 公开 1CRN 输入

## 01:45 第三步：先对齐，再由队长发布

The proposals become a shared protocol: who calculates, who analyzes, and what must be checked before handoff.

各自提案被对齐为共同协议：谁计算、谁分析、交接前检查什么。

The captain checks the plan and publishes it. The agents do not silently change the team's agreement.

队长检查后发布。各个 Agent 不能悄悄改掉团队约定。

性质：实际界面操作演练 · 队长确认与发布

## 01:59 现在轮到谁，一眼可见

The topology now shows the captain and both members, with their tasks and dependencies.

拓扑中能看到队长、两位成员，以及任务和依赖关系。

Member A calculates first. Member B waits for an approved result, instead of guessing when it is safe to continue.

成员 A 先计算；成员 B 等获批结果，不必猜什么时候可以继续。

性质：实际界面操作演练 · 不代表三个真实账号联调

## 02:12 SciencePAL 执行科研，Codex 独立复核

Our real run used Science Pal’s official Biology Agent and cloud research workspace to execute Python and Biopython, returning code, parameters, and residue measurements.

真实运行调用 SciencePAL 官方 Biology Agent 和云端科研环境，交付代码、参数与逐残基数值。

Codex checked the measurements independently. Our platform adds the shared protocol and verified handoff. The value is a connected research workflow, not an exclusive algorithm.

Codex 独立复核，平台统一协议与核验交接。价值在于把科研执行接入团队流程，不是独占算法。

性质：真实记录 · 画面为另外公开的独立核查回放

## 02:34 结果提交了，但还不能直接给下游

Submitting a result triggers an independent review. In this example, the first calculation is only an exploratory pass.

提交成果后，还要独立评审。本例的第一轮只做探索计算。

The agreed final check needs a higher resolution comparison, so the result is returned for revision.

最终验收要求更精细的计算比较，因此需要退回返工。

性质：操作演练；真实案例也有预先约定的探索阶段退回

## 02:49 队长安排返工，原结果保留

The captain opens the review feedback and assigns the revision. Member A sees exactly what needs to change.

队长打开退回意见并安排返工，成员 A 清楚知道要补什么。

The earlier result stays in the history. Member B remains blocked until the revised result is approved.

旧版结果保留在记录中；新版通过前，成员 B 仍不会收到可用交接。

性质：实际界面操作演练 · 原有返工确认流程

## 03:03 独立复算，让“通过”有依据

In the real run, Science Pal repeated the calculation at one thousand and five thousand sampling points.

真实运行中，SciencePAL 补做了 1000 点和 5000 点计算。

The totals differed by about zero point one one percent, below the agreed two percent limit. Codex also checked them using a separate implementation.

两者总量相差约 0.11%，低于约定的 2%；Codex 还用另一实现复算核对。

性质：真实数值 · 固定构象的几何验证，不推断生物功能

## 03:19 真正发生过的问题：批准依据没交过来

We also found a real handoff bug. Codex received the result, but not the approval evidence needed to trust that exact file.

真实联调还暴露了一个交接问题：Codex 收到了结果，却没收到对应的批准依据。

It reported the blocker instead of pretending the analysis was complete. We fixed the handoff packet.

它如实报告阻塞，没有假装完成分析。我们据此修复了交接包。

性质：真实联调发现 · 不是虚构的成员犯错

## 03:34 交接文件，也交接这份文件的批准依据

Now the handoff includes the approved file, its fingerprint, and the original review record.

现在交接的不只有文件，还包括文件指纹和原始评审记录。

Click the connection to see what was produced, who approved it, and whether the downstream member received it.

点击交接连线，就能看见产物、批准关系，以及下游是否已经收到。

性质：实际界面操作演练 · 获批后放行下游

## 03:46 研究结果：哪些残基有较大的绝对暴露面积？

The study now answers the original question. In this fixed structure, tyrosine twenty nine, leucine eighteen, and proline thirty six have the largest absolute exposed areas.

回到研究问题：在这个固定结构中，TYR 29、LEU 18、PRO 36 的绝对暴露面积最大。

These are geometric measurements, not claims about biological function. The complete residue results and independent reference are linked below.

这是几何测量，不是生物功能判断。逐残基结果与独立参考都可以核查。

性质：已有真实 SciencePAL 结果 · 固定结构的几何描述

## 04:06 检查失败，评审写“通过”也不能交接

The host now executes frozen numerical checks. A failed check blocks handoff, even if an agent review says approved. The original topology shows exactly what failed.

Host 执行冻结的数值检查。检查失败时，Agent 写“通过”也不能交接；原拓扑指出具体原因。

The saved real result passes. Three controlled errors fail, including changed residue areas with an unchanged total. This verifies the configured checks, not every possible scientific error.

保存的真实结果通过；三类受控错误被拒绝，包括总量不变但残基面积被改动。检查有明确覆盖范围。

性质：新增门禁 · 受控错误演练 / 本次未调用远端 Agent

## 04:30 真实证据可以打开，范围也说清楚

The three person workflow you saw is a rehearsal. The published scientific evidence comes from one Science Pal account working with local Codex.

三人流程是操作演练；公开科学证据来自一个 SciencePAL 账号与本机 Codex 的真实协作。

This is a general research platform, not a tool limited to this protein. Open the evidence links below to inspect the real files and the Science Pal run.

平台不限于这个蛋白。打开下方链接，可以核查真实文件和 SciencePAL 运行记录。

性质：边界说明 · 不宣称已完成真人双账号验证