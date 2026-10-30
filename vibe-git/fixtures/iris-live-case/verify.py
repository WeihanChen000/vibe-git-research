"""Audit the exported REAL Iris handoff; no model requests or synthetic run creation."""
import csv, hashlib, io, json, pathlib, statistics, sys
root=pathlib.Path(sys.argv[1]);p=json.loads((root/'project.json').read_text(encoding='utf-8'));checks=[]
def check(name,ok,detail=''):
 checks.append({'check':name,'passed':bool(ok),'detail':detail})
def content(run,f):return (root/'runs'/run['id']/f['filename']).read_bytes()
def result(run):return json.loads(content(run,run['output']))['result']
runs=p['runs'];check('Project completed',p['phase']=='COMPLETED');check('Two independently owned member bindings',len({r['ownerNodeId'] for r in runs})==2)
for r in runs:
 check(r['id']+' collected',r['status']=='COLLECTED')
 for f in r['inputs']+([r['output']] if r['output'] else []):
  b=content(r,f);check(r['id']+' '+f['filename']+' frozen bytes',len(b)==f['size'] and hashlib.sha256(b).hexdigest()==f['sha256'])
 if r['output']:
  receipts=json.loads(content(r,r['output']))['inputReceipts'];actual={f['filename']:(f['sha256'],f['size']) for f in r['inputs']}
  check(r['id']+' exact receipts',len(receipts)==len(actual) and {f['filename']:(f['sha256'],f['size']) for f in receipts}==actual)
 if r['kind']=='REVIEW':
  target=next((t for t in runs if t['kind']=='TASK' and t['taskKey']==r['taskKey'] and t['output'] and any(f['artifactId']==t['output']['id'] for f in r['inputs'])),None)
  check(r['id']+' independent reviewer',target is not None and target['ownerNodeId']!=r['ownerNodeId'])
audits=[r for r in runs if r['kind']=='TASK' and r['taskKey']=='data_audit'];reviews=[r for r in runs if r['kind']=='REVIEW' and r['taskKey']=='data_audit'];summaries=[r for r in runs if r['kind']=='TASK' and r['taskKey']=='species_summary'];summary=summaries[-1]
raw=content(summary,next(f for f in summary['inputs'] if f['filename']=='source-iris.csv'));rows=[[float(x) for x in r[:4]]+[r[4]] for r in csv.reader(io.StringIO(raw.decode())) if r]
check('Original public CSV preserved',hashlib.sha256(raw).hexdigest()=='0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc')
check('Fault then real repair',len(audits)>=2 and result(audits[0])['rows'][0][0]==6.1 and result(audits[-1])['rows']==rows)
check('Real Biology reject then approve',len(reviews)>=2 and result(reviews[0])['verdict']=='request_changes' and result(reviews[-1])['verdict']=='approve' and all(r['threadId'] and r['runId'] and r['agent']['runtimeAgentId']=='10000000-0000-0000-0000-000000000002' for r in reviews))
handoff=next(f for f in summary['inputs'] if f['filename']=='data_audit.json')
check('Downstream receives approved artifact ID and SHA',handoff['artifactId']==audits[-1]['output']['id'] and handoff['sha256']==audits[-1]['output']['sha256'])
check('Rejected candidate never sent downstream',all(f['artifactId']!=audits[0]['output']['id'] for r in summaries for f in r['inputs']))
check('Downstream is native Biology real run',summary['agent']['runtimeAgentId']=='10000000-0000-0000-0000-000000000002' and summary['threadId'] and summary['runId'])
s=result(summary);actual={r['species']:r for r in s['summary_rows']};computed=[]
for name in sorted({r[4] for r in rows}):
 group=[r for r in rows if r[4]==name];e={'species':name,'n':len(group),'petal_length_min':min(r[2] for r in group),'petal_length_max':max(r[2] for r in group)}
 for i,field in enumerate(['sepal_length','sepal_width','petal_length','petal_width']):e[field+'_mean']=statistics.fmean(r[i] for r in group)
 computed.append(e);check(name+' independent numerical replication',all(abs(actual[name][k]-v)<=1e-6 for k,v in e.items() if k!='species'))
check('Observed range overlap',s['versicolor_virginica_range_overlap'] is True)
summary_reviews=[r for r in runs if r['kind']=='REVIEW' and r['taskKey']=='species_summary']
check('Natural reproducibility defect rejected and repaired',len(summaries)>=2 and result(summary_reviews[0])['verdict']=='request_changes' and result(summary_reviews[0])['checks'][5]['passed'] is False and result(summary_reviews[-1])['verdict']=='approve')
prior={r['species']:r for r in result(summaries[0])['summary_rows']}
check('Repair preserves independently verified statistics within frozen 1e-6 tolerance',all(abs(row[k]-prior[row['species']][k])<=1e-6 for row in s['summary_rows'] for k in row if k!='species'))
check('Executable source delivered in frozen result',any('import ' in line and '\n' in line for line in s['limitations']))
for r in runs:
 if r['threadId']:
  proof_path=root/'remote-proof'/r['id']/'provenance.json'
  proof=json.loads(proof_path.read_text(encoding='utf-8')) if proof_path.exists() else {}
  check(r['id']+' native completed runtime proof',proof.get('agentId')==r['agent']['runtimeAgentId'] and proof.get('runId')==r['runId'] and proof.get('status')=='completed')
last=[r for r in runs if r['kind']=='REVIEW' and r['taskKey']=='species_summary'][-1]
check('Codex final independent review approves',last['agent'].get('platform')=='codex' and result(last)['verdict']=='approve' and all(c['passed'] for c in result(last)['checks']))
report={'projectId':p['id'],'phase':p['phase'],'scope':'Real public Iris, current Codex and native SciencePAL Biology; one human account; controlled fault in first candidate only','passed':sum(c['passed'] for c in checks),'total':len(checks),'checks':checks,'independentlyComputed':computed,'handoff':handoff,'sciencepalRuns':[{'kind':r['kind'],'task':r['taskKey'],'threadId':r['threadId'],'runId':r['runId']} for r in runs if r['threadId']]}
(root/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'passed':report['passed'],'total':report['total'],'failed':[c for c in checks if not c['passed']]},ensure_ascii=False));sys.exit(0 if all(c['passed'] for c in checks) else 1)
