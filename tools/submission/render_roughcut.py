"""Silent screen-sequence rough cut. Never substitutes for a continuous UI recording."""
from pathlib import Path
import json, subprocess, hashlib, re, shutil
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/submission/rough-cut'; WORK=ROOT/'output/roughcut-20261101/render'
WORK.mkdir(parents=True,exist_ok=True); (OUT/'shots').mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()
FONT='C:/Windows/Fonts/msyh.ttc'
scenes=[
 ('03-members.png',10,'跨 Agent 交接：方法、文件和批准，是否对应？','操作演示｜模拟执行器',[25,60,1000,560]),
 ('03-members.png',10,'队长用 Codex，成员用 SciencePAL；提案汇入同一项目','操作演示｜模拟执行器',[26,315,1000,550]),
 ('02-scientist-proposal.png',15,'成员先提交方法、参数和交付要求','操作演示｜模拟执行器',[460,227,1220,700]),
 ('04-create.png',15,'队长选择输入文件，填写来源，冻结提案建项','操作演示｜模拟执行器',[143,255,860,880]),
 ('10-protocol.png',15,'下面查看已完成的真实案例：先冻结输入与验收要求','真实运行记录｜1CRN',[28,145,1380,620]),
 ('10-protocol.png',10,'SciencePAL 计算 → Codex 复核 → 报告 → SciencePAL 复核','真实运行记录｜1CRN',[30,309,1380,540]),
 ('11-tools.png',20,'SciencePAL Biology 工具执行原计算，输出 sasa.json','真实运行记录｜1CRN',[28,145,1380,705]),
 ('12-result.png',10,'实际交付：2967.6165 Å²，327 个重原子，46 个残基','真实运行记录｜1CRN',[28,145,1380,690]),
 ('13-reference.png',10,'独立参考相差约 0.1865%，低于事先约定的 2%','本地独立复核',[28,145,1380,660]),
 ('14-reject.png',20,'数值通过仍被退回：原代码、执行日志和版本证据缺失','真实运行记录｜1CRN',[28,145,1380,670]),
 ('15-supplement.png',20,'操作者补回原运行证据；原计算成果不变，仍需独立复审','真实运行记录｜1CRN',[28,145,1380,700]),
 ('16-approve.png',25,'两次评审绑定同一个文件哈希；复审仍有调用成本','真实运行记录｜1CRN',[28,145,1380,700]),
 ('21-handoff.png',20,'报告收到成果、批准依据和数值检查记录，再开始下游工作','真实运行记录｜1CRN',[28,145,1380,660]),
 ('17-change.png',20,'只增加中文摘要和两条局限；变更影响范围为 report','真实运行记录｜1CRN',[28,145,1380,700]),
 ('18-reuse.png',25,'R2 的成果、计算作业、批准评审与 R1 一致','真实运行记录｜1CRN',[28,145,1380,725]),
 ('19-report.png',15,'最终报告保留原数值，增加中文说明，并给出适用边界','真实运行记录｜1CRN',[28,145,1380,700]),
 ('20-limits.png',10,'已验证补证与复用；跨电脑协作、总体节时收益仍待验证','真实运行记录｜1CRN',[28,145,1380,740]),
]
assert sum(s[1] for s in scenes)==270
font=lambda n:ImageFont.truetype(FONT,n)
def drawtext(draw,text,xy,size,color,width):
 line='';y=xy[1]
 for c in text:
  if font(size).getlength(line+c)>width:
   draw.text((xy[0],y),line,font=font(size),fill=color);y+=size+10;line=''
  line+=c
 draw.text((xy[0],y),line,font=font(size),fill=color)
 return y+size
clips=[]; records=[]; offset=0
for i,(name,dur,caption,scope,crop) in enumerate(scenes):
 source=ROOT/'output/roughcut-20261101/shots'/name
 dest=OUT/'shots'/name
 if not source.exists(): source=dest
 if source.resolve()!=dest.resolve(): shutil.copyfile(source,dest)
 src=Image.open(source).convert('RGB')
 records.append(dict(start=offset,duration=dur,caption=caption,scope=scope,source='shots/'+name,sourceSha256=hashlib.sha256(dest.read_bytes()).hexdigest(),focusCrop=crop,provenance='Actual simulator UI screenshot' if i<4 else 'Read-only editorial rendering of immutable historical records; not product UI'))
 for j,seconds in enumerate([2,dur-2]):
  im=Image.new('RGB',(1920,1080),'#edf0f4');d=ImageDraw.Draw(im)
  frame=src if j==0 else src.crop(crop)
  frame.thumbnail((1856,858),Image.Resampling.LANCZOS)
  # thumbnail never upscales: explicit resize for readable focus shots.
  scale=min(1856/frame.width,858/frame.height)
  frame=frame.resize((round(frame.width*scale),round(frame.height*scale)),Image.Resampling.LANCZOS)
  im.paste(frame,((1920-frame.width)//2,86+(858-frame.height)//2))
  d.rectangle((0,0,1920,76),fill='#192b3e')
  d.text((32,18),'Vibe-Git Research · 无配音粗剪',font=font(28),fill='white')
  d.text((1100,18),scope,font=font(28),fill='#ffdb90')
  d.rectangle((0,950,1920,1080),fill='#192b3e')
  bottom=drawtext(d,caption,(32,963),34,'white',1856);assert bottom<1053
  note='实际界面截帧 · 非连续录屏' if i<4 else '保存记录阅览 · 非产品操作界面 · 非现场执行'
  d.text((32,1030),note,font=font(21),fill='#bdcad8')
  d.text((1635,1030),f'{offset:03d}–{offset+dur:03d}s',font=font(21),fill='#bdcad8')
  d.rectangle((0,1073,round(1920*(offset+(2 if j==0 else dur))/270),1079),fill='#66b8e8')
  img=WORK/f'frame-{i:02d}-{j}.png';im.save(img)
  clip=WORK/f'clip-{i:02d}-{j}.mp4'
  subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-loop','1','-framerate','12','-i',str(img),'-t',str(seconds),'-an','-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','19','-pix_fmt','yuv420p',str(clip)],check=True)
  clips.append(clip)
 offset+=dur
 print(f'Rendered {i+1}/{len(scenes)} ({offset}s)',flush=True)
(WORK/'concat.txt').write_text(''.join("file '"+x.as_posix()+"'\n" for x in clips),encoding='utf8')
video=OUT/'handoff-rough-cut.mp4'
subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(WORK/'concat.txt'),'-c','copy','-movflags','+faststart',str(video)],check=True)
subprocess.run([FF,'-v','error','-i',str(video),'-f','null','-'],check=True)
probe=subprocess.run([FF,'-hide_banner','-i',str(video)],capture_output=True,text=True,encoding='utf8',errors='replace').stderr
assert '00:04:30.00' in probe and '1920x1080' in probe and 'Audio:' not in probe,probe
(OUT/'shots.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
Image.open(WORK/'frame-09-1.png').save(OUT/'poster.jpg',quality=92)
checks=dict(scope='Silent screenshot-sequence rough cut, not continuous screen capture or final narrated submission',seconds=270,width=1920,height=1080,fps=12,audioStreams=0,fullDecode='passed',videoBytes=video.stat().st_size,videoSha256=hashlib.sha256(video.read_bytes()).hexdigest(),scenes=len(scenes),framesInspectedSeparately=[0,75,125,190,230,260])
(OUT/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('DONE',video,flush=True)
