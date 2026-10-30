# UCI Iris 数据来源

Fisher, R. (1936). Iris [Dataset]. UCI Machine Learning Repository. DOI: https://doi.org/10.24432/C56C76.

- 官方页面：https://archive.ics.uci.edu/dataset/53/iris
- 官方归档：https://archive.ics.uci.edu/static/public/53/iris.zip
- 许可：Creative Commons Attribution 4.0 International（CC BY 4.0），https://creativecommons.org/licenses/by/4.0/
- 获取日期：2026-10-29。
- 采用归档中的 `bezdekIris.data` 原始字节，SHA-256 `0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc`，4551 字节。
- 上传及内置示例仅改文件名为 `source-iris.csv` / `iris.data`，无表头，不修改记录、行序或换行。源数据 150 行，三个物种各 50 条。
- 官方变量单位为 cm；列顺序是 sepal length、sepal width、petal length、petal width、class。
- 官方页面记录了不同历史数据版本的行差异。本案例固定使用上述 `bezdekIris.data`，以实际上传字节复算，不混用库内置变体或静默纠正源文件。

原 `iris.names` 作为来源说明保留。当前模板执行来源、单位和统计复核，不要求制造错误。初次真实试验曾在提案中要求首轮输出 mm，但 Agent 首次就输出了正确的 cm，因此单位错误测试未复现，不能宣称发生了单位错误退回。原提案和成果保留，详见 `../../SCIENCEPAL-IRIS-LIVE.md`。整个过程没有修改官方源文件，也不构成新的植物学发现。

GitHub 复用检索：`gh search repos "iris dataset UCI" --limit 3`。最相关候选 `GraysonWills/kaggle-iris-dataset-uci` 未归档，最近推送 2026-03-04，无许可证；README 是简短的 Kaggle 镜像读取示例，依赖 pandas，并无本项目需要的字节溯源/单位核验能力。无许可证仅可作为私有本地参考，本项目没有采用其数据或代码。其余结果为更早的 Iris 分析作业，未进一步读取。最终仅直接使用官方 CC BY 4.0 数据，自行实现，不增加依赖。
