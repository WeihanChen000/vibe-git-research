# 单账号条件下的协作演练与 Codex 接入评审

后续进展：本报告保留改进前的观察。已按优先级完成同项目混合任务入口及“现在轮到谁”；最新实现、模拟证据和仍待验证的边界见 [混合团队说明](SCIENCEPAL-MIXED-TEAM.md)。下文的“尚未统一”描述的是此前基线。

2026-10-30。结论：多人科研协作的控制流程可用；首次接入和异常处理仍偏工程化。Codex 可以通过任务桥调用 SciencePAL，但任务桥和团队项目尚未统一，当前不能称为完整的 Codex + SciencePAL 多人平台。

## 本次实际验证

运行 `npm run build` 后，在 vibe-git 目录执行 `npm run sciencepal:simulate`。无需 Key、无需第二账号，不会调用 SciencePAL，不打开公网隧道。它启动临时回环 Host，使用真实成员 CLI、HTTP 鉴权、连接器、任务桥、文件冻结和证据导出；SciencePAL 一侧替换为确定性模拟器。模拟器不是科研模型，不能用于证明科研能力或跨账号权限。

结果见 `data/usability-simulation/simulation-report.json` 与同目录 R1/R2 证据。每次运行使用临时独立存储，证据包含项目 ID；最新汇总覆盖旧汇总，旧项目证据保留。临时身份仅用于已经关闭的本次 Host，不混用真实成员。

| 路径 | 观察到的结果 |
| --- | --- |
| A、B 两个成员，同一个专家 ID | 成员身份、任务所有者、评审者仍分别记录 |
| 对齐等待输入 | NEEDS_INPUT 停住，明确答复后在原线程续接；恢复保存日志后继续 |
| 数据成果缺少单位 | 模拟评审读取实际文件，退回；下游暂不启动 |
| A 返工，B 重新评审 | 修正单位，保留前版，批准后才交接给下游 |
| B 提议改变研究终点 | 队长确认后进入 R2，从均值 2 改算样本方差 1；R1 保留 |
| B 直接发布 | 403 拒绝，无队长权限 |
| Codex 调用路径 | bridge 提交、取回错误均值、本地复算、原线程返工、取回新版；实际 CLI 导出可读取文件 |

团队演练共 13 个逻辑任务运行、1 次原线程续接（即模拟平台 14 次启动）；Codex 桥演练另有 2 轮。14 个检查通过。Codex 桥和团队路径是两个独立演练，不能把它们拼成已经统一的混合团队闭环。数值数据为合成 [1,2,3]，错误为受控注入，评审采用确定性检查。

本次另跑成员协作与 bridge 两组回归，共 42 项通过，结果在 `data/usability-simulation/regression.json`。未重跑历史软件流程的完整测试；上一轮记录的 12 个既有失败不在本次修复范围。

## 好用的部分

- 领取后自动执行、采集、校验、评审和交接，成员不需手动复制上下游结果。
- 返工与 R2 保留旧版；可按文件字节、成员、评审与研究协议版本追溯。
- 成员权限沿用原项目，选相同专家不混淆身份；Host 不替队友持有 SciencePAL Key。
- Codex 桥输出 JSON 和实际本地路径，Codex 可以直接检查结果并运行独立复算。

## 首次使用的主要问题与优先级

这里是操作路径与代码评审，不是有真人参加的可用性研究；没有浏览器点击测试，也不虚构满意度或耗时。

