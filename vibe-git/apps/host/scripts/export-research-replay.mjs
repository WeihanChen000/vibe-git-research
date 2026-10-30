/** Export a read-only replay from VERIFIED real-run files. Never calls a model or edits live state. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('data/mixed-live-20261030'),out=resolve('apps/web/public/research-replay/1crn');
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const final=await read('project.json'),verification=await read('verification.json'),remote=await read('remote-observations.json');
assert.equal(verification.passed,true);assert.equal(final.phase,'COMPLETED');assert.equal(remote.previous,'asked');assert.equal(remote.current,'completed');assert.equal(remote.history.length,2);
const hash=b=>createHash('sha256').update(b).digest('hex'),base='/research-replay/1crn',files={};
await mkdir(out,{recursive:true});
for(const run of final.runs){for(const f of [...run.inputs,...(run.output?[run.output]:[])]){
 const id=f.artifactId??f.id;assert.match(id,/^[a-zA-Z0-9-]+$/);assert.match(f.filename,/^[a-zA-Z0-9_.-]+$/);
 const bytes=await readFile(join(root,'runs',run.id,f.filename));assert.equal(hash(bytes),f.sha256);assert.equal(bytes.length,f.size);
 if(files[id]){assert.equal(files[id].sha256,f.sha256);continue;}
 const relative=`files/${id}/${f.filename}`;await mkdir(join(out,'files',id),{recursive:true});await writeFile(join(out,relative),bytes);
 files[id]={filename:f.filename,url:`${base}/${relative}`,sha256:f.sha256,size:f.size};
}}
const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['claimId','nodeToken','apiKey','csrfToken','inviteToken'].includes(key)).map(([key,item])=>[key,clean(item)])):value;
const snapshots=await Promise.all((await readdir(join(root,'snapshots'))).sort().map(async name=>({name,p:await read('snapshots/'+name)})));
const find=predicate=>{const match=snapshots.find(x=>predicate(x.p));assert.ok(match,'Required captured stage exists');return match;};
const rejected=find(p=>p.phase==='CHANGES_REQUESTED');
const invalid=find(p=>p.phase==='BLOCKED');
const released=find(p=>p.tasks[0]?.status==='APPROVED'&&p.runs.find(r=>r.taskKey==='sasa'&&r.kind==='TASK')?.status==='READY');
const asked=find(p=>p.runs.some(r=>r.status==='NEEDS_INPUT'));
const collected=find(p=>p.phase==='REVIEWING'&&p.tasks[1]?.status==='REVIEWING');
const finished=find(p=>p.phase==='COMPLETED');
const execution=final.runs.find(r=>r.kind==='TASK'&&r.taskKey==='sasa'),continuation=execution.continuations[0];
assert.equal(continuation.threadId,remote.threadId);assert.equal(continuation.previousRunId,remote.previousRunId);assert.equal(continuation.runId,remote.currentRunId);
const resumed=structuredClone(asked.p),run=resumed.runs.find(r=>r.id===execution.id);
Object.assign(run,{status:'RUNNING',remoteStatus:'running',runId:continuation.runId,error:null,updatedAt:continuation.at,continuations:[continuation]});
resumed.updatedAt=continuation.at;resumed.events=final.events.filter(e=>e.at<=continuation.at);
const scientific=await read('scientific-verification.json');
assert.equal(scientific.passed,true);
const scientificReview=final.runs.find(r=>r.kind==='REVIEW'&&r.status==='COLLECTED'&&r.inputs.some(f=>f.artifactId===execution.output.id));
assert.ok(scientificReview?.output);
const boundScience={formatVersion:1,passed:scientific.passed,candidateSha256:execution.output.sha256,reviewArtifactId:scientificReview.output.id,sourceSha256:scientific.sourceSha256,method:'Codex / NumPy 5000-point independent implementation of the same Shrake-Rupley algorithm family. Compared with SciencePAL BioPython 960 points; not experimental truth.',checks:scientific.checks,metrics:[{name:'总 SASA',observed:scientific.sciencepalTotalA2,reference:scientific.codexTotalA2,tolerance:.03,comparison:'relative',unit:'Å²'},...scientific.cysteines.map(c=>({name:`CYS ${c.id}`,observed:c.sciencepalA2,reference:c.codexA2,tolerance:c.toleranceA2,comparison:'absolute',unit:'Å²'}))]};
const scienceBytes=Buffer.from(JSON.stringify(boundScience,null,2));
await writeFile(join(out,'scientific-verification.json'),scienceBytes);
const scienceReports=[{filename:'scientific-verification.json',url:`${base}/scientific-verification.json`,sha256:hash(scienceBytes),size:scienceBytes.length,artifactId:execution.output.id,candidateSha256:execution.output.sha256,reviewArtifactId:scientificReview.output.id}];
const guide=await readFile('SCIENCEPAL-TEAM-START.md','utf8');
const descriptions=[
 ['rejected','单位错误被独立评审退回','Codex 已领取并提交真实结构计算。首版故意注入十分之一的单位错误，Biology 独立重算后退回；下游仍被阻断。',rejected,{type:'review',id:'geometry'}],
 ['invalid-review','返工后，格式问题仍被拦下','Codex 修正了距离。真实复审认可数值，但一项 evidence 漏写文件名，Host 保留 INVALID 原件并阻止交接；没有替 Agent 改结论。',invalid,{type:'history'}],
 ['released','修正版复审通过，等待交接回执','显式重试后独立评审通过。geometry.json 已获准传给下游，此刻尚未收到下游文件回执，不能提前显示交接完成。',released,{type:'handoff',id:'geometry--sasa'}],
 ['needs-input','Biology 等待确认科研参数','远端实际停在 asked，任务进入 NEEDS_INPUT。原线程等待确认 1.4 Å 探针；这是预定接续测试，不是自然产生的科学不确定性。',asked,{type:'next'}],
 ['resumed','原线程接续，没有重复开任务','按冻结协议由 Codex 代提交 1.4 Å 回复。旧 run 保留，新 run 沿同一 thread 继续；这一瞬间依据真实续接回执重建。',{p:resumed,name:'remote-observations.json'},{type:'history'}],
 ['handoff','实际文件回执与科研结果交回','Biology 完成 BioPython 计算，输入字节回执匹配获批几何文件。此时文件交接已被证实，仍在等待 Codex 独立复核。',collected,{type:'handoff',id:'geometry--sasa'}],
 ['completed','交叉复核通过，完整闭环完成','Codex 从实际交接文件重算 NumPy 基线，总面积差异 0.101%，六个 CYS 通过容差。最终评审通过，2 / 2 项完成。',finished,{type:'task',id:'sasa'}],
];
// The handoff id comes from the same graph model (from -> to), not a synthetic edge.
const bundle={formatVersion:1,id:'1crn',title:final.title,scienceReports,scope:'真实运行回放 · 单账号跨平台案例；单位错误与参数确认是明示的受控测试。只读，不启动模型。',guide,files,evidenceUrl:`${base}/evidence.json`,remoteEvidenceUrl:`${base}/remote-observations.json`,steps:descriptions.map(([id,title,summary,record,focus])=>{
 const p=clean(record.p),captain=p.team.members.find(m=>m.nodeId===p.team.captainNodeId);
 return {id,title,summary,observedAt:p.updatedAt,origin:id==='resumed'?'continuation-receipt':'captured-snapshot',source:record.name,focus,state:{viewer:{id:captain.nodeId,label:captain.label,role:'captain'},members:p.team.members.map(m=>({id:m.nodeId,label:m.label,role:m.nodeId===captain.nodeId?'captain':'member',binding:{agent:m.agent,updatedAt:p.createdAt},plan:null})),projects:[p]}};
})};
for(const [name,data] of [['case.json',bundle],['evidence.json',clean(await read('evidence.json'))],['remote-observations.json',remote],['verification.json',verification]])await writeFile(join(out,name),JSON.stringify(data,null,2));
const manifest={scope:bundle.scope,projectId:final.id,steps:bundle.steps.map(({id,origin,source,observedAt})=>({id,origin,source,observedAt})),files:[...Object.entries(files).map(([artifactId,f])=>({artifactId,...f})),...await Promise.all(['case.json','evidence.json','remote-observations.json','scientific-verification.json','verification.json'].map(async name=>{const b=await readFile(join(out,name));return {url:`${base}/${name}`,sha256:hash(b),size:b.length};}))]};
await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({steps:bundle.steps.length,artifacts:Object.keys(files).length,destination:out}));
