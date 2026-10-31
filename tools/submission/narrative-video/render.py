"""Original explanatory animation over real recorded UI events. No fabricated UI or clicks."""
from pathlib import Path
import os,json,math,subprocess,bisect,hashlib,argparse,re
from functools import lru_cache
from PIL import Image,ImageDraw,ImageFont
import imageio_ffmpeg
SRC=Path(__file__).resolve().parent;ROOT=SRC.parents[2]
RAW=Path(os.environ.get('VIBE_CAPTURE_DIR',ROOT/'output/operations-full-20261101/take2'))
OUT=ROOT/'docs/submission/narrative-demo';WORK=ROOT/'output/narrative-video-20261101/render'
OUT.mkdir(exist_ok=True,parents=True);WORK.mkdir(exist_ok=True,parents=True)
FF=imageio_ffmpeg.get_ffmpeg_exe();FPS=24;W,H=1920,1080
FONT=os.environ.get('VIBE_CJK_FONT','C:/Windows/Fonts/msyh.ttc')
BG='#f6f8fa';INK='#17212c';MUT='#576779';BLUE='#0969da';GREEN='#1a7f37';RED='#cf222e';PURPLE='#8250df';LINE='#d0d7de'
S=json.loads((SRC/'story.json').read_text(encoding='utf-8'))
@lru_cache(None)
def font(n):return ImageFont.truetype(FONT,n)
def text(d,xy,s,n=28,c=INK):d.text(xy,s,font=font(n),fill=c)
def ease(v):v=min(1,max(0,v));return v*v*(3-2*v)
def lerp(a,b,t):return a+(b-a)*t
def wrap(s,n,width):
 lines=[];line=''
 for c in s:
  if font(n).getlength(line+c)>width:lines.append(line);line=c
  else:line+=c
 if line:lines.append(line)
 return lines

def arrow(d,a,b,color=BLUE,width=5,progress=1):
 end=(lerp(a[0],b[0],progress),lerp(a[1],b[1],progress));d.line([a,end],fill=color,width=width)
 if progress>.05:
  angle=math.atan2(b[1]-a[1],b[0]-a[0]);size=13
  d.polygon([end,(end[0]-size*math.cos(angle-.55),end[1]-size*math.sin(angle-.55)),(end[0]-size*math.cos(angle+.55),end[1]-size*math.sin(angle+.55))],fill=color)
def doc(d,x,y,label,color=BLUE,scale=1):
 w,h=68*scale,82*scale;d.rounded_rectangle((x-w/2,y-h/2,x+w/2,y+h/2),radius=8*scale,fill='white',outline=color,width=max(2,int(3*scale)))
 for i in range(3):d.line((x-20*scale,y-15*scale+i*12*scale,x+16*scale,y-15*scale+i*12*scale),fill=color,width=max(2,int(3*scale)))
 if label:text(d,(x-font(23).getlength(label)/2,y+h/2+12),label,23,color)
def tag(d,x,y,label,color):
 wid=font(22).getlength(label)+28;d.rounded_rectangle((x,y,x+wid,y+37),radius=8,fill=color);text(d,(x+14,y+3),label,22,'white')
def card(d,rect,title,sub,color,status):
 d.rounded_rectangle(rect,radius=16,fill='white',outline=LINE,width=2);x,y,x2,y2=rect
 d.rounded_rectangle((x,y,x+6,y2),radius=3,fill=color)
 text(d,(x+22,y+18),title,28,color);text(d,(x+22,y+61),sub,22,MUT)
 tag(d,x+22,y+105,status,color)

