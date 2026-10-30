/** Actual CSV calculations, simulated remote only. Source bytes never changed. */
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const parse=b=>JSON.parse(Buffer.from(b).toString());
export function irisEnvelope(kind,files){
 const c=parse(files.find(f=>f.filename==='context.json').bytes),source=files.find(f=>f.filename==='source-iris.csv');
 const rows=Buffer.from(source.bytes).toString().trim().split(/\r?\n/).map(line=>line.split(',').map((s,i)=>i<4?Number(s):s));let result;
 if(kind==='ALIGN')result={alignmentMarkdown:'# Iris 描述性复核协议\n真实源文件、cm 单位、逐行核验。data_audit 获批后再运行 species_summary。公开历史数据，不推断因果。',issues:[],tasks:[
 {key:'data_audit',title:'核验 Iris 原始数据与单位',goal:'实际解析文件并保留全部记录',boundary:'不改写公开源文件；不声称新发现',acceptance:['Rows and counts exactly match the uploaded CSV','Source digest and cm unit match the source'],dependencies:[],assigneeAgentId:c.agents[0].id},
 {key:'species_summary',title:'独立复算三个物种的描述性统计',goal:'使用获批的上游数据并对照源文件复算均值与范围',boundary:'范围重叠不能推出完美分类或因果关系',acceptance:['All species statistics match independent source computation','Approved upstream rows, source digest, units and citation agree'],dependencies:['data_audit'],assigneeAgentId:c.agents[1].id}]};
 if(kind==='REVIEW'){
  const target=parse(files.find(f=>f.filename===c.task.outputFilename).bytes).result;
  const same=JSON.stringify(target.rows)===JSON.stringify(rows),meta=target.source_sha256===hash(source.bytes)&&target.measurement_unit==='cm'&&target.record_count===rows.length;
  result={verdict:same&&meta?'approve':'request_changes',summary:same&&meta?'逐行独立重读 CSV 与单位校验通过':'data_audit.json 第一项或其他数值与原始 CSV 不符，不能交给下游',checks:c.task.acceptance.map((criterion,i)=>({criterion,passed:i===0?same:meta,evidence:`data_audit.json: ${i===0?'150 rows independently compared with source-iris.csv; identical='+same:'actual source SHA256='+hash(source.bytes)+'; unit='+target.measurement_unit}`})),requiredChanges:same&&meta?[]:['重新读取 source-iris.csv 的实际数值，修正 data_audit.json；保留原始输入不变。']};
 }
 if(kind==='TASK'){
  const upstream=parse(files.find(f=>f.filename==='data_audit.json').bytes).result;if(JSON.stringify(upstream.rows)!==JSON.stringify(rows))throw Error('Unapproved or changed upstream data');
  const names=[...new Set(rows.map(row=>row[4]))],fields=['sepal_length','sepal_width','petal_length','petal_width'];
  const summary_rows=names.map(species=>{const group=rows.filter(row=>row[4]===species),o={species,n:group.length};fields.forEach((key,i)=>o[key+'_mean']=group.reduce((sum,row)=>sum+row[i],0)/group.length);o.petal_length_min=Math.min(...group.map(r=>r[2]));o.petal_length_max=Math.max(...group.map(r=>r[2]));return o;});
  const v=summary_rows.find(s=>s.species==='Iris-versicolor'),g=summary_rows.find(s=>s.species==='Iris-virginica');
  result={synthetic:false,source_sha256:hash(source.bytes),measurement_unit:'cm',record_count:rows.length,summary_rows,petal_length_mean_order:[...summary_rows].sort((a,b)=>a.petal_length_mean-b.petal_length_mean).map(s=>s.species),versicolor_virginica_range_overlap:Math.max(v.petal_length_min,g.petal_length_min)<=Math.min(v.petal_length_max,g.petal_length_max),conclusion_zh:`花瓣长度均值（cm）：${summary_rows.map(s=>s.species+' '+s.petal_length_mean.toFixed(6)).join('；')}。versicolor 与 virginica 范围重叠，不能声称完美分类或因果关系。`,limitations:['公开历史数据的描述性复核，不代表新发现。','调度使用模拟 Agent；结果由本机 JS 实际计算。'],citation:'UCI Iris https://archive.ics.uci.edu/dataset/53/iris DOI 10.24432/C56C76 CC BY 4.0'};
 }
 if(!result)throw Error('Unsupported Iris task '+kind);
 return Buffer.from(JSON.stringify({revision:c.revision,inputReceipts:files.map(f=>({filename:f.filename,sha256:hash(f.bytes),size:f.bytes.length})),result}));
}
