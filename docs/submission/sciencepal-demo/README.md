# SciencePAL 新建公开材料复核演示

这里保存 SciencePAL 实际输出的原始 JSON 和 Python 源码，不修改字节。它是对四份公开附件的附加独立检查，未重跑 SASA 几何采样，不替代完整协作记录。

原结果 SHA256：1f41a94bd5954881e5a6ffff633c7a5d447c1a1e6d410c6b92b96828e15dba8b。

运行脚本需要 Python 标准库；它读取当前目录四份文件并写 judge-verification.json，因此**请在单独目录重跑，不覆盖本目录原件**：

| fixtures/integrated-live 原文件 | 复制后的名称 |
|---|---|
| source-1crn.pdb | source-1CRN.pdb |
| d66660eb-1ad0-4bb2-8730-ecb834277164.json | sasa.json |
| a9c9ccd2-1fa3-4199-92bb-74f1fa10a5ab.json | approved-review.json |
| ca091406-6cdc-49f1-b15c-67a3279a0f80.json | synthesis.json |

复制脚本到同一目录后执行 `python judge-verification-source.py`。预期五项 PASS。新生成文件含当前时间与本机版本，哈希不应要求等于原远端产物。

源码已做静态检查：只读取上述文件和自身源码、查询已安装包版本并写当前目录结果，不访问网络或执行附件中的代码。检查 1 只计算哈希和大小，输入身份仍须与仓库冻结清单比较；这是针对该案例的复核，不是通用安全验证器。

原 JSON 将 synthesis 的提交时状态记录为 pending review，这是原产物的不可变字段。后续 Biology 终审在完整联调记录中已批准；本精简演示没有附带终审文件，不能用它单独证实全项目完成。

本次新页面显示执行模型 GLM-5.3；先前完整联调页面显示 GPT-6.1-sol-high。仅记录页面所示，不根据不同时间的默认模型推断质量对照，也不改写旧运行记录。
