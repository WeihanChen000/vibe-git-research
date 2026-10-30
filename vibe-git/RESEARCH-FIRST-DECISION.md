# 2026-10-30：科研流程主线

采纳组员意见：将原 Vibe-Git 的软件开发协作主线改为科研协作，SciencePAL 作为默认科研执行平台。原先“Codex 必须作为主程序”的定位不再是产品前提；Codex、DSH 等多平台能力保留为扩展。研究场景变了，成员身份、提案权限、对齐、交接、评审、返工及版本化机制继续复用。

## 改变什么

| 流程 | 科研内容 |
| --- | --- |
| 各人提交提案 | 研究问题、数据来源、方法、基线、本人分工、资源及停止条件 |
| 自动对齐与裁决 | 冻结研究协议；明确数据、方法、单位、指标冲突 |
| 分工执行 | 专家工具计算、证据整理、实验分析或复现 |
| 独立评审 | 核查具体来源和结果；工程成功与科学合理性分别判断 |
| 返工和研究变更 | 保存旧版，修正后复评；协议变更使受影响结论失效 |
| 交付 | 可复现的研究成果包，保留来源、参数、工具和失败记录 |

项目 Skill 已在原 submodule 中更新为该主线；旧 Codex Skill 保留在 `references/legacy-codex-skill.md`，不再作为默认入口。该 Skill 已通过 quick_validate。SciencePAL 流水线提示也已要求保留研究问题、数据版本、方法、单位、基线及结论边界，同时继续遵守现有冻结 JSON Schema。提示规则不冒充新增的服务器字段校验。

云端 SciencePAL Agent 执行科研任务，本地成员连接器处理身份、派发及回传；云端不能访问成员电脑的 localhost，也不意味着平台已经安装本地 CLI。科研 Skill 在本次案例作为明确任务附件使用；未声称已经上传为账号永久 Skill。

## 真正的专家入口已找到

官方 SDK 0.2.3 文档明确：`/api/agents` 仅列本人自建 Agent；`GET /api/agent-catalog?usable_only=true` 才是包含内置、本人自建和获授权共享 Agent 的可用目录。本账号实际返回 Biology、Material、Survey、MIMIC、General 五个内置 Agent 以及原来的两个自建 Agent。

客户端已改用可用目录，保留来源、领域类型、描述及工具配置标签。旧后端不支持时明确失败，不静默退回自建列表掩盖专家。提交和成员连接器继续复查账号使用权限。

Biology 实测：BioPython 1.84 的 PDBParser 与 ShrakeRupley 成功导入，PyMOL 3.2.0a、MAFFT、Open Babel、samtools 的版本命令成功；MDAnalysis、Scanpy 等包仅确认存在，尚不等于所有功能可用。FastQC 的启动失败也被记录。与昨日自建通用 Agent 缺少 Bio/PyMOL 的结果不矛盾，两个 Agent 使用了不同的运行环境。

来源：[官方 API/SDK 帮助](https://sciencepal.ai/help/sdk)、[官方 Skills 导入说明](https://sciencepal.ai/help/skills)。实际能力以本项目探测产物为准。

## 复用与范围

GitHub 查询 `gh search repos 'sciencepal SDK' --limit 3` 无结果，采用官网公开 HTTP 契约，在现有 TypeScript 客户端实现；无需安装 wheel 或增加 npm 依赖。

原 Skill 是项目已锁定的 `TFboy1/vibe-git-skill` submodule，commit `940b6c6c2ac34a7e0536da36d49d65d57a46c313`；仓库未归档、最近推送 2026-10-13，无独立 LICENSE。仅在本地保留兼容参考并改写科研入口，未发布或推送这些修改。原作者为队员，不以缺少 LICENSE 为由阻止已授权的本地开发。

2026-10-30 后续更新：新团队项目已按成员区分绑定，允许两人使用同一个内置专家 ID；已提供接入检查、科研提案、源数据模板及可发给队友的源码包。见 [接入说明](SCIENCEPAL-TEAM-QUICKSTART.md)。第二真实成员联调仍待队友操作，DSH 自动执行仍为后续工作。
