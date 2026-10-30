# Vibe-Git × SciencePAL：本地最小可用原型

> 已升级：完整的自动对齐、依赖执行、交叉评审、返工和需求变更流程见 [SCIENCEPAL-COLLABORATION.md](SCIENCEPAL-COLLABORATION.md)。现在 `/sciencepal` 默认打开完整流程；本文记录的快速交接入口改为 `/sciencepal/handoff`，以下能力边界和测试数字保留为第一版历史记录。

这是在原 Vibe-Git 源码中新增的 SciencePAL 专用协作模式。复用原有 Fastify Host、SQLite 数据库、房间 ID、React 构建与静态资源服务；在原版工作台工具栏提供入口。

第一版将“本机 Codex 节点执行代码”替换为“绑定远端 SciencePAL Agent 执行任务”，建立 A → 文件成果 → B 的真实依赖。SciencePAL 工作流使用独立持久化表，不会伪造 Codex 节点心跳、Git HEAD 或旧版阶段任务完成状态。

## 启动

在本目录执行，已验证环境为 Windows、Node 26.1、npm 11。

```powershell
npm ci
npm run build
# 二选一配置：进程环境变量 SCIENCEPAL_API_KEY，或外部 JSON 文件。
# 文件内容为 {"apiKey":"你的密钥"}；不要存入 Git 仓库。
$env:SCIENCEPAL_AUTH_FILE = 'C:\你的私有目录\sciencepal-auth.json'
npm run sciencepal
```

打开 <http://127.0.0.1:8788/sciencepal>。默认只监听 127.0.0.1，不建立公网隧道。端口可以通过 `PORT` 改变。

数据保存在本目录 `data/sciencepal/`，已被 Git 忽略。保留这个目录即可保留协作记录、原始文件和回执。`VIBE_GIT_DATA_DIR` 可以指定其他专用数据目录。不要同时启动两个进程写入同一个数据库。

如果使用已有 Vibe-Git Host，可设置 `SCIENCEPAL_ENABLED=1` 并配置密钥，然后从 `/sciencepal` 进入，复用这个 Host 的房间。第一版的 SciencePAL API 始终限制本机访问。原版工作台的权限和 CLI 登录方式仍按上游实现。

`npm run sciencepal` 使用 Node 的环境代理支持；如本机需代理，使用现有的 `HTTP_PROXY` / `HTTPS_PROXY`，并将 `127.0.0.1,localhost,::1` 放在 `NO_PROXY` 中。

## 使用流程

1. 从账号中选择两个不同的 Agent；可复用先前验证创建的 Handoff A 与 B。
2. 填写协作标题、A/B 各自任务、A 的输出文件名。默认演示使用明确标注的模拟实验数据。
3. 创建流程后点击 **启动 A**。创建流程本身不会启动远端运行。
4. A 真实运行完成后点击 **采集成果文件**。Host 验证线程 Agent 身份，从沙箱读取文件，并持久化原始字节、长度、SHA-256。
5. 点击 **交接文件并启动 B**。Host 将冻结文件作为 multipart `files` 发送给 B，不会把文件内容和预期哈希抄进提示词。
6. B 完成后点击 **采集回执与结果**。B 输出 `receipt.json`，其中 `result` 包含任务结果。
7. 点击 **核验文件交接**。核对两个 Agent/线程/沙箱、输入文件版本、文件名、大小、独立计算的哈希以及结果字段。通过不代表科研结论正确，仍需审阅结果。

文件可直接预览或下载；刷新页面、重启 Host 后保留记录。仅浏览器打开时定期同步所选流程；关闭浏览器不会取消远端任务，再打开后可手动刷新。

## 最小输出契约

A 必须在 `/workspace/<指定文件名>` 生成实际文件，单文件不超过 5 MiB。文件名只允许字母、数字、下划线、点和连字符，不能包含目录，不能使用保留的 `receipt.json`。

B 的真实附件会包含 A 文件。Host 自动追加以下回执要求：

```json
{
  "input_filename": "experiment.json",
  "input_sha256": "从实际文件字节独立计算的 SHA-256",
  "input_size_bytes": 1234,
  "read_method": "python_file_bytes",
  "result": { "你的任务结果": "可以是对象、列表或文本" }
}
```

`read_method` 是 B 的声明，字节数与 SHA-256 是 Host 能独立核对的证据。此原型没有声称监控 B 的全部工具执行过程。

## 与原项目的接入位置

