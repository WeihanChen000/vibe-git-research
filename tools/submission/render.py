from pathlib import Path
import sys,json,re,subprocess,math,hashlib,os
import imageio_ffmpeg
from PIL import Image,ImageDraw,ImageFont
SRC=Path(__file__).resolve().parent; ROOT=SRC.parents[1]; P=ROOT/'output/submission-rebuild'; OUT=P/'deliverables'
OUT.mkdir(parents=True,exist_ok=True)
S=json.loads((SRC/'scenes.json').read_text(encoding='utf8')); FF=imageio_ffmpeg.get_ffmpeg_exe()
BG='#0b1018'; WHITE='#edf5fd'; BLUE='#8ac6ff'; TEAL='#75dfc6'; MUTED='#afbed0'; GOLD='#ffcf87'
F={}
def font(n):
 if n not in F:F[n]=ImageFont.truetype(os.environ.get('VIBE_CJK_FONT','C:/Windows/Fonts/msyh.ttc'),n)
 return F[n]
def lines(t,n,w):
 out=[];a=''
 for c in t:
  if c=='\n' or font(n).getlength(a+c)>w:out.append(a);a='' if c=='\n' else c
  else:a+=c
 if a:out.append(a)
 return out
def text(d,t,x,y,n=32,color=WHITE,w=1700):
 for a in lines(t,n,w):d.text((x,y),a,font=font(n),fill=color);y+=int(n*1.5)
 return y
def ts(x,comma=False):
 m=round(x*1000);return f'{m//3600000:02}:{m//60000%60:02}:{m//1000%60:02}{"," if comma else "."}{m%1000:03}'
def duration(f):
 r=subprocess.run([FF,'-hide_banner','-i',str(f)],capture_output=True,text=True,encoding='utf8',errors='replace')
 m=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r.stderr);assert m,r.stderr
 return int(m[1])*3600+int(m[2])*60+float(m[3])
