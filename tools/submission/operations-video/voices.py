"""English narration; sends only the public scene text to Microsoft Edge TTS."""
import asyncio,json
from pathlib import Path
import edge_tts
ROOT=Path(__file__).resolve().parent
SCENES=json.loads((ROOT/'scenes.json').read_text(encoding='utf-8'))
async def main():
 out=ROOT/'audio';out.mkdir(exist_ok=True);sem=asyncio.Semaphore(3)
 async def one(i,s):
  path=out/f'{i:02}.mp3'
  if path.exists():return
  async with sem:
   await edge_tts.Communicate(s['en'],voice='en-US-AriaNeural',rate='+10%').save(str(path))
   print('Narration',i+1,'/',len(SCENES),flush=True)
 await asyncio.gather(*(one(i,s) for i,s in enumerate(SCENES)))
asyncio.run(main())
