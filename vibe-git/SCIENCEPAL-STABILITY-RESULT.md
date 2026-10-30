# 接入稳定性修复：依赖与 NEEDS_INPUT

2026-10-30，北京时间。范围是当前 npm 科研原型与成员连接器；真人双账号联调仍待队友接入。

## 依赖修复

此前 npm 审计为 10 项，其中生产依赖 2 项。交付包干净安装后的全量与生产依赖 npm 审计均为 0 项。使用锁文件 `npm ci`，不以旧 pnpm 锁文件代替本包安装流程。

| 组件 | 当前锁定版本 |
| --- | --- |
| Vitest / mocker | 5.0.5 |
| Vite | 7.3.7 |
| Fastify | 5.12.7 |
| fast-uri | 3.1.9 / 4.2.3 |
| concurrently / shell-quote | 9.2.5 / 1.12.0 |
| source-map-js / postcss-selector-parser | 1.2.2 / 6.1.5 |

GitHub 搜索查询：`vitest in:name org:vitest-dev`。保留官方 [vitest-dev/vitest](https://github.com/vitest-dev/vitest)：MIT、未归档、最近推送 2026-10-29，5.0.5 发布于 2026-10-15；检查 README、包依赖和 [迁移说明](https://vitest.dev/guide/migration/)。沿用现有框架，仅开发依赖升级，不复制仓库代码，不添加第二套框架；卸掉了旧版本的部分传递依赖。搜索返回的 ESLint 插件不解决此问题，未采用。

## 续接行为

- 网页答复：原 run 等待输入时查询同一线程，核对专家、时间、已知历史；只有唯一新 run 才自动接回。不新建线程、不发送替代答复。
- 本机答复：`reply PROJECT ANSWER.md` 在持有本人连接器锁时先保存 messageId、原文及哈希，再调用原线程的消息与 start 接口。答复正文只保留在成员本机日志，Host 保存哈希及来源。
- 消息回执丢失可用同一 messageId/content 重试；start 无幂等保证，启动前写日志，未知结果只查询，不重发。明确拒绝的 start 可以重试，已保存消息不再重复发送。
- Host 对续接做成员鉴权、原线程校验、当前运行的条件更新、幂等回执和追加历史；旧 run 迟到成果拒收。历史包含旧/新 run ID、时间和答复来源。
- 每个任务最多续接 6 次，计入项目 32 次运行预算。认证失败、多个候选或身份不符时停止核对；临时网络/429/5xx 对可安全重试的阶段退避，最长 30 秒。未知启动不因“还没查到”而重发。

接口依据 [SciencePAL 官方 SDK 帮助](https://sciencepal.ai/help/sdk)：先向原线程追加带 message_id 的答复，再 start；asked 不是完成，也不授权替用户猜答案。

## 真实平台探测

单一真实账号、两个合成成员身份；有意触发等待输入，只验证连接器生命周期，不计作跨账号或新科研发现。

- 原线程：`68b1161d-8187-4760-bce9-2f4be5e86d2d`
- 原 run：`36567f2d-abdc-4a93-ad9b-6fdc9c10a928`，平台实际状态 **asked**。
- 本机 reply 后新 run：`891d8eb4-7765-42e8-9dfe-c50f30efd4e0`，平台实际状态 **completed**。
- 新结果已采集为 COLLECTED，原始附件回执与对齐结构通过 Host 校验，项目到 READY。没有发布后续合成任务。
- 6 项实测检查通过，包括原线程保留、旧状态、新状态、新 run、冻结成果及 Host 验收。

维护者本地原始证据：`data/team-continuation-live/verification.json`、`align-result.json`；该数据目录不随队友源码包发送。复现实测工具为 `apps/host/scripts/verify-member-continuation-live.mjs`，只有明确运行 init/reply 才消耗 SciencePAL 额度。

## 验证范围与遗留项

交付包干净安装后的科研回归 108 项通过，覆盖消息/启动/Host 回执丢失、崩溃重启、错误身份、并发候选、暂停、撤销成员、预算上限、迟到成果和完整双成员返工/R2。原 CLI 的 5 项测试亦通过。依赖升级后的完整构建及类型检查通过。

完整 `npm test` 仍有旧软件协作流程的 **12 个既有失败**（v20 10 个、v21 2 个，伴随失败后的 SQLite 文件未关闭）；用上轮 ZIP 的旧依赖版本复跑，得到相同 12 个失败，故不是本轮引入。没有删除测试、改成 skip 或放宽成员权限掩盖失败。科研专用回归通过不代表整个历史软件分支全绿，这些旧测试与契约需单独整修。

最终 ZIP 的干净安装、审计、科研测试数量与 SHA-256 记录在维护者 `data/team-onboarding/verification.json`。真人不同账号、外部网络稳定性和用户对真实科研问题的答复仍须按 [验收表](SCIENCEPAL-TEAM-ACCEPTANCE.md) 完成；本轮未打开公网隧道或替换现有运行服务。
