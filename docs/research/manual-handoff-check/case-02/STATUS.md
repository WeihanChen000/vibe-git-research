# 材料包 02：当时的项目记录

R1；快照时间 2026-10-30T21:26:48.287Z。这是已有记录，不是正在执行的任务。

队长：Captain。

| 任务 | 当前状态 | 第几次执行 | 作者 | 评审者 |
|---|---|---|---|---|
| sasa | CHANGES_REQUESTED | 3 | Member-4BA0 | Captain |
| synthesis | WAITING | 0 | Member-B65B | Captain |

状态原词：APPROVED=获批，CHANGES_REQUESTED=要求修改，REVIEWING=评审中，RUNNING=执行中，WAITING=待执行。

当前 sasa 执行 ID：`3deb50b2-e540-4a32-9acf-f88d7afdc71f`。当前评审运行 ID：`e836fb27-70cb-41ed-a84e-7ce657966b8b`。

以下为冻结文件索引，不是审批结论。

| 文件 | SHA256 |
|---|---|
| [source-1CRN.pdb](source-1CRN.pdb) | `42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811` |
| [sasa.json](sasa.json) | `57217210b2e6be2bd915f65315792c3466c7ac5a22b5f149be98d16330252ede` |
| [review-result.json](review-result.json) | `7edbbc0fe3aa637ff6916c43eba1ee997ea9d408cf5e641d8ce5fd705eee896e` |

[原研究协议](protocol.md) · [数值检查原记录](numeric-checks.json) · [当前评审原文件](review-result.json)

评审中的 `inputReceipts` 表示它实际读过哪个版本。不要把不同运行的 context.json 哈希互相比。这里只核查交接依据，不重跑附件代码。
