/** Single-machine / three member acceptance. --live uses the operator's existing accounts.
 * Durable state is outside the repository. No synthetic model output in live mode.
 * Restart the same command to resume; an uncertain local run is never dispatched twice.
 */
import assert from 'node:assert/strict';
import {atomicJson,acquireAcceptanceLock,connectorAction} from './acceptance-storage.mjs';
import {readFile,writeFile,mkdir,appendFile,realpath} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {buildApp} from '../dist/app.js';
import {managedCodexTask} from '../dist/sciencepal/local-codex.js';
import {startLocalAgent,agentRunState} from '../dist/sciencepal/local-agent.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const projectRoot=fileURLToPath(new URL('../../../',import.meta.url));
const repo=resolve(projectRoot,'..');
const args=new Set(process.argv.slice(2));
assert.ok([...args].every(a=>['--live','--status'].includes(a))&&args.size<=1,'Use no flag for offline, --live for real accounts, or --status for read-only progress');
const root=resolve(process.env.VIBE_ACCEPTANCE_ROOT||join(process.env.LOCALAPPDATA||process.env.HOME,'VibeGit','isolated-acceptance-20261031'));
const outside=(base,target)=>{const r=relative(base,target);return r==='..'||r.startsWith('..'+sep)||isAbsolute(r);};
assert.ok(outside(repo,root),'Private acceptance state must be outside the repository');
await mkdir(root,{recursive:true});assert.ok(outside(await realpath(repo),await realpath(root)),'Private root must not resolve into repository');
const read=async f=>{const value=JSON.parse(await readFile(join(root,f),'utf8'));if(value.node?.id&&!value.nodeId)value.nodeId=value.node.id;return value;};
const save=async(f,v)=>atomicJson(join(root,f),v);
let state;try{state=await read('state.json');}catch(e){if(e.code!=='ENOENT')throw e;}
if(!args.has('--live')&&!args.has('--status')){
 console.log('Default: offline permission/continuation simulation and immutable live-evidence verification. For real accounts run npm run research:acceptance -- --live. The same command resumes its private journal; it never resets an existing project.');
 for(const command of [['--test',join(projectRoot,'scripts/acceptance-storage.test.mjs')],[join(projectRoot,'apps/host/scripts/simulate-research-collaboration.mjs'),'--mixed'],[join(projectRoot,'scripts/verify-isolated-acceptance.mjs')],['--test',join(projectRoot,'scripts/verify-isolated-acceptance.test.mjs')]]){
  const child=spawn(process.execPath,command,{cwd:projectRoot,stdio:'inherit',windowsHide:true});const code=await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);});if(code!==0){process.exitCode=code;break;}
 }
}else{
 const release=args.has('--live')?await acquireAcceptanceLock(root):async()=>{};
 let app;
 try{app=await buildApp({dbPath:join(root,'host.db'),dataDir:join(root,'host'),staticDir:false,backupDatabase:false,sciencepal:{remote:{configured:false,agents:async()=>{throw Error('Host cannot access member SciencePAL credentials');}},worker:false}});
 const origin=await app.listen({host:'127.0.0.1',port:0});
 const captain=await read('host/captain.json');
 const raw=token=>async(path,body,method)=>fetch(origin+path,{method:method??(body===undefined?'GET':'POST'),headers:{authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const request=token=>async(...args)=>{const r=await raw(token)(...args);if(!r.ok)throw Error('Host '+r.status+': '+await r.text());return r.json();};
 const a=request(captain.nodeToken),pipeline=app.sciencepalPipeline;
 const record=async(name,detail)=>{state.checks??=[];if(!state.checks.some(c=>c.name===name)){state.checks.push({name,passed:true,at:new Date().toISOString(),detail});await save('state.json',state);console.log('PASS '+name);}};
 const snapshot=async(label,focus={type:'next'})=>{const p=pipeline.get(state.projectId);await mkdir(join(root,'snapshots'),{recursive:true});const n=String((state.snapshots??=[]).length).padStart(3,'0');const file=`snapshots/${n}.json`;await save(file,p);state.snapshots.push({file,label,focus,at:new Date().toISOString()});await save('state.json',state);};
 const worker=async(action)=>{
  const env={...process.env,SCIENCEPAL_AUTH_FILE:process.env.SCIENCEPAL_AUTH_FILE||join(process.env.LOCALAPPDATA,'VibeGit/sciencepal-auth.json')};
  const child=spawn(process.execPath,['--use-env-proxy',join(projectRoot,'apps/host/scripts/acceptance-member-worker.mjs'),root,origin,action],{env,cwd:projectRoot,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const code=await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);});
  if(code===75)return {interrupted:true};
  if(code!==0)throw Error('Member connector: '+stderr.trim());
  return {stdout:stdout.trim()};
 };
 if(!state){
  if(args.has('--status'))throw Error('No acceptance exists yet; use --live');
  const invite=await read('host/invite.json');
  const identity=async role=>{try{return await read(role+'/member.json');}catch(e){if(e.code!=='ENOENT')throw e;const joined=app.v20Service.join(invite.inviteToken,origin);return {...joined,nodeId:joined.node.id};}};
  const codex=await identity('codex'),sciencepal=await identity('sciencepal'),outsider=await identity('outsider');
  for(const [name,identity] of [['captain',captain],['codex',codex],['sciencepal',sciencepal],['outsider',outsider]]){await mkdir(join(root,name),{recursive:true});await save(name+'/member.json',identity);}
  await save('sciencepal/journal.json',{phase:'IDLE',projectId:'preflight'});
  const agents=JSON.parse((await worker('catalog')).stdout),biology=agents.find(x=>x.name==='Biology Agent'&&x.source==='builtin');assert.ok(biology,'Official Biology Agent unavailable');
  await a('/api/sciencepal-team/binding',{agent:{id:'codex-local',name:'队长 · Codex 方法复核',platform:'codex'}},'PUT');
  await request(codex.nodeToken)('/api/sciencepal-team/binding',{agent:{id:'codex-local',name:'成员 A · Codex 结果汇总',platform:'codex'}},'PUT');
  await request(sciencepal.nodeToken)('/api/sciencepal-team/binding',{agent:{id:biology.id,name:'成员 B · SciencePAL Biology',platform:'sciencepal'}},'PUT');
  const common=`# Preregistered single-machine three-member acceptance\nReal public 1CRN structure, chain A, heavy ATOM records only, alternate location blank/A, no HETATM or hydrogens, Angstrom. Exact source attachment; do not refetch. This is computational geometry, not functional or clinical evidence.\nExactly TWO tasks: sasa assigned to the SciencePAL member, synthesis assigned to the non-captain Codex member. Captain coordinates alignment and independently reviews both tasks; captain has no authoring task. Use member-scoped IDs from context, never merge the two Codex members.\nSciencePAL sasa MUST actually run Bio.PDB.SASA.ShrakeRupley, probe_radius_A=1.4, radii C=1.70 N=1.55 O=1.52 S=1.80. Deliver total_A2 and residues [{residue_id:integer,area_A2:number}], n_points, atom_count, residue_count, source_sha256, method literal Shrake-Rupley, code (complete portable executed Python source) and tool_versions. All values must be computed, not copied from earlier studies.\nFIRST sasa attempt is a deliberately incomplete PILOT: BEFORE computing, use your actual ask-user/question tool to ask for the verification phrase. The required answer is not in these files; wait, do not invent one. This is an authorized controlled NEEDS_INPUT lifecycle test. Once an answer arrives, compute ONLY n_points=100, label exploratory, and submit. It intentionally FAILS the final acceptance requirement; reviewer must request_changes. On REWORK (when previous-sasa.json and feedback are provided), do not ask again: compute 1000 and 5000 points, report convergence total relative difference <=2% and limitation. This is planned refinement, not an accidental model mistake.\nLifecycle events (controlled question/wait/restart) are harness checks, not scientific acceptance criteria; keep their instructions in task goal, do not add them to the scientific acceptance list. Sasa scientific acceptance must include: correct frozen source/filter/counts; actual code and tool versions with units/radii; final n_points>=1000 AND an actually executed 5000-point comparison with <=2% total difference. Retain pilot truthfully; no fabricating success. Codex reviewer must compute an independent baseline using actual source and standard Python or available NumPy, and report numeric evidence in reproduction. For pilot, a correct 100-point output still requires changes because precision criterion is unmet.\nSynthesis reads only APPROVED sasa.json and source, independently sums residues and hashes approved upstream bytes, and emits summary, total_A2, source_sha256, upstream_sha256, code. Explicitly say single fixed structure, no biological function ranking. Captain independently reviews synthesis by recomputing counts/sums/hashes.\nOnly use available tools; no package installs or network refetch. For local Windows Python use python or py if available; do not scan unrelated paths. All public evidence must avoid user paths, tokens, personal contact details. Code should use relative input paths. Stop after actual required envelope exists.\n`;
  const plans=[];for(const [identity,role] of [[captain,'Captain: align and independently review, do not author sasa/synthesis'],[codex,'Non-captain Codex member: author synthesis'],[sciencepal,'SciencePAL member: author sasa']])plans.push(await request(identity.nodeToken)('/api/v1/plans',{filename:'protocol.md',content:common+'\nROLE: '+role}));
  const source=await readFile(join(projectRoot,'fixtures/expert-case/1CRN.pdb'));
  const p=await a('/api/sciencepal-team/projects',{title:'单机三成员真实验收 · 1CRN 试算、返工与隔离恢复',coordinatorNodeId:captain.nodeId,documentIds:plans.map(x=>x.id),source:{filename:'source-1CRN.pdb',base64:source.toString('base64'),sourceUrl:'https://files.rcsb.org/download/1CRN.pdb',attribution:'RCSB PDB / 1CRN public coordinates; frozen fixture'},resultSchemas:{sasa:{type:'object',required:['source_sha256','method','probe_radius_A','n_points','total_A2','atom_count','residue_count','residues','code','tool_versions'],properties:{source_sha256:{type:'string'},method:{type:'string'},probe_radius_A:{type:'number'},atom_count:{type:'integer'},residue_count:{type:'integer'},tool_versions:{type:'object'},n_points:{type:'integer',minimum:100},total_A2:{type:'number',minimum:0},residues:{type:'array',minItems:46,maxItems:46,items:{type:'object',required:['residue_id','area_A2'],properties:{residue_id:{type:'integer'},area_A2:{type:'number',minimum:0}}}},code:{type:'string',minLength:30}}},synthesis:{type:'object',required:['summary','total_A2','source_sha256','upstream_sha256','code'],properties:{source_sha256:{type:'string'},code:{type:'string'},summary:{type:'string',minLength:30},upstream_sha256:{type:'string',minLength:64,maxLength:64},total_A2:{type:'number'}}}},scientificChecks:{version:1,sourceSha256:hash(source),tasks:{sasa:[{id:'residue-sum',kind:'sum',totalPath:'total_A2',rowsPath:'residues',valueField:'area_A2',absoluteTolerance:0.001},{id:'residue-count',kind:'reference',path:'residue_count',expected:46,absoluteTolerance:0,relativeTolerance:0,provenance:'Independent count of chain A residue identifiers in frozen public 1CRN ATOM records.'}]}}});
  state={version:1,projectId:p.id,scope:'One computer; one human; three project identities; real existing Codex account and one SciencePAL account. Controlled process exit, question and pilot refinement; not cross-account or OS sandbox isolation.',members:{captain:captain.nodeId,codex:codex.nodeId,sciencepal:sciencepal.nodeId},checks:[],snapshots:[],localRuns:[]};
  await save('sciencepal/journal.json',{projectId:p.id,phase:'IDLE'});await save('state.json',state);
  await writeFile(join(root,'answer.txt'),'VIBEGIT-ISOLATED-CONTINUE. This is the preauthorized lifecycle answer. Continue the ORIGINAL frozen pilot task at 100 points, label it exploratory. Do not relax the final acceptance criterion.');
  await snapshot('三个独立成员身份与冻结源文件',{type:'protocol'});
 }
 const pget=()=>pipeline.get(state.projectId);
 const command=(name,body={})=>a(`/api/sciencepal-team/projects/${state.projectId}/commands/${name}`,{revision:pget().revision,...body});
 const codex=await read('codex/member.json'),sciencepal=await read('sciencepal/member.json'),outsider=await read('outsider/member.json');
 const denied=async(name,identity,path,body,method)=>{if(state.checks.some(c=>c.name===name))return;const before=hash(JSON.stringify(pget()));const r=await raw(identity.nodeToken)(path,body,method);assert.equal(r.status,403,name);assert.equal(hash(JSON.stringify(pget())),before,'Denied request mutated project');await record(name,'HTTP 403; project bytes unchanged');};
 if(args.has('--live')){state.members={captain:captain.nodeId,codex:codex.nodeId,sciencepal:sciencepal.nodeId};state.checks=state.checks.filter(c=>c.detail!==false);await save('state.json',state);}
 if(args.has('--status'))console.log(JSON.stringify({phase:pget().phase,checks:state.checks,runs:pget().runs.map(r=>({kind:r.kind,task:r.taskKey,status:r.status,error:r.error}))},null,2));
 else{
 assert.equal(new Set([captain.nodeId,codex.nodeId,sciencepal.nodeId]).size,3);await record('Three distinct member identities','Captain and two distinct member node IDs');
 await denied('Nonparticipant cannot read project',outsider,`/api/sciencepal-team/projects/${state.projectId}`);
 await denied('Member cannot publish',sciencepal,`/api/sciencepal-team/projects/${state.projectId}/commands/publish`,{revision:1});
 await denied('Member cannot rework for captain',codex,`/api/sciencepal-team/projects/${state.projectId}/commands/rework`,{revision:1,taskKey:'sasa'});
 if(pget().phase==='DRAFT')await command('align');
 const active=new Map();let last='';const deadline=Date.now()+60*60*1000;
 while(Date.now()<deadline){
  await pipeline.tick();let p=pget();const marker=p.phase+JSON.stringify(p.runs.map(r=>[r.id,r.status]));
  if(marker!==last){console.log(JSON.stringify({phase:p.phase,runs:p.runs.map(r=>({kind:r.kind,task:r.taskKey,status:r.status,error:r.error}))}));await snapshot(p.phase);last=marker;}
  if(p.phase==='COMPLETED')break;
  if(['BLOCKED','NEEDS_DECISION'].includes(p.phase))throw Error('Needs operator review: '+p.phase+' '+p.error);
  if(p.runs.some(r=>['FAILED','INVALID','UNKNOWN'].includes(r.status)))throw Error('Execution needs inspection; saved state is resumable, no blind retry');
  if(p.phase==='READY'){
   assert.deepEqual(p.alignment.tasks.map(t=>t.key).sort(),['sasa','synthesis']);
   assert.equal(p.alignment.tasks.find(t=>t.key==='sasa').assigneeAgentId,'member_'+sciencepal.nodeId);
   assert.equal(p.alignment.tasks.find(t=>t.key==='synthesis').assigneeAgentId,'member_'+codex.nodeId);
   await command('set-constraints',{constraints:[{taskKey:'sasa',field:'source_sha256',kind:'source-sha'},{taskKey:'synthesis',field:'source_sha256',kind:'source-sha'},{taskKey:'sasa',field:'method',kind:'text',value:'Shrake-Rupley'},{taskKey:'sasa',field:'probe_radius_A',kind:'number',value:1.4}]});
   await command('publish',{alignmentRunId:p.alignmentRunId});await record('Captain publishes frozen scientific rules','Only captain token; source hash, method, units and numeric predicates fixed');continue;
  }
  if(p.phase==='CHANGES_REQUESTED'){
   const task=p.tasks.find(t=>t.status==='CHANGES_REQUESTED');assert.ok(task);
   let supplement='';
   if(task.attempt===3&&task.key==='sasa'&&process.env.VIBE_ACCEPTANCE_EVIDENCE){
    const evidencePath=resolve(process.env.VIBE_ACCEPTANCE_EVIDENCE);assert.ok(outside(repo,await realpath(evidencePath)),'Operator evidence must be outside repository');
    const observation=JSON.parse(await readFile(evidencePath,'utf8'));supplement=JSON.stringify(observation);
    assert.ok(supplement.length<=3200,'Bounded operator evidence only');assert.equal(observation.source,'operator-observed-sciencepal-ui');
    assert.equal(observation.threadId,p.runs.find(r=>r.kind==='TASK'&&r.taskKey==='sasa').threadId,'Evidence must bind original first attempt');
    assert.ok(Array.isArray(observation.events)&&observation.events.length>0);
    state.operatorEvidence={sha256:hash(supplement),record:observation,boundToAttempt:3};await save('state.json',state);
   }
   assert.ok(task.attempt<3||(task.attempt===3&&supplement&&!state.supplementReviewSubmitted),'At most two automatic reworks; one supplemental review needs new original-thread operator evidence');
   if(task.key==='sasa')assert.equal(p.tasks.find(t=>t.key==='synthesis').executionId,null,'Downstream must wait during sasa pilot rework');
   await snapshot('真实评审退回：第 '+task.attempt+' 次提交',{type:'review',id:task.key});
   if(task.key==='sasa')await record('Review rejection holds downstream',{task:task.key,attempt:task.attempt,verdict:task.review.verdict});
   if(supplement){
    await command('supplement-review',{taskKey:task.key,reviewId:task.reviewId,note:supplement});
    state.supplementReviewSubmitted=true;await save('state.json',state);await snapshot('补充原线程事件证据，保留成果重新复审',{type:'review',id:task.key});
   }else await command('rework',{taskKey:task.key,note:task.key==='sasa'?'Follow the actual independent review; retain pilot; run final 1000 and 5000 points and deliver full reproducible code.':task.review.requiredChanges.join('\n')});continue;
  }
  const remoteRun=p.runs.find(r=>r.agent.platform==='sciencepal'&&['READY','RUNNING','NEEDS_INPUT','STARTING'].includes(r.status));
  if(remoteRun){
   await denied('Other member cannot claim SciencePAL task',codex,`/api/sciencepal-team/projects/${p.id}/runs/${remoteRun.id}/claim`,{claimId:randomUUID()});
   await denied('Other member cannot submit SciencePAL result',codex,`/api/sciencepal-team/projects/${p.id}/runs/${remoteRun.id}/complete`,{});
   const before=await read('sciencepal/journal.json');
   const nextAction=connectorAction(remoteRun.status,before);
   if(nextAction==='reply')assert.ok(remoteRun.kind==='TASK'&&remoteRun.taskKey==='sasa'&&p.tasks.find(t=>t.key==='sasa').attempt===1&&!(remoteRun.continuations?.length),'Unexpected question: inspect the original thread; no canned answer will be sent');
   const outcome=await worker(nextAction);
   if(outcome.interrupted){await record('Real connector process interrupted after durable receipt',await read('sciencepal/disconnect-once.json'));await snapshot('连接器进程中断，远端回执已保存',{type:'task',id:'sasa'});}
   else if(before.remote&&state.checks.some(c=>c.name==='Real connector process interrupted after durable receipt')){
    const receipt=await read('sciencepal/disconnect-once.json');
    if(before.remote.threadId===receipt.threadId){const current=pget().runs.find(r=>r.id===receipt.localRunId);if(current.threadId===receipt.threadId){await record('Restart restores original remote run without resubmission',{threadId:current.threadId,runId:current.runId});}}
   }
   p=pget();const asked=p.runs.find(r=>r.status==='NEEDS_INPUT');
   if(asked){await record('Real SciencePAL NEEDS_INPUT observed',{threadId:asked.threadId,runId:asked.runId});await snapshot('真实等待输入，显示本人原线程',{type:'next'});}
   const continued=p.runs.find(r=>r.continuations?.length);if(continued){await record('Explicit answer continues original thread',continued.continuations);}
   if(outcome.stdout&&!outcome.stdout.startsWith('运行中'))console.log(outcome.stdout);
  }
  p=pget();
  for(const [role,identity] of [['captain',captain],['codex',codex]]){
   const req=request(identity.nodeToken);
   const run=p.runs.find(r=>r.ownerNodeId===identity.nodeId&&r.agent.platform==='codex'&&['READY','RUNNING'].includes(r.status));if(!run)continue;
   const context={host:'http://isolated-acceptance.local',nodeId:identity.nodeId,projectId:p.id,runId:run.id,profileDir:join(root,role)};
   await denied('Other member cannot claim Codex task',sciencepal,`/api/sciencepal-team/projects/${p.id}/runs/${run.id}/claim`,{claimId:randomUUID()});
   let info=await managedCodexTask('inspect',req,context);
   if(!info.prepared)info=await managedCodexTask('take',req,context);
   let runtime=await agentRunState(info.directory);
   if(!runtime){const started=await startLocalAgent(req,context);active.set(run.id,true);state.localRuns.push({id:run.id,role,kind:run.kind,taskKey:run.taskKey,runtimeId:started.runtimeId,transport:started.transport});await save('state.json',state);console.log('Started real Codex '+role+' '+run.kind);}
   else if(runtime.state==='COMPLETED'){await managedCodexTask('submit',req,context);active.delete(run.id);console.log('Submitted real Codex '+role+' '+run.kind);}
   else if(!['RUNNING','STARTING'].includes(runtime.state))throw Error('Local Agent needs operator review: '+runtime.state);
   else if(!active.has(run.id))throw Error('Local run has a saved running marker from a prior orchestrator. Inspect original task before resuming; no duplicate dispatch.');
  }
  await new Promise(r=>setTimeout(r,5000));
 }
 const final=pget();assert.equal(final.phase,'COMPLETED','Bounded execution timed out; resume existing state');
 await snapshot('完成：真实成果、独立复核与文件交接',{type:'handoff',id:'sasa--synthesis'});
 const evidence=pipeline.evidence(final.id,final.revision);
 assert.ok(evidence.allApproved);assert.ok(evidence.handoffs.length>0&&evidence.handoffs.every(h=>h.checks.every(c=>c.passed)));
 await record('Approved immutable handoff verified',evidence.handoffs.map(h=>({checks:h.checks})));
 assert.ok(final.runs.some(r=>r.scientificValidation?.status==='PASSED'));
 await record('Host executed numeric checks','Residue sum and count passed on actual candidate bytes');
 if(!state.checks.some(c=>c.name==='Codex lost acknowledgement safely replayed')){
  const run=final.runs.findLast(r=>r.ownerNodeId===codex.nodeId&&r.kind==='TASK');assert.ok(run);
  const context={host:'http://isolated-acceptance.local',nodeId:codex.nodeId,projectId:final.id,runId:run.id,profileDir:join(root,'codex')};
  const req=request(codex.nodeToken),before=hash(JSON.stringify(pget()));let dropped=false;
  const lostAck=async(...args)=>{const value=await req(...args);if(args[0].endsWith('/complete-local')&&!dropped){dropped=true;throw Error('INJECTED_RESPONSE_LOSS');}return value;};
  await assert.rejects(managedCodexTask('submit',lostAck,context),/INJECTED_RESPONSE_LOSS/);assert.ok(dropped);
  const resumed=await managedCodexTask('submit',req,context);assert.equal(resumed.status,'COLLECTED');assert.equal(hash(JSON.stringify(pget())),before);
  await record('Codex lost acknowledgement safely replayed',{scope:'Controlled retransmission of already frozen real output; discarded first HTTP acknowledgement, then retried from original local task directory. No model rerun.',runId:run.id,artifactId:run.output.id,sha256:run.output.sha256});
 }

 const records=(await readFile(join(root,'sciencepal/transport.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(records.filter(r=>r.event==='start-attempt').length,final.runs.filter(r=>r.agent.platform==='sciencepal').length,'Restart created duplicate remote starts');
 await record('No duplicate remote starts',{startCalls:records.filter(r=>r.event==='start-attempt').length,remoteJobs:final.runs.filter(r=>r.agent.platform==='sciencepal').length});
 for(const required of ['Real SciencePAL NEEDS_INPUT observed','Explicit answer continues original thread','Review rejection holds downstream','Restart restores original remote run without resubmission'])assert.ok(state.checks.some(c=>c.name===required),'Missing actual coverage: '+required);
 await mkdir(join(root,'artifacts'),{recursive:true});for(const r of final.runs)for(const f of [...r.inputs,...(r.output?[r.output]:[])]){const id=f.artifactId??f.id;await writeFile(join(root,'artifacts',id),pipeline.file(final.id,id).bytes);}
 await worker('proof');
 await save('project.json',final);await save('evidence.json',evidence);state.completedAt=new Date().toISOString();await save('state.json',state);
 console.log(JSON.stringify({phase:final.phase,checks:state.checks.length,scope:state.scope,export:'Run npm run research:acceptance:export to create reviewed read-only topology replay.'}));
 }
 }finally{await app?.close();await release();}
}
