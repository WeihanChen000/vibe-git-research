# 独立浏览器验收环境

用于已有的 `verify-workflow-experiments.mjs` 自动模拟，不是产品运行依赖。只启动独立、无登录资料的无头 Chromium；Agent 使用确定性模拟输出，不调用 Codex / SciencePAL 账号。

## Windows 首次配置

Node.js 24+。在 PowerShell 执行：

```powershell
$browserTools = Join-Path $env:LOCALAPPDATA 'VibeGit/browser-tests'
npm install --prefix $browserTools --save-exact --ignore-scripts --no-audit --no-fund playwright-core@1.60.0
node (Join-Path $browserTools 'node_modules/playwright-core/cli.js') install chromium
```

固定使用已验证的 Playwright 1.60.0，配套 Chromium 148.0.7778.96 / revision 1223。安装器可复用同版本缓存；不用更新系统 Chrome/Edge 或读取个人浏览器资料。工具约 13 MB，浏览器首次下载另需空间。不要把 browser-tests/node_modules 或浏览器二进制上传仓库。

官方来源：[microsoft/playwright](https://github.com/microsoft/playwright)，Apache-2.0；2026-10-31 核对为未归档且仍在维护。本次定向检索 `repo:microsoft/playwright`，采用其官方 npm 工具，不复制其源码、不新增产品依赖。

## 启动检查与完整模拟

从仓库的 `vibe-git` 目录运行：

```powershell
node scripts/run-workflow-browser.mjs --check
node scripts/run-workflow-browser.mjs
```

第一条验证模块、浏览器启动及页面点击。第二条先做同样检查，再跑两套实验的建项、对齐、防偏移、评审、返工和报告变更复用。

新克隆或修改产品代码后，先 `npm ci` 和 `npm run build`。启动器不自动安装产品依赖或重新构建，不应把旧 dist 当成当前源码的验收。

每次结果写入仓库忽略目录 `output/browser-tests/<UTC时间>/`，保留 summary.json、失败页面和截图。模拟服务只监听本机。历史真实科研证据不会被覆盖。

## 自定义安装位置 / 其他系统

使用与浏览器匹配的固定版本，并将模块文件传给启动器：

```powershell
$env:PLAYWRIGHT_MODULE = '独立安装目录/node_modules/playwright-core/index.mjs'
node scripts/run-workflow-browser.mjs --check
node scripts/run-workflow-browser.mjs
```

此变量只影响当前终端，不修改系统 PATH。其他系统可用对应 shell 设置同名变量；本轮实际验收仅在 Windows 完成。浏览器安装路径被自定义时，还需按 Playwright 的标准配置提供 PLAYWRIGHT_BROWSERS_PATH。

## 常见失败

- 找不到模块：确认安装在上述目录，或设置 PLAYWRIGHT_MODULE 到实际 index.mjs；不能只安装浏览器。
- 浏览器文件不存在：使用同一份 playwright-core/cli.js 执行 install chromium；不能将不匹配缓存目录随意改名。
- 页面按钮超时：环境可能已经正常；检查失败截图和 summary，确认脚本定位与当前界面一致，不要靠放宽业务断言使测试通过。
- 端口/权限失败：脚本需要本机临时监听端口和独立浏览器进程权限；不用改 Wi-Fi、防火墙或重启系统。
- 未 build：先构建当前代码，再重跑。

本轮发现并修正旧脚本仍点击“我的研究变更”的问题，改为新工作台导航“工作台”。没有改动产品、权限或科学检查标准。

## 2026-10-31 实际验收

独立模块和匹配浏览器启动通过；修正过期按钮定位后，传感器标定、一级反应动力学各 12 项检查通过，共 24 项；两者均完成 R1、R2，每套记录 91 次界面点击/填写动作，浏览器运行时错误为 0。涵盖遗漏需求、方法/数值错误、评审越权、合法返工、评审重试不重算、文件交接及报告变更复用。[可公开检查摘要](evidence/browser-environment-20261031.json)。动作计数不是效率指标，也不代表真人操作负担。

第一轮环境启动已成功，但旧按钮定位失败；失败输出保留在本机忽略目录，后续成功结果来自新的独立目录。没有将失败样本覆盖成通过。浏览器自动模拟不替代真实账号、跨电脑或普通用户可用性验证。
