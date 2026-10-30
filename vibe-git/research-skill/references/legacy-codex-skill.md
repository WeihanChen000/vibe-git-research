---
name: vibe-git
description: 安装并调用 Vibe-Git CLI，协助队长和成员连接协作房间、提交 Markdown 提案、对齐需求、执行任务及审核内部需求变更。用户要求操作 Vibe-Git 时使用；普通 Git/GitHub 操作不适用。
---

# Vibe-Git CLI

Vibe-Git 是 CLI 驱动的多人协作工具。通过终端调用 `vibe-git`；网页由 `vibe-git open` 打开，用于查看团队状态。不要把旧 AgentGit MCP 命令当作本 CLI 的命令。

## 面向第一次使用者的总原则

把使用者当作第一次接触 Git、CLI 和多人协作的人来带，不要只甩一条命令。每次用户说“第一次使用”“不会安装”“怎么开始”或只给出一个模糊目标时，按下面顺序解释并推进：

1. 先用一句话说明两个东西的关系：Skill 让 Agent 知道如何协作，CLI 提供房间、状态和上传命令；用户只需要先安装 Skill，用户明确要求“自动安装”时，Agent 直接执行 npm 安装 CLI。
2. 先确认用户当前所在的是**自己的项目 Git 工作区**，不是 Vibe-Git 源码目录，也不是空文件夹。
3. 确认 Node.js 24+、Git、Codex CLI 是否可用；缺什么就先给出安装方向，不要直接假设已安装。
4. 安装完成后必须问清楚用户是“队长”还是“队员”。在身份不明确前，不要执行 `host start`、`connect`、`plan submit` 或其他会改变房间状态的命令。
5. 根据身份只给当前阶段需要的命令，并在每条命令后说明“你应该看到什么”。不要一次倾倒整张命令表。

推荐的第一句：

> 你是要创建房间的队长，还是要加入别人房间的队员？队长负责启动 Host、收集提案、对齐并发布任务；队员负责加入、提交自己的提案、执行任务和确认完成。

## Skill 能替用户做什么

Skill 不会凭空替用户决定需求，但在用户明确目标和身份后，应主动把自然语言转换成安全、可回执的 CLI 流程：

- **安装助手**：检查 `vibe-git --help`、依赖版本和当前工作区；缺少 CLI 且用户已明确要求自动安装时，在确认 Node.js/npm 可用后直接执行 `npm install -g @vibe-git/vibe-git`，再运行 `vibe-git --help` 验证。不要推荐不存在的 `npm install -g vibe-git`。
- **队长开房**：确认用户是队长且位于项目工作区后，协助运行 `vibe-git host start`，告诉用户如何保存并私下发送加入命令，再用 `vibe-git open` 打开面板。
- **队员入房**：要求用户粘贴队长提供的完整加入命令或 URL，确认当前是正确的项目工作区后运行 `vibe-git connect <join-url>`，随后检查 `status` 并打开面板。
- **自动上传提案**：用户提供目标、现状、方案、验收标准或代码上下文后，帮助整理成 UTF-8 Markdown；在用户明确“提交/上传提案”后保存为不覆盖现有文件的 `.md`，运行 `vibe-git plan submit <文件.md>`，并把 CLI 成功回执和版本告诉用户。
- **自动上传任务细节**：用户领取任务后想补充实现步骤、测试方式或风险时，整理 Markdown 并在确认任务 ID 后运行 `vibe-git task push <task-id> <文件.md>`。
- **自动提交需求变更**：用户明确说“改需求”“提变更”“提交 PR”时，先说明这里的 PR 是 Vibe-Git 内部需求变更单，不是 GitHub Pull Request；整理变更背景、原需求、修改内容、影响范围和验收方式，确认用户要提交后运行 `vibe-git pr submit <文件.md>`。
- **连接 Codex 审核/算力池**：用户要连接 Codex 池或审核能力时运行 `vibe-git codex bind`，让用户完成交互式 device-auth，再运行 `vibe-git codex status` 验证。这个专用账号只用于审核，不替换用户日常 Codex 配置，也不读取或打印凭据。
- **任务推进助手**：根据真实的 `task-id` 和状态，协助 `task list`、`task pull`、`task start`、`task sync`、`task integrate`、`task done`；不猜 ID，不把 Codex 退出误报为完成。
- **高级流程助手**：只有用户明确需要分阶段交付、工作流契约或任务依赖时，才介绍 `stage activate/replan`、`contract list/show/ack/publish`、`work list/pull` 和 `align downgrade`；先读取状态和真实 ID，不凭空创建阶段、契约或依赖。

只在 CLI 返回成功回执后说“已提交”“已连接”“已完成”。如果失败，保留原始错误，优先建议 `vibe-git status` 或 `vibe-git logs`，不要假装成功。

## 安装或定位 CLI

1. 先运行 `vibe-git --help`。若命令已可用，直接使用；若已在源码仓库且构建产物存在，也可调用 `node <源码目录>/apps/cli/dist/index.js --help`。
2. 用户要求自动安装且 CLI 不可用时，检查 Node.js 24+、npm、Git 和 Codex CLI，然后执行 `npm install -g @vibe-git/vibe-git`；安装完成后重新运行 `vibe-git --help`。
3. 只有用户明确选择源码安装或正在开发 Vibe-Git 时，才进入源码仓库执行 `npm ci`、`npm run build`、`npm link`。Windows PowerShell 可用 `npm.cmd` 避开脚本执行策略。
4. 安装命令、智能体一句话提示词和排障见 [安装参考](install.md)。仅在安装、更新或命令不可用时读取它。

### 安装完成后的首次教学

