---
name: vibe-git
description: 在 Vibe-Git 中组织多人成员及各自 Agent 的科研协作：研究提案、协议对齐、实际执行、文件交接、独立评审和返工。默认使用 SciencePAL 科研 Agent，保留其他平台入口；普通 Git 操作及不涉及协作的问答不适用。
---

# Vibe-Git 科研协作

研究问题 → 成员提案 → 协议对齐 → 分工执行 → 独立评审 → 返工/研究变更 → 成员验收。保留协作流程，改变交付及验收内容。SciencePAL 是默认科研执行平台；Codex 等平台可以参与实现、复现或协调，不要求成员先绑定 Codex 算力。

## 运行位置与权限

- 在成员电脑：使用已构建原型的 `sciencepal:member` 连接器或 `sciencepal:call` 统一入口。先读状态，复用已有身份及授权；无法判断时才询问，不重新加入或替换别人的绑定。
- 在 SciencePAL 云端：用收到的任务包、沙箱和科研工具执行本人分工，交付约定的文件。成员电脑的 localhost 不能在云端访问；不要假装云端安装了本地 CLI。成员连接器负责实际交接。
- 原 Codex CLI 路径仍兼容，仅在明确使用旧路径时读 [旧版操作](references/legacy-codex-skill.md) 或 [命令参考](references/workflows.md)。原型新增命令不等于已发布到 npm。
- 成员、Agent、平台和底层模型分别记录；两个 Agent 不代表两位成员。队长不能改别人的提案，Agent 不能替成员授予权限。
- 多人项目的 `context.agents[].id` 是成员绑定标识，分工和评审使用该值；`runtimeAgentId` 是实际平台专家 ID。两位成员可选同一内置专家，不能合并成员、换用 runtimeAgentId 分工或据此推断账号相同。接入前用 `doctor` 核查本人权限；不同账号仍需两位本人确认。

## 科研流程

1. **提案**：说明研究问题、来源与输入版本、方法/基线、本人分工、交付、可核查验收、局限及预算。按任务规模使用 [科研协议模板](references/research.md)，不机械扩展成完整论文计划。
2. **对齐**：冻结上述内容和依赖。数据、方法或指标冲突必须引用成员原文并给出裁决选项；没有实质冲突就直接对齐。原系统的 requirement/revision 承载研究协议版本，不丢弃历史。
3. **选择专家**：从官方 `GET /api/agent-catalog?usable_only=true` 或本地 `agents` 命令发现有使用权限的内置、自建及共享 Agent。旧 `/api/agents` 仅列自建 Agent。用实际返回 ID，先实测所需工具；角色说明是平台声明，成功执行才是观察证据。
4. **执行**：按冻结协议实际读取原始字节，记录来源哈希、方法参数、工具版本、命令和输出。工具缺失或失败如实记录；不得安装工具后声称原本预装。实际输出 envelope/schema 优先，Skill 不得修改字段或削弱验收。
5. **评审**：与执行者分开，逐项复算或核查，检查真正相关的数据、单位、方法假设、基线及结论边界。代码成功不是科学批准；指出具体文件、观察和修正意见。可复用评审器应接受正确样本及相关错误样本的独立检查。
6. **返工与变更**：针对同一任务反馈，保留前版再独立复评。研究问题、数据、方法或终点变化走协议修订，明确失效任务和结论；不把旧版结果算作新版证据。
7. **验收**：交接真实版本文件及证据，不仅是聊天摘要。成员确认交付；团队批准不等于正式同行评议。公开/私有/合成数据及受控故障注入分开标记。

## 当前本地原型命令

在已构建的项目 `vibe-git/` 目录运行，先用当前版本 `help` 查看参数，不从旧 CLI 猜命令。

- 团队身份与提案：`npm run sciencepal:member -- state`，`agents`，`bind <实际AgentID>`，`plan <proposal.md>`。新成员只在有明确邀请时 `join`。
- 队长冻结已有提案：`create <project.json>`；每位成员 `work <项目ID>`，只执行本人允许领取的任务。
- 队长流程：`command <项目ID> align <action.json>`，读取真实对齐结果及裁决后 `publish`；退回用 `rework`，协议变更用 `change`、`apply-change`。
- Codex 参加同一个团队项目：创建项目前以本人身份 `bind-codex`；使用 `next <项目ID>` 查看责任人与待办，`take <项目ID> <新任务目录>` 领取。读取 TASK.md 和 inputs/，生成约定的完整 JSON envelope，然后 `submit <项目ID> <原任务目录> <结果路径>`。提交后仍须另一成员评审；SciencePAL 成员继续用原 work 命令。
- 本地任务目录绑定本人、Host、项目和运行；重试使用原目录，返工及新任务使用新目录。不要修改冻结输入。Codex 任务记录使用本地执行 ID，不伪造 SciencePAL thread/run/sandbox。工具只交接任务包，不会自动启动一个 Codex 模型；当前 Codex 负责实际计算或审查。
- 单人调试/跨平台入口：`npm --silent run sciencepal:call -- agents|submit|status|collect|respond|show|list|recover`。提交 JSON 含 requestId、实际 agentId、prompt、inputFiles、outputs；`respond <任务ID> <feedback.json>` 在原线程反馈。此入口不自动获得团队项目批准权。

## 凭据、状态与证据

`SCIENCEPAL_AUTH_FILE` 指向仓库外 Key 文件；`VIBE_GIT_MEMBER_FILE` 指向本人身份。不要打印、上传或写入提示词，Host 不持有队友 Key。已明确授权的具体步骤不重复索取确认；对外发布、共享私有资料和替队友授权不包含在普通执行授权中。

只按真实回执报告：RUNNING 查原任务，NEEDS_INPUT 待回答，COMPLETED 仍需采集，COLLECTED 仍需科研验收。UNKNOWN 禁止重发启动或换 requestId 绕过，应核对远端后恢复。交接文件不覆盖，失败和不支持预期的结果保留。

团队 NEEDS_INPUT 必须先收到成员答复：本人可在 SciencePAL 原线程回答，连接器自动核对并接回唯一新 run；或停止 work 后使用 `reply PROJECT ANSWER.md`，随后恢复原 work。不要替成员猜答案，也不要同时用两个回复渠道。连接器保存 messageId、答复哈希和续接历史；未知 start 只查询不重发，多个候选运行停止核对。原线程最多续接 6 次，计入项目运行预算。

当前原型最多接收八个输入文件。完整评审材料超限时，将明确选定的科研文件打成 ZIP，并附每个文件的 SHA-256 清单；不为凑数量省略运行日志、基线生成代码或协议，也不打包整个工作区与凭据。接收方核对外层归档及解包后字节，区分“生产者没有生成”与“交接包没有包含”。

联网、安装及资源使用以任务协议和实际入口权限为准，Skill 不扩权。区分事实、推断、平台声明及未验证假设；单次案例不证明平台全面优越或研究发现成立。