def pipeline(im,state,t,dur):
 d=ImageDraw.Draw(im);x=1560;cx=1725
 text(d,(x,155),'交接状态 · 流程示意',23,MUT)
 calc='等待输入';review='等待成果';report='等待批准';rc=BLUE;pc=MUT
 p=t/max(.001,dur)
 if state in ['input']:calc='同一输入 · 已冻结'
 if state in ['compute']:calc='领取任务 / 计算'
 if state in ['reject','supplement','approve','report','change','reuse','done']:
  calc='原成果保留';review='独立复核';report='等待批准'
 if state=='reject':
  if p>.7:review='缺少证据 · 退回';rc=RED
  else:review='检查执行依据'
 if state=='supplement':review='补证 → 再评审';rc=BLUE
 if state=='approve':
  review='复审中' if p<.78 else '复审批准';report='等待批准' if p<.78 else '允许开始';rc=BLUE if p<.78 else GREEN;pc=MUT if p<.78 else GREEN
 if state in ['report','change','reuse','done']:review='批准依据保留';rc=GREEN;report='生成报告';pc=PURPLE
 if state=='change':report='新增报告要求'
 if state=='reuse':report='更新 R2 · 再评审'
 if state=='done':report='报告已交付';pc=GREEN
 card(d,(x,210,1895,385),'SciencePAL','成员 · 计算',GREEN,calc)
 card(d,(x,465,1895,640),'Codex','队长 · 独立复核',rc,review)
 card(d,(x,720,1895,915),'科研报告','Codex 执行 · 成员复审',pc,report)
 arrow(d,(cx,394),(cx,453),GREEN)
 blocked=state in ['start','input','compute','reject','supplement'] or state=='approve' and p<.78
 arrow(d,(cx,650),(cx,707),RED if blocked else GREEN)
 if blocked:d.line((cx-25,681,cx+25,681),fill=RED,width=7)
 # Clearly illustrative moving file, never an invented product-state transition.
 if state in ['compute','supplement']:
  q=(t/3)%1;y=lerp(397,445,q);d.ellipse((cx-7,y-7,cx+7,y+7),fill=GREEN)
 if not blocked and state in ['approve','report','reuse']:
  q=(t/3)%1;y=lerp(650,703,q);d.ellipse((cx-7,y-7,cx+7,y+7),fill=PURPLE)

# Protein illustration comes from the actual public input coordinates, not an AI-generated structure.
PDB=next((ROOT/'docs/submission/operations-demo/evidence/files').rglob('source-1crn.pdb'))
POINTS=[]
for line in PDB.read_text().splitlines():
 if line.startswith('ATOM') and line[12:16].strip()=='CA':POINTS.append(tuple(float(line[k:k+8]) for k in [30,38,46]))
CENTER=tuple(sum(p[j] for p in POINTS)/len(POINTS) for j in range(3))
def protein(d,x,y,t,scale=12):
 pts=[];a=t*.16
 for p in POINTS:
  xx,yy,zz=[p[j]-CENTER[j] for j in range(3)];rx=xx*math.cos(a)-zz*math.sin(a);rz=xx*math.sin(a)+zz*math.cos(a);pts.append((x+rx*scale,y+yy*scale,rz))
 for i in range(len(pts)-1):
  p,q=pts[i],pts[i+1];d.line((p[0],p[1],q[0],q[1]),fill=BLUE,width=7)
 for xx,yy,zz in pts:d.ellipse((xx-6,yy-6,xx+6,yy+6),fill=GREEN,outline='white',width=1)