安装成功并且 `vibe-git --help` 能显示命令后，不要停在“安装完成”。继续询问身份并完成对应的最小闭环：

- **队长**：确认项目工作区 → `host start` → 保存加入命令 → `open` → 等待队员 → 指导队员提交提案 → `align start` → 查看并裁决 → `tasks publish`。
- **队员**：确认项目工作区 → 粘贴加入 URL → `connect` → `status` → `open` → 准备并提交自己的提案 → `task list` → 领取并开工。

每完成一个状态改变命令，都要重新读取 `status` 或 CLI 回执；不要把网页按钮点击、Codex 对话结束或本地文件生成当作服务器已接受。

## 调用前判断

- 确认当前终端在**使用者自己的 Git 工作区**。`host start` 和 `connect` 会把当前目录记录为该节点工作区；不要在 Vibe-Git 工具源码目录代替用户的项目目录运行它们，除非该目录就是项目。
- 用 `vibe-git status` 读取当前节点身份、任务和后台进程；队长检查 Host 时用 `vibe-git host status`。本机一次只维护一个活跃节点配置，切换房间或工作区前先说明影响。
- 从 CLI 回执或面板取得真实的 `alignment-id`、`task-id`、`node-id`、`review-id`；不要猜测 ID。长时间等待审核时用有超时的阻塞等待脚本，避免频繁手动轮询。
- `--help` 可看当前安装版本的命令。具体工作流见 [命令参考](workflows.md)；执行相应角色或阶段前再读。

## 工作流要点

- 队长：`host start` → 将输出的加入命令交给成员 → `open` 看面板；需要审核能力时在各节点分别 `codex bind`；收到至少一份提案后显式 `align start`，审核对齐稿后 `tasks publish <alignment-id>`。
- 成员：在自己的工作区运行队长给出的 `connect <join-url>` → `status` → `open`；用 `plan submit <文件.md>` 提交或更新**自己的**提案。所有节点都能查看团队最新提案，不能修改他人的提案。
- 文件可以是任意名称的 `.md`，须为非空 UTF-8 且不超过 256 KiB。`plan submit` 是提案，`task push` 是任务执行细节，`pr submit` 是内部需求变更；文件名不决定文档种类。
- 成员先 `task list`、`task pull <task-id>`，可用 `task push` 上传执行细节；只在明确决定开工后调用 `task start`。Codex 正常结束进入 `WAITING_CONFIRMATION` 后，先新鲜同步，再由成员确认并调用 `task done`。
- 开发中可以 `pr submit <文件.md>`；普通成员不能发起审核。队长 `review start --force` 会提前通知并暂停受影响任务；`review apply` / `review reject` 需要依据实际审核结果作出决定。

## 给“傻瓜用户”的角色教程

### 队长教程

当用户选择队长时，按这条顺序带着做，不要让用户自己猜下一步：

1. 进入项目根目录，确认这里有 `.git`，再运行 `vibe-git host start`。
2. 从成功回执中找到加入命令，只把它发给预期队员；不要公开到仓库、Issue 或群公告。
3. 运行 `vibe-git open` 查看房间，不要把网页地址当成加入命令。
4. 队员提交提案后运行 `vibe-git status`；至少有一份提案时运行 `vibe-git align start`。
5. 用 `align status`、`align show <alignment-id>` 看冲突；需要裁决时使用真实的 `issue-id` 和 `option-id` 运行 `align resolve`。
6. 所有实质冲突裁决完后，先按需要 `task assign`，再运行 `tasks publish <alignment-id>`。
7. 开发中收到需求变更时，运行 `review start --force`、`review status`，根据实际审核结果运行 `review apply` 或 `review reject`。

### 队员教程

当用户选择队员时，要求队长先发完整加入命令，再按这条顺序带着做：

1. 在自己要写代码的项目根目录运行 `vibe-git connect <join-url>`。
2. 运行 `vibe-git status` 确认节点身份，再运行 `vibe-git open` 查看房间。
3. 让 Skill 根据用户的项目目标整理 `proposal.md`；用户确认内容后运行 `vibe-git plan submit proposal.md`。
4. 收到任务后先运行 `vibe-git task list`，再用真实的 `task-id` 运行 `task pull`。
5. 需要补充实现步骤时使用 `task push`；明确要开工后才使用 `task start`。
6. Codex 正常结束后先运行 `task sync`，确认状态新鲜且用户同意完成，再运行 `task done`。
7. 开发中发现需求要变更时，让 Skill 整理变更单；用户确认后运行 `pr submit`。这不会创建 GitHub PR。

### Codex 池教程

用户说“连接算力”“绑定审核 Codex”“让 Vibe-Git 帮我检查影响”时，先解释这是每个节点独立的专用审核账号，然后运行：

```powershell
vibe-git codex bind
vibe-git codex status
```

遇到 device-auth 页面时只告诉用户完成授权，不读取、复制或展示本机凭据。需要切换传输方式时，再根据用户明确选择运行 `vibe-git config set work.transport auto|app-server|cli`。

## 凭据与回执

- 加入链接含注册密钥，仅交给预期成员；不要写进仓库、Issue 或公开日志。不要读取、打印或上传 `~/.vibe-git/client.json`、`data/v20/captain.json` 或 `~/.vibe-git/audit-codex` 的凭据。
- `codex bind` 使用交互式 device-auth，专用审核账号保存在本机 `~/.vibe-git/audit-codex`，不替换日常 Codex 配置。遇到登录提示，让使用者完成设备授权。
- 只在 CLI 返回成功回执后报告操作成功。失败时保留错误信息，查看 `vibe-git logs`；队长也可查本机 Host 日志。不要把内部 Vibe-Git Pull Request 说成 GitHub PR。
