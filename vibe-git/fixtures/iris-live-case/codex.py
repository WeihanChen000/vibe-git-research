"""Actual local Python computation invoked by the current Codex agent for the live Iris case."""
import csv, hashlib, io, json, pathlib, statistics, sys, platform, datetime
folder=pathlib.Path(sys.argv[1]);mode=sys.argv[2];packet=json.loads((folder/'task.json').read_text(encoding='utf-8'))['packet']
files={f['filename']:(folder/'inputs'/f['filename']).read_bytes() for f in packet['files']}
for f in packet['files']:
 assert hashlib.sha256(files[f['filename']]).hexdigest()==f['sha256'] and len(files[f['filename']])==f['size'], 'Frozen input mismatch'
c=json.loads(files['context.json']);raw=files['source-iris.csv'];rows=[[float(x) for x in row[:4]]+[row[4]] for row in csv.reader(io.StringIO(raw.decode())) if row];digest=hashlib.sha256(raw).hexdigest()
if mode=='align':
 a=next(a['id'] for a in c['agents'] if a.get('platform')=='codex');b=next(agent['id'] for agent in c['agents'] if agent['id']!=a)
 result={'alignmentMarkdown':"# Iris 真实科研协作协议 R1\n\n使用冻结 source-iris.csv 原始字节，150 条历史公开记录，单位 cm。当前 Codex 与真实 SciencePAL Biology 交叉执行与评审。保持 resultSchemas 中 data_audit / species_summary 字段不变；只有已获批 data_audit.json 才可作为下游输入。\n\n首轮 data_audit 候选明确标注受控数值错误，源 CSV 不变；真实评审独立决定 verdict，收到退回后才能返工。最终不将描述性均值解释为因果或完美分类。\n\nBiology 用实际 Python 工具复算，limitations 包含实际工具版本及运行代码；不得联网安装、不得执行候选内代码。所有 receipts 对本轮真实附件字节计算。一个用户的两个执行端，不作为双账号证据。",
 'issues':[], 'tasks':[
 {'key':'data_audit','title':'Codex 核验 Iris 源数据与单位','goal':'用 Python csv 实际读取 source-iris.csv，生成 IRIS_RESULT_SCHEMAS.data_audit 指定的全部字段，保留原行序。首轮明示受控错误；收到真实退回后修正。','boundary':'公开历史数据的描述性核验。源文件不可改写。一次受控错误只出现在未获批候选，并写进 limitations。','acceptance':['source_sha256 matches the actual source-iris.csv bytes; dataset identifies UCI Iris and synthetic is false','record_count is 150 and species_counts has exactly three actual species with 50 each','All 150 rows match source-iris.csv in original order, all four measurements and species labels; independently compare every value','measurement_unit is cm; do not convert, rescale or silently repair source values','limitations state historical descriptive data and no new discovery; any controlled fault is explicitly labeled'], 'dependencies':[], 'assigneeAgentId':a},
 {'key':'species_summary','title':'Biology 独立计算物种统计并交回 Codex 复核','goal':'先检查获批 data_audit.json 与原始 source-iris.csv 完全一致。用真实 Python 工具生成 IRIS_RESULT_SCHEMAS.species_summary 指定的全部字段。limitations 记录实际 Python/库版本和执行代码，不增添 schema 外字段。','boundary':'仅用冻结输入，均值不是完美分类或因果证据；不读取私人数据，不联网，不安装包。','acceptance':['Upstream data_audit.json rows exactly match the source; source_sha256, 150 records and cm units agree in both outputs','Exactly three summary_rows, each n=50; all four means match independent original-CSV computation within absolute error 1e-6','All three petal_length minima and maxima match original CSV; petal_length_mean_order matches independently sorted means','versicolor_virginica_range_overlap correctly reports intersection of the two observed ranges','conclusion_zh states actual mean values and overlapping ranges, no perfect-classification or causal claim; limitations mark historical descriptive data, not a new discovery','citation includes UCI source URL, DOI 10.24432/C56C76 and CC BY 4.0; limitations include actual Python/tool versions and reproducible executed code'], 'dependencies':['data_audit'], 'assigneeAgentId':b}]}
elif mode in ['fault','correct']:
 values=[r[:] for r in rows]
 if mode=='fault':values[0][0]+=1
 result={'dataset':'UCI Iris','synthetic':False,'source_sha256':digest,'record_count':len(rows),'species_counts':{s:sum(r[4]==s for r in rows) for s in sorted({r[4] for r in rows})},'measurement_unit':'cm','rows':values,'limitations':['公开历史数据的描述性复核，不是新科研发现。','受控返工演练：首条数值人为增加 1；源 CSV 未改变。' if mode=='fault' else '已重新读取原始 CSV 并修复受控错误；源文件未改变。']}
