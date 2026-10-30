// Offline verification only: never executes artifact code or calls an account.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('../fixtures/integrated-live/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
assert.equal(manifest.phase,'COMPLETED');
const files=new Map();
for(const f of manifest.files){
 assert.match(f.file,/^[a-z0-9-]+\.(json|pdb)$/);
 const bytes=await readFile(new URL(f.file,base));
 assert.equal(bytes.length,f.size,f.file+' size');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.file+' hash');
 assert(!files.has(f.artifactId),'duplicate artifact');
 files.set(f.artifactId,{...f,...(f.file.endsWith('.json')?{data:JSON.parse(bytes.toString('utf8'))}:{})});
}
let receipts=0,withheld=0;
for(const run of manifest.runs){
 const out=run.output&&files.get(run.output.id); if(!out)continue;
 assert.equal(out.sha256,run.output.sha256);assert.equal(out.size,run.output.size);
 assert.equal(out.data.revision,run.revision);
 assert.equal(out.data.inputReceipts.length,run.inputs.length);
 assert.equal(new Set(out.data.inputReceipts.map(x=>x.filename)).size,run.inputs.length);
 for(const input of run.inputs){
  const receipt=out.data.inputReceipts.find(x=>x.filename===input.filename);
  assert(receipt,'missing receipt '+input.filename);
  assert.equal(receipt.sha256,input.sha256);assert.equal(receipt.size,input.size);
  const publicFile=files.get(input.artifactId);
  if(publicFile){assert.equal(publicFile.sha256,input.sha256);assert.equal(publicFile.size,input.size);receipts++;}
  else {assert.equal(input.filename,'context.json','unexpected withheld input');withheld++;}
 }
}
const task=k=>{const t=manifest.tasks.find(t=>t.key===k);assert(t);assert.equal(t.status,'APPROVED');return t;};
const output=r=>{assert(r?.output);return files.get(r.output.id).data.result;};
const sasa=task('sasa'),synthesis=task('synthesis');
const pilot=manifest.runs.find(r=>r.kind==='TASK'&&r.taskKey==='sasa');
const final=manifest.runs.find(r=>r.id===sasa.executionId);
const downstream=manifest.runs.find(r=>r.id===synthesis.executionId);
assert.notEqual(pilot.id,final.id);
assert.equal(pilot.platform,'sciencepal');assert.equal(final.platform,'sciencepal');assert.equal(downstream.platform,'codex');
assert.equal(output(pilot).n_points,100);assert.equal(output(final).n_points,1000);
assert.equal(output(final).source_sha256,manifest.sourceSha256);
assert.equal(output(final).method,'Shrake-Rupley');assert.equal(output(final).probe_radius_A,1.4);
const finalResult=output(final), conv=finalResult.convergence;
assert.equal(finalResult.residues.length,46);assert.equal(finalResult.atom_count,327);
assert.equal(conv.total_1000_A2,finalResult.total_A2);
assert(Number.isFinite(conv.total_5000_A2)&&conv.total_5000_A2>0);
const ratio=Math.abs(conv.total_1000_A2-conv.total_5000_A2)/conv.total_5000_A2;
assert(Math.abs(ratio-conv.ratio)<1e-12);assert(ratio<=0.02);
assert.equal(finalResult.provenance.pilot.sha256,pilot.output.sha256);
assert.equal(typeof finalResult.code,'string');assert(finalResult.code.length>30);

const rejected=manifest.runs.find(r=>r.kind==='REVIEW'&&r.taskKey==='sasa'&&r.status==='COLLECTED'&&output(r).verdict==='request_changes');
assert(rejected);assert(output(rejected).checks.some(c=>c.passed===false));
assert(Date.parse(rejected.updatedAt)<=Date.parse(final.createdAt),'rework before rejection');
for(const t of [sasa,synthesis]){
 const r=manifest.runs.find(r=>r.id===t.reviewId);assert.equal(r.status,'COLLECTED');
 const result=output(r);assert.equal(result.verdict,'approve');assert.equal(result.requiredChanges.length,0);
 assert.equal(result.checks.length,t.acceptance.length);
 for(const criterion of t.acceptance){const c=result.checks.find(c=>c.criterion===criterion);assert(c?.passed===true);assert(c.evidence.includes(t.outputFilename));assert(c.evidence.length<=3000);}
}
const approvedReview=manifest.runs.find(r=>r.id===sasa.reviewId);
assert(Date.parse(approvedReview.updatedAt)<=Date.parse(downstream.createdAt),'handoff before approval');
const upstream=downstream.inputs.find(i=>i.filename==='sasa.json');
assert.equal(upstream.artifactId,final.output.id);assert.equal(upstream.sha256,final.output.sha256);
assert.notEqual(upstream.sha256,pilot.output.sha256);
assert.equal(output(downstream).upstream_sha256,final.output.sha256);
const approval=downstream.upstreamApprovals.find(a=>a.reviewRunId===approvedReview.id);
assert(approval,'missing approval evidence in final downstream packet');
assert.equal(approval.verdict,'approve');assert.equal(approval.reviewedArtifact.id,final.output.id);
assert.equal(approval.reviewedArtifact.sha256,final.output.sha256);
assert.equal(approval.reviewArtifact.sha256,approvedReview.output.sha256);
const synthesisRejected=manifest.runs.find(r=>r.kind==='REVIEW'&&r.taskKey==='synthesis'&&r.status==='COLLECTED'&&output(r).verdict==='request_changes');
assert(synthesisRejected,'missing actual synthesis rejection');
assert(Date.parse(synthesisRejected.updatedAt)<=Date.parse(downstream.createdAt));

console.log(JSON.stringify({passed:true,files:files.size,verifiedPublicInputReceipts:receipts,privateContextReceipts:withheld,scope:'Frozen public bytes, recorded review/rework order and approved handoff; approval-context excerpts are operator-exported; private context bodies and historical remote execution are not independently attested by this offline check.'}));
