# 安装 Vibe-Git：让 Agent 自动处理，或自己手动处理

把 Vibe-Git 想成两个零件：**Skill 是教 Agent 怎么带你协作的说明书，CLI 是真正创建房间、上传文件和读取状态的工具**。

普通用户推荐只先安装 Skill。用户明确要求自动安装后，Skill 发现 CLI 没有安装时会直接执行 npm 安装命令；用户不需要自己搜索 npm 包名，也不需要先进入源码仓库。

## Agent 自动安装（推荐）

先在你平时使用 Agent 的项目工作区执行这一条命令：

```powershell
npx skills add TFboy1/vibe-git-skill --skill vibe-git
```

然后把下面这一句话直接发给 Agent：

> 请自动安装并配置 Vibe-Git：先检查 Node.js、Git、Codex CLI 和 vibe-git CLI；如果 CLI 没安装就执行 `npm install -g @vibe-git/vibe-git`，安装成功后先问我是队长还是队员，再带我完成第一步。

Agent 应该按这个顺序处理：

1. 检查 `node --version`、`npm --version`、`git --version`、`codex --version`。
2. 检查 `vibe-git --help`；如果 CLI 不存在，向用户说明将安装 `@vibe-git/vibe-git`。
3. 用户已经通过上面的提示词明确要求自动安装，直接执行 `npm install -g @vibe-git/vibe-git`。
4. 再次运行 `vibe-git --help`，只有成功后才说 CLI 安装完成。
5. 询问用户是队长还是队员，然后进入对应教程。

## 哪些智能体可以使用

只要智能体支持安装 Agent Skill、读取当前工作区并执行终端命令，就可以使用 Vibe-Git。当前教程面向：

- Trae
- Codex
- WorkBuddy
- Coder
- Claude Code
- Antigravity

不同智能体的按钮名称可能不同，但给它的核心提示词相同：**先安装/加载 `vibe-git` Skill，再让 Skill 自动安装 CLI**。如果某个智能体不允许 Agent 执行终端命令，就改用下面的手动安装方式。

## 手动安装

如果你不希望 Agent 执行安装命令，可以自己在 PowerShell、终端或集成终端执行：

```powershell
npm install -g @vibe-git/vibe-git
vibe-git --help
```

然后再安装 Skill，让 Agent 帮你使用 CLI：

```powershell
npx skills add TFboy1/vibe-git-skill --skill vibe-git
```

如果 `vibe-git --help` 能显示 Vibe-Git 命令，CLI 就已经安装成功。不要使用不存在的 `npm install -g vibe-git`。

## 源码安装（仅开发者需要）

只有你要修改 Vibe-Git 源码、测试本地未发布版本或参与项目开发时，才使用源码安装：

```powershell
git clone https://github.com/TFboy1/vibe-git.git
Set-Location .\vibe-git\vibe-git
npm.cmd ci
npm.cmd run build
npm.cmd link
vibe-git --help
```

安装后请回到**你真正要协作的项目 Git 工作区**运行 `host start` 或 `connect`。不要在 Vibe-Git 源码目录里误启动房间。全局链接依赖这个源码目录，使用期间不要移动或删除它。

## 安装完成后，先问身份

安装成功后不要停在“命令可用了”。先让 Agent 问：

> 你是要创建房间、邀请队友和发布任务的队长，还是要加入别人房间、提交提案和执行任务的队员？

### 队长

```powershell
Set-Location C:\path\to\your-project
vibe-git host start
vibe-git open
```

`host start` 成功回执里的加入命令才是给队员的邀请入口。只把完整命令私下发给预期队员；`open` 只是打开面板，不是加入命令。

### 队员

```powershell
Set-Location C:\path\to\your-project
vibe-git connect "<队长给你的完整加入 URL>"
vibe-git status
vibe-git open
```

进入房间后，可以直接对 Agent 说：

> 我是队员，请阅读当前项目，帮我起草一份提案；先展示内容给我确认，确认后再保存为 UTF-8 Markdown 并执行 `vibe-git plan submit`。

## 安装后可以直接这样说

- “我是队长，帮我检查当前工作区并启动 Vibe-Git 房间。”
- “我是队员，这是队长的加入命令，帮我连接并确认状态。”
- “帮我阅读项目并生成提案，确认后自动上传。”
- “我要改需求，请生成内部变更单，确认后执行 `vibe-git pr submit`。”
- “帮我连接 Vibe-Git 专用 Codex 审核池。”

涉及启动房间、连接节点、上传文件、绑定账号或发布任务时，Skill 会先确认身份、工作区和目标 ID；用户确认后才执行，并且只在 CLI 成功回执后报告成功。

## 常见安装问题

- **Skill 安装了但 CLI 不存在**：Skill 和 CLI 是两个东西；重新对 Agent 发送自动安装的一句话，或手动执行 `npm install -g @vibe-git/vibe-git`。
- **`npm` 找不到**：先安装 Node.js 24+，重新打开终端后再试。
- **`vibe-git` 找不到**：检查 npm 全局 bin 是否在 PATH，重新打开终端后运行 `vibe-git --help`。
- **Agent 不允许执行命令**：使用手动安装方式，再把安装结果告诉 Agent。
- **连接后状态不对**：确认你在自己的项目 Git 工作区，运行 `vibe-git status` 和 `vibe-git logs`，把错误原文交给 Agent。

加入链接包含注册密钥，只交给预期队员。不要把 `~/.vibe-git/client.json`、`data/v20/captain.json` 或 `~/.vibe-git/audit-codex` 发给任何人。
