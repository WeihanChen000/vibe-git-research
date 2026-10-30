# SciencePAL 原生专家科研协作实测

2026-10-30。按队友建议，将默认主线改为 SciencePAL 科研协作。Vibe-Git 负责多人的研究提案、协议对齐、证据交接和版本化评审；SciencePAL 原生专家负责实际科研工具执行。Codex 保留为可选入口。完整决策见 [科研主线](RESEARCH-FIRST-DECISION.md)。

## 专家入口与实际能力

纠正此前只查到自建 Agent 的判断：官方 SDK 0.2.3 的 `GET /api/agent-catalog?usable_only=true` 才包含内置及已授权共享 Agent；`/api/agents` 仅列自建 Agent。当前账号实际返回 Biology、General、Material、MIMIC、Survey 五个内置 Agent，以及两个旧自建 Agent。客户端已经改接可用目录，保留来源与领域元数据，不用改名的通用 Agent 冒充专家。

内置 Biology Agent 实际成功导入 BioPython 1.84 的 PDBParser、ShrakeRupley，并调用 PyMOL 3.2.0a。MAFFT、Open Babel、samtools 等版本探测成功；MDAnalysis、Scanpy 等仅确认包存在。FastQC 存在但启动报错，不能算可用。探测任务：`868fdd1b-781f-4d2e-8c50-809787d8f2eb`。

来源：[SciencePAL 官方 SDK](https://sciencepal.ai/help/sdk)、[BioPython SASA 接口](https://biopython.org/docs/1.84/api/Bio.PDB.SASA.html)。工具能力判断以真实产物为准。

## 真实案例：crambin 的几何与溶剂可及表面积

冻结公开结构 [RCSB PDB 1CRN](https://www.rcsb.org/structure/1CRN)、研究协议和科研 Skill，交给内置 Biology Agent。执行任务：`d51b3c94-57c2-4a75-9eee-3c93ff4c7b0f`。该案例是描述性复算，不宣称新发现、蛋白功能或药效。

固定 model 0、chain A、327 个标准重原子、46 个残基，探针半径 1.4 Å，显式原子半径。SciencePAL 实际运行 BioPython 的 200/960 点 SASA，并用 PyMOL 渲染结构；全过程未安装依赖。独立基线使用另写的 NumPy 5000 点采样实现。

| 项目 | 结果 |
| --- | --- |
| BioPython 960 点总 SASA | 2970.152447 Å² |
| 独立 5000 点总 SASA | 2973.162771 Å² |
| 两种实现的总面积差 | 约 0.10125%，满足事先固定的 3% 容差 |
| BioPython 200/960 点采样差 | 约 0.30188%；它是采样敏感性，不是独立验证 |
| 三对 SG 距离 | 约 2.004、2.035、2.051 Å |
| 六个 CYS 整残基面积 | 均满足事先固定的 max(3 Å², 5% 基线值) 容差 |
| 本地核验 | 43/43 通过，包含文件哈希、参数、单位、完整性及独立数值对照 |

原始数据 SHA-256：`42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811`。完整协议、基线代码、验收与打包工具见 [案例目录](fixtures/expert-case/README.md)。

PyMOL 日志含一条注释文本引起的非致命 `SyntaxError`；后续命令继续执行、返回码为 0，图像和来源标注实际生成。这不影响本次数值验收，但脚本仍有清理空间；保留原日志，不宣称全过程无错误。

## 执行、评审与返工记录

1. 首轮真实执行得到结果和图，但报告把同一实现的采样差当成独立验证，精度导出与图标签也需修正。
2. 原生 General Agent 的首次评审 `cd80fe35-b78f-4f6d-85e3-ae589ef6bdca` 返回 **INCONCLUSIVE**。除上述科学表述问题，交接遗漏了生产者已生成的工具日志和独立基线代码。这是我们的打包问题，不能把它改写为生产者未交付日志或伪称 REJECT。
3. 第二次执行遇到重复命令保护，真实状态为 **NEEDS_INPUT**。在原线程补充指令后继续，保留该暂停历史。
4. 第三次执行数值正确，但擅自改名了冻结结果字段，43 项核验有 1 项失败；图片标注仍有问题。没有放宽协议。
5. 第四次执行恢复字段并修正图标签与来源说明，通过 43 项核验。现将三个输入、五个产物、独立基线及生成器共 10 文件打成 ZIP，附逐文件 SHA-256 清单，避免八个附件的上限再次造成遗漏。
6. 独立最终复评任务 `5bba6085-cff2-4b99-b8fb-b058cfd3e04d` 已完成并采集，返回 **APPROVE**，11 项检查全部通过，无必需修改。它核对外层归档及 10 个内部文件哈希，在自己的环境实际执行 NumPy 基线，得到 2973.1627706139193 Å²，与本地基线仅浮点尾差；核验了六个 CYS 整残基面积，并查看实际 PNG。它没有 BioPython/PyMOL，未重跑生产者的这两项工具，这个限制与非致命日志错误均保留在评审中。

完整原始记录见 [证据清单](fixtures/expert-case/evidence/manifest.json)，最终 [评审意见](fixtures/expert-case/evidence/final_review/r1/review-notes.md) 与 [机器可读判定](fixtures/expert-case/evidence/final_review/r1/review.json) 分别存档。早期 INCONCLUSIVE、NEEDS_INPUT 和本地失败检查没有被最终通过覆盖。这里的 APPROVE 是冻结协议下的 Agent 技术评审，不代表正式同行评议或成员已经签字验收。

![Biology Agent 实际 PyMOL 输出](fixtures/expert-case/evidence/execution/r4/structure-r4.png)

## Skill 与工程改动

原项目 Skill 已改为研究问题、数据、方法、基线、证据、局限、复现及科研评审流程；旧 Codex 工作流保留为兼容参考。Skill 已通过格式验证。本次云端使用冻结的科研 Skill 附件；尚未永久导入账号 Skills。

科研提示已接入现有执行和评审契约。92 项 SciencePAL 自动化测试通过，完整构建与类型检查通过。新代码未增加 npm 依赖；UI 的旧大包警告仍存在。当前启动中的旧 Host 进程未重启，网页热更新状态不能据此保证。

## 能证明什么，下一步做什么

本次能证明 SciencePAL 原生 Biology 的预装领域工具可以直接执行并产出可核查结果，且 Vibe-Git 能记录真实失败、追踪返工和交接完整证据。与本次本地 Python、此前自建通用 Agent 缺少相关包的情况相比，优势是专业环境的准备成本与可复核交付。尚未比较安装工具后的 Codex 能力，不支持“模型更聪明”或“绝对不可替代”的结论。

当前仍是同一账号下不同原生 Agent 的验证，第二位队友的跨账号接入尚未实测。下一项优先工作是让两位成员分别绑定自己的账号与专家：解决同一内置 Agent ID 在不同成员下的授权绑定，实际验证提案权限和跨成员交接。随后将本次证据链接入科研演示界面。DSH 及更多平台接入继续保留，不抢先于真实多人闭环。
