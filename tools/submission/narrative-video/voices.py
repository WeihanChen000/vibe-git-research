import asyncio,json
from pathlib import Path
import edge_tts
SRC=Path(__file__).resolve().parent
S=json.loads((SRC/'story.json').read_text(encoding='utf-8'))
async def main():
 sem=asyncio.Semaphore(3)
 async def one(i,s):
  path=SRC/'audio'/f'{i:02}.mp3'
  meta=path.with_suffix('.jsonl')
  if path.exists() and meta.exists():return
  async with sem:
   await edge_tts.Communicate(s['en'],voice='en-US-AriaNeural',rate='+7%',boundary='WordBoundary').save(str(path),str(meta))
   print('Narration',i+1,flush=True)
 await asyncio.gather(*(one(i,s) for i,s in enumerate(S)))
asyncio.run(main())
