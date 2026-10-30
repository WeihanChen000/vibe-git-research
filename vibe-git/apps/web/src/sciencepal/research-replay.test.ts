import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseReplay,replayState,replayRunSummary} from './research-replay';
import {researchHandoffs,taskDisplay} from './research-model';
const bundle=parseReplay(JSON.parse(readFileSync(new URL('../../public/research-replay/1crn/case.json',import.meta.url),'utf8')));
const at=(id:string)=>bundle.steps.find(s=>s.id===id)!.state.projects[0]!;
describe('Verified real case replay',()=>{
 it('removes live capabilities even if an exported state contains them',()=>{const copy=structuredClone(bundle);Object.assign(copy.steps[0]!.state,{csrfToken:'not-a-token',browserCommands:true,localResearch:true,interactiveSimulation:true,presence:{}});const s=replayState(copy,0);expect(s.csrfToken).toBeUndefined();expect(s.browserCommands).toBeUndefined();expect(s.localResearch).toBeUndefined();expect(s.presence).toBeUndefined();expect(s.interactiveSimulation).toBeUndefined();expect(s.replay?.id).toBe('1crn');});
 it('preserves the real rejection, invalid review and later approval',()=>{expect(at('rejected').tasks[0]!.review?.verdict).toBe('request_changes');expect(at('invalid-review').runs.some(r=>r.status==='INVALID')).toBe(true);expect(at('completed').phase).toBe('COMPLETED');expect(at('completed').runs.some(r=>r.status==='INVALID')).toBe(true);});
 it('does not show delivery before the actual consumer receipt',()=>{expect(researchHandoffs(at('rejected'))[0]!.state).toBe('blocked');expect(researchHandoffs(at('released'))[0]!.state).toBe('released');expect(researchHandoffs(at('needs-input'))[0]!.state).toBe('released');expect(researchHandoffs(at('handoff'))[0]!.state).toBe('delivered');});
 it('shows actual waiting, then one same-thread continuation with no future output',()=>{const p=at('needs-input');expect(taskDisplay(p,p.tasks[1]!).label).toBe('等待本人回答');const resumed=at('resumed'),r=resumed.runs.find(r=>r.taskKey==='sasa'&&r.kind==='TASK')!;expect(r.status).toBe('RUNNING');expect(r.output).toBeNull();const c=replayRunSummary(resumed);expect(c).toHaveLength(1);expect(c[0]!.threadId).toBe(r.threadId);expect(c[0]!.previousRunId).not.toBe(c[0]!.runId);expect(bundle.steps.find(s=>s.id==='resumed')!.origin).toBe('continuation-receipt');});
 it('only serves exact original artifact bytes with manifest hashes',()=>{for(const f of Object.values(bundle.files)){const path=new URL('../../public'+f.url,import.meta.url);const bytes=readFileSync(path);expect(bytes.length).toBe(f.size);expect(createHash('sha256').update(bytes).digest('hex')).toBe(f.sha256);}for(const s of bundle.steps)for(const r of s.state.projects[0]!.runs)for(const f of [...r.inputs,...(r.output?[{...r.output,artifactId:r.output.id}]:[])])expect(bundle.files[f.artifactId]!.sha256).toBe(f.sha256);});
 it('rejects external or traversal evidence URLs and invalid stages',()=>{const c=structuredClone(bundle);c.evidenceUrl='https://example.com/';expect(()=>parseReplay(c)).toThrow();c.evidenceUrl='/research-replay/1crn/../secret';expect(()=>parseReplay(c)).toThrow();c.evidenceUrl=bundle.evidenceUrl;c.steps=[];expect(()=>parseReplay(c)).toThrow();});
});
const iris=parseReplay(JSON.parse(readFileSync(new URL('../../public/research-replay/iris/case.json',import.meta.url),'utf8')));
const irisAt=(id:string)=>iris.steps.find(s=>s.id===id)!.state.projects[0]!;
describe('Iris replay with two authentic rework cycles',()=>{
 it('separates controlled numerical rejection from actual code-delivery rejection',()=>{
  expect(iris.steps).toHaveLength(9);expect(iris.steps.every(s=>s.origin==='captured-snapshot')).toBe(true);
  const first=irisAt('numeric-rejected'),second=irisAt('code-rejected');
  expect(first.tasks[0]!.review?.verdict).toBe('request_changes');expect(first.tasks[0]!.review?.checks[2]!.passed).toBe(false);
  expect(second.tasks[1]!.review?.checks.map(c=>c.passed)).toEqual([true,true,true,true,true,false]);
  expect(second.tasks[1]!.review?.requiredChanges.join(' ')).toContain('actual reproducible executed Python source');
  expect(irisAt('numeric-rework').tasks[0]!.attempt).toBe(2);expect(irisAt('code-rework').tasks[1]!.attempt).toBe(2);
  expect(irisAt('completed').tasks.every(t=>t.status==='APPROVED'&&t.attempt===2)).toBe(true);
 });
 it('uses actual approved file identity and does not imply handoff until receipts exist',()=>{
  expect(researchHandoffs(irisAt('numeric-rejected'))[0]!.state).toBe('blocked');
  expect(researchHandoffs(irisAt('released'))[0]!.state).toBe('released');
  expect(researchHandoffs(irisAt('handoff'))[0]!.state).toBe('delivered');
  const final=irisAt('completed'),audits=final.runs.filter(r=>r.kind==='TASK'&&r.taskKey==='data_audit');
  for(const run of final.runs.filter(r=>r.kind==='TASK'&&r.taskKey==='species_summary')){
   expect(run.inputs.some(f=>f.artifactId===audits[0]!.output!.id)).toBe(false);
   expect(run.inputs.find(f=>f.filename==='data_audit.json')!.artifactId).toBe(audits[1]!.output!.id);
  }
  expect(replayRunSummary(final)).toEqual([]);
 });
 it('isolates case paths, strips live capabilities and keeps every byte authentic',()=>{
  expect(replayState(iris,5).replay?.brief).toContain('代码缺失退回');
  expect(replayState(iris,5).browserCommands).toBeUndefined();
  for(const f of Object.values(iris.files)){
   const b=readFileSync(new URL('../../public'+f.url,import.meta.url));expect(b.length).toBe(f.size);expect(createHash('sha256').update(b).digest('hex')).toBe(f.sha256);
  }
  for(const step of iris.steps)for(const r of step.state.projects[0]!.runs)for(const f of [...r.inputs,...(r.output?[{...r.output,artifactId:r.output.id}]:[])])expect(iris.files[f.artifactId]!.sha256).toBe(f.sha256);
  const text=JSON.stringify(iris);expect(text).not.toMatch(/"(?:claimId|apiKey|nodeToken|csrfToken|inviteToken)":/);
  for(const url of ['/research-replay/1crn/evidence.json','/research-replay/iris/%2e%2e/file']){const bad=structuredClone(iris);bad.evidenceUrl=url;expect(()=>parseReplay(bad)).toThrow();}
 });
});

