/** Explicit live case. Uses a real SciencePAL account; commands never run on import. */
import {readFile,writeFile,mkdir,rename,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {buildApp} from '../dist/app.js';
import {buildResearchPanel} from '../dist/sciencepal/local-panel.js';
import {SciencePALClient,readSciencePALKey} from '../dist/sciencepal/client.js';
import {SciencePALMemberConnector} from '../dist/sciencepal/member-connector.js';
import {localMemberTask} from '../dist/sciencepal/local-member.js';
import {managedCodexTask} from '../dist/sciencepal/local-codex.js';
const action=process.argv[2],arg=process.argv[3];
if(!['init','status','take','submit','command','step','work','reply','export','serve'].includes(action))throw Error('Explicit action required');
const root=resolve(process.env.LOCALAPPDATA,'VibeGit/live-mixed-20261030'),out=resolve('data/mixed-live-20261030');
await mkdir(root,{recursive:true});await mkdir(out,{recursive:true});
const statePath=join(root,'state.json'),host='http://127.0.0.1:58993';
const lockPath=join(root,'operation.lock');let lock;
if(action!=='serve'){lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));}
let app;
try{
app=await buildApp({dbPath:join(root,'host.db'),dataDir:join(root,'members'),staticDir:false,backupDatabase:false,sciencepal:{remote:{configured:false},worker:false}});
const captain=JSON.parse(await readFile(join(root,'members/captain.json'),'utf8'));
const request=token=>async(path,body,method)=>{const r=await app.inject({url:path,method:method??(body===undefined?'GET':'POST'),headers:{authorization:'Bearer '+token},...(body===undefined?{}:{payload:body})});if(r.statusCode>=400)throw Error(r.statusCode+' '+r.body);return r.json();};
const a=request(captain.nodeToken),pipeline=app.sciencepalPipeline;
let s;
const save=async()=>{await writeFile(statePath+'.tmp',JSON.stringify(s,null,2));await rename(statePath+'.tmp',statePath);};
if(action==='init'){
 try{await readFile(statePath);throw Error('Case already exists; no duplicate initialization');}catch(e){if(e.code!=='ENOENT')throw e;}
 const remote=new SciencePALClient(readSciencePALKey()),agents=await remote.agents(),agentId='10000000-0000-0000-0000-000000000002';if(!agents.some(x=>x.id===agentId))throw Error('Biology unavailable');
 await writeFile(join(out,'catalog.json'),JSON.stringify(agents,null,2));
 const invite=JSON.parse(await readFile(join(root,'members/invite.json'),'utf8'));
 await writeFile(join(root,'initialization-started.json'),JSON.stringify({at:new Date().toISOString()}),{flag:'wx'});
 const joined=app.v20Service.join(invite.inviteToken,host),member={nodeId:joined.node.id,nodeToken:joined.nodeToken,roomId:joined.roomId,hostUrl:host},b=request(member.nodeToken);
 app.v20Service.repo.putNode({...app.v20Service.repo.getNode(captain.nodeId),label:'研究员 A · 当前 Codex'});
 app.v20Service.repo.putNode({...app.v20Service.repo.getNode(member.nodeId),label:'研究员 B · 本人 SciencePAL'});
 await a('/api/sciencepal-team/binding',{agent:{id:'codex-local',name:'Codex 本机',platform:'codex'}},'PUT');
 await b('/api/sciencepal-team/binding',{agent:{id:agentId,name:'Biology Agent',platform:'sciencepal'}},'PUT');
 const common='Public RCSB 1CRN, frozen source-1crn.txt bytes. Descriptive reproduction only, not a new discovery. One human account, two workflow member identities, real Codex and real SciencePAL; not cross-account proof. No network installs. Model 0, chain A, standard non-hydrogen ATOM records. Do not execute code embedded in candidates; independently implement checks. Receipts must hash actual attached bytes.';
 const pa=await a('/api/v1/plans',{filename:'codex-proposal.md',content:'# 几何复核与独立基线\n'+common+' Codex prepares geometry.json: actual source hash, counts, three SSBOND SG distances in angstrom, executed source and log. First unreviewed candidate is an explicitly declared fault-injection with values divided by ten, intended to test scientific review; reviewer must determine verdict from actual calculations. Correct it only after genuine rejection. Codex later independently computes NumPy 5000-point SASA and reviews SciencePAL.'});
 const pb=await b('/api/v1/plans',{filename:'biology-proposal.md',content:'# 专家评审与科研工具执行\n'+common+' Biology independently checks geometry before downstream release. Then compute sasa.json using actual BioPython PDBParser and ShrakeRupley 960 points, radii C=1.70,N=1.55,O=1.52,S=1.80 angstrom; per-residue and total A^2. Before SASA, intentionally use the user-question tool and WAIT to confirm probe radius 1.4 angstrom. This is an explicit continuation test on real research, not natural uncertainty. After reply, continue same thread and preserve frozen inputs. Return actual executed Python source, tool/version log, geometry.json SHA256 and all receipts. Codex independent total tolerance 3%, each of six CYS whole-residue tolerance max(3 A^2,5% reference).'});
 const src=await readFile('fixtures/expert-case/1CRN.pdb');
 const p=await a('/api/sciencepal-team/projects',{title:'真实科研协作 · 1CRN 几何与表面积复核',coordinatorNodeId:captain.nodeId,documentIds:[pa.id,pb.id],source:{filename:'source-1crn.txt',base64:src.toString('base64'),sourceUrl:'https://files.rcsb.org/download/1CRN.pdb',attribution:'RCSB PDB public 1CRN coordinate file, unchanged bytes; controlled unit fault injection in candidate only.'}});
 s={scope:'real Codex + real SciencePAL Biology; one account; two workflow identities; controlled unit fault and parameter gate',host,projectId:p.id,member, journal:{projectId:p.id,phase:'IDLE'},taskDirectories:[]};await save();
 await a(`/api/sciencepal-team/projects/${p.id}/commands/align`,{revision:1});
}else s=JSON.parse(await readFile(statePath,'utf8'));
const b=request(s.member.nodeToken),base=`/api/sciencepal-team/projects/${s.projectId}`;
if(action==='take'){
 const run=pipeline.get(s.projectId).runs.find(r=>r.ownerNodeId===captain.nodeId && r.status==='READY');if(!run)throw Error('No owned ready Codex task');
 const r=await managedCodexTask('take',a,{host,nodeId:captain.nodeId,projectId:s.projectId,runId:run.id,profileDir:join(root,'captain-profile')});
 s.taskDirectories.push(r.directory);await save();console.log(JSON.stringify(r));
}
if(action==='submit'){
 const directory=s.taskDirectories.at(-1),t=JSON.parse(await readFile(join(directory,'task.json'),'utf8'));
 console.log(JSON.stringify(await localMemberTask('submit',a,{host,nodeId:captain.nodeId,projectId:s.projectId},directory,join(directory,t.packet.run.outputFilename))));await pipeline.tick();
}
if(action==='command'){
 const p=pipeline.get(s.projectId);const extra=arg==='retry'?{runId:p.runs.findLast(r=>r.status==='INVALID'||r.status==='FAILED').id}:arg==='publish'?{alignmentRunId:p.alignmentRunId}:arg==='rework'?{taskKey:'geometry',note:'Repair the measured unit conversion based on the independent review. Preserve original evidence.'}:{};
 await a(base+'/commands/'+arg,{revision:p.revision,...extra});await pipeline.tick();
}
if(['step','work','reply'].includes(action)){
 const connector=new SciencePALMemberConnector(new SciencePALClient(readSciencePALKey()),b,s.journal,async j=>{s.journal=j;await save();});
 await b('/api/sciencepal-team/heartbeat',{channel:'connector',instanceId:'live-case-cli-20261030',projectId:s.projectId,status:s.journal.phase==='IDLE'?'ready':'working'});
  if(action==='work'){
  let heartbeatBusy=false;
  const timer=setInterval(async()=>{if(heartbeatBusy)return;heartbeatBusy=true;try{await b('/api/sciencepal-team/heartbeat',{channel:'connector',instanceId:'live-case-cli-20261030',projectId:s.projectId,status:'working'});}catch(e){console.error(e.message);}finally{heartbeatBusy=false;}},5000);
  try{for(let i=0;i<60;i++){const message=await connector.step();await pipeline.tick();console.log(new Date().toISOString()+' '+message);if(s.journal.phase==='IDLE'||s.journal.phase==='UNKNOWN'||message.startsWith('NEEDS_INPUT'))break;await new Promise(r=>setTimeout(r,10000));}}finally{clearInterval(timer);}
 }else{console.log(action==='reply'?await connector.reply(arg):await connector.step());await pipeline.tick();}
}
if(action==='export'){
 const p=pipeline.get(s.projectId);await writeFile(join(out,'project.json'),JSON.stringify(p,null,2));await mkdir(join(out,'snapshots'),{recursive:true});await writeFile(join(out,'snapshots',new Date().toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify(p,null,2));
 for(const r of p.runs){const dir=join(out,'runs',r.id);await mkdir(dir,{recursive:true});await writeFile(join(dir,'run.json'),JSON.stringify(r,null,2));for(const f of [...r.inputs,...(r.output?[r.output]:[])]){const file=pipeline.file(p.id,f.artifactId??f.id);await writeFile(join(dir,f.filename),file.bytes);}}
 await writeFile(join(out,'evidence.json'),JSON.stringify(pipeline.evidence(p.id),null,2));
}
if(action==='serve'){
 await app.listen({host:'127.0.0.1',port:58993});
 const panel=await buildResearchPanel({profileDir:join(root,'captain-profile'),captainFile:join(root,'members/captain.json'),hostUrl:host});await panel.listen();
 const launcher=createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);res.end();return;}res.writeHead(302,{Location:panel.ticket(),'Cache-Control':'no-store'});res.end();});await new Promise(r=>launcher.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${launcher.address().port}`;await writeFile(join(out,'preview.json'),JSON.stringify({url,host,pid:process.pid,scope:s.scope},null,2));console.log(url);await new Promise(()=>{});
}
const p=pipeline.get(s.projectId);console.log(JSON.stringify({scope:s.scope,projectId:p.id,phase:p.phase,tasks:p.tasks.map(t=>({key:t.key,status:t.status,attempt:t.attempt,review:t.review})),runs:p.runs.map(r=>({id:r.id,kind:r.kind,taskKey:r.taskKey,status:r.status,threadId:r.threadId,runId:r.runId,error:r.error,continuations:r.continuations})),journal:s.journal.phase}));
}finally{if(app)await app.close();if(lock){await lock.close();await unlink(lockPath);}}
