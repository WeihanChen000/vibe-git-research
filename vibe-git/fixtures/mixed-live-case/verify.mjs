/** Verify exported real artifacts, member ownership, handoff and continuation. No network writes. */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('data/mixed-live-20261030'),p=JSON.parse(await readFile(join(root,'project.json'))),checks=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
check('Real mixed project completed',p.phase==='COMPLETED');
check('Two separately scoped workflow owners with Codex and SciencePAL',new Set(p.team.members.map(m=>m.nodeId)).size===2&&p.agents.some(a=>a.platform==='codex')&&p.agents.some(a=>a.platform==='sciencepal'));
for(const r of p.runs){
 check(`Run ${r.kind}/${r.taskKey}/${r.id} preserved`,r.status==='COLLECTED'||(r.status==='INVALID'&&r.kind==='REVIEW'&&r.taskKey==='geometry'&&r.output));
 check(`Run ${r.id} belongs to frozen member`,p.team.members.some(m=>m.nodeId===r.ownerNodeId&&m.agent.id===r.agent.id));
 const dir=join(root,'runs',r.id),bytes=await readFile(join(dir,r.outputFilename)),envelope=JSON.parse(bytes);
 check(`Output ${r.id} actual hash and size`,hash(bytes)===r.output.sha256&&bytes.length===r.output.size);
 check(`Envelope ${r.id} exact input count and revision`,envelope.revision===r.revision&&envelope.inputReceipts.length===r.inputs.length);
 for(const f of r.inputs){const b=await readFile(join(dir,f.filename)),receipt=envelope.inputReceipts.find(x=>x.filename===f.filename);check(`Receipt ${r.id}/${f.filename}`,hash(b)===f.sha256&&b.length===f.size&&receipt?.sha256===f.sha256&&receipt?.size===f.size);}
 if(r.agent.platform==='sciencepal')check(`Real native Biology run ${r.id}`,r.agent.runtimeAgentId==='10000000-0000-0000-0000-000000000002'&&!!r.threadId&&!!r.runId&&!r.runId.startsWith('simulated'));
}
const geometries=p.runs.filter(r=>r.kind==='TASK'&&r.taskKey==='geometry'),reviews=p.runs.filter(r=>r.kind==='REVIEW'&&r.taskKey==='geometry');
check('Two geometry attempts; real rejected, invalid and approved reviews preserved',geometries.length===2&&reviews.length===3&&reviews.filter(r=>r.status==='INVALID').length===1);
const output=async r=>JSON.parse(await readFile(join(root,'runs',r.id,r.outputFilename))).result;
const initial=await output(reviews[0]),final=await output(reviews.at(-1));
check('Actual reviewer rejected unit fault',initial.verdict==='request_changes'&&initial.checks.some(c=>!c.passed));
check('Actual reviewer approved corrected result',final.verdict==='approve'&&final.checks.every(c=>c.passed));
check('Original fault preserved; corrected version labeled', (await output(geometries[0])).faultInjection===true&&(await output(geometries[1])).faultInjection===false);
check('Reviewers differ from task authors',p.tasks.every(t=>t.reviewerAgentId!==t.assigneeAgentId));
const sasa=p.runs.find(r=>r.kind==='TASK'&&r.taskKey==='sasa'),handoff=sasa.inputs.find(f=>f.filename==='geometry.json');
check('Downstream receives only approved corrected geometry bytes',handoff.artifactId===geometries[1].output.id&&handoff.sha256===geometries[1].output.sha256&&handoff.sha256!==geometries[0].output.sha256);
check('Exactly one same-thread continuation',sasa.continuations?.length===1&&sasa.continuations[0].threadId===sasa.threadId&&sasa.continuations[0].previousRunId!==sasa.runId);
const snapshots=await Promise.all((await readdir(join(root,'snapshots'))).map(async f=>JSON.parse(await readFile(join(root,'snapshots',f)))));
check('Real NEEDS_INPUT snapshot preserved',snapshots.some(x=>x.runs.some(r=>r.id===sasa.id&&r.status==='NEEDS_INPUT')));
const observations=JSON.parse(await readFile(join(root,'remote-observations.json')));
check('Remote previous run truly asked and continuation completed',observations.previous==='asked'&&observations.current==='completed');
check('No duplicate remote continuation',observations.history.length===2&&observations.history.every(r=>r.threadId===sasa.threadId));
const scientific=JSON.parse(await readFile(join(root,'scientific-verification.json')));
check('Independent numerical verification passed',scientific.passed===true);
await writeFile(join(root,'verification.json'),JSON.stringify({passed:true,scope:p.title,accountLimit:'one real account; two workflow members; no cross-account claim',checks},null,2));
console.log(JSON.stringify({passed:true,checks:checks.length,projectId:p.id}));
