/** Real account case; UI owns join/bind/proposals/create/commands. No mock remote. */
import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';
import {buildApp} from '../dist/app.js';
import {buildResearchPanel} from '../dist/sciencepal/local-panel.js';
const root=process.env.VIBE_GIT_IRIS_LIVE_ROOT?resolve(process.env.VIBE_GIT_IRIS_LIVE_ROOT):resolve(process.env.LOCALAPPDATA,'VibeGit/live-iris-ui-20261030'),out=resolve('data/iris-live-ui-20261030');
await mkdir(root,{recursive:true});await mkdir(out,{recursive:true});
const action=process.argv[2]||'serve';
if(!['serve','status','export'].includes(action))throw Error('Unknown action');
if(action!=='serve'){
 const runtime=JSON.parse(await readFile(join(root,'runtime.json'),'utf8')),captain=JSON.parse(await readFile(join(root,'members/captain.json'),'utf8'));
 const get=async path=>{const r=await fetch(runtime.host+path,{headers:{Authorization:'Bearer '+captain.nodeToken}});if(!r.ok)throw Error('Read failed '+r.status);return r;};
 const state=await(await get('/api/sciencepal-team/state')).json();
 if(action==='export')for(const p of state.projects){
  const dir=join(out,p.id);await mkdir(join(dir,'snapshots'),{recursive:true});await writeFile(join(dir,'project.json'),JSON.stringify(p,null,2));await writeFile(join(dir,'snapshots',new Date().toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify(p,null,2));
  const ev=await(await get(`/api/sciencepal-team/projects/${p.id}/evidence`)).json();await writeFile(join(dir,'evidence.json'),JSON.stringify(ev,null,2));
  for(const r of p.runs){const runDir=join(dir,'runs',r.id);await mkdir(runDir,{recursive:true});for(const f of [...r.inputs,...(r.output?[r.output]:[])]){const bytes=new Uint8Array(await(await get(`/api/sciencepal-team/projects/${p.id}/artifacts/${f.artifactId??f.id}`)).arrayBuffer());await writeFile(join(runDir,f.filename),bytes);}}
 }
 console.log(JSON.stringify({members:state.members.map(m=>({id:m.id,label:m.label,platform:m.binding?.agent.platform,agentId:m.binding?.agent.id,hasPlan:!!m.plan})),projects:state.projects.map(p=>({id:p.id,phase:p.phase,error:p.error,tasks:p.tasks.map(t=>({key:t.key,status:t.status,attempt:t.attempt,review:t.review?{verdict:t.review.verdict,passed:t.review.checks.filter(c=>c.passed).length,total:t.review.checks.length,requiredChanges:t.review.requiredChanges}:null})),runs:p.runs.map(r=>({id:r.id,kind:r.kind,taskKey:r.taskKey,status:r.status,threadId:r.threadId,runId:r.runId,error:r.error,continuations:r.continuations}))}))}));
}else{
 const lock=await open(join(root,'server.lock'),'wx');await lock.writeFile(String(process.pid));let app,leader,member,launcher,timer;
 const close=async(code=0)=>{clearInterval(timer);launcher?.close();await member?.app.close();await leader?.app.close();await app?.close();await lock.close();await unlink(join(root,'server.lock'));process.exit(code);};
 try{
  let prior;try{prior=JSON.parse(await readFile(join(root,'runtime.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  app=await buildApp({dbPath:join(root,'host.db'),dataDir:join(root,'members'),staticDir:false,backupDatabase:false,sciencepal:{remote:{configured:false},worker:false}});
  const host=await app.listen({host:'127.0.0.1',port:prior?Number(new URL(prior.host).port):0});
  leader=await buildResearchPanel({profileDir:join(root,'captain-profile'),captainFile:join(root,'members/captain.json'),hostUrl:host});await leader.listen();
  member=await buildResearchPanel({profileDir:join(root,'member-profile')});await member.listen();
  let ticking=false;timer=setInterval(async()=>{if(ticking)return;ticking=true;try{await app.sciencepalPipeline.tick();}catch(e){console.error(e.message);}finally{ticking=false;}},1000);
  launcher=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(req.method!=='GET'||!['/captain','/member'].includes(path)){res.writeHead(404);res.end('Use /captain or /member');return;}res.writeHead(302,{Location:path==='/captain'?leader.ticket():member.ticket(),'Cache-Control':'no-store'});res.end();});await new Promise(r=>launcher.listen(0,'127.0.0.1',r));
  const runtime={host,launcher:`http://127.0.0.1:${launcher.address().port}`,pid:process.pid,scope:'Real Codex and SciencePAL Biology; one human account, two member roles. No simulated dispatch.'};
  await writeFile(join(root,'runtime.json'),JSON.stringify(runtime,null,2));await writeFile(join(out,'preview.json'),JSON.stringify(runtime,null,2));console.log(JSON.stringify(runtime));process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
 }catch(e){console.error(e instanceof Error?e.message:'Startup failed');await close(1);}
}
