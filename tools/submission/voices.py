import sys,asyncio,json
from pathlib import Path
import edge_tts
P=Path(__file__).resolve().parent
(P/'audio').mkdir(exist_ok=True)
S=json.loads((P/'scenes.json').read_text(encoding='utf-8'))
async def main():
 for i,s in enumerate(S):
  for j,b in enumerate(s['beats']):
   f=P/'audio'/f'voice-{i:02d}-{j}.mp3'
   if '--force' in sys.argv or not f.exists():
    await edge_tts.Communicate(b[0],voice='en-US-AriaNeural',rate='+6%').save(str(f))
  print('audio',i+1,flush=True)
asyncio.run(main())
