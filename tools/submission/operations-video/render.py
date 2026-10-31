"""Render actual Ego browser frames, editorial close-ups, English audio and Chinese subtitles.
No product DOM/state changes or fabricated clicks. Raw timing is retimed for narration.
"""
from pathlib import Path
import json,os,re,subprocess,hashlib,zipfile,math,bisect,shutil
from concurrent.futures import ThreadPoolExecutor
from PIL import Image,ImageDraw,ImageFont
import imageio_ffmpeg
SRC=Path(__file__).resolve().parent;ROOT=SRC.parents[2]
RAW=Path(os.environ.get('VIBE_CAPTURE_DIR',str(ROOT/'output/operations-full-20261101/take2')))
OUT=ROOT/'docs/submission/operations-demo';WORK=ROOT/'output/operations-video-render'
for d in (OUT,WORK):d.mkdir(parents=True,exist_ok=True)
S=json.loads((SRC/'scenes.json').read_text(encoding='utf-8'));FF=imageio_ffmpeg.get_ffmpeg_exe();FPS=24
FONT=os.environ.get('VIBE_CJK_FONT','C:/Windows/Fonts/msyh.ttc');fonts={}
def font(n):
 if n not in fonts:fonts[n]=ImageFont.truetype(FONT,n)
 return fonts[n]
def duration(path):
 e=subprocess.run([FF,'-hide_banner','-i',str(path)],capture_output=True,text=True,encoding='utf-8',errors='replace').stderr
 m=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',e)
 if not m:raise ValueError(e)
 return int(m[1])*3600+int(m[2])*60+float(m[3])
def wrap(s,n,w):
 lines=[];line=''
 for x in s:
  if font(n).getlength(line+x)>w:lines.append(line);line=x
  else:line+=x
 if line:lines.append(line)
 return lines
for i,s in enumerate(S):s['actualDuration']=math.ceil(max(s['duration'],duration(SRC/'audio'/f'{i:02}.mp3')+.8)*FPS)/FPS
TOTAL=sum(s['actualDuration'] for s in S)
if TOTAL>300:raise ValueError(f'Narration too long: {TOTAL:.2f}s; edit scenes, do not cut speech.')
# Selected source captures only. Failed rehearsal clips and local credentials are excluded.
selected={x['name'] for s in S for x in s['clips']};sources={}
for name in sorted(selected):
 cap=json.loads((RAW/name/'capture.json').read_text(encoding='utf-8'))
 assert not cap['error'],(name,cap['error'])
 cap['scope']='Historical public SciencePAL verification, separately recorded' if name.startswith(('26-','27b-')) else cap['scope']
 sources[name]=cap
