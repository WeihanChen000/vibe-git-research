"""Reproducible local media / provenance checks, not a human listening review."""
from pathlib import Path
import json,subprocess,re,hashlib,zipfile
import imageio_ffmpeg
R=Path(__file__).resolve().parents[3];S=R/'tools/submission/narrative-video';O=R/'docs/submission/narrative-demo';W=R/'output/narrative-video-20261101/audit';W.mkdir(parents=True,exist_ok=True)
ff=imageio_ffmpeg.get_ffmpeg_exe();video=O/'vibe-git-story.mp4'
def run(args):
 p=subprocess.run([ff,'-hide_banner',*args],capture_output=True,text=True,encoding='utf-8',errors='replace');return p
probe=run(['-i',str(video)]).stderr
m=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',probe);duration=int(m[1])*3600+int(m[2])*60+float(m[3]);assert 180<=duration<=300
assert '1920x1080' in probe and '24 fps' in probe and 'Audio: aac' in probe
p=run(['-v','error','-xerror','-i',str(video),'-f','null','-']);assert p.returncode==0,p.stderr
volume=run(['-i',str(video),'-vn','-af','volumedetect','-f','null','-']).stderr
mean=float(re.search(r'mean_volume: ([\d.-]+)',volume)[1]);peak=float(re.search(r'max_volume: ([\d.-]+)',volume)[1]);assert peak<0
(W/'media-probe.txt').write_text(probe,encoding='utf-8');(W/'volume.txt').write_text(volume,encoding='utf-8')
chapters=json.loads((O/'chapters.json').read_text(encoding='utf-8'));mapping=json.loads((S/'edit-map.json').read_text(encoding='utf-8'));story=json.loads((S/'story.json').read_text(encoding='utf-8'))
assert len(chapters)==22 and abs(sum(c['duration'] for c in chapters)-duration)<.1
subtitle_check=[]
for i,c in enumerate(chapters):
 assert 0<c['subtitleTime']<c['duration'],c
 words=[json.loads(l) for l in (S/'audio'/f'{i:02}.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
 last=max((w['offset']+w['duration'])/1e7 for w in words)+.18
 assert last<=c['duration'],(i,last,c['duration'])
 subtitle_check.append({'chapter':c['id'],'secondChineseCue':c['subtitleTime'],'lastSpokenWordEndsAt':round(last,3),'chapterDuration':c['duration']})
with zipfile.ZipFile(R/'tools/submission/operations-video/captures.zip') as z:
 for x in mapping['frameChanges']:assert hashlib.sha256(z.read(x['capture']+'/'+x['frame'])).hexdigest()==x['sha256'],x
ui_seconds=sum(c['duration'] for c in chapters if c['scope'].startswith('real recorded'))
# Read representative frames from the encoded final output, not only pre-encode images.
for i in [0,2,7,8,10,11,13,17,18,19,21]:
 c=chapters[i];t=c['start']+c['duration']*.65;f=W/f'frame-{i:02}.png';p=run(['-y','-ss',str(t),'-i',str(video),'-frames:v','1',str(f)]);assert p.returncode==0,p.stderr
published={}
for p in sorted(O.iterdir()):
 if p.is_file() and p.name!='checks.json':published[p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
result={'version':'narrative-20261101-v1','productAndCaptureBaseline':'ee9528c','scope':'Actual previously captured product UI with simulated agents, original explanatory animation and a separately labelled historical SciencePAL verification. No new provider execution.','durationSeconds':duration,'resolution':[1920,1080],'fps':24,'audio':'AAC English synthetic Aria, normalized toward -18 LUFS','meanAudioDb':mean,'peakAudioDb':peak,'fullDecode':True,'chapters':len(chapters),'sourceFrameChangesVerified':len(mapping['frameChanges']),'simulatedUiSeconds':round(ui_seconds,3),'subtitleTiming':'Chinese cue boundaries follow matching English word timestamps plus 180 ms audio offset','subtitleChecks':subtitle_check,'sampleBrowserPlayback':{'browser':'ego lite','duration':40.021333,'ended':True,'mediaError':None},'publicPlaybackVerified':False,'files':published,'limitations':['Not a human full listening review; audio checked by decoding, level and synthesis timestamps.','Encoded representative frames inspected; not every video frame.','Existing simulated evidence reused; no new real SciencePAL/Codex calls or cross-computer validation.','PDF retained as historical technical material, not re-rendered for this video.']}
(O/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:result[k] for k in ['durationSeconds','meanAudioDb','peakAudioDb','fullDecode','sourceFrameChangesVerified','simulatedUiSeconds']},ensure_ascii=False))
