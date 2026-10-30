# SciencePAL 完整科研协作流程

多人扩展：原成员身份与提案权限现已接入，入口 `/sciencepal/team`，通过各人本机连接器执行。参见 [多人实现与核查](SCIENCEPAL-MULTIPERSON.md) 和 [队友接入说明](SCIENCEPAL-TEAM-QUICKSTART.md)。本文其余接口描述保留给历史单账号验证流程。

本版将 Vibe-Git 的“冻结提案 → 对齐 → 冲突裁决 → 发布 → 依赖执行 → 评审 → 变更重编排”工作方式接入 SciencePAL。入口仍为 <http://127.0.0.1:8788/sciencepal>。上一版双 Agent 快速文件交接保留在 `/sciencepal/handoff`，旧记录与文件不迁移、不删除。

默认入口为“真实运行回顾”，可切换执行轮次、对照修订成果、查看交接检查、切换需求版本并导出报告。点击“协作工作台”进入原完整操作流程。当前作品评审、设计决策及三分钟演示路线见 `HACKATHON-REVIEW-AND-DEMO.md`。

新增可选的冻结成果格式：Iris 模板自动提供规则，也可以按任务键填写 JSON Schema。Host 在独立评审前检查真实 result，格式错误阻止评审和交接；字段错误和失败原文件保留，显式重试沿用同一规则。详见 [SCIENCEPAL-RESULT-CONTRACTS.md](SCIENCEPAL-RESULT-CONTRACTS.md)。未配置的旧项目明确显示“未配置机器格式约束”，不追溯声称已通过新校验。

## 如何运行

沿用 `SCIENCEPAL-PROTOTYPE.md` 的 Node、密钥和启动方式：

```powershell
npm ci
npm run build
$env:SCIENCEPAL_AUTH_FILE = 'C:\你的私有目录\sciencepal-auth.json'
npm run sciencepal
```

密钥仅由 Host 读取。默认回环监听 `127.0.0.1:8788`；不开放公网访问。数据仍位于 `data/sciencepal/`。

1. 新建项目，选择 2–4 个不同的真实 SciencePAL Agent，分别填写目标、分工和验收提案，指定对齐负责人。
2. 可选上传一个 UTF-8 研究源文件并填写 HTTPS 来源及署名，或使用内置 Iris 公开数据复核模板。创建时冻结提案正文、来源 Agent、源文件原始字节和 SHA-256。点击“启动自动对齐”。
3. 对齐 Agent 通过实际附件读取提案，生成 2–6 个有目标、边界、验收标准和依赖的任务。任务分配至少覆盖两个 Agent。
4. 有实质冲突时暂停，展示原文证据与可选方案；你选择后系统重新定稿。已确认的冲突选项不能被另一请求覆盖。
5. 检查对齐稿与分工，点击“确认发布并自动执行”。发布前不会启动工作任务。
6. Host 自动派发就绪任务、查询运行、回收真实文件，再交给另一位 Agent 逐项评审。无需逐个点击“采集”或“启动下游”。
7. 上游通过评审后，下游才会拿到冻结文件。作者不能自审；评审线程与沙箱必须独立。
8. 评审要求修改时暂停新派发，显示具体缺陷。点击“按评审意见返工”，原执行者会拿到旧成果和反馈，生成新成果并再次接受独立评审。旧尝试始终保留。
   在任务卡展开“执行与评审历史”，可同时查看首次退回、收到的返工意见、修订成果及重审结果。每次成果和评审都有独立下载入口；归档版本也提供同样的历史视图。历史读取失败不会显示为通过。
9. 全部任务通过独立评审后，项目阶段完成。

自动调度在 Host 内运行，关闭页面后继续。停止 Host 会暂停本地调度，不会取消已提交的 SciencePAL 远端运行；重启后继续观察已保存的 Run ID。界面的“暂停派发”也只暂停新派发，仍回收在途结果。

## 需求变更闭环