def diagram(im,s,t,dur):
 d=ImageDraw.Draw(im);p=t/dur;k=s['kind'];text(d,(40,155),'说明动画 · 非产品界面',22,MUT)
 if k=='intro':
  protein(d,410,440,t,17);tag(d,150,705,'公开结构 1CRN',BLUE)
  text(d,(820,240),'研究任务',32,MUT);text(d,(820,310),'算出表面积',68);text(d,(820,404),'交付可追溯的报告',60)
  arrow(d,(760,555),(1130,555),BLUE,6,ease((t-1)/2));doc(d,1260,555,'成果',GREEN,1.1)
  text(d,(820,650),'同一份输入   /   不同 Agent',35,MUT)
  if t>5:tag(d,820,724,'成员 SciencePAL',GREEN);tag(d,1120,724,'队长 Codex',BLUE)
 elif k=='blocked':
  text(d,(65,215),'算出来了，为什么还不能往下交？',48)
  doc(d,300,480,'计算结果',GREEN,1.8);doc(d,1220,480,'报告',PURPLE,1.8)
  arrow(d,(430,480),(1080,480),LINE,9)
  q=ease(min(1,t/2));doc(d,lerp(450,740,q),480,'',GREEN,.8)
  d.line((825,420,825,540),fill=RED,width=13);tag(d,694,610,'缺少原代码 / 版本记录',RED)
  text(d,(240,780),'原成果保留',32,GREEN);text(d,(1110,780),'下游等待',32,RED)
 elif k=='comparison':
  text(d,(65,220),'报告改变，不等于计算也要重来',45)
  for x,title in [(310,'R1'),(1150,'R2')]:text(d,(x-30,320),title,46,BLUE)
  for y,label,col in [(455,'同一计算文件',GREEN),(580,'同一批准依据',GREEN),(735,'报告内容',PURPLE)]:
   d.rounded_rectangle((110,y-44,520,y+44),radius=12,fill='white',outline=col,width=3);text(d,(145,y-25),label,30,col)
   arrow(d,(555,y),(910,y),col,5,ease((t-.3)/1.8));d.rounded_rectangle((950,y-44,1400,y+44),radius=12,fill='white',outline=col,width=3)
   text(d,(982,y-25),label if y<700 else 'R2 + 中文摘要 / 局限',28,col)
  tag(d,600,828,'计算 1 次 · 报告执行 2 次',BLUE)
 elif k=='answer':
  protein(d,350,460,t,14);text(d,(90,760),'1CRN · 固定结构几何量',30,MUT)
  text(d,(730,220),'历史真实主案例',25,MUT);text(d,(730,285),'2967.6165',78,GREEN);text(d,(1275,320),'Å²',48,GREEN)
  text(d,(730,414),'独立参考 2973.1628 Å²',32);text(d,(730,475),'相对差异约 0.1865%',34,BLUE)
  d.rounded_rectangle((730,560,1445,575),radius=7,fill=LINE);progress=ease(t/2.5);d.rounded_rectangle((730,560,730+max(7,715*.1865/2*progress),575),radius=7,fill=GREEN)
  text(d,(730,599),'本例预先约定容差：2%',26,MUT)
  text(d,(730,710),'不推断新的生物学功能',32)
  text(d,(730,780),'来源：历史真实计算 + 本地独立参考',23,MUT)
 elif k=='end':
  text(d,(100,250),'可靠交接，有据可查。',64);text(d,(100,368),'不同 Agent，交接同一份获批成果。',34,MUT)
  for i,(label,col) in enumerate([('原版 Vibe-Git',MUT),('队友适配器 / 工作台',BLUE),('科研交接 / 恢复 / 复用',GREEN)]):
   x=100+i*465;d.rounded_rectangle((x,500,x+420,620),radius=16,fill='white',outline=col,width=2);text(d,(x+22,541),label,27,col)
  text(d,(100,735),'github.com/WeihanChen000/vibe-git-research',37,BLUE)
  text(d,(100,810),'播放页：操作视频 · 历史证据 · 运行方法',29,MUT)

@lru_cache(90)
def readim(path):return Image.open(path).convert('RGB')
SOURCES={}
for s in S:
 for sh in s['shots']:
  name=sh['capture'];c=json.loads((RAW/name/'capture.json').read_text(encoding='utf-8'));assert not c.get('error'),name
  base=__import__('datetime').datetime.fromisoformat(c['startedAt'].replace('Z','+00:00')).timestamp()
  # Capture timestamps, not delayed delivery timestamps. This preserves actual input/state timing.
  c['times']=[max(0,f['metadata']['timestamp']-base) for f in c['frames']];c['times'][0]=0
  SOURCES[name]=c

def source(s,t,dur):
 shotlen=dur/len(s['shots']);j=min(len(s['shots'])-1,int(t/shotlen));sh=s['shots'][j];u=t-j*shotlen;c=SOURCES[sh['capture']]
 rawdur=c['durationMs']/1000;raw=u/shotlen*rawdur;fi=max(0,bisect.bisect_right(c['times'],raw)-1);f=c['frames'][fi]
 return sh,u,shotlen,c,fi,f,raw,rawdur

