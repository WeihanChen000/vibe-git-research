/** Offline integrity and outcome check for published synthetic workflows. No browser/model. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../docs/research/evidence/workflow-experiments/',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const manifest=await json('manifest.json');
for(const f of manifest.files){assert.ok(!f.path.includes('..')&&!f.path.startsWith('/'));const bytes=await readFile(new URL(f.path,root));assert.equal(bytes.length,f.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);}
const summary=await json('summary.json');assert.deepEqual(summary.cases.map(c=>c.id),['calibration','kinetics']);let receipts=0;
for(const c of summary.cases){assert.equal(c.checkpoints.length,12);assert.ok(c.checkpoints.every(x=>x.passed));assert.ok(!c.failure);assert.equal(c.pageErrors.length,0);}
assert.equal(summary.egoLite.status,'completed');
for(const c of [...summary.cases,{id:'ego-calibration'}]){
 const expected=c.id==='kinetics'?Math.log(2)/0.1:2.5;
 const stages=await Promise.all(['evidence-r1.json','evidence.json'].map(name=>json(c.id+'/'+name)));
 assert.deepEqual(stages.map(e=>e.revision),[1,2]);
 for(const e of stages){assert.ok(e.allApproved);assert.ok(e.handoffs.length&&e.handoffs.every(h=>h.checks.every(x=>x.passed)));
  for(const r of e.runs){if(!r.output)continue;const output=await json(`${c.id}/files/${r.output.id}-${r.output.filename}`);assert.equal(output.revision,r.revision);
   assert.equal(output.inputReceipts.length,r.inputs.length);for(const input of r.inputs){const receipt=output.inputReceipts.find(x=>x.filename===input.filename);assert.ok(receipt);assert.equal(receipt.sha256,input.sha256);assert.equal(receipt.size,input.size);receipts++;}}
  for(const t of e.tasks){assert.equal(t.task.status,'APPROVED');const a=t.attempts.find(x=>x.execution.id===t.task.executionId);assert.ok(a);assert.ok(a.reviews.some(r=>r.run.id===t.task.reviewId&&r.result?.verdict==='approve'&&r.result.checks.every(c=>c.passed)));}
  const report=e.tasks.find(t=>t.task.key==='report').task,run=e.runs.find(r=>r.id===report.executionId);const output=await json(`${c.id}/files/${run.output.id}-${run.output.filename}`);
  assert.ok(Math.abs(output.result.value-expected)<1e-9);assert.equal(output.result.synthetic,true);
 }
 assert.equal(stages[0].tasks.find(t=>t.task.key==='fit').task.artifactId,stages[1].tasks.find(t=>t.task.key==='fit').task.artifactId);
 assert.equal(stages[1].tasks.find(t=>t.task.key==='fit').task.carriedFrom.revision,1);
}
console.log(JSON.stringify({passed:true,cases:2,completedRuns:3,egoRevisions:2,browserCheckpoints:24,files:manifest.files.length,receiptReferences:receipts,scope:'Frozen synthetic evidence, not remote model execution or an unassisted human user study.'}));
