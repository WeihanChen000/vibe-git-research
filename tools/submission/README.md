# 可编辑制作源：交给接手队友

本目录补齐此前只保存在本机的有用材料。**它不是新版本成片，也不表示现有视频已获用户认可。** 当前视频被指出操作画面太小，需要接手人重剪。

## 文件

- `scenes.json`：12 段标题、英文旁白、中文字幕及画面类型。与现有 final-20261031-v1 MP4 同源。
- `audio/voice-00-0.mp3` 至 `voice-11-1.mp3`：24 段已生成英文 Aria 配音，顺序对应场景两段旁白。直接剪辑不必调用 TTS。
- `pdf-pages.json`：五页正文、标题与链接。
- `render.py`：旧版视频的可重建脚本；它会重现偏文字卡片的版式，**不是推荐的重剪方案**。
- `pdf.py`：PDF 制作源。
- `voices.py`：可选重新生成配音。仅发送公开讲稿到 Microsoft 在线 TTS；不应加入账号凭据或私有资料。
- `assets/`：已检查的三张模拟 UI 截图。method-error 属于此前传感器走查；另外两张来自未完成的 1CRN 重录。不得混称同一个实跑。
- `operations-draft/`：录像用模拟启动器与已明确标注的静态历史数值。详见该目录 README。
- 原版拓扑、既有协议截图仍引用仓库 `docs/research/images/`，不重复复制。
- `SOURCE-MANIFEST.json`：本目录公开源文件的规范字节哈希（不包含清单自身）。

## 重建方式

建议独立 Python 虚拟环境。所需本机制作依赖：Pillow、imageio-ffmpeg、reportlab、pypdf；只有重新生成配音才需要 edge-tts。这些不加入产品依赖，不附带第三方二进制或 Windows 字体。

在仓库根目录：
```powershell
python tools/submission/pdf.py
python tools/submission/render.py
```
产物及中间帧在 `output/submission-rebuild/`，最终文件在其 `deliverables/` 中。**不会自动覆盖 docs/submission。** 审核后自行复制成品、同步字幕与播放页章节，再更新 artifact-checks.json。

默认使用 Windows Microsoft YaHei。其他环境请提供支持中文的 TrueType/TTC 字体：
```powershell
$env:VIBE_CJK_FONT = '你的中文字体绝对路径'
$env:VIBE_CJK_BOLD_FONT = '你的中文粗体绝对路径'
```
不复制或发布系统字体。FFmpeg 由现有 imageio-ffmpeg 环境提供。

修改旁白后，可执行 `python tools/submission/voices.py --force` 重新生成所有音频；不传 --force 只补缺失文件，不能用旧音频搭配新讲稿。此操作会联网；离线剪辑直接使用现有音频即可。

## 验证范围与剪辑注意

交接时检查 Python/Node 语法、素材路径与源文件清单；PDF 在现有本机工具环境重建核对，视频重建核对时不重新调用 TTS。跨系统字体、全新电脑依赖安装尚未验收。

目前程序会生成旧版讲稿、字幕和片头，接手修改时应更新材料版本，不把改版输出继续叫已核验的 v1。视频仍须 3–5 分钟、PDF 最多五页；数字、来源与能力状态以 [交接首页](../../TEAM-HANDOFF.md) 为准。

用户明确的问题：看不清操作、不知道点击后发生什么。建议把现有音轨当参考，采用大幅实际页面、按钮局部放大、操作前后对比；不要继续用大段文字卡片代替操作演示。补证与复用可以使用明确标注的模拟界面解释，再用真实 1CRN 原始记录证明已完成行为。新模拟录像不能冒充再次调用真实 SciencePAL。
