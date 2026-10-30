# 真实 Codex × SciencePAL 科研闭环

这套脚本只操作 `data/mixed-live-20261030` 对应的新项目，调用真实 SciencePAL Biology Agent，不使用模拟 Remote。Codex 部分由当前 Codex 编写并运行计算，再通过原成员 API 交回。两个工作流身份使用同一位用户的账号资源，不能据此宣称完成双账号联调。

## 数据与冻结方法

- 原始数据：[RCSB PDB 1CRN](https://www.rcsb.org/structure/1CRN)，使用仓库已保存的原始 PDB 字节，作为 `source-1crn.txt` 交接；SHA256 `42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811`。
- Codex 从 ATOM / SSBOND 字段重算 chain A 的原子数、残基数和 SG–SG 距离。
- SciencePAL 使用实际安装的 BioPython PDBParser 与 ShrakeRupley，960 球面点、1.4 Å 探针；原子半径 C=1.70、N=1.55、O=1.52、S=1.80 Å。[官方方法说明](https://biopython.org/docs/1.84/api/Bio.PDB.SASA.html)。
- Codex 使用独立 NumPy 5000 点实现复核；总面积容差 3%，六个 CYS 整残基面积容差 max(3 Å², 参考值的 5%)。
- 结论限于单结构描述性复算，不是新生物学发现，也不是模型能力排名。

## 明示的故障与人工门槛

首版几何候选故意把距离除以十而字段仍为 Å，用于检验真实评审是否拒绝。文件标注 `faultInjection:true`。这不是自然发生的模型失误。返工必须依据真实评审重新计算，原件不可覆盖。

SASA 前要求真实 Agent 用提问工具确认探针半径并停下来，观察真实 `asked`/`NEEDS_INPUT` 后，通过连接器提交操作人批准的 `1.4 Å`，验证原线程续跑。这是受控接续测试，不声称模型自然缺乏参数。

## 运行与恢复

在 npm 工作区运行。需先构建 Host 与 Web。凭据保持在项目外；只设置 `SCIENCEPAL_AUTH_FILE` 路径，不把 Key 写入命令或证据。

`node --use-env-proxy apps/host/scripts/live-mixed-research.mjs <action>`：

- `init`：仅首次建立本案例，已有状态则拒绝；失败初始化留存标记，不自动重建远端任务。
- `take` / `submit`：领取本人 Codex 任务、提交实际成果；新领取使用本机面板相同的任务目录。
- `command publish|rework|retry`：沿原队长权限操作，保留失败记录。
- `work`：领取或继续一个 SciencePAL 任务，保存日志与心跳；完成、等待输入或提交未知时停止；最多轮询十分钟。
- `reply "操作人答复"`：仅在真实等待输入时恢复原线程；禁止重复续接。
- `export`：保存冻结文件、全部运行、原始评审及阶段快照；无需 Key。
- `serve`：打开同一数据库的原版科研拓扑，独立端口，不改变旧演示。

状态、身份令牌与数据库在 `%LOCALAPPDATA%/VibeGit/live-mixed-20261030`，API Key 留在原来的授权文件。`operation.lock` 防并发写入；若发生崩溃，先核实记录的进程确实结束，再人工处理锁。提交未知不能重试 init/start，应核对原 SciencePAL 线程。

`codex_prepare.py TASK_DIRECTORY align|fault|correct` 生成本案例协议或执行实际几何计算。`verify.mjs` 只核验已经导出的证据，不调用远端、不伪造结果。新运行必须重新生成数据及独立基线，不把旧证据视为新执行。
