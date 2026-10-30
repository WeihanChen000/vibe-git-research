import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const out=resolve('data/mixed-live-20261030'),{url}=JSON.parse(await readFile(join(out,'preview.json'))),name=process.argv[2]||'live';
const profile=await mkdtemp(join(tmpdir(),'vibe-real-case-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try{
 let port;for(let i=0;i<80;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}}
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map(),errors=[];
 ws.addEventListener('message',e=>{const x=JSON.parse(e.data);if(x.id){const p=pending.get(x.id);pending.delete(x.id);x.error?p.reject(Error(x.error.message)):p.resolve(x.result);}else if(x.method==='Runtime.exceptionThrown')errors.push(x.params.exceptionDetails.text);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url});
 for(let i=0;i<100;i++){if(await ev("!!document.querySelector('.command-bar')"))break;await delay(100);}
 await delay(750);
 if(process.argv.includes('--submit-review')){
  let point;
  for(let i=0;i<100;i++){
   point=await ev("(()=>{const b=[...document.querySelectorAll('.rt-inspector button')].find(e=>e.textContent.trim()==='检查并交回成果'&&!e.disabled);if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
   if(point)break;await delay(100);
  }
  assert.ok(point,'Actual prepared Codex review can be submitted from original drawer');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  for(let i=0;i<100;i++){if(await ev("fetch('/api/sciencepal-team/state').then(r=>r.json()).then(s=>s.projects[0].phase==='COMPLETED')"))break;await delay(100);}
  assert.ok(await ev("fetch('/api/sciencepal-team/state').then(r=>r.json()).then(s=>s.projects[0].phase==='COMPLETED')"),'Actual scientific review accepted by Host');await delay(1500);
 }
 const state=await ev("fetch('/api/sciencepal-team/state').then(r=>r.json())");
 const result={at:new Date().toISOString(),phase:state.projects[0]?.phase,projectId:state.projects[0]?.id,originalCommandBar:await ev("!!document.querySelector('.command-bar')"),memberNodes:await ev("document.querySelectorAll('.member-node').length"),syntheticBanner:state.interactiveSimulation===true,errors,text:await ev('document.body.innerText')};
 assert.equal(result.originalCommandBar,true);assert.equal(result.memberNodes,2);assert.equal(result.syntheticBanner,false);assert.equal(errors.length,0);
 await writeFile(join(out,name+'-ui.json'),JSON.stringify(result,null,2));await writeFile(join(out,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));console.log(JSON.stringify({...result,text:result.text.slice(-1600)}));
}finally{ws?.close();chrome.kill();}