| 优先级 | 具体问题及证据 | 建议改动与验收 |
| --- | --- | --- |
| P0 | bridge 的任务没有 team projectId/member/task/revision 授权绑定；只共享数据库位置 | 先让 Codex 作为本人成员的操作入口，读同一项目状态、提交提案、查看交接/评审；在成员授权和任务领取之内提交成果。严禁将独立 bridge 结果直接标为团队已批准 |
| P0 | work 在无可领任务时统一显示“等待本人任务”，不区分等队长发布、等别人评审或项目完成；面板只读 | 增加结构化 nextAction：原因、责任人、对象、可执行命令。完成时显示验收摘要；首次队友应不再猜下一步 |
| P0 | bridge 的 NEEDS_INPUT 只有状态和 threadId，没有提问正文；团队本机 reply 要停 work、写文件、再重启 | 增加待办/问题读取入口与明确回复操作；先验证官方问题读取能力，拿不到正文就显示原线程入口和限制。回复走本机连接器，不把 Key 送给浏览器/Host |
| P1 | 初始化包含多个终端、环境变量、成员 ID、项目 ID、action.json；绑定同一账号不会自动提示这是单账号演练 | 项目 profile + setup/start 向导，自动保存非敏感上下文；双成员模拟模式明确标记。切换成员必须切换独立身份/日志 |
| P1 | Codex 桥没有 watch/自动采集命令；没有安装为 MCP 工具；提供的 skill 也不等于当前 Codex 已加载 | 先提供薄的 Codex skill + 有界 watch，遇到 NEEDS_INPUT/UNKNOWN 停在明确动作；核心复用 bridge。MCP 放在统一项目语义之后，避免包装两套割裂状态 |
| P1 | 面板展示任务状态，但没有成员连接器在线/最后活跃状态 | 加 heartbeat/lastSeen，区分队友未开连接器和 Agent 正在运行；不把网络离线判为任务失败 |
| P1 | 通用结构与哈希校验保证交接正确，不能证明科研结论正确；模拟评审不能代表模型表现 | 围绕一个科研模板保留方法、单位、数据来源、独立数值检查及失败反例。复用已有 1CRN 真案例及结果契约，不用模拟成绩宣称科研优势 |

## Codex 与 SciencePAL 现在怎样一起用

当前可以在配置好环境的 Codex 工作区中，由 Codex 写 request.json，然后调用以下已有命令；无需操作 SciencePAL 网页来提交普通任务：

```powershell
npm --silent run sciencepal:call -- agents
npm --silent run sciencepal:call -- submit request.json
npm --silent run sciencepal:call -- status TASK_ID
npm --silent run sciencepal:call -- collect TASK_ID
npm --silent run sciencepal:call -- respond TASK_ID feedback.json
```

从 agents 选择本人可用专家。状态未完成不能 collect；NEEDS_INPUT 不能替用户猜答案；UNKNOWN 不换 requestId 重发。请求/反馈格式及路径限制见 [统一入口说明](SCIENCEPAL-CODEX-ENTRY.md)。本次实际执行过 CLI help 和模拟数据的 CLI collect；没有启动新的真实平台任务。

推荐角色分工：人确定研究目标并处理裁决；Codex 整理输入、操作项目、编写复算代码和检查成果；SciencePAL 专家承担明确的研究子任务。人的成员身份、运行平台和科研角色应独立记录。当前仅能说 Codex 可操作 CLI，尚没有可领取团队任务的通用 Codex worker，也没有验证 DSH。

现有单账号真实证据见 [结构案例](SCIENCEPAL-STRUCTURE-LIVE.md) 与 [续接修复](SCIENCEPAL-STABILITY-RESULT.md)。它们证明各自跑通的部分，不能代替本次尚未完成的真实混合团队验证。SciencePAL 专用科研工具的独特优势仍须由真实工具回执与案例对照支持。

## 下一阶段决策

先把“Codex 操作同一个团队项目”与“明确下一步待办”做完整，再降低等待输入与首次接入的操作成本。暂不扩展更多平台。黑客松演示主线应是：两位研究者各自负责一个科研环节，Codex 在本人成员身份内协调，SciencePAL 专家执行，独立复算发现问题，返工后才交接；每个阶段展示同一个项目中的证据。该主线目前仍有上述 P0 缺口，不能把建议当作已经实现。
