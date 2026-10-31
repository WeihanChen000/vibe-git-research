/** Ego Page screencast recording; actual UI frames and timestamps, never fabricated clicks. */
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function capture(page,out,name,action){
 const dir=join(out,name);await mkdir(dir,{recursive:true});
 const frames=[],actions=[];let running=true,failure=null,pumpError=null;
 await page.events();
 await page.cdp('Page.startScreencast',{format:'jpeg',quality:95,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
 const start=Date.now();
 const pump=(async()=>{try{while(running){
  for(const e of await page.events())if(e.method==='Page.screencastFrame'){
   const n=frames.length,file=`frame-${String(n).padStart(5,'0')}.jpg`;
   await writeFile(join(dir,file),Buffer.from(e.params.data,'base64'));
   frames.push({file,at:Date.now()-start,metadata:e.params.metadata});
   await page.cdp('Page.screencastFrameAck',{sessionId:e.params.sessionId});
  }
  await delay(35);
 }}catch(e){pumpError=e;}})();
 const mark=label=>actions.push({label,at:Date.now()-start});
 try{
  await delay(1400);mark('action-start');await action(mark);mark('action-complete');await delay(2200);
 }catch(e){failure=e;}
 finally{
  running=false;await pump;await page.cdp('Page.stopScreencast');
  await writeFile(join(dir,'capture.json'),JSON.stringify({scope:'Actual local product UI screencast with deterministic simulated agents; no provider calls',name,startedAt:new Date(start).toISOString(),durationMs:Date.now()-start,frames,actions,error:failure?.message??pumpError?.message??null},null,2));
 }
 if(failure)throw failure;if(pumpError)throw pumpError;if(!frames.length)throw Error('No browser frames captured');
 console.log({clip:name,frames:frames.length,seconds:(Date.now()-start)/1000});
}
