# 动态叙事视频制作源

独立新版目录；保留 `operations-video` 和旧成片。本轮不修改产品前端、权限、后端、模拟器或历史运行证据。

## 叙事选择

- [People Coming Over](https://www.youtube.com/watch?v=u6nUgXjBMuo)：一个请求串联输入、具体结果和追加要求。
- [GibberLink](https://www.youtube.com/watch?v=EtNagNezo8w)：固定双方身份，用一次明确转折后继续完成同一任务。
- [Hugo Tour Guide](https://www.youtube.com/watch?v=ysKjLtJra-g)：用户意图、输入动作、产品反馈与最终入口。

获奖依据：[ElevenLabs 官方](https://elevenlabs.io/blog/announcing-the-winners-of-the-elevenlabs-worldwide-hackathon)、[AgentQL 官方](https://www.agentql.com/blog/2025-multimodal-agents-hackathon)。这些是参考视频可见的一般叙事方法；不宣称视频剪辑造成获奖。参考片已按全时间线播放并查看画面/可得字幕；没有完整试听声音。没有复制其视频、音乐、角色或界面资产。

本片用一个 1CRN 案例贯穿，核心转折是“已有数值结果但缺执行证据，报告仍被拦住”。实际 UI 录制为主体；原创说明动画解释同一成果的去向、阻断、批准和报告变更。右侧流程图明确是解释层，不是产品新功能。PDB 骨架动画使用已公开输入的 Cα 坐标，只用于结构示意。

## 文件与重建

- `story.json`：完整双语叙事、镜头、聚焦位置与字幕语义切点。
- `render.py`：24 fps 平滑镜头、真实 UI 帧、流程动画、字幕与 MP4。
- `audio/`、`voices.py`：公开英文合成旁白及词级时间戳。只在需要重新配音时发送公开讲稿给 Edge TTS。
- `sample-map.json` / `edit-map.json`：镜头到原始采集帧的 SHA256 和时间映射。模拟 UI、历史 SciencePAL 和说明动画分开。
- `audit.py`：完整解码、音量、来源帧哈希、字幕时间边界与媒体信息检查。

复用上一版已经发布的原始帧包，不重复上传相同 41 MB 文件。源帧以 CDP 截图时间而非延迟收到事件的时间排序；不插造 UI 或鼠标操作。

```powershell
python -m zipfile -e tools/submission/operations-video/captures.zip output/narrative-source
$env:VIBE_CAPTURE_DIR = (Resolve-Path output/narrative-source).Path
# Python 3.12 + Pillow + imageio-ffmpeg；非 Windows 请设置 VIBE_CJK_FONT。
python tools/submission/narrative-video/render.py --sample
python tools/submission/narrative-video/render.py
python tools/submission/narrative-video/audit.py
```

先做 40 秒无配音样片检查退回→补证→放行，再做全片。生成后必须检查实际 MP4，而非只更新讲稿。语音字幕按 TTS 词时间对齐；自动解码、音量和时间检查不等同真人完整试听。

## 版本和证据边界

制作起点：`ee9528c35c9b3f22704e20b8997736d4a3dec061`；产品前端与队友 `f3088f84c844f5ef7354acbf3cd7e9d2cc32a012` 一致。既有录制来自已完成的单机确定性模拟，21 附件 / 30 回执 / 10 作业，本轮未重新调用模型。真实两轮主案例仍为 31 / 34 / 11；另一批 SciencePAL 历史公开复核不当作重新计算 SASA。未扩展科学结论、节时或省钱声称。

旧 PDF 和历史记录仍保留其版本，不声称里面已出现本片新动画。最终参赛资料整合与提交由用户/队友完成；本轮没有代签声明或提交问卷。