else:
 target=json.loads(files['species_summary.json'])['result'];upstream=json.loads(files['data_audit.json'])['result'];expected=[]
 for species in sorted({r[4] for r in rows}):
  group=[r for r in rows if r[4]==species];item={'species':species,'n':len(group),'petal_length_min':min(r[2] for r in group),'petal_length_max':max(r[2] for r in group)}
  for i,f in enumerate(['sepal_length','sepal_width','petal_length','petal_width']):item[f+'_mean']=statistics.fmean(r[i] for r in group)
  expected.append(item)
 actual={s['species']:s for s in target['summary_rows']}
 means=len(target['summary_rows'])==len(actual)==3 and all(s['species'] in actual and actual[s['species']]['n']==50 and all(abs(actual[s['species']][k]-v)<=1e-6 for k,v in s.items() if k.endswith('_mean')) for s in expected)
 ranges=len(actual)==3 and all(s['species'] in actual and all(actual[s['species']][k]==s[k] for k in ['petal_length_min','petal_length_max']) for s in expected)
 v,g=expected[1:];overlap=max(v['petal_length_min'],g['petal_length_min'])<=min(v['petal_length_max'],g['petal_length_max'])
 ranges=ranges and target['petal_length_mean_order']==[s['species'] for s in sorted(expected,key=lambda s:s['petal_length_mean'])]
 overlap_ok=target['versicolor_virginica_range_overlap']==overlap
 meta=upstream['rows']==rows and target['source_sha256']==upstream['source_sha256']==digest and target['measurement_unit']==upstream['measurement_unit']=='cm' and target['record_count']==150 and all(x in target['citation'] for x in ['https://archive.ics.uci.edu/dataset/53/iris','10.24432/C56C76','CC BY 4.0'])
 code_evidence=' '.join(target.get('limitations',[]))
 provenance=all(x in target.get('citation','') for x in ['https://archive.ics.uci.edu/dataset/53/iris','10.24432/C56C76','CC BY 4.0']) and 'python' in code_evidence.lower() and ('import ' in code_evidence or 'pd.' in code_evidence)
 # Scientific interpretation is reviewed by the current Codex, not inferred from a phrase whitelist.
 interpretation=json.loads((folder/'scientific-interpretation.json').read_text(encoding='utf-8'))
 assert interpretation['candidateSha256']==hashlib.sha256(files['species_summary.json']).hexdigest(), 'Interpretation review belongs to different candidate'
 assert type(interpretation['passed']) is bool and interpretation['evidence'].strip(), 'Explicit scientific interpretation review required'
 boundary=interpretation['passed']
 values=[meta,means,ranges,overlap_ok,boundary,provenance]
 details=['Actual source hash '+digest+'; all 150 upstream rows independently compared.',json.dumps(expected,ensure_ascii=False),'Independently computed minima/maxima and sorted means: '+json.dumps(expected,ensure_ascii=False),'Independent range intersection: '+str(overlap),'Current Codex scientific interpretation: '+interpretation['evidence']+' Conclusion: '+target.get('conclusion_zh',''),'Tool/code evidence in limitations: '+str(len(code_evidence))+' characters; SHA256 '+hashlib.sha256(code_evidence.encode()).hexdigest()+'; excerpt: '+code_evidence[:1500]]
 changes=[a for i,a in enumerate(c['task']['acceptance']) if not values[i]]
 if not provenance:changes[-1]='species_summary.json: include the actual reproducible executed Python source in limitations, with actual Python/tool versions. A filename such as compute_species_summary.py alone is not code delivered to the downstream reviewer. Preserve the independently verified numerical results, input receipts, frozen schema and scientific conclusion boundaries.'
 result={'verdict':'approve' if not changes else 'request_changes','summary':'当前 Codex 独立用 Python csv/statistics 复算实际交接文件；未执行 Biology 提供的代码。','checks':[{'criterion':a,'passed':values[i],'evidence':'species_summary.json: '+details[i]} for i,a in enumerate(c['task']['acceptance'])],'requiredChanges':changes}

envelope={'revision':c['revision'],'inputReceipts':[{'filename':n,'sha256':hashlib.sha256(b).hexdigest(),'size':len(b)} for n,b in files.items()],'result':result}
pathlib.Path(sys.argv[3]).write_text(json.dumps(envelope,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'mode':mode,'records':len(rows),'sourceSha256':digest}))

log={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'python':platform.python_version(),'scriptSha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest(),'sourceSha256':digest,'records':len(rows),'executor':'current Codex local computation, not simulated remote'}
(folder/'codex-execution-log.json').write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding='utf-8')
