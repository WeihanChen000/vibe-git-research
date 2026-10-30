# 真实 Iris 跨平台验收

此目录属于真实账号验证，不替换原来的模拟实验。当前 Codex 从自己领取的任务目录执行 Python；SciencePAL 原生 Biology 在账号的远端沙箱运行。一个账号的两个成员身份不是两个真实用户。

普通队友使用原拓扑的项目菜单、我的提案、算力网和右侧待办即可。Codex 的“准备本人任务包”只准备文件：把复制出的说明交给本人 Codex，完成后回到原待办检查交回。SciencePAL 本人启动连接器后自动领取自己负责的任务与评审。

## 本地开发者验证入口

- `node --use-env-proxy apps/host/scripts/live-iris-ui.mjs serve`：创建/恢复隔离的真实 Host 与两个本机入口，默认保存在 `%LOCALAPPDATA%/VibeGit/live-iris-ui-20261030`；可用 `VIBE_GIT_IRIS_LIVE_ROOT` 指定目录。不要同时启动第二个实例。
- 从终端返回的 `/captain`、`/member` 打开原界面，分别绑定 Codex 和本人的 Biology，保存各自提案。上传官方 CSV 并使用 Iris 模板冻结输出格式，然后建项、对齐、发布。
- `python codex.py <本人任务目录> align|correct|review <待交回成果路径>`：本次实际使用的 Codex 计算助手。它会核对所有输入字节，不会调用远端模型、领取他人任务或自动提交。
- `fault` 模式仅用于明确披露的返工测试：只改变首版未获批候选的一个数值，绝不改原始 CSV。正常项目不要使用此模式。
- `review` 还要求当前 Codex 阅读候选、写入 `scientific-interpretation.json`：包含确切候选的 `candidateSha256`、布尔 `passed` 和解释性 `evidence`。数值自动复算，科学结论的语义由当前审阅者判断。
- `live-iris-ui.mjs status` 只读简要状态；`export` 保存实际输入、成果和每个阶段快照到开发目录 `data/iris-live-ui-20261030`。该目录不进入接入包。
- `capture-iris-remote.mjs <导出项目目录> <本地运行ID> [已观察到的脚本名]` 只读保存真实运行身份与脚本；凭据只从本机 `SCIENCEPAL_AUTH_FILE` 读取，不写入证据。
- 完成后运行 `python verify.py <导出项目目录>`，检查完整回执、独立评审、数值复算、受控错误返工、自然交付缺陷返工与获批文件交接。

统计只支持公开历史 Iris 数据的描述性复核，不宣称新的植物学发现，也不证明某个平台比其他平台更强。完整实际结果见根目录 `SCIENCEPAL-IRIS-LIVE-RESULT.md`。
