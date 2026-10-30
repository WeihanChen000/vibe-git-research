"""Independent Python executor for the UI rehearsal; never calls a model."""
import csv, hashlib, io, json, pathlib, statistics, sys
folder=pathlib.Path(sys.argv[1]);mode=sys.argv[2];packet=json.loads((folder/'task.json').read_text(encoding='utf-8'))['packet']
files={f['filename']:(folder/'inputs'/f['filename']).read_bytes() for f in packet['files']}
c=json.loads(files['context.json']);raw=files['source-iris.csv'];rows=[[float(x) for x in row[:4]]+[row[4]] for row in csv.reader(io.StringIO(raw.decode())) if row];digest=hashlib.sha256(raw).hexdigest()
if mode in ['fault','correct']:
 values=[r[:] for r in rows]
 if mode=='fault':values[0][0]+=1
 result={'dataset':'UCI Iris','synthetic':False,'source_sha256':digest,'record_count':len(rows),'species_counts':{s:sum(r[4]==s for r in rows) for s in sorted({r[4] for r in rows})},'measurement_unit':'cm','rows':values,'limitations':['公开历史数据的描述性复核，不是新科研发现。','受控返工演练：首条数值人为增加 1；源 CSV 未改变。' if mode=='fault' else '已重新读取原始 CSV 并修复受控错误；源文件未改变。']}
else:
 target=json.loads(files['species_summary.json'])['result'];upstream=json.loads(files['data_audit.json'])['result'];expected=[]
 for species in sorted({r[4] for r in rows}):
  group=[r for r in rows if r[4]==species];item={'species':species,'n':len(group),'petal_length_min':min(r[2] for r in group),'petal_length_max':max(r[2] for r in group)}
  for i,f in enumerate(['sepal_length','sepal_width','petal_length','petal_width']):item[f+'_mean']=statistics.fmean(r[i] for r in group)
  expected.append(item)
 actual={s['species']:s for s in target['summary_rows']};stats=len(actual)==3 and all(s['species'] in actual and all(abs(actual[s['species']][k]-v)<=1e-6 for k,v in s.items() if k!='species') for s in expected)
 v,g=expected[1:];overlap=max(v['petal_length_min'],g['petal_length_min'])<=min(v['petal_length_max'],g['petal_length_max'])
 stats=stats and target['petal_length_mean_order']==[s['species'] for s in sorted(expected,key=lambda s:s['petal_length_mean'])] and target['versicolor_virginica_range_overlap']==overlap
 meta=upstream['rows']==rows and target['source_sha256']==upstream['source_sha256']==digest and target['measurement_unit']==upstream['measurement_unit']=='cm' and target['record_count']==150 and all(x in target['citation'] for x in ['https://archive.ics.uci.edu/dataset/53/iris','10.24432/C56C76','CC BY 4.0'])
 result={'verdict':'approve' if stats and meta else 'request_changes','summary':'独立 Python csv/statistics 复算完成；未执行对方代码。','checks':[{'criterion':a,'passed':stats if i==0 else meta,'evidence':'species_summary.json: '+json.dumps(expected,ensure_ascii=False)+'; source SHA256='+digest} for i,a in enumerate(c['task']['acceptance'])],'requiredChanges':[] if stats and meta else ['修正与源 CSV 不符的统计或来源记录']}
envelope={'revision':c['revision'],'inputReceipts':[{'filename':n,'sha256':hashlib.sha256(b).hexdigest(),'size':len(b)} for n,b in files.items()],'result':result}
pathlib.Path(sys.argv[3]).write_text(json.dumps(envelope,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'mode':mode,'records':len(rows),'sourceSha256':digest}))