# A reusable source archive without auth/session files. Keep original images byte-for-byte.
with zipfile.ZipFile(SRC/'captures.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name,cap in sources.items():
  z.writestr(name+'/capture.json',json.dumps(cap,ensure_ascii=False,indent=2))
  for f in cap['frames']:z.write(RAW/name/f['file'],name+'/'+f['file'])

def crop_for(clip,f,idx,total):
 name=clip['name'];r=list(clip['crop']);scroll=f['metadata'].get('scrollOffsetY',0)
 if name.startswith(('05-','06-','10-','11-','12-','15-','16-','20-','22-','23-','24-')):
  r=[35,0 if scroll>250 else 510,1490,670 if scroll>250 else 1050]
 if name=='01-proposal':r=[525,300,1395,800]
 if name=='02-open-create':r=[525,190,1395,700]
 if name=='03-upload':r=[525,430,1395,990]
 if name=='04-create':r=[525,530,1395,1035] if idx<total-3 else [35,470,1490,1030]
 if name=='13-supplement-open':r=[65,320 if idx==0 else 510,1235,860 if idx==0 else 1045]
 if name=='14-submit-supplement':r=[410,485,1490,985] if idx<total-3 else [35,0,1490,670]
 if name=='19-report-change':r=[35,315,1490,990] if idx<total-3 else [35,0,1490,670]
 if name=='21-apply-change':r=[65,405,1490,1030] if idx<total-2 else [35,0,1490,670]
 return r

def frame_image(src,crop,wide,title,scope,caption,chapter,progress):
 canvas=Image.new('RGB',(1920,1080),'#f6f8fa')
 im=Image.open(src).convert('RGB');frame=im if wide else im.crop(tuple(crop))
 scale=min(1920/frame.width,884/frame.height);frame=frame.resize((round(frame.width*scale),round(frame.height*scale)),Image.Resampling.LANCZOS)
 canvas.paste(frame,((1920-frame.width)//2,64+(884-frame.height)//2))
 d=ImageDraw.Draw(canvas);d.rectangle((0,0,1920,63),fill='#17212c')
 d.text((28,12),f'{chapter+1:02}  {title}',font=font(29),fill='white')
 right=scope+'  |  剪辑回看';d.text((1892-font(24).getlength(right),17),right,font=font(24),fill='#f3dca0')
 d.rectangle((0,948,1920,1080),fill='#17212c')
 lines=wrap(caption,38,1820);assert len(lines)<=2,(caption,lines)
 for j,line in enumerate(lines):d.text(((1920-font(38).getlength(line))/2,964+j*47),line,font=font(38),fill='white')
 d.rectangle((0,1075,round(progress*1920),1079),fill='#65b592')
 return canvas

chapters=[];globalStart=0
for i,s in enumerate(S):
 durationScene=s['actualDuration'];dir=WORK/f'{i:02}';dir.mkdir(exist_ok=True);concat=[];provenance=[];offset=0
 piece=durationScene/len(s['clips'])
 for j,c in enumerate(s['clips']):
  cap=sources[c['name']];fs=cap['frames'];rawDuration=cap['durationMs']/1000
  ats=[max(0,f['at']/1000) for f in fs];ats[0]=0
  # Keep the actual order. Event-receipt timing is retimed to this chapter; no claims of real time.
  boundaries={0.0,piece}
  boundaries.update(min(piece,max(0,a/rawDuration*piece)) for a in ats)
  if j==0:boundaries.add(min(1.0,piece))
  mid=durationScene/2-offset
  if 0<mid<piece:boundaries.add(mid)
  points=sorted(boundaries)
  for k in range(len(points)-1):
   t=points[k];end=points[k+1]
   if end-t<.005:continue
   sourceTime=t/piece*rawDuration;fi=max(0,bisect.bisect_right(ats,sourceTime+1e-7)-1);f=fs[fi]
   wide=j==0 and t<1.0;subtitle=s['zh'][0 if offset+t<durationScene/2 else 1]
   dest=dir/f'{len(concat):04}.jpg';src=RAW/c['name']/f['file']
   im=frame_image(src,crop_for(c,f,fi,len(fs)),wide,s['title'],s['scope'],subtitle,i,(globalStart+offset+t)/TOTAL);im.save(dest,quality=95,subsampling=0)
   concat.append((dest,end-t));provenance.append({'start':round(offset+t,3),'duration':round(end-t,3),'capture':c['name'],'sourceFrame':f['file'],'wide':wide,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest()})
  offset+=piece
 with (dir/'frames.txt').open('w',encoding='utf-8') as h:
  for path,dur in concat:h.write(f"file '{path.as_posix()}'\nduration {dur:.9f}\n")
  h.write(f"file '{concat[-1][0].as_posix()}'\n")
 chapters.append({**s,'start':round(globalStart,3),'frames':provenance});globalStart+=durationScene
 print('Prepared',i+1,'/',len(S),flush=True)

def encode(i):
 s=S[i];dir=WORK/f'{i:02}';cmd=[FF,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(dir/'frames.txt'),'-i',str(SRC/'audio'/f'{i:02}.mp3'),'-vf','fps=24,format=yuv420p','-af','adelay=300|300,apad','-t',f"{s['actualDuration']:.6f}",'-c:v','libx264','-preset','fast','-crf','18','-threads','2','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-movflags','+faststart',str(dir/'clip.mp4')]
 subprocess.run(cmd,check=True);print('Encoded',i+1,flush=True)
with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(encode,range(len(S))))
with (WORK/'all.txt').open('w',encoding='utf-8') as f:
 for i in range(len(S)):f.write(f"file '{(WORK/f'{i:02}'/'clip.mp4').as_posix()}'\n")
video=OUT/'vibe-git-operations.mp4'
subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(WORK/'all.txt'),'-c','copy','-movflags','+faststart',str(video)],check=True)

def stamp(t,sep=','):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{sep}{ms%1000:03}'
srt=[];vtt=['WEBVTT',''];en=[]
for i,s in enumerate(chapters):
 for j,cap in enumerate(s['zh']):
  st=s['start']+j*s['actualDuration']/2;end=s['start']+(j+1)*s['actualDuration']/2
  srt.append(f'{i*2+j+1}\n{stamp(st)} --> {stamp(end)}\n{cap}\n');vtt.append(f'{stamp(st,".")} --> {stamp(end,".")}\n{cap}\n')
 en.append(f'{i+1}\n{stamp(s["start"])} --> {stamp(s["start"]+s["actualDuration"])}\n{s["en"]}\n')
(OUT/'zh-CN.srt').write_text('\n'.join(srt),encoding='utf-8');(OUT/'zh-CN.vtt').write_text('\n'.join(vtt),encoding='utf-8');(OUT/'en.srt').write_text('\n'.join(en),encoding='utf-8')
(OUT/'chapters.json').write_text(json.dumps([{k:v for k,v in s.items() if k!='frames'} for s in chapters],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(SRC/'edit-map.json').write_text(json.dumps({'scope':'Actual UI frames with editorial crops and retiming; simulated agents except separately labelled public historical SciencePAL verification. No fabricated product state.','fps':FPS,'duration':TOTAL,'chapters':chapters},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
shutil.copyfile(WORK/'00'/'0004.jpg',OUT/'poster.jpg')
print(json.dumps({'seconds':duration(video),'bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'sourceZipBytes':(SRC/'captures.zip').stat().st_size}),flush=True)