在对齐稿待发布、阶段完成或评审退回且所有在途运行结束时，可以提交需求变更。

1. 冻结当前需求版本、任务、已有成果和变更文本。
2. SciencePAL 对齐负责人做影响评审，给出 accept/reject、原因、受影响任务和获批时的完整需求修订稿。
3. 评审建议不会直接改变需求。你可以不应用、返回原阶段；被拒绝的建议不能应用。
4. 明确确认获批变更后，旧阶段归档，需求版本递增，自动发起新版本对齐。
5. 新对齐稿仍需确认发布。新版本的任务全部重新执行和评审，旧成果仅作历史证据，不能自动冒充新版本成果。

这是保守的整阶段重编排：当前不会只改局部任务后复用未证明仍有效的旧输出。受影响任务列表用于审阅和追溯，未作为跳过重新验证的理由。

## 与原 Vibe-Git 的关系

| 原版能力 | SciencePAL 适配 |
|---|---|
| 成员提案及来源快照 | Agent 提案、正文哈希与版本 |
| ALIGN_PLANS / ALIGN_FINALIZE | 真实 SciencePAL ALIGN Run，冲突裁决后再次定稿 |
| 对齐稿人工发布 | 未发布不得执行，绑定对齐 Run 与需求版本 |
| 任务目标、边界、验收与依赖 | 同样的任务责任和依赖语义，文件任务采用硬依赖 |
| 原版依赖环校验 | 抽出共享 `domain/dependency-graph.ts`，原 Codex 与 SciencePAL 共同调用 |
| Git HEAD / 工作树证据 | 不可变文件字节、SHA-256、输入清单、真实 Agent/线程/沙箱身份 |
| 阶段完成门禁 | 所有任务真实产出且通过另一 Agent 的逐项评审 |
| 需求变更审核与人工应用 | CHANGE_REVIEW Run → 人工确认 → R+1 → 重新对齐与验证 |
| 房间、持久化与网页 | 继续使用原 Fastify Host、V20Repository SQLite 连接、房间 ID、React bundle 和 Markdown 展示组件 |

没有伪造 Codex 心跳、Git HEAD 或在原代码任务表中写假完成状态。SciencePAL 的阶段证据是文件，原版的阶段证据是 Git；因此使用适配后的持久化状态模型，共享 Host 和可复用的校验逻辑。原版 Codex 代码执行、Mock 接口并行集成和 Git 合并没有被宣称已经迁移。

## 实现位置

- `packages/protocol/src/sciencepal-pipeline.ts`：提案、对齐、任务、评审、需求变更、运行与历史版本。
- `apps/host/src/sciencepal/pipeline.ts`：唯一的派发决策与状态推进入口，后台 worker、持久化、防重、重启恢复、返工和版本切换。
- `apps/host/src/sciencepal/pipeline-contract.ts`：输出约定、文件回执校验、任务图校验、冲突原文引用、评审全覆盖检查、变更输出校验。
- `apps/host/src/sciencepal/client.ts`：沿用已经验证的官方 API，扩展 multipart 多附件传递；不增加 SDK 或框架依赖。
- `apps/host/src/sciencepal/routes.ts` / `app.ts`：挂到已有本机路由与 Host 生命周期。
- `apps/web/src/sciencepal/CollaborationWorkspace.tsx`：完整工作台，包括冲突裁决、发布、任务依赖、评审反馈、返工、变更审阅、历史证据。
- `apps/host/test/sciencepal-pipeline.test.ts`：行为与集成测试。

新增 `sciencepal_projects` 与 `sciencepal_pipeline_files` 两张表。前者保存项目快照与运行历史，后者保存不可变输入和输出 BLOB。原快速交接表保持兼容。

## 文件与评审约定

每个运行接收 `context.json` 和相关上游成果的实际文件。Host 内部冻结文件 ID、文件名、长度和哈希；预期哈希不写入给 Agent 的提示词。Agent 使用实际文件工具独立读取，并输出：

