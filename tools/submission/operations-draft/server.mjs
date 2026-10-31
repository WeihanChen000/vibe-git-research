/** Interactive experiment rehearsal in the original UI. No real accounts or models. */
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {EventEmitter} from 'node:events';
import {buildApp} from '../../../vibe-git/apps/host/dist/app.js';
import {buildResearchPanel} from '../../../vibe-git/apps/host/dist/sciencepal/local-panel.js';
import {SciencePALMemberConnector} from '../../../vibe-git/apps/host/dist/sciencepal/member-connector.js';
import {managedCodexTask} from '../../../vibe-git/apps/host/dist/sciencepal/local-codex.js';
import {ResearchRemote} from '../../../vibe-git/apps/host/scripts/research-simulation-fixture.mjs';
import {cases,scenario,reference} from './fixture.mjs';
const study=cases.find(c=>c.id===(process.argv[2]||'1crn'));if(!study)throw Error('This filming draft supports 1crn only');
const root=await mkdtemp(join(tmpdir(),'vibe-interactive-experiment-')),out=resolve('../output/video-operations-v2/session');await mkdir(out,{recursive:true});await writeFile(join(out,study.id+'.pdb'),study.csv);
const sim=scenario(study),workers=[],off=new ResearchRemote('host');off.configured=false;
const app=await buildApp({dbPath:':memory:',dataDir:root,staticDir:false,backupDatabase:false,sciencepal:{remote:off,worker:false}});
app.addHook('onSend',async(r,reply,payload)=>{if(r.url==='/api/sciencepal-team/state'&&reply.statusCode===200&&typeof payload==='string'){const d=JSON.parse(payload);d.interactiveSimulation=true;return JSON.stringify(d);}return payload;});
const host=await app.listen({host:'127.0.0.1',port:0}),captain=JSON.parse(await readFile(join(root,'captain.json'))),invite=JSON.parse(await readFile(join(root,'invite.json'))),pipeline=app.sciencepalPipeline;
app.v20Service.repo.putNode({...app.v20Service.repo.getNode(captain.nodeId),label:'队长 · Codex（模拟）'});
const request=token=>async(path,body,method)=>{const r=await fetch(host+path,{method:method??(body===undefined?'GET':'POST'),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
const a=request(captain.nodeToken),leaderProfile=join(root,'leader');
const options={allowLocalExecution:false,remote:()=>new ResearchRemote('directory'),worker:env=>{const child=new EventEmitter();child.stopped=false;child.kill=()=>{child.stopped=true;child.emit('exit',0);return true;};child.ready=(async()=>{const c=JSON.parse(await readFile(env.VIBE_GIT_MEMBER_FILE));child.req=request(c.nodeToken);child.env=env;child.connector=new SciencePALMemberConnector(new ResearchRemote('simulated-science',sim.calculate),child.req,{phase:'IDLE',projectId:env.VIBE_GIT_PROJECT_ID},async()=>{});})();workers.push(child);return child;}};
const leader=await buildResearchPanel({...options,profileDir:leaderProfile,captainFile:join(root,'captain.json'),hostUrl:host});await leader.listen();
const member=await buildResearchPanel({...options,profileDir:join(root,'member')});await member.listen();
let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{
 await pipeline.tick();
 for(const w of workers){await w.ready;if(!w.stopped){await w.req('/api/sciencepal-team/heartbeat',{channel:'connector',instanceId:w.env.VIBE_GIT_CONNECTOR_INSTANCE,projectId:w.env.VIBE_GIT_PROJECT_ID,status:'working'});await w.connector.step();}}
 for(const p of pipeline.list())for(const r of p.runs.filter(r=>r.ownerNodeId===captain.nodeId&&r.revision===p.revision&&['STARTING','RUNNING'].includes(r.status))){
  const info=await managedCodexTask('inspect',a,{host,nodeId:captain.nodeId,projectId:p.id,runId:r.id,profileDir:leaderProfile});
  if(info.prepared&&!info.outputExists){const packet=JSON.parse(await readFile(join(info.directory,'task.json'))).packet,files=await Promise.all(packet.files.map(async f=>({filename:f.filename,bytes:await readFile(join(info.directory,'inputs',f.filename))})));await writeFile(info.outputPath,sim.calculate(r.kind,files));}
 }
 await pipeline.tick();
 }catch(e){console.error('Simulation step:',e.message);}finally{busy=false;}},700);
const info={scope:'Interactive generated-data simulation only; never use a real API key.',study,captain:leader.ticket(),member:member.ticket(),invite:host+'/join/'+invite.inviteToken,csv:join(out,study.id+'.pdb'),reference:reference(study,Buffer.from(study.csv))};
await writeFile(join(out,'session.json'),JSON.stringify(info,null,2));
await writeFile(join(out,'captain-proposal.md'),study.captain+'\n');
await writeFile(join(out,'scientist-proposal.md'),study.scientist+'\n');
await writeFile(join(out,'START-HERE.md'),"# 1CRN filming draft - SIMULATION ONLY\n\nOpen the private captain/member URLs in session.json. Join with the local invitation; use only SIMULATED-ONLY as the mock key. Save the two proposals. Create a project through the captain UI and upload 1crn.pdb, attributing RCSB PDB.\n\nThis draft was only filmed through agent selection and proposal entry. Alignment, supplementary review and revision reuse still require validation. Simulated results copy an explicitly marked historical result; they are NOT a fresh SciencePAL calculation.\n\nFor Codex actions prepare the task packet, wait for the mock output, then check and submit. Do not start a real model. For SciencePAL start the local mock connector. Keep all output/session files private.\n");
console.log('Human walkthrough: '+join(out,'START-HERE.md'));

console.log('SIMULATION ONLY. SciencePAL key: SIMULATED-ONLY. Local outputs appear after preparing a task; click check/submit, not launch a real model.');console.log('Private session saved; no real model calls.');
async function stop(){clearInterval(timer);for(const w of workers)w.kill();await leader.app.close();await member.app.close();await app.close();process.exit(0);}process.once('SIGINT',stop);process.once('SIGTERM',stop);