def ui(im,s,t,dur):
 sh,u,shotlen,c,fi,f,raw,rawdur=source(s,t,dur);name=sh['capture'];pic=readim(str(RAW/name/f['file']))
 target=list(sh['crop']);scroll=f['metadata'].get('scrollOffsetY',0)
 if name.startswith(('05-','06-','10-','11-','12-','15-','16-','20-','22-','23-','24-')):target=[35,0 if scroll>250 else 340,1490,780 if scroll>250 else 1059]
 if name=='13-supplement-open':target=[60,315,1200,930]
 if name in ['12-review-return','15-supplement-approved'] and scroll>250:target=[35,0,1190,618]
 if name=='14-submit-supplement':
  if fi<7:
   a=[80,510,1470,950];b=[900,590,1470,950];q=ease((raw-2.0)/.8);target=[lerp(a[k],b[k],q) for k in range(4)]
  else:target=[35,0,1190,618]
 if name=='19-report-change':target=[35,300,1490,1040] if fi<len(c['frames'])-3 else [35,0,1490,780]
 if name=='21-apply-change':target=[35,300,1490,1040] if fi<len(c['frames'])-2 else [35,0,1490,780]
 # One context shot followed by a smooth optical focus, never synthesized UI frames.
 focus=ease((u-.45)/1.0);wide=[0,0,pic.width,pic.height]
 crop=tuple(round(lerp(wide[q],target[q],focus)) for q in range(4))
 bw,bh=1504,800;frame=pic.crop(crop);factor=min(bw/frame.width,bh/frame.height);size=(round(frame.width*factor),round(frame.height*factor));frame=frame.resize(size,Image.Resampling.LANCZOS)
 x=24+(bw-size[0])//2;y=150+(bh-size[1])//2;im.paste(frame,(x,y));d=ImageDraw.Draw(im)
 # Explanatory emphasis on actually filmed controls. No invented cursor or click event.
 box=None;label=None
 if name=='13-supplement-open' and fi==0:box=(80,516,198,559);label='补证复审'
 if name=='14-submit-supplement' and 1<=fi<7:box=(1326,870,1453,908);label='确认提交'
 if name=='15-supplement-approved' and fi==len(c['frames'])-1:box=(78,72,690,118);label='报告可以继续'
 if name=='25-reuse-proof' and fi==len(c['frames'])-1:box=(200,345,307,369);label='沿用同一份获批成果'
 if box:
  b=[x+(box[0]-crop[0])*factor,y+(box[1]-crop[1])*factor,x+(box[2]-crop[0])*factor,y+(box[3]-crop[1])*factor]
  if b[1]>=150 and b[3]<=950:
   pulse=3+int(2*(.5+.5*math.sin(t*5)));d.rounded_rectangle(tuple(b),radius=6,outline='#bf8700',width=pulse)
   start=(min(1440,b[2]+170),max(180,b[1]-50));arrow(d,start,(b[2]+7,(b[1]+b[3])/2),'#bf8700',4);text(d,(start[0]-font(25).getlength(label),start[1]-39),label,25,'#825c00')
 # Honest editorial rate label. No implied real model latency.
 rate=rawdur/shotlen
 text(d,(35,922),('操作剪辑 · '+f'{rate:.1f}× 原录制速度') if abs(rate-1)>.15 else '操作录制 · 接近原速',19,MUT)
 return {'capture':name,'frame':f['file'],'sourceSeconds':round(raw,3),'crop':crop}

