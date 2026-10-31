/** Offline audit of the latest captured real UI workflow; no model calls. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../../docs/research/latest-governance-live/',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,base),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const m=await read('manifest.json'),p=await read('project.json'),remote=await read('remote-sasa-proof.json');
const files=new Map();let receipts=0;
assert.deepEqual(Object.keys(m.records).sort(),['project.json','remote-sasa-proof.json','tool-observations.json']);
for(const [name,f] of Object.entries(m.records)){const b=await readFile(new URL(name,base));assert.equal(sha(b),f.sha256);assert.equal(b.length,f.size);}
for(const [id,f] of Object.entries(m.artifacts)){assert.match(id,/^[a-zA-Z0-9-]+$/);assert.match(f.filename,/^[a-zA-Z0-9_.-]+$/);assert.equal(f.path,`files/${id}/${f.filename}`);const b=await readFile(new URL(f.path,base));assert.equal(sha(b),f.sha256);assert.equal(b.length,f.size);files.set(id,b);}
assert.equal(p.id,m.projectId);assert.equal(p.phase,'COMPLETED');assert.equal(p.revision,2);
for(const run of p.runs){
 if(!run.output)continue;
 const out=m.artifacts[run.output.id];assert.ok(out);assert.equal(out.sha256,run.output.sha256);
 const envelope=JSON.parse(files.get(run.output.id));assert.equal(envelope.revision,run.revision);assert.equal(envelope.inputReceipts.length,run.inputs.length);
 for(const input of run.inputs){const f=m.artifacts[input.artifactId];assert.ok(f);assert.equal(f.sha256,input.sha256);assert.equal(f.size,input.size);const found=envelope.inputReceipts.filter(x=>x.filename===input.filename);assert.equal(found.length,1);assert.equal(found[0].sha256,f.sha256);assert.equal(found[0].size,f.size);receipts++;}
}
const old=p.history.find(h=>h.revision===1);assert.ok(old);assert.ok(old.tasks.every(t=>t.status==='APPROVED'));
const current=p.tasks.find(t=>t.key==='sasa'),prior=old.tasks.find(t=>t.key==='sasa');
assert.equal(current.status,'APPROVED');assert.equal(current.carriedFrom.revision,1);
for(const key of ['executionId','artifactId','reviewId','attempt'])assert.deepEqual(current[key],prior[key]);
for(const key of ['key','title','goal','boundary','acceptance','dependencies','assigneeAgentId','reviewerAgentId','outputFilename','requirementIds','resultSchema','scientificChecks'])assert.deepEqual(current[key],prior[key]);
const calculations=p.runs.filter(r=>r.kind==='TASK'&&r.taskKey==='sasa');assert.equal(calculations.length,1);const calc=calculations[0];assert.equal(calc.revision,1);assert.equal(calc.id,current.executionId);assert.equal(calc.output.id,current.artifactId);assert.equal(calc.scientificValidation.status,'PASSED');
const reviews=p.runs.filter(r=>r.kind==='REVIEW'&&r.taskKey==='sasa');assert.equal(reviews.length,2);assert.equal(reviews[0].revision,1);assert.equal(reviews[1].revision,1);assert.equal(reviews[1].id,current.reviewId);
assert.equal(JSON.parse(files.get(reviews[0].output.id)).result.verdict,'request_changes');assert.equal(JSON.parse(files.get(reviews[1].output.id)).result.verdict,'approve');
for(const r of reviews)assert.ok(r.inputs.some(i=>i.artifactId===current.artifactId&&i.sha256===calc.output.sha256));
const supplement=JSON.parse(files.get(reviews[1].inputs.find(i=>i.filename==='context.json').artifactId));assert.ok(supplement.feedback.includes('cb9f13f43624bb851b6f24e6e3600f00c73e84a24c068430afc906bf04c050e1'));assert.ok(supplement.feedback.length>4000);
const change=p.changes.find(c=>c.baseRevision===1&&c.status==='APPLIED');assert.ok(change);assert.deepEqual(change.result.affectedTaskKeys,['report']);assert.equal(change.result.taskImpacts.find(i=>i.key==='sasa').affected,false);
const reports=p.runs.filter(r=>r.kind==='TASK'&&r.taskKey==='report');assert.equal(reports.length,2);assert.deepEqual(reports.map(r=>r.revision),[1,2]);
for(const r of reports){assert.equal(r.status,'COLLECTED');assert.ok(r.inputs.some(i=>i.artifactId===current.artifactId&&i.sha256===calc.output.sha256));const result=JSON.parse(files.get(r.output.id)).result;assert.equal(result.upstream_sha256,calc.output.sha256);assert.equal(result.total_A2,JSON.parse(files.get(current.artifactId)).result.total_A2);}
const revised=JSON.parse(files.get(reports[1].output.id)).result;assert.equal(typeof revised.summary_zh,'string');assert.ok([...revised.summary_zh].length<=150);assert.match(revised.summary_zh,/\p{Script=Han}/u);assert.equal(revised.limitations_zh.length,2);for(const text of revised.limitations_zh)assert.match(text,/\p{Script=Han}/u);
assert.notEqual(reports[0].output.sha256,reports[1].output.sha256);assert.ok(p.tasks.every(t=>t.status==='APPROVED'));
assert.equal(remote.threadId,calc.threadId);assert.equal(remote.runs.length,1);assert.equal(remote.runs[0].id,calc.runId);assert.equal(remote.runs[0].status,'completed');
console.log(JSON.stringify({passed:true,projectId:p.id,revisions:2,artifacts:files.size,inputReceipts:receipts,upstreamCalculations:1,upstreamReviews:2,reportExecutions:2,reusedArtifactSha256:calc.output.sha256,scope:'Exact exported bytes and recorded workflow identity. Not an independent rerun of remote science, a human usability benchmark, or a multi-account test.'}));
