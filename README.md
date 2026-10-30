# Vibe-Git Research · 多人、多 Agent 科研协作

**每个人使用自己的 Agent，在同一份研究协议下完成执行、文件交接、独立评审和返工。**

在队友原 [Vibe-Git](https://github.com/TFboy1/vibe-git) 上扩展，沿用人员拓扑、项目甘特、成员提案和队长发布逻辑。当前主路径为 **Codex × SciencePAL**，并已整合队友的六种本地 Agent 适配接口；各平台真实运行验证范围见下方说明。这是通用科研协作原型，**1CRN 与 Iris 只是可选的验证案例**，不是平台限定的研究课题。

[本次多 Agent 整合与防漂移说明](docs/research/MULTI-AGENT-INTEGRATION.md) · [完整展示与讲解](docs/research/SHOWCASE.md) · [原版能力对照](docs/research/COMPARISON.md) · [队友快速开始](docs/research/START.md) · [架构与扩展](docs/research/ARCHITECTURE.md) · [验证与边界](docs/research/VALIDATION.md) · [全部材料导航](docs/research/INDEX.md)

![当前科研版：原拓扑中的工具、参数、结果与独立复核](docs/research/images/research-evidence-current.png)

*实际构建界面的只读历史回放。单个真实 SciencePAL 账号与 Codex，两种工作流身份；不代表两位真实用户已经联调。*

下载后可双击 [`docs/research/index.html`](docs/research/index.html) 查看无需安装的图文展示；GitHub 上请直接阅读上方展示页。

## 本轮新增

[可执行科学检查与测试](docs/research/SCIENTIFIC-GATES.md)：已配置检查失败时，Agent 批准不能放行；1CRN 模板附独立参考。队长双击 `vibe-git/open-captain.cmd`，成员双击 `vibe-git/open-research.cmd`。

## 黑客松提交材料

[提交包与缺项清单](docs/submission/README.md) · [5 页技术说明](docs/submission/project-brief.pdf) · [▶ 直接播放故事演示（英文配音）](https://weihanchen000.github.io/vibe-git-research/submission/watch.html) · [原创性与资源说明](docs/submission/ORIGINALITY-RESOURCES.md)

材料不等于已经提交。队伍身份、最终声明和问卷回执仍需队长完成；SciencePAL 展示链接的访问状态见提交包。

## 本次新增

- 原算力网选择七种平台；本地待办可以启动已安装的 Agent，也可复制任务包说明。
- 原协议抽屉直接固定方法、参数、源数据哈希和范围，失败成果阻止评审与交接。
- 原 v20/v21 的 12 项旧测试失败已修复；保留提案版本、模块证据和成员权限门禁。
- 真实联调修复了 Codex App Server 启动兼容和本地失败恢复；评审代码与简短证据分开交付。
- 获批交接自动携带原始批准记录，并绑定成果哈希，避免下游收到文件却不知道是否获准使用。

## 先看，还是直接使用？

| 目的 | 入口 | 是否调用真实模型 |
|---|---|---|
| 发给队友快速了解 | 本 README 与完整展示 | 否 |
| 自己点击真实案例全过程 | `vibe-git/open-replay.cmd` | 否，使用已保存原始证据 |
| 体验加入、提案、返工与交接 | 构建后 `npm run research:simulate-ui` | 否，明确标记合成演练 |
| 开始自己的研究项目 | `vibe-git/open-research.cmd`；队长按接入指南先启动房间 | 是，执行时使用各自账号额度 |

要求 **Node.js 24+**。从仓库根目录：

```powershell
cd vibe-git
npm ci
npm run build
npm run research:replay
```

终端输出本机链接，保持终端开启。首次安装需要网络；构建后的回放不需要 API Key。回放可选 1CRN 七阶段或 Iris 九阶段，能展开原始文件、评审和交接证据。Windows 也可双击 `open-replay.cmd` 自动准备。

## 实际使用的主路径

**加入房间 → 绑定本人 Agent → 写自己的研究提案 → 上传材料并冻结项目 → 对齐与发布 → 按“现在轮到谁”执行 → 评审 / 返工 → 获批文件交接。**

上传自己的材料、选择参与成员、定义自己的方法与验收标准即可建项。当前界面支持单份、不超过 256 KiB 的 UTF-8 CSV / TSV / TXT / JSON / DATA / PDB；它还不是任意格式、大文件的通用数据平台。自定义材料会移除案例专用成果约束。

## 相比原版增加了什么？

| 原版基础（保留） | 科研扩展（新增） |
|---|---|
| 多人 Codex、成员提案、队长对齐与发布 | 同项目中的成员身份与 Codex / SciencePAL 绑定 |
| Git、任务和需求版本 | 冻结科研输入字节、输出格式、来源与验收要求 |
| 原拓扑与任务状态 | 文件交接与独立评审关系、“等谁 / 下一步” |
| 完成确认与已有接口契约 | 研究产物回执、格式门禁、评审退回与重试版本 |
| 软件开发流程 | 科研专家执行、原线程等待输入后接续、证据回放 |

详细对照以原版 **f3e888f** 为基线。界面旧图来自原仓库的交互演示，不冒充原版完整运行评测；六类自动门禁结果也不等于真人效率提升。见 [对照方法及盲点](docs/research/COMPARISON.md)。

## SciencePAL 的必要性怎么体现？

它在本项目中是实际科研执行端：从账号可用 Agent 目录选择专家，接收任务文件，在其环境中执行并交回产物。1CRN 的真实 Biology 运行交付了 BioPython 1.84、计算参数、代码与输出；Codex 在另一端重算核对。平台管理的是这次合作的身份、版本、证据和交接。

这证明当前集成有实际用途，**不证明这些算法只有 SciencePAL 能做**。研究工具可用性与任务适配才是选择它的理由；不能把强制调用它或角色名称当成独特优势证据。

## 当前验证状态

- 正式回归与真实整合记录见 [最新验证记录](docs/research/INTEGRATED-LIVE-20261031.md)，旧测试已恢复通过。
- 真实案例：1CRN 七阶段、Iris 九阶段，包含 **38 个原始附件**，均有字节数和 SHA256。
- 真实跨平台：一个 SciencePAL 账号 + 本地 Codex 已验证；真实两位用户各自账号联调仍待完成。
- 受控测试：1CRN 首版单位错误与参数确认、Iris 首次数值错误是明示设计；不冒充自然发生的错误。Iris 第二次缺代码为真实产物问题。
- 当前 Codex 可从本人任务入口启动已登录的本地执行器，使用冻结任务包交回；不会接管任意已有会话。其他平台接口已接入，除 Codex / SciencePAL 外真实模型仍待验证。

## 来源与团队使用

这是公开的团队分享仓库，保留上游基线和作者归属，不改写队友原仓库。源码包包含科研 Skill：[`vibe-git/research-skill`](vibe-git/research-skill/SKILL.md)。原版文档入口为 [README-ORIGINAL.md](README-ORIGINAL.md)，早期研发报告可能描述历史阶段，请以本 README 和验证页为当前状态。

仓库已由负责人授权公开，可直接分享给队友与评委。当前快照未发现统一的根级开源许可证，公开可见不等于授予任意使用许可；保留原作者及素材归属，不擅自补写 MIT。见 [来源和分享范围](docs/research/PROVENANCE.md)。API Key、邀请凭据、成员 token、私人数据库与完整运行目录均不进入分享快照。