| 层 | 文件 | 作用 |
|---|---|---|
| 共享协议 | `packages/protocol/src/sciencepal.ts` | 任务、Agent、成果、校验结果的数据类型 |
| 远端 API | `apps/host/src/sciencepal/client.ts` | 原生 fetch/FormData、状态读取、沙箱文件下载；没有新增 SDK 依赖 |
| 编排与存储 | `apps/host/src/sciencepal/service.ts` | 复用 V20Repository 的 SQLite 连接与房间 ID，保存两 Agent 依赖及不可变成果 |
| Host 路由 | `apps/host/src/sciencepal/routes.ts`、`apps/host/src/app.ts` | 新模式挂载到原 Host，本机校验和防跨站请求 |
| 启动入口 | `apps/host/src/sciencepal/main.ts` | 仅监听回环地址，独立原型数据目录 |
| React 页面 | `apps/web/src/sciencepal/SciencePALWorkspace.tsx` | 任务配置、依赖状态、成果预览、核验、协作日志 |
| 原版入口 | `apps/web/src/main.tsx`、`canvas/TopCommandBar.tsx` | 同一前端 bundle 中切换 SciencePAL 模式 |
| 测试 | `apps/host/test/sciencepal.test.ts` | 文件交接、重复提交、重启恢复、身份/哈希不符、访问边界 |

新增两张表：`sciencepal_workflows` 存工作流 JSON；`sciencepal_artifacts` 存文件字节。文件元数据与字节在同一 SQLite 事务中写入。

## API

本机 API 前缀 `/api/sciencepal`。POST 需要 `Content-Type: application/json` 和 `X-Vibe-SciencePAL: 1`；浏览器 Origin 必须与 Host 一致。拒绝远端连接、非回环 Host、伪造的 X-Forwarded-For。

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/state` | 本地持久化状态，不包含密钥 |
| GET | `/agents` | 当前账号 Agent 列表 |
| POST | `/workflows` | 创建并冻结分工，校验两个 Agent 不同 |
| POST | `/workflows/:id/:role/start` | `producer` / `consumer` 显式启动 |
| POST | `/workflows/:id/sync` | 查询已知远端 Run |
| POST | `/workflows/:id/:role/collect` | 校验身份、下载并冻结成果 |
| GET | `/workflows/:id/artifacts/:artifactId` | 下载所属工作流文件，返回哈希头 |
| POST | `/workflows/:id/verify` | 独立核对 B 回执 |

创建参数：`title`, `producerAgentId`, `consumerAgentId`, `producerPrompt`, `consumerPrompt`, `outputFilename`。

使用的官方服务：`https://sciencepal.ai/api`。Agent 启动走 `/agent/initiate`，状态走 `/agent-run/:id`，身份和沙箱走 `/thread/:id/agent` 与 `/thread/:id/sandbox`，成果走 `/sandboxes/:id/files/content`。

## 故障语义与边界

- `COMPLETED` 只表示远端运行结束；必须采集真实文件才能解锁 B。
- 网络错误、超时、服务端错误或响应无法解析时，提交可能已经成功：标为 `UNKNOWN`，禁止自动重发。需要到 SciencePAL 核对，第一版尚无人工绑定未知 Run 的恢复界面。
- 重启时 `STARTING` 转为 `UNKNOWN`；已有 Run ID 的任务继续同步，绝不重新创建运行。
- 同一流程的并发操作互斥；重复启动返回冲突。已冻结成果不覆盖，传给 B 前再次校验本地哈希。
- 401/403 会显示认证错误，不输出远端响应中的潜在凭据。密钥仅由 Host 读取；沙箱 VNC URL 等字段会被丢弃。
- `asked` / `paused` 显示需要补充信息；本版没有完整的续聊和新 Run 追踪，需要在 SciencePAL 处理后另行接入恢复功能。
- 当前是**单账号、两个 Agent、一个文件、串行依赖**。没有多用户权限、跨账号共享、并行 DAG、多个附件、自动内容评审或 Git 变更合并。
- 原项目的提案自动对齐、合同门禁、阶段重编排仍是 Codex 流程。本版没有将其假装成 SciencePAL 能力；后续可以在此真实交接链上迁移。
- 原始任务提示和文件保存在本机数据库；演示使用合成数据，没有上传用户私人文件。

## 验证结果

- `npm run build`：通过（存在原有大型前端 bundle 提示）。
- `npm run typecheck`：通过。
- `npm run test:sciencepal`：12/12 通过。
- `npm run test -w @vibe-git/cli`：5/5 通过。
- 上游 Host 测试：4 通过、12 失败。在完整未修改的 `f3e888f796f06cc6d219d368ac547969adfb3b47` 归档中、同 Node/锁文件环境下复现了相同 12 项失败（阶段/对齐预期与实际不一致，失败后还出现 Windows SQLite 文件未释放问题）。这次没有扩大范围修复这些上游问题，也不能宣称上游全套测试通过。
- 真实网页操作与运行证据见本机 `data/sciencepal/` 数据库及 `SCIENCEPAL-LIVE-RESULT.md`。

## 源码与复用说明

基线为 TFboy1/vibe-git 的公开提交 `f3e888f796f06cc6d219d368ac547969adfb3b47`，本地分支 `codex/sciencepal-prototype`。上游未发现明确许可证，因此当前副本按个人本地、私有研究使用；公开分发或部署前需获得上游许可。

前期复用检索查询为 `sciencepal` 和 `agent client protocol`。参考候选 cc-sciencepal（MIT）与 Agent Client Protocol（Apache-2.0）的接入思路；本版未复制其实现、未引入其依赖，使用已经实测的官方 HTTP API，与原项目已有框架集成。
