# 1CRN：领域计算与复现

研究问题：公开 crambin 结构中三对二硫键的 SG 距离、总溶剂可及表面积与六个半胱氨酸的整残基面积是多少？描述性复算，不推断功能或药效。全队仅设置 structure、analysis 两个任务，遵守冻结 resultSchemas。提案作者负责 structure，另一位成员负责 analysis；分配使用 context.agents 中与本提案对应的成员绑定 id，不能用 runtimeAgentId 替换。

原始附件 source-1crn.txt 是未经改写的 1CRN PDB 字节，SHA-256 为 42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811。固定 model 0、chain A、标准 ATOM 重原子，排除氢和 HETATM；原始字节不重下载、不编辑。不联网、不安装依赖、不改个人记忆/Skills。

structure：使用实际 BioPython PDBParser 与 ShrakeRupley，probe=1.4 Å，半径 C=1.70/N=1.55/O=1.52/S=1.80 Å，960 个球面点。输出所有 46 残基 SASA、327 重原子、总 SASA，以及依据 SSBOND 和实际 SG 坐标计算的三对距离。记录实际工具版本、参数、可复现 Python 代码、运行输出和局限。生成 secrets.token_hex(16) nonce，只用于验证真实文件交接。使用标准 envelope 输出 structure.json；不要另起任意命名任务或增减冻结字段。

验收（对齐时合并成不超过 8 项且不丢要求）：原始哈希正确；327 原子/46 残基；三对 SSBOND 坐标距离正确；参数完整且总面积等于逐残基加和；真实工具与可复现代码；nonce 非空；科学结论限于静态结构，绝对 SASA 不称为标准化暴露百分比。

另一位成员先独立评审 structure.json，批准后才派发 analysis。我的 Agent 随后评审对方 analysis.json，必须核对真实上游文件、独立复算方法与数值，不能仅看“passed=true”就批准。失败返回具体要求，保留所有旧版本。
