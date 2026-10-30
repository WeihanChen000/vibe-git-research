"""Codex independent scientific review of freshly handed-off SciencePAL output."""
import json,hashlib,sys,math
from pathlib import Path
root=Path(sys.argv[1]);out=Path('data/mixed-live-20261030');inputs=root/'inputs'
ctx=json.loads((inputs/'context.json').read_text('utf-8'));candidate=json.loads((inputs/'sasa.json').read_text('utf-8'))['result']
ref=json.loads((out/'codex-reference.json').read_text('utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source_ok=candidate.get('sourceSha256')==sha(inputs/'source-1crn.txt')==ref['source_sha256']
upstream_ok=candidate.get('upstreamSha256')==sha(inputs/'geometry.json')
counts_ok=candidate.get('atomCount')==327 and candidate.get('residueCount')==46
code=candidate.get('pythonCode','');log=candidate.get('toolLog','')
expected={'C':1.70,'N':1.55,'O':1.52,'S':1.80}
tools_ok=all(k in code for k in ['PDBParser','ShrakeRupley']) and bool(log) and candidate.get('probeRadiusA')==1.4 and candidate.get('nPoints')==960 and candidate.get('atomicRadiiA')==expected
area=candidate.get('totalSasaA2');rel=abs(area-ref['total_A2'])/ref['total_A2']
res=candidate.get('residues',[]);byid={r['id']:r for r in res};comparisons=[]
for r in ref['residues']:
    if r['name']!='CYS':continue
    got=byid.get(r['id'],{}).get('sasaA2');expected_area=r['sasa_A2'];tolerance=max(3,0.05*expected_area)
    comparisons.append(dict(id=r['id'],sciencepalA2=got,codexA2=expected_area,differenceA2=None if got is None else abs(got-expected_area),toleranceA2=tolerance,passed=got is not None and abs(got-expected_area)<=tolerance))
numeric_ok=rel<=.03 and len(comparisons)==6 and all(x['passed'] for x in comparisons)
sum_area=sum(r['sasaA2'] for r in res)
sanity_ok=len(res)==len(byid)==46 and set(byid)==set(range(1,47)) and all(math.isfinite(r['sasaA2']) and r['sasaA2']>=0 for r in res) and abs(sum_area-area)<.001 and bool(candidate.get('limitations'))
flags=[source_ok and upstream_ok and counts_ok,tools_ok,numeric_ok,sanity_ok]
evidence=[f"sasa.json sourceSha256 matches actual input: {source_ok}; upstream geometry.json bytes: {upstream_ok}; counts: {counts_ok}. Hashes independently recomputed locally.",f"sasa.json pythonCode contains PDBParser and ShrakeRupley; reported probe={candidate.get('probeRadiusA')}, nPoints={candidate.get('nPoints')}, radii={candidate.get('atomicRadiiA')}; toolLog={str(log)[:1600]}. Remote reported code/log reviewed without executing returned code.",f"sasa.json total={area:.9f} A^2; independently rerun NumPy 5000-point baseline={ref['total_A2']:.9f}; relative difference={rel:.9%}. CYS checks: {json.dumps(comparisons)}",f"sasa.json contains {len(res)} unique-count {len(byid)} residues; residue sum={sum_area:.9f}, total={area:.9f}; limitations={candidate.get('limitations')}."]
checks=[dict(criterion=c,passed=f,evidence=e) for c,f,e in zip(ctx['task']['acceptance'],flags,evidence)]
verification=dict(passed=all(flags),sourceSha256=sha(inputs/'source-1crn.txt'),upstreamSha256=sha(inputs/'geometry.json'),sciencepalTotalA2=area,codexTotalA2=ref['total_A2'],relativeDifference=rel,cysteines=comparisons,checks=checks)
(out/'scientific-verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2),'utf-8')
receipt=[dict(filename=f.name,sha256=sha(f),size=len(f.read_bytes())) for f in inputs.iterdir()]
result=dict(verdict='approve' if all(flags) else 'request_changes',summary='Codex independently recomputed the public structure with NumPy; numerical and provenance checks passed.' if all(flags) else 'One or more independent checks failed; inspect concrete evidence.',checks=checks,requiredChanges=[] if all(flags) else [c['criterion'] for c in checks if not c['passed']])
(root/'review-result.json').write_text(json.dumps(dict(revision=ctx['revision'],inputReceipts=receipt,result=result),ensure_ascii=False,indent=2),'utf-8')
print(json.dumps(verification,ensure_ascii=False))
