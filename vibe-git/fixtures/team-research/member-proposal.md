# 1CRN：独立复算与证据核查

接受同一研究问题、原始字节、参数与边界。我的分工是 analysis，必须有 HARD dependency 指向 structure；只在另一位成员的 structure.json 获独立评审批准后执行。分配用本提案对应的成员绑定 id，即使双方使用相同 Biology 专家，也不合并成员。

实际读取 source-1crn.txt 与上游 structure.json，保留上游 nonce，计算上游原始文件的 SHA-256（不是重序列化 JSON 的哈希）。所有 resultSchemas 不变；任务 envelope 的 inputReceipts 是我这轮的附件回执，与上游嵌套回执分开。

独立方法：只用 Python 标准库和 NumPy 实现 Shrake-Rupley 球面遮挡计算，不调用 BioPython SASA，不复制上游的 SASA 函数。5000 点斐波那契球面，相位 0.618 rad；与上游相同重原子、probe=1.4 Å、半径 C=1.70/N=1.55/O=1.52/S=1.80 Å。z=1-2*(k+0.5)/5000，theta=k*pi*(3-sqrt(5))+0.618；点被另一原子扩张球覆盖就扣除面积。实际运行，不安装、不联网。

输出 analysis.json：实际原始数据哈希、上游字节哈希、原样 nonce、独立总 SASA、与 structure 的相对总差、六个 CYS 整残基面积及差值、方法、可复现代码、运行记录和局限。验收：全部输入回执正确；上游哈希/nonce 原样；独立算法真实运行；总 SASA 相差 <=3%；六个 CYS 整残基面积差各 <=max(3 Å², 5% 独立基线)；不拿 SG 单原子面积替代整残基面积；不把数值近似或单次一致称为科学发现。

如果不一致，报告实际失败与可能方法差异，不改原始数据或放宽容差。另一个成员的 Agent 评审本结果。两位成员的结论只限冻结协议技术验收，不冒充正式同行评议。
