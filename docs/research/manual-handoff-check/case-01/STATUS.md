# 材料包 01：当时的项目记录

R1；快照时间 2026-10-30T21:38:33.343Z。这是已有记录，不是正在执行的任务。

队长：Captain。

| 任务 | 当前状态 | 第几次执行 | 作者 | 评审者 |
|---|---|---|---|---|
| sasa | APPROVED | 3 | Member-4BA0 | Captain |
| synthesis | RUNNING | 1 | Member-B65B | Captain |

状态原词：APPROVED=获批，CHANGES_REQUESTED=要求修改，REVIEWING=评审中，RUNNING=执行中，WAITING=待执行。

当前 sasa 执行 ID：`3deb50b2-e540-4a32-9acf-f88d7afdc71f`。当前评审运行 ID：`c47cc007-164f-42f0-9fcc-281de181baa1`。

以下为冻结文件索引，不是审批结论。

| 文件 | SHA256 |
|---|---|
| [source-1CRN.pdb](source-1CRN.pdb) | `42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811` |
| [sasa.json](sasa.json) | `57217210b2e6be2bd915f65315792c3466c7ac5a22b5f149be98d16330252ede` |
| [review-result.json](review-result.json) | `c2153ad17cbdd6ceeb0b2b8fc1793f1dcb8707dd25d694edaf877a7b39efc820` |

[原研究协议](protocol.md) · [数值检查原记录](numeric-checks.json) · [当前评审原文件](review-result.json)

评审中的 `inputReceipts` 表示它实际读过哪个版本。不要把不同运行的 context.json 哈希互相比。这里只核查交接依据，不重跑附件代码。
