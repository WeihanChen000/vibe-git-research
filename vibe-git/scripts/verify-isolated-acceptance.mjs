/** Offline verifier: never executes embedded code and never contacts an account. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,sep} from 'node:path';
const root=resolve(process.argv[2]||'apps/web/public/research-replay/isolated');
const read=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const manifest=await read('manifest.json'),bundle=await read('case.json'),report=await read('acceptance-report.json'),evidence=await read('evidence.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
const within=name=>{const path=resolve(root,name);assert.ok(path.startsWith(root+sep));return path;};
for(const f of manifest.files){const bytes=await readFile(within(f.name));assert.equal(hash(bytes),f.sha256);assert.equal(bytes.length,f.size);}
let receipts=0;
for(const [id,f] of Object.entries(bundle.files)){
 assert.equal(f.url,`/research-replay/isolated/files/${id}/${f.filename}`);
 const bytes=await readFile(within(`files/${id}/${f.filename}`));assert.equal(hash(bytes),f.sha256);assert.equal(bytes.length,f.size);
}
const final=bundle.steps.at(-1).state.projects[0];assert.equal(final.phase,'COMPLETED');assert.equal(final.team.members.length,3);assert.equal(new Set(final.team.members.map(m=>m.nodeId)).size,3);
for(const run of final.runs){assert.equal(run.status,'COLLECTED');const f=bundle.files[run.output.id];const envelope=JSON.parse(await readFile(within(`files/${run.output.id}/${f.filename}`),'utf8'));
 if(run.kind==='TASK'&&run.taskKey==='sasa'){const result=envelope.result;assert.equal(result.residue_count,46);assert.equal(result.residues.length,46);assert.equal(new Set(result.residues.map(r=>r.residue_id)).size,46);assert.ok(result.residues.every(r=>Number.isFinite(r.area_A2)&&r.area_A2>=0));assert.ok(Number.isFinite(result.total_A2)&&Math.abs(result.total_A2-result.residues.reduce((n,r)=>n+r.area_A2,0))<=0.001);assert.equal(result.source_sha256,final.source.artifact.sha256);}
 assert.equal(envelope.revision,run.revision);assert.equal(envelope.inputReceipts.length,run.inputs.length);
 for(const input of run.inputs){const actual=bundle.files[input.artifactId],receipt=envelope.inputReceipts.find(r=>r.filename===input.filename);assert.ok(actual&&receipt);assert.equal(receipt.sha256,actual.sha256);assert.equal(receipt.size,actual.size);receipts++;}
}
for(const name of ['Nonparticipant cannot read project','Member cannot publish','Member cannot rework for captain','Other member cannot claim SciencePAL task','Other member cannot submit SciencePAL result','Other member cannot claim Codex task','Real connector process interrupted after durable receipt','Restart restores original remote run without resubmission','Real SciencePAL NEEDS_INPUT observed','Explicit answer continues original thread','Review rejection holds downstream','No duplicate remote starts','Codex lost acknowledgement safely replayed'])assert.ok(report.checks.some(c=>c.name===name&&c.passed),name);
assert.equal(report.remoteReceipts.filter(r=>r.event==='start-attempt').length,final.runs.filter(r=>r.agent.platform==='sciencepal').length);
assert.equal(report.remoteReceipts.filter(r=>r.event==='continueRun-attempt').length,final.runs.reduce((n,r)=>n+(r.continuations?.length??0),0));
const first=final.runs.find(r=>r.kind==='TASK'&&r.taskKey==='sasa'),last=final.runs.findLast(r=>r.kind==='TASK'&&r.taskKey==='sasa');assert.notEqual(first.id,last.id);
const cont=first.continuations;assert.equal(cont.length,1);assert.equal(cont[0].threadId,first.threadId);assert.notEqual(cont[0].previousRunId,cont[0].runId);
for(const task of final.tasks){const execution=final.runs.find(r=>r.id===task.executionId),review=final.runs.find(r=>r.id===task.reviewId);assert.notEqual(execution.ownerNodeId,review.ownerNodeId);assert.ok(review.inputs.some(f=>f.artifactId===execution.output.id));const f=bundle.files[review.output.id],raw=JSON.parse(await readFile(within(`files/${review.output.id}/${f.filename}`),'utf8'));assert.equal(raw.result.verdict,'approve');assert.ok(raw.result.checks.every(c=>c.passed));}
if(report.operatorEvidence){
 const o=report.operatorEvidence;assert.equal(hash(JSON.stringify(o.record)),o.sha256);assert.equal(o.record.threadId,first.threadId);
 const rejected=bundle.steps.find(s=>s.id==='chronology-rejected').state.projects[0].tasks.find(t=>t.key==='sasa');
 const supplemented=bundle.steps.find(s=>s.id==='supplement-review').state.projects[0].tasks.find(t=>t.key==='sasa');
 assert.equal(supplemented.artifactId,rejected.artifactId);assert.equal(supplemented.executionId,rejected.executionId);assert.equal(supplemented.attempt,rejected.attempt);assert.notEqual(supplemented.reviewId,rejected.reviewId);
 assert.ok(supplemented.feedback.includes(JSON.stringify(o.record)));assert.deepEqual(supplemented.acceptance,rejected.acceptance);
 const originalAsk=o.record.events.find(e=>e.type==='ask-user-tool'),compute=o.record.events.find(e=>e.type==='first-SASA-computation');assert.ok(originalAsk.step<compute.step);
 assert.ok(Date.parse(o.record.events.find(e=>e.type==='user-answer').displayedAt)<Date.parse(compute.displayedAt));
}
const downstream=final.runs.find(r=>r.kind==='TASK'&&r.taskKey==='synthesis');assert.ok(downstream.inputs.some(f=>f.artifactId===last.output.id));assert.ok(!downstream.inputs.some(f=>f.artifactId===first.output.id));
for(const run of final.runs.filter(r=>r.agent.platform==='sciencepal')){const observed=report.remoteProof.observations.find(r=>r.localRunId===run.id);assert.ok(observed);assert.equal(observed.status,'completed');assert.equal(observed.threadId,run.threadId);assert.equal(observed.runId,run.runId);assert.equal(observed.identity.agentId,run.agent.runtimeAgentId);}
assert.ok(report.remoteProof.observations.some(r=>r.previous.some(x=>x.status==='asked')));
assert.ok(evidence.allApproved);assert.ok(evidence.handoffs.every(h=>h.checks.every(c=>c.passed)));
const before=bundle.steps.find(s=>s.id==='needs-input').state.projects[0];assert.ok(before.runs.some(r=>r.status==='NEEDS_INPUT'));assert.equal(before.tasks.find(t=>t.key==='synthesis').executionId,null);
console.log(JSON.stringify({passed:true,members:3,stages:bundle.steps.length,artifacts:Object.keys(bundle.files).length,receipts,checks:report.checks.length,scope:report.scope}));