raw=[duration(SRC/'audio'/f'voice-{i:02d}-{j}.mp3') for i in range(len(S)) for j in range(2)]
speed=max(1.0,sum(raw)/268); print('Audio seconds',sum(raw),'speed',speed,flush=True)
start=0; clips=[]; en=['WEBVTT\n'];zh=['WEBVTT\n'];srt=[];records=[]
for i,s in enumerate(S):
 ss=start
 for j,(english,chinese) in enumerate(s['beats']):
  dur=math.ceil((raw[i*2+j]/speed+.4)*24)/24
  im=Image.new('RGB',(1920,1080),BG);d=ImageDraw.Draw(im)
  text(d,'VIBE-GIT RESEARCH',65,35,25,BLUE)
  text(d,f'{i+1:02} / {len(S):02}   ·   FINAL 2026-10-31',1390,38,22,MUTED,480)
  text(d,s['title'],65,105,51,w=1770);text(d,s['label'],68,190,26,GOLD,w=1770)
  if s.get('image'):
   src=Image.open(ROOT/s['image']).convert('RGB');src.thumbnail((1120,590),Image.Resampling.LANCZOS)
   im.paste(src,(735+(1120-src.width)//2,285+(590-src.height)//2))
   for k,b in enumerate(s['bullets']):text(d,b,75,310+k*170,34,TEAL if k==0 else WHITE,600)
  elif s['kind']=='result':
   text(d,'2967.6165 Å²',90,310,92,TEAL);text(d,'SciencePAL · 1000 点',95,445,34,MUTED)
   text(d,'独立参考 2973.1628 Å²',95,540,46);text(d,'相对差 0.1865%   /   预设容差 2%',95,635,42,BLUE)
   text(d,'固定结构几何复现，不推断生物功能',95,760,30,MUTED)
  elif s['kind']=='counts':
   for k,(a,b) in enumerate([('31','原始附件'),('34','输入回执'),('11','Agent 作业')]):
    x=95+k*595;text(d,a,x,300,120,TEAL);text(d,b,x+5,475,34,MUTED)
   for k,b in enumerate(s['bullets'][1:]):text(d,b,95,625+k*90,36)
   text(d,'计数范围：修复后的成功项目；不合并历史尝试',95,815,29,GOLD)
  else:
   for k,b in enumerate(s['bullets']):
    y=300+k*170;d.rounded_rectangle((70,y-10,1845,y+120),radius=12,fill='#15202d',outline='#304459',width=2)
    text(d,f'{k+1:02}',100,y+20,37,BLUE);text(d,b,195,y+20,42,TEAL if k==2 else WHITE,1590)
   if s['kind']=='reuse':text(d,'成果 SHA256 53f7fae95f77…   ·   绑定的批准记录保留',95,835,26,MUTED)
  d.rectangle((0,928,1920,1080),fill='#050910')
  end=text(d,chinese,70,950,34,WHITE,1780);assert end<1075,(i,j,end)
  d.rectangle((0,1072,round(1920*(i*2+j+1)/24),1079),fill=TEAL)
  img=P/f'frame-{i:02d}-{j}.png';im.save(img)
  dst=P/f'clip-{i:02d}-{j}.mp4'
  cmd=[FF,'-y','-hide_banner','-loglevel','error','-loop','1','-framerate','12','-i',str(img),'-i',str(SRC/'audio'/f'voice-{i:02d}-{j}.mp3'),'-af',f'atempo={speed},apad','-t',str(dur),'-c:v','libx264','-preset','fast','-tune','stillimage','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-movflags','+faststart',str(dst)]
  r=subprocess.run(cmd,capture_output=True);assert not r.returncode,r.stderr
  clips.append(dst)
  en.append(f'{ts(start)} --> {ts(start+dur)}\n{english}\n');zh.append(f'{ts(start)} --> {ts(start+dur)}\n{chinese}\n')
  srt.append(f'{len(srt)+1}\n{ts(start,True)} --> {ts(start+dur,True)}\n{chinese}\n')
  start+=dur
 records.append(dict(scene=i+1,start=round(ss,3),duration=round(start-ss,3),title=s['title'],scope=s['label'],narration=[b[0] for b in s['beats']]))
 print('Rendered',i+1,round(start,2),flush=True)
assert 180<=start<=300,start
(P/'concat.txt').write_text(''.join("file '"+p.as_posix()+"'\n" for p in clips),encoding='utf8')
r=subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(P/'concat.txt'),'-c','copy','-movflags','+faststart',str(OUT/'vibe-git-research-demo.mp4')],capture_output=True);assert not r.returncode,r.stderr
(OUT/'demo.en.vtt').write_text('\n'.join(en),encoding='utf8');(OUT/'demo.zh-CN.vtt').write_text('\n'.join(zh),encoding='utf8');(OUT/'demo.zh-CN.srt').write_text('\n'.join(srt),encoding='utf8')
(OUT/'demo-scenes.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(OUT/'DEMO-SCRIPT.md').write_text('# 最终视频讲稿\n\n材料版本 final-20261031-v1；功能基线 dda48233f57ee20e9c8be2d6b21c782b46ece7ba。英文合成配音，烧录中文字幕。情境示意、模拟界面和已完成真实案例分别标注；不是连续实时录屏，也没有在冻结代码上重新调用模型。\n\n'+'\n\n'.join(f'## {ts(r["start"])[:8]} {s["title"]}\n\n性质：{s["label"]}\n\n'+'\n\n'.join(en+'\n\n'+zh for en,zh in s['beats']) for s,r in zip(S,records)),encoding='utf8')
Image.open(P/'frame-01-0.png').save(OUT/'video-poster.jpg',quality=92)
(P/'render-summary.json').write_text(json.dumps(dict(seconds=start,speed=speed,scenes=12,voice='en-US-AriaNeural',size=(OUT/'vibe-git-research-demo.mp4').stat().st_size),indent=2),encoding='utf8')
print('FINAL',start,flush=True)