def draw(s,t,dur,glob,total,subtitles=True):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
 d.rectangle((0,0,1920,80),fill='white');text(d,(28,19),'VIBE-GIT RESEARCH',26,INK);text(d,(385,18),s['title'],29,INK)
 scope='历史真实记录 · 独立复核' if s['id']=='history' else '说明动画' if s['kind']!='ui' else '实录操作 · 模拟 Agent'
 text(d,(1890-font(21).getlength(scope),25),scope,21,'#825c00')
 labels=['提出任务','冻结与执行','退回与补证','变更与复用','交付结果'];stages=[0,2,8,13,19]
 idx=S.index(s);stage=max(i for i,z in enumerate(stages) if idx>=z)
 for i,label in enumerate(labels):
  x=30+i*380;d.rectangle((x,92,x+355,97),fill=GREEN if i<=stage else LINE);text(d,(x,105),label,20,GREEN if i==stage else MUT)
 provenance=None
 if s['kind']=='ui':provenance=ui(im,s,t,dur)
 else:diagram(im,s,t,dur)
 # The diagram's status follows the filmed outcome, never leads it in the approval scene.
 state=s['state']
 if s['id']=='blocked':pipeline(im,state,dur,dur)
 elif s['id']=='history':
  dd=ImageDraw.Draw(im);text(dd,(1560,155),'历史复核 · 独立批次',23,MUT)
  card(dd,(1560,210,1895,385),'SciencePAL','科研 Skill / 工具环境',GREEN,'历史公开记录')
  card(dd,(1560,465,1895,640),'可检查的输出','查看成功执行与文件',BLUE,'工具核查证据')
  card(dd,(1560,720,1895,915),'来源边界','不是刚才点击的结果',MUT,'不是重新计算 SASA')
 else:pipeline(im,state,t,dur)
 d=ImageDraw.Draw(im);d.rectangle((0,957,1920,1080),fill=INK)
 if subtitles:
  z=s['zh'][1 if len(s['zh'])>1 and t>=s.get('subtitleTime',dur/2) else 0];lines=wrap(z,35,1810)
  assert len(lines)<=2,(s['id'],lines)
  for j,line in enumerate(lines):text(d,((1920-font(35).getlength(line))/2,975+j*44),line,35,'white')
 d.rectangle((0,1075,round((glob+t)/total*1920),1079),fill=GREEN)
 return im,provenance

