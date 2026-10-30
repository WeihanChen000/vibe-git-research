# 原型真实闭环验证 · 2026-10-29

结论：从 Vibe-Git 新增的 SciencePAL 工作台创建、启动并完成了一次真实双 Agent 文件协作。不是之前独立探针脚本的结果复用，也没有模拟远端执行。

## 执行链

- 本地入口：<http://127.0.0.1:8788/sciencepal>
- 工作流 ID：`72069628-7d63-4772-aead-7aec6368e73d`
- 共享 Vibe-Git 房间：`8ee36d98-ffa4-4352-83fe-e35d9f551c2d`
- 任务：A 生成明确标注 simulated 的实验数据，B 读取原文件、独立计算两组的样本数、均值、样本标准差和均值差，并回传随机标识。
- 网页实际操作：创建流程 → 启动 A → 采集 A 文件 → 交接并启动 B → 采集 B 回执 → 核验 → 查看结果内容。

| 角色 | 真实 Agent | 真实 Run |
|---|---|---|
| A | `d3b9e520-3ae0-46d0-a2a9-d3df80f5c23d` | `024ff7b1-f506-4b02-9e5d-f34111931c74` |
| B | `ba5dc9e9-a01c-4563-848f-5c2a082de793` | `5e504b13-49a3-4d3b-9ad1-7cde07727b75` |

[A 的 SciencePAL 记录](https://sciencepal.ai/projects/14959291-3b20-4dc1-90a4-acf3114de486/thread/d789058b-b939-49bd-a045-47c28acf0137)

[B 的 SciencePAL 记录](https://sciencepal.ai/projects/d49d5d2a-0246-4253-b497-7c47e4226914/thread/23e27bc0-1cf7-424d-aeed-beb924be08c2)

## 文件证据

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| A / experiment.json | 1,379 | `864eb0b9ece58b4747d94eab3fe5c5c5e60f9fd7b4e3344d449ff0c931350c2d` |
| B / receipt.json | 1,202 | `76f8cff7ca4aa4fb8521ca90a3b68bf8ee02b9db5bc0b99250378f60f368dd28` |

B 报告的输入 SHA-256 与 Host 保存的 A 文件完全一致，字节数一致。B 的启动提示没有携带输入内容或预期哈希，附件发送的是已冻结的原始字节。两端身份分别通过 SciencePAL 的线程 Agent 接口核对，线程与沙箱不同。

工作台的 8 项交接检查全部通过。本机再独立运行 Python 校验原文件与回执，12 项检查全部通过：哈希、大小、合成数据标记、两组样本数/均值/样本标准差/随机标识、组间均值差。

| 结果 | control | treatment |
|---|---:|---:|
| 样本数 | 5 | 5 |
| 均值 | 1.354 | 2.238 |
| 样本标准差 | 0.2180137610 | 0.2227554713 |

treatment − control 均值差为 0.884。以上是模拟数据的流程验证，不能作为真实科学发现。

## 恢复和测试

A 提交后重启过 Host；重新打开页面仍读取原 Run ID，采集并继续 B 成功，没有产生额外 A Run。单元与路由测试另外验证了提交超时或中途崩溃转为 UNKNOWN、禁止重复启动、缺少成果时阻止 B、身份/哈希不符时拒绝通过。

新增测试 12/12、CLI 5/5、构建和类型检查通过。上游原有 Host 测试的 12 项失败在未修改基线复现，详见 `SCIENCEPAL-PROTOTYPE.md`。

## 本机原始证据

- `data/sciencepal/workspace.db`：运行、事件、文件 BLOB。
- `data/sciencepal/evidence/workflow.json`：脱敏的工作流快照。
- `data/sciencepal/evidence/experiment.json`：A 文件。
- `data/sciencepal/evidence/receipt.json`：B 文件。
- `data/sciencepal/evidence/independent-verification.json`：独立 Python 复算检查结果。

这些运行数据被 Git 忽略。密钥不在这些证据中，沿用先前获准创建的临时 Key；到期后换用新的本机配置即可，历史记录不受影响。