import {scienceResult,independentEvidence} from './scientific-evidence';
describe('Stage-bound scientific evidence',()=>{
 it('does not leak final verification into earlier stages',()=>{
  for(let i=0;i<bundle.steps.length-1;i++)expect(replayState(bundle,i).replay?.scienceReports).toEqual([]);
  expect(replayState(bundle,bundle.steps.length-1).replay?.scienceReports).toHaveLength(1);
  const b=structuredClone(bundle);b.scienceReports![0]!.candidateSha256='0'.repeat(64);expect(()=>parseReplay(b)).toThrow();
 });
 it('checks the exact verification artifact and refuses a mismatched candidate',()=>{
  const meta=bundle.scienceReports![0]!,bytes=readFileSync(new URL('../../public'+meta.url,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(meta.sha256);expect(bytes.length).toBe(meta.size);
  const raw=JSON.parse(bytes.toString());expect(independentEvidence(raw,meta.candidateSha256,meta.reviewArtifactId).passed).toBe(true);
  expect(()=>independentEvidence(raw,'wrong',meta.reviewArtifactId)).toThrow();
  raw.metrics[0].observed*=2;expect(independentEvidence(raw,meta.candidateSha256,meta.reviewArtifactId).passed).toBe(false);
 });
 it('does not fabricate missing tool versions or treat prose as actual code',()=>{
  const a=scienceResult({result:{toolLog:'not structured'}});expect(a.log).toEqual({});expect(a.hasCode).toBe(false);expect(a.total).toBeUndefined();
  expect(scienceResult({result:'A narrative result'}).method).toBeNull();
 });
});

 it('renders a non-1CRN research method and general comparison without case IDs',()=>{
  const result=scienceResult({result:{researchEvidence:{version:1,tools:[{name:'Python statistics',version:'3.x'}],parameters:[{name:'样本数量',value:12}],measurements:[{name:'平均值',value:2.5,unit:'a.u.'}],limitations:['合成测试样本，非科研结论']}}});
  expect(result.method?.measurements[0]!.name).toBe('平均值');
  expect(independentEvidence({formatVersion:1,candidateSha256:'candidate',reviewArtifactId:'review',passed:true,method:'Independent arithmetic fixture',metrics:[{name:'平均值',observed:2.5,reference:2.5,tolerance:0.001,comparison:'absolute',unit:'a.u.'}],checks:[{passed:true}]},'candidate','review').passed).toBe(true);
 });