def duration(path):
 o=subprocess.run([FF,'-i',str(path)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr;m=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',o)
 if not m:raise RuntimeError(o)
 return int(m[1])*3600+int(m[2])*60+float(m[3])
def stamp(t):
 v=round(t*1000);return f'{v//3600000:02}:{v//60000%60:02}:{v//1000%60:02},{v%1000:03}'

def render(sample=False, only=None):
 selection=list(range(8,12)) if sample else list(range(len(S)));starts={};total=0
 for i in selection:
  s=S[i];aud=SRC/'audio'/f'{i:02}.mp3';s['actualDuration']=math.ceil(max(s['duration'],duration(aud)+.55 if aud.exists() and not sample else 0)*FPS)/FPS;starts[i]=total;total+=s['actualDuration']
 if total>300:raise ValueError(f'{total}s exceeds five minutes; shorten narration, do not truncate audio')
 for i in selection:
  s=S[i];s['subtitleTime']=s['actualDuration']/2;meta=SRC/'audio'/f'{i:02}.jsonl'
  if not sample and s.get('subtitleBreak') and meta.exists():
   words=[json.loads(l) for l in meta.read_text(encoding='utf-8').splitlines() if l.strip()];norm=lambda a:re.sub(r'[^a-z0-9]+',' ',a.lower()).split();target=norm(s['subtitleBreak']);tokens=[];owners=[]
   for j,w in enumerate(words):
    ts=norm(w['text']);tokens+=ts;owners += [j]*len(ts)
   found=next((k for k in range(len(tokens)) if tokens[k:k+len(target)]==target),None)
   if found is None:raise ValueError((s['id'],target))
   s['subtitleTime']=words[owners[found]]['offset']/10000000+.18
 name='sample' if sample else 'full';folder=WORK/name;folder.mkdir(exist_ok=True);mapping=[];chapters=[]
 if only and (SRC/'edit-map.json').exists():mapping=[x for x in json.loads((SRC/'edit-map.json').read_text(encoding='utf-8'))['frameChanges'] if x['scene'] not in {S[i]['id'] for i in only}]
 for i in selection:
  s=S[i];dur=s['actualDuration'];outfile=folder/f'{i:02}.mp4';aud=SRC/'audio'/f'{i:02}.mp3'
  if only and i not in only:
   assert outfile.exists(),outfile
   chapters.append({'id':s['id'],'title':s['title'],'start':round(starts[i],3),'duration':dur,'subtitleTime':s.get('subtitleTime',dur/2),'scope':'historical independent SciencePAL verification' if s['id']=='history' else 'illustration' if s['kind']!='ui' else 'real recorded UI with simulated agents','en':s['en'],'zh':s['zh']})
   continue
  cmd=[FF,'-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r',str(FPS),'-i','-']
  if sample:cmd+=['-f','lavfi','-i','anullsrc=r=48000:cl=stereo']
  else:cmd+=['-i',str(aud),'-af','adelay=180|180,apad']
  cmd+=['-t',str(dur),'-c:v','libx264','-preset','fast','-crf','19','-threads','3','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-movflags','+faststart',str(outfile)]
  reuse=os.environ.get('VIBE_REUSE_CHAPTERS')=='1' and outfile.exists() and i not in {int(x) for x in os.environ.get('VIBE_RENDER_IDS','0').split(',')}
  proc=None if reuse else subprocess.Popen(cmd,stdin=subprocess.PIPE);last=None
  for n in range(round(dur*FPS)):
   t=n/FPS;im,prov=draw(s,t,dur,starts[i],total,not sample)
   if n in [round(FPS*.4),round(dur*FPS*.5),round(dur*FPS*.88)]:im.save(folder/f'{i:02}-{n:04}.jpg',quality=95)
   if n==int(dur*FPS*.5) and i in [10,17,0]:im.save(OUT/('sample-poster.jpg' if sample else 'poster.jpg'),quality=95)
   if prov and (prov['capture'],prov['frame'])!=last:
    path=RAW/prov['capture']/prov['frame'];mapping.append({'at':round(starts[i]+t,3),'scene':s['id'],**prov,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});last=(prov['capture'],prov['frame'])
   if proc:proc.stdin.write(im.tobytes())
  if proc:proc.stdin.close();assert proc.wait()==0
  chapters.append({'id':s['id'],'title':s['title'],'start':round(starts[i],3),'duration':dur,'subtitleTime':s.get('subtitleTime',dur/2),'scope':'historical independent SciencePAL verification' if s['id']=='history' else 'illustration' if s['kind']!='ui' else 'real recorded UI with simulated agents','en':s['en'],'zh':s['zh']})
  print(f'{name}: {i+1}/{len(S)} {s["id"]} {dur:.2f}s',flush=True)
 concat=folder/'concat.txt';concat.write_text(''.join(f"file '{(folder/f'{i:02}.mp4').as_posix()}'\n" for i in selection),encoding='utf-8')
 video=OUT/('dynamic-sample.mp4' if sample else 'vibe-git-story.mp4');subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c:v','copy','-af','loudnorm=I=-18:TP=-1.5:LRA=11','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart',str(video)],check=True)
 (SRC/('sample-map.json' if sample else 'edit-map.json')).write_text(json.dumps({'fps':FPS,'seconds':total,'scope':'Source frames use recorded capture timestamps. Smooth camera and process diagrams are explanatory animation. No fabricated UI or cursor.','chapters':chapters,'frameChanges':sorted(mapping,key=lambda x:x['at'])},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 if not sample:
  (OUT/'chapters.json').write_text(json.dumps(chapters,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');zh=[];en=[];k=1
  for c in chapters:
   en.append(f'{len(en)+1}\n{stamp(c["start"])} --> {stamp(c["start"]+c["duration"])}\n{c["en"]}\n')
   for j,line in enumerate(c['zh']):
    a=c['start']+(0 if j==0 else c['subtitleTime']);b=c['start']+(c['duration'] if j==len(c['zh'])-1 else c['subtitleTime']);zh.append(f'{k}\n{stamp(a)} --> {stamp(b)}\n{line}\n');k+=1
  (OUT/'zh-CN.srt').write_text('\n'.join(zh),encoding='utf-8');(OUT/'en.srt').write_text('\n'.join(en),encoding='utf-8')
 print(json.dumps({'file':str(video),'seconds':duration(video),'bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest()}),flush=True)
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--sample',action='store_true');ap.add_argument('--only',help='Re-render selected zero-based chapters, reuse the others');args=ap.parse_args();render(args.sample,{int(x) for x in args.only.split(',')} if args.only else None)
