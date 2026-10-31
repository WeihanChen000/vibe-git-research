# 完整操作视频的制作源

本轮是实际浏览器操作录制，Agent 为确定性模拟执行器。SciencePAL 原生界面来自另一次已公开历史复核。两类画面单独标注，不拼成新的一次远端计算。

- `scenes.json`：19 个章节的英文旁白、中文翻译、镜头选择和放大区域。
- `audio/`：已生成的英文音频，可离线复用；声音为 Microsoft Edge TTS `en-US-AriaNeural`。
- `captures.zip`：选入成片的原始浏览器 JPEG 帧和 CDP 时间信息，不含会话邀请或本机认证文件。窗口滚动、输入、按钮状态均来自实际页面。
- `edit-map.json`：每一帧的来源哈希、章节时间与剪辑对应关系；未使用失败录像片段。
- `render.py`：Pillow + FFmpeg 渲染；局部放大、字幕和重定时，不生成伪点击或伪产品状态。
- `verify.py`：核验公开模拟记录的文件、回执、批准绑定与复用身份，不调用模型。
- `voices.py`：仅需要重新配音时运行；会将公开英文讲稿发送给 Microsoft Edge TTS 服务。

## 重建成片

Python 3.12；所需包为 Pillow、imageio-ffmpeg。重新配音才需要 edge-tts。使用已有媒体工具环境，不是给产品增加依赖。

```powershell
python -m zipfile -e tools/submission/operations-video/captures.zip output/operations-source
$env:VIBE_CAPTURE_DIR = (Resolve-Path output/operations-source).Path
# 非 Windows 环境须设 VIBE_CJK_FONT 为支持中文的字体绝对路径。
python tools/submission/operations-video/render.py
python tools/submission/operations-video/verify.py
```

输出到 `docs/submission/operations-demo/`；中间帧在忽略的 `output/operations-video-render/`。`render.py` 拒绝超过 5 分钟的讲稿，不截断声音。重建画面、音轨后重新运行媒体核验并更新发布检查；不要只改文案就声称视频已更新。

## 来源与边界

1. 本次模拟完整录制：21 份附件、30 条输入回执、10 项作业；16 项离线一致性核验通过。上游计算一次，补证与 R2 均未重算。
2. 历史真实两轮主案例：`docs/research/latest-governance-live/`；31 份附件、34 条回执、11 项作业。与本次模拟分开统计，原证据不修改。
3. 视频中的 SciencePAL 原生窗口：[公开复核](https://sciencepal.ai/share/3b6302a7-f055-460e-9e3d-588287a7b3ca)，是更早的独立复核批次，不是历史两轮主案例的实时重放。展示已加载科研 Skill 和成功的工具输出，不将加载 Skill 等同于所有工具都被调用。
4. 原 Vibe-Git、队友适配器和 CityuAI4S 工作台的贡献归属见已有贡献说明。本轮没有修改产品 UI、权限或状态机。

这是已完成制作并经过媒体/流程核验的版本，尚不能替代用户对讲解效果的最终认可；没有替用户提交比赛。
