"""Offline audit of the published simulated UI run; never invokes an Agent."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[3];E=ROOT/'docs/submission/operations-demo/evidence'
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
s=load(E/'state.json');p=s['projects'][0];manifest=load(E/'manifest.json')['artifacts'];passed=[]
def check(condition,label):
 assert condition,label
 passed.append(label)
def artifact(id):return (E/manifest[id]['path']).read_bytes()
for id,m in manifest.items():
 b=artifact(id);assert len(b)==m['size'] and hashlib.sha256(b).hexdigest()==m['sha256'],id
check(True,'21 published artifact byte hashes match original receipts')
receipts=0
for r in p['runs']:
 env=json.loads(artifact(r['output']['id']));assert env['revision']==r['revision'];assert len(env['inputReceipts'])==len(r['inputs'])
 for a in r['inputs']:
  actual=next(v for v in env['inputReceipts'] if v['filename']==a['filename']);assert actual['sha256']==a['sha256'] and actual['size']==a['size'];receipts+=1
check(True,'Every run covers every frozen input with exact byte receipts')
check(p['revision']==2 and p['phase']=='COMPLETED','R2 completed through real Host state transitions')
check(len(p['runs'])==10 and all(r['status']=='COLLECTED' for r in p['runs']),'All 10 simulated jobs collected, no failed jobs hidden in completed take')
check(s['counts']==dict(align=2,compute=1,review=4,report=2),'Exactly one calculation, two reports and four reviews')
calc=[r for r in p['runs'] if r['kind']=='TASK' and r['taskKey']=='sasa'];reviews=[r for r in p['runs'] if r['kind']=='REVIEW' and r['taskKey']=='sasa'];reports=[r for r in p['runs'] if r['kind']=='TASK' and r['taskKey']=='report']
check(len(calc)==1 and len(reviews)==2,'Supplement adds a review, never a second producer job')
verdicts=[json.loads(artifact(r['output']['id']))['result']['verdict'] for r in reviews]
check(verdicts==['request_changes','approve'],'Recorded rejection followed by independent simulated approval')
check(all(next(a for a in r['inputs'] if a['filename']=='sasa.json')['artifactId']==calc[0]['output']['id'] for r in reviews),'Both reviews bind the exact same original result artifact')
check(calc[0]['scientificValidation']['status']=='PASSED' and calc[0]['scientificValidation']['artifactSha256']==calc[0]['output']['sha256'],'Numerical gate bound to actual calculation artifact')
check(reports[0]['createdAt']>=reviews[-1]['updatedAt'],'First report was dispatched only after supplementary approval')
old=next(t for t in p['history'][0]['tasks'] if t['key']=='sasa');new=next(t for t in p['tasks'] if t['key']=='sasa')
check(all(old[k]==new[k] for k in ['artifactId','executionId','reviewId']),'R1 and R2 retain result, execution and approving review identity')
check(new['carriedFrom']['revision']==1,'R2 explicitly records reuse from R1')
check(p['changes'][-1]['result']['affectedTaskKeys']==['report'],'Change affects report only')
check(next(t for t in p['changes'][-1]['result']['taskImpacts'] if t['key']=='sasa')['fingerprint']==new['carriedFrom']['fingerprint'],'Reused task matches change-review fingerprint')
for r in reports:
 context=json.loads(artifact(next(a['artifactId'] for a in r['inputs'] if a['filename']=='context.json')));a=context['upstream'][0]['approval'];b=a['reviewFileUtf8'].encode();assert hashlib.sha256(b).hexdigest()==a['reviewArtifact']['sha256'];assert a['reviewedArtifact']['id']==calc[0]['output']['id'];assert a['reviewRunId']==reviews[-1]['id'];assert a['verdict']=='approve'
check(True,'Both report inputs carry the same result plus verified approving review bytes')
check(json.loads(artifact(reports[0]['output']['id']))['result']!=json.loads(artifact(reports[1]['output']['id']))['result'],'R2 report changed while upstream identity remained fixed')
result={'scope':'Offline consistency checks of deterministic simulated UI run, not fresh SciencePAL or Codex model execution. Historical source evidence is separate.','passed':len(passed),'checks':passed,'artifacts':len(manifest),'inputReceipts':receipts,'jobs':len(p['runs']),'counts':s['counts'],'sameUpstream':{k:new[k] for k in ['artifactId','executionId','reviewId']},'resultSha256':calc[0]['output']['sha256'],'historicalRealEvidence':'../../research/latest-governance-live/manifest.json'}
(E/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'checksPassed':len(passed),'artifacts':len(manifest),'inputReceipts':receipts,'jobs':len(p['runs'])}))
