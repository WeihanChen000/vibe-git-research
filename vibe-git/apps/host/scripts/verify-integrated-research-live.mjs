// Explicit live integration harness. Runs real paid/account agents only on step.
// One human account, two workflow members; NOT cross-account collaboration evidence.
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,join,isAbsolute,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildApp} from '../dist/app.js';
import {SciencePALClient,readSciencePALKey} from '../dist/sciencepal/client.js';
import {SciencePALMemberConnector} from '../dist/sciencepal/member-connector.js';
import {managedCodexTask} from '../dist/sciencepal/local-codex.js';
import {startLocalAgent,agentRunState} from '../dist/sciencepal/local-agent.js';
const [action,arg]=process.argv.slice(2);
if(!['init','step','status','publish','rework','retry','reply','export','serve'].includes(action))throw Error('init | step | status | publish | rework TASK | retry RUN | reply ANSWER_FILE | export | serve');
const root=process.env.VIBE_LIVE_ROOT;
if(!root||!isAbsolute(root))throw Error('VIBE_LIVE_ROOT must be an absolute private directory outside the repository');
const repository=fileURLToPath(new URL('../../../../',import.meta.url));
const outside=(base,target)=>{const r=relative(base,target);return r==='..'||r.startsWith('..'+sep)||isAbsolute(r);};
if(!outside(repository,resolve(root)))throw Error('Live credentials and journals must stay outside the repository');
await mkdir(root,{recursive:true});
if(!outside(await realpath(repository),await realpath(root)))throw Error('Live directory resolves inside the repository');
const statePath=join(root,'state.json');
const hostRemote={configured:false,agents:async()=>{throw Error('Host cannot use member credentials');}};
const app=await buildApp({dbPath:join(root,'host.db'),dataDir:join(root,'host'),staticDir:action==='serve'?resolve('apps/web/dist'):false,backupDatabase:false,sciencepal:{remote:hostRemote,worker:false}});
try{
const captain=JSON.parse(await readFile(join(root,'host/captain.json'),'utf8'));
const req=token=>async(path,body,method)=>{const r=await app.inject({method:method??(body===undefined?'GET':'POST'),url:path,headers:{authorization:'Bearer '+token},...(body===undefined?{}:{payload:body})});if(r.statusCode>=400)throw Error('Host '+r.statusCode+': '+r.body);return r.json();};
const a=req(captain.nodeToken),pipeline=app.sciencepalPipeline;
let state;
if(action==='init'){
 try{await readFile(statePath);throw Error('Existing live run; use status/step, never duplicate initialization.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const remote=new SciencePALClient(readSciencePALKey());
 const biology=(await remote.agents()).find(a=>a.name==='Biology Agent'&&a.source==='builtin');if(!biology)throw Error('Official Biology Agent unavailable');
 const invite=JSON.parse(await readFile(join(root,'host/invite.json'),'utf8'));
 const member=app.v20Service.join(invite.inviteToken,'http://localhost'),b=req(member.nodeToken);
 await a('/api/sciencepal-team/binding',{agent:{id:'codex-local',name:'Codex independent reviewer',platform:'codex'}},'PUT');
 await b('/api/sciencepal-team/binding',{agent:{id:biology.id,name:biology.name,platform:'sciencepal'}},'PUT');
 const common=`# Frozen scientific protocol\nPublic 1CRN chain A heavy ATOM records, altLoc blank or A, no HETATM/hydrogens, PDB Angstrom units. Question: quantify geometric solvent accessibility; do NOT infer activity, clinical efficacy or irreplacability. Source is the supplied PDB; never refetch a different version.\nExactly two tasks: sasa assigned to Biology Agent and synthesis assigned to Codex, synthesis HARD depends on approved sasa.\nThis is a preregistered staged convergence exercise: the FIRST sasa attempt intentionally computes a 100 sphere-point pilot only; report it honestly as exploratory. Review must request_changes because final acceptance requires >=1000 points and independent convergence comparison. After feedback, Biology recomputes 1000 and 5000 points; do not overwrite pilot. This is planned methodological refinement, NOT a spontaneous Agent mistake.\nMethod field literal Shrake-Rupley; probe_radius_A=1.4; radii C=1.70,N=1.55,O=1.52,S=1.80. Biology must actually use Bio.PDB.SASA.ShrakeRupley, report actual versions, executed Python source, model/chain/atom selection and per-residue areas. No network/download/install is needed if tools are present; report missing capabilities honestly.\nFinal sasa acceptance: (1) correct frozen source and chain/filter counts; (2) full actually executed reproducible code and tool versions, exact method/probe/radii/units; (3) n_points >=1000, an actual 5000 point comparison, total relative difference <=2%, with numeric results and limitations. Pilot deliberately does not satisfy criterion 3. Codex reviewer must independently parse coordinates and calculate a separate sphere-sampling baseline (can use NumPy or Python standard library), cite actual sasa.json and numeric discrepancies, never only repeat author assertions.\nFor synthesis, read only the approved sasa.json and frozen PDB to report evidence-based totals, residue-level interpretation and limitations; embed the upstream file SHA256 and code/tool versions used to verify sums/counts. Never call SASA a biological functional experiment or claim a single PDB generalizes. Biology reviews synthesis independently with actual calculations. All code needed for reproduction must be embedded in output JSON fields, not merely local paths.\nUse Python available in the runtime; on local Windows prefer python or py. Do not read auth files, alter inputs, or modify unrelated projects.\n`;
 const pa=await a('/api/v1/plans',{filename:'independent-review.md',content:common+'\nI am Codex: coordinator, independent scientific reviewer of sasa, author of synthesis.'});
 const pb=await b('/api/v1/plans',{filename:'biology-calculation.md',content:common+'\nI am the SciencePAL Biology specialist: execute sasa, independently review synthesis.'});
 const source=await readFile(resolve('fixtures/expert-case/1CRN.pdb'));
 const basic={source_sha256:{type:'string'},method:{type:'string'},probe_radius_A:{type:'number'}};
 const schemas={sasa:{type:'object',required:['source_sha256','method','probe_radius_A','n_points','total_A2','atom_count','residue_count','residues','code','tool_versions'],properties:{...basic,n_points:{type:'integer',minimum:100},total_A2:{type:'number',minimum:0},atom_count:{type:'integer',minimum:1},residue_count:{type:'integer',minimum:1},residues:{type:'array',items:{type:'object'}},code:{type:'string',minLength:30},tool_versions:{type:'object'}},additionalProperties:true},synthesis:{type:'object',required:['source_sha256','method','probe_radius_A','summary','upstream_sha256','code'],properties:{...basic,summary:{type:'string',minLength:30},upstream_sha256:{type:'string',minLength:64,maxLength:64},code:{type:'string',minLength:30}},additionalProperties:true}};
 const project=await a('/api/sciencepal-team/projects',{title:'真实整合验证 · Biology × Codex · 分阶段收敛与独立复核',coordinatorNodeId:captain.nodeId,documentIds:[pa.id,pb.id],resultSchemas:schemas,source:{filename:'source-1CRN.pdb',base64:source.toString('base64'),sourceUrl:'https://files.rcsb.org/download/1CRN.pdb',attribution:'RCSB PDB / 1CRN; public coordinate data; frozen local fixture'}});
 state={projectId:project.id,member,scope:'One real SciencePAL account + local Codex; two workflow identities, not two human accounts',case:'Preregistered pilot then convergence refinement; no fabricated outputs',journal:{projectId:project.id,phase:'IDLE'},localRuns:[]};
 await writeFile(statePath,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});
 await a(`/api/sciencepal-team/projects/${state.projectId}/commands/align`,{revision:1});
}else state=JSON.parse(await readFile(statePath,'utf8'));
const save=()=>writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});
const get=()=>pipeline.get(state.projectId);
const cmd=(name,body={})=>a(`/api/sciencepal-team/projects/${state.projectId}/commands/${name}`,{revision:get().revision,...body});
const context=runId=>({host:'http://localhost',nodeId:captain.nodeId,projectId:state.projectId,runId,profileDir:join(root,'codex')});
if(action==='serve'){
 const origin=await app.listen({host:'127.0.0.1',port:0});
 const ticket=app.v20Service.createBrowserTicket(app.v20Service.repo.getNode(captain.nodeId),origin);
 await writeFile(join(root,'browser-ticket.json'),JSON.stringify({url:ticket.url,origin,projectId:state.projectId}),{mode:0o600});
 console.log(JSON.stringify({origin,projectId:state.projectId,scope:'Read current real project using original UI; no automatic model dispatch'}));
 await new Promise(resolve=>process.once('SIGINT',resolve));
}
if(action==='step'){
 await pipeline.tick();let p=get();
 const run=p.runs.find(r=>r.ownerNodeId===captain.nodeId&&r.revision===p.revision&&r.status==='READY');
 if(run&&!p.paused&&!['BLOCKED','CHANGES_REQUESTED'].includes(p.phase)){
  const info=await managedCodexTask('take',a,context(run.id));
  const started=await startLocalAgent(a,context(run.id));state.localRuns.push({id:run.id,kind:run.kind,taskKey:run.taskKey,runtimeId:started.runtimeId,transport:started.transport,startedAt:new Date().toISOString()});await save();
  console.log(JSON.stringify({localStarted:run.id,kind:run.kind,task:run.taskKey}));
  for(let i=0;i<180;i++){await new Promise(r=>setTimeout(r,5000));const s=await agentRunState(info.directory);if(s&&!['RUNNING','STARTING'].includes(s.state)){console.log(JSON.stringify({localFinished:s.state}));if(s.state!=='COMPLETED')throw Error('Local Agent did not finish; inspect its original task directory.');const out=await managedCodexTask('submit',a,context(run.id));console.log(JSON.stringify({submitted:out.status}));break;}if(i===179)throw Error('Local run timeout; do not restart blindly.');}
 }else{
  const connector=new SciencePALMemberConnector(new SciencePALClient(readSciencePALKey()),req(state.member.nodeToken),state.journal,async j=>{state.journal=j;await save();});
  console.log(await connector.step());
 }
 await pipeline.tick();
}
if(action==='publish'){
 const p=get();if(p.phase!=='READY')throw Error('Alignment is not ready');
 if(p.alignment.tasks.map(t=>t.key).sort().join(',')!=='sasa,synthesis')throw Error('Task set changed');
 await cmd('set-constraints',{constraints:p.alignment.tasks.flatMap(t=>[{taskKey:t.key,field:'source_sha256',kind:'source-sha'},{taskKey:t.key,field:'method',kind:'text',value:'Shrake-Rupley'},{taskKey:t.key,field:'probe_radius_A',kind:'number',value:1.4}])});
 await cmd('publish',{alignmentRunId:p.alignmentRunId});await pipeline.tick();
}
if(action==='rework'){if(!arg)throw Error('Task key required');await cmd('rework',{taskKey:arg});await pipeline.tick();}
if(action==='retry'){if(!arg)throw Error('Run id required');await cmd('retry',{runId:arg});}
if(action==='reply'){
 if(!arg)throw Error('Answer file required');
 const connector=new SciencePALMemberConnector(new SciencePALClient(readSciencePALKey()),req(state.member.nodeToken),state.journal,async j=>{state.journal=j;await save();});
 console.log(await connector.reply(await readFile(resolve(arg),'utf8')));
}
if(action==='export'){
 const p=get();const dir=join(root,'evidence');await mkdir(dir,{recursive:true});
 for(const r of p.runs){for(const file of [...r.inputs,...(r.output?[r.output]:[])]){const id=file.artifactId??file.id;const actual=pipeline.file(p.id,id);await writeFile(join(dir,id+'.json'),actual.bytes);}}
 await writeFile(join(dir,'project-private.json'),JSON.stringify(p,null,2));
}
const p=get();console.log(JSON.stringify({projectId:p.id,phase:p.phase,error:p.error,runs:p.runs.map(r=>({id:r.id,kind:r.kind,taskKey:r.taskKey,platform:r.agent.platform,status:r.status,error:r.error,threadId:r.threadId,runId:r.runId})),tasks:p.tasks.map(t=>({key:t.key,status:t.status,attempt:t.attempt,review:t.review}))},null,2));
}finally{await app.close();}