```json
{
  "revision": 1,
  "inputReceipts": [
    { "filename": "context.json", "sha256": "实际文件字节的 SHA-256", "size": 1234 }
  ],
  "result": "与运行种类相符的结构化结果"
}
```

每个实际附件都必须有且只有一份准确回执。Host 下载输出后核对身份、文件哈希、版本和运行归属，再校验业务结果。运行完成、文件存在、输入可信、评审通过是不同状态。

评审必须逐项覆盖原始验收标准，包含布尔判断、引用实际成果文件名的具体证据。任何验收项未通过或仍有修改要求，`approve` 都会被拒绝。`request_changes` 必须包含可执行的修改要求。审查属于 Agent 判断，不保证科研结论为真，重要结果仍需人工审阅。

## 本机接口

同样使用 `/api/sciencepal` 前缀和本机/Host/Origin/`X-Vibe-SciencePAL: 1` 校验。

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/projects` | 读取完整项目与运行快照 |
| POST | `/projects` | `{title, coordinatorId, proposals:[{agentId,content}], source?:{filename,base64,sourceUrl,attribution}, resultSchemas?:{taskKey:JSONSchema}}` |
| POST | `/projects/:id/commands/:action` | 显式的生命周期操作 |
| GET | `/projects/:id/artifacts/:artifactId` | 下载属于该项目的冻结证据 |
| GET | `/projects/:id/evidence?revision=N` | 从本机冻结字节重新核验并汇总该版本证据；添加 `download=1` 下载 JSON 报告 |

所有 command 请求带 `revision`，旧版本请求返回冲突。操作包括：

- `align`：启动首轮对齐。
- `rename`：另带 `title`，只更改显示名称并保留事件记录，不更改已冻结的提案和运行。
- `decide`：另带 `alignmentRunId`, `issueId`, `optionId`。
- `publish`：另带 `alignmentRunId`。
- `pause` / `resume`：暂停或恢复新派发。
- `rework`：另带 `taskKey`，可选 `note`；仅允许评审退回的任务。
- `retry`：另带 `runId`；仅允许确定失败或输出无效的步骤，已被替代的运行不能重复重试。
- `recover`：另带本地 `runId` 和远端 `threadId`；仅用于 UNKNOWN。只读取既有线程的运行列表，要求恰好一次运行、Agent/线程/时间吻合且未被其他项目绑定；不会重新发起远端任务。后续仍严格校验全部冻结输入与输出。
- `change`：另带 `request`。
- `apply-change` / `dismiss-change`：另带 `changeId`。

## 容错与当前范围

- 每项目 2–4 个 Agent，每轮 2–6 个任务；最多同时运行两个远端作业，同一个 Agent 在同项目中不并行执行两个作业。
- 每项目最多 32 次远端运行，每个任务最多 3 次执行。重试和返工均由人明确触发，不自动无限消耗额度。
- 每个运行的附件合计不超过 5 MiB，成果为 UTF-8 JSON。任务键是安全 ASCII 标识，输出文件名由 Host 生成，防止路径越界和文件名冲突。
- 可选研究源文件单个不超过 256 KiB，支持 UTF-8 CSV/TSV/TXT/JSON/DATA。名称须为 `source-` 前缀的安全 ASCII 名称；界面自动规范文件名。严格验证 Base64 和 UTF-8，保留 BOM、换行和原始字节。每次对齐、执行、评审和返工均发送同一冻结源文件；Agent 上下文提供来源和署名，不提供预期哈希。来源网址不触发 Host 抓取。当前不支持替换源文件；数据改变应新建项目。
- 网络导致提交结果不确定时标为 UNKNOWN 并阻止再次派发。重启遇到 STARTING 也如此；已有 Run ID 则继续观察。
- 采集后、校验前崩溃，会从已冻结的本机字节继续校验，不会悄悄用远端后续修改覆盖原证据。
- 认证错误保留在运行记录中；不泄露上游响应或 VNC 凭据。
- UNKNOWN 时可在页面填入 SciencePAL 对话地址中的 Thread ID，核对后接回原 Run。远端仍初始化时继续等待，不能绕过文件证据校验；接错线程的输出不能通过原输入哈希门禁。
- Agent 等待追问时标为 NEEDS_INPUT；目前没有完整的续聊、新 Run 绑定面板，需在 SciencePAL 核对。
- 任务退回阻止下游；在途任务可能继续完成，但不会自动绕过评审。变更申请只允许在无在途运行的稳定阶段，避免改写执行中的需求。
- 仅支持单账号、本机单 Host 进程；没有跨账号授权、团队部署权限系统或多进程数据库协调。

## 验证

完整流程测试 49 项，与快速交接测试合计 61 项全部通过；包括完整成功路径、冲突裁决、真实字节依赖、作者不得自审、退回返工、需求变更接受/拒绝、发布前变更影响评审、旧版本拦截、并发派发、暂停、重启恢复、未知提交防重和接回、错误身份/哈希/JSON、验收未通过却批准的拒绝。执行历史与证据回顾另外覆盖首次退回保留、评审重试关联、归档隔离、只读不派发、证据损坏拒绝、独立性及时序缺口、导出及接口访问边界。源文件 10 项测试覆盖完整流程原始字节保持、无预期哈希提示、无效输入拒绝及篡改后禁止派发；成果格式 13 项新增测试覆盖错误类型、缺字段、额外字段、无评审和下游调用、重试修复、不可被对齐覆盖、跨版本保持与不支持定义的拒绝。

构建与工作区类型检查通过。原 Host 全套测试仍有上游已有的 12 项失败，详情保存在本机 `data/sciencepal/evidence/host-regression-full.json`；这些失败已在先前未修改基线验证，不能宣称原项目全套测试通过。

真实成功及变更运行见 `SCIENCEPAL-COLLABORATION-LIVE.md`，真实退回返工闭环见 `SCIENCEPAL-REWORK-LIVE.md`。新增公开 UCI Iris 数据的真实复核见 `SCIENCEPAL-IRIS-LIVE.md`：两项任务均获批，本机独立复算通过 40 项检查。该次计划中的单位错误未复现，不能当作新一次退回返工证据。演示使用合成数据及有署名的公开数据，不读取或发送私人文件。

可对一个已完成的真实项目进行只读复核，不会再次调用 Agent：

```powershell
node apps/host/scripts/verify-sciencepal-live.mjs <项目UUID>
```

末尾可加版本号，例如 `... <项目UUID> 1`，只复核已归档的 R1。报告明确记录 scopeRevision 与当前项目状态，不把旧版本通过当作新版本完成。

该脚本下载每次运行自己的冻结输入和输出，按原始字节验证所有回执，并检查作者/评审身份、下游依赖版本和评审先于派发的时间关系，保存到 `data/sciencepal/evidence/<项目UUID>/`。特别避免把不同运行的同名 `context.json` 混为同一个文件。

当前仍为私有本地适配副本；沿用 `SCIENCEPAL-PROTOTYPE.md` 中的上游许可说明。成果格式校验将原已被 Fastify 间接安装的 MIT 许可 Ajv 8.20.0 声明为 Host 直接依赖，没有复制外部源码。此前其他实现继续沿用已有依赖。

恢复接口检索：`gh search repos sciencepal`。最相关候选 [x-zheng16/cc-sciencepal](https://github.com/x-zheng16/cc-sciencepal) 为 MIT、未归档、最近推送 2026-10-15，依赖 Python/uv/httpx，有测试。它的 README 提醒启动超时后应查询既有会话；本项目仅参考其行为说明，不安装也不复制源码。最终按 [SciencePAL 官方 SDK 文档](https://sciencepal.ai/help/sdk) 及其 0.2.2 SDK 的 `list_thread_runs` 接口独立实现原生 HTTP 适配。
