/** Generated teaching data and deterministic Agent doubles. No provider calls. */
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const cases=[
 {id:'calibration',title:'模拟实验 · 传感器线性标定',method:'ols-with-intercept',unit:'mV/mm',metric:'slope',
 csv:'displacement_mm,voltage_mV\n0,0.2\n1,2.1\n2,4.3\n3,6.2\n4,8.4\n5,10.3\n',
 scientist:'使用全部六个标定点，以带截距最小二乘拟合电压对位移，不得强制过原点。\n报告斜率 slope、截距 intercept、测量单位 unit 和六个点的残差；方法字段 method 为 ols-with-intercept。',
 captain:'复核拟合结果，并由获批 fit.json 换算电压 5.25 mV 对应的位移。\n报告该模拟实验的适用范围和局限，不将标定误差解释为真实设备精度。'},
 {id:'kinetics',title:'模拟实验 · 一级反应动力学',method:'natural-log-ols',unit:'min^-1',metric:'rate',
 csv:'time_min,concentration_mmol_L\n'+[0,2,4,6,8,10].map(t=>`${t},${(100*Math.exp(-0.1*t)).toFixed(12)}`).join('\n')+'\n',
 scientist:'使用全部六个时间点，对浓度取自然对数，再按时间做带截距最小二乘拟合；不得改为常用对数。\n报告速率常数 rate、截距 intercept、单位 unit 和六点的残差；方法字段 method 为 natural-log-ols。',
 captain:'独立复核速率常数，从获批 fit.json 计算半衰期 value，单位为 min。\n说明这些是无噪声模拟数据，不能据此宣称已经验证真实反应机理。'}
];
export function rows(bytes){return Buffer.from(bytes).toString('utf8').trim().split(/\r?\n/).slice(1).map(l=>l.split(',').map(Number));}
// Producer uses centered OLS; the reviewer uses raw sums (or the kinetic endpoint ratio).
export function compute(study,data){const pts=rows(data),x=pts.map(p=>p[0]),y=pts.map(p=>study.id==='kinetics'?Math.log(p[1]):p[1]);
 const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length;
 const slope=x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/x.reduce((s,v)=>s+(v-mx)**2,0),intercept=my-slope*mx;
 return {synthetic:true,method:study.method,[study.metric]:study.id==='kinetics'?-slope:slope,intercept,unit:study.unit,residuals:x.map((v,i)=>({index:i,residual:y[i]-(intercept+slope*v)}))};}
export function reference(study,data){const a=rows(data);if(study.id==='kinetics')return Math.log(a[0][1]/a.at(-1)[1])/(a.at(-1)[0]-a[0][0]);
 const n=a.length,sx=a.reduce((s,r)=>s+r[0],0),sy=a.reduce((s,r)=>s+r[1],0);return (n*a.reduce((s,r)=>s+r[0]*r[1],0)-sx*sy)/(n*a.reduce((s,r)=>s+r[0]**2,0)-sx*sx);}
export function scenario(study){const counts={align:0,fit:0,fitReview:0},trace=[];
 function calculate(kind,files){const c=JSON.parse(Buffer.from(files.find(f=>f.filename==='context.json').bytes)),source=files.find(f=>f.filename.startsWith('source-'));
 let result,event=kind;
 if(kind==='ALIGN'){
  const scientist=c.agents.find(a=>(a.platform??'sciencepal')==='sciencepal'),captain=c.agents.find(a=>a.platform==='codex');
  const owner=c.proposals.find(p=>p.agentId===scientist.id).id,requirements=c.governance.requirements.filter(r=>!r.retiredBy);
  const prior=c.previousTasks?.find(t=>t.key==='fit');
  result={alignmentMarkdown:`# ${study.title}\n按原文分工，固定方法、单位和结果字段。所有数据为模拟。`,issues:[],tasks:[
   prior?{...prior,acceptance:prior.acceptance.filter(v=>!v.startsWith('[REQ:'))}:{key:'fit',title:'计算参数并报告单位',goal:'按冻结方法拟合六个输入点',boundary:'不得删除数据点或改变方法',dependencies:[],assigneeAgentId:scientist.id,acceptance:['数值由六个输入点计算，保留残差','必须报告约定单位'],requirementIds:requirements.filter(r=>r.sourceId===owner).map(r=>r.id)},
   {key:'report',title:'复核并解释实验结果',goal:'使用获批参数计算目标值并说明局限',boundary:'只使用已批准产物，禁止外推真实实验结论',dependencies:['fit'],assigneeAgentId:captain.id,acceptance:['目标值与上游参数一致','报告模拟数据的局限'],requirementIds:requirements.filter(r=>r.sourceId!==owner).map(r=>r.id)}]};
  if(++counts.align===1){result.tasks[0].requirementIds.pop();event='omitted-requirement';}
 }
 if(kind==='TASK'&&c.task.key==='fit'){
  result=compute(study,source.bytes);counts.fit++;
  if(counts.fit===1){if(study.id==='calibration'){result.method='ols-through-origin';const a=rows(source.bytes);result.slope=a.reduce((s,r)=>s+r[0]*r[1],0)/a.reduce((s,r)=>s+r[0]**2,0);result.intercept=0;result.residuals=a.map((r,index)=>({index,residual:r[1]-result.slope*r[0]}));event='method-drift';}else{result[study.metric]*=1.2;event='wrong-number';}}
  else if(counts.fit===2){delete result.unit;event='missing-unit';}
 }
 if(kind==='TASK'&&c.task.key==='report'){
  const file=files.find(f=>f.filename==='fit.json');if(!file)throw Error('Approved upstream bytes required');const fit=JSON.parse(Buffer.from(file.bytes)).result;
  result={synthetic:true,value:study.id==='kinetics'?Math.log(2)/fit.rate:(5.25-fit.intercept)/fit.slope,unit:study.id==='kinetics'?'min':'mm',upstreamSha256:sha(file.bytes),limitations:'模拟数据，仅验证计算与协作流程，不证明真实设备精度或反应机理。'+(c.revision>1?' 尚未包含真实测量噪声。':''),method:'approved-parameter-transform'};
 }
 if(kind==='REVIEW'){
  const candidate=JSON.parse(Buffer.from(files.find(f=>f.filename===c.task.outputFilename).bytes)).result;
  const fit=compute(study,source.bytes),expected=reference(study,source.bytes);
  const goodNumber=c.task.key==='fit'?Math.abs(candidate[study.metric]-expected)<1e-8:Math.abs(candidate.value-(study.id==='kinetics'?Math.log(2)/expected:(5.25-fit.intercept)/expected))<1e-8;
  const goodUnit=candidate.unit===(c.task.key==='fit'?study.unit:study.id==='kinetics'?'min':'mm');
  const checks=c.task.acceptance.map(criterion=>({criterion,passed:goodNumber&&(!criterion.includes('单位')||goodUnit),evidence:`${c.task.outputFilename}: independent value check=${goodNumber}; unit=${candidate.unit??'missing'}`}));
  const failed=checks.filter(t=>!t.passed),passed=!failed.length;
  result={verdict:passed?'approve':'request_changes',summary:passed?'独立复算与原要求一致':'原数值可复核，但产物遗漏了原协议要求的单位',checks,requiredChanges:passed?[]:[`在 ${c.task.outputFilename} 补上单位 ${study.unit}，保留既定方法。`],requiredChangeCriteria:passed?[]:[failed[0].criterion]};
  if(c.task.key==='fit'&&++counts.fitReview===1){result.checks.forEach(v=>v.passed=true);result.verdict='request_changes';result.requiredChanges=['另做一组与原协议无关的新实验'];result.requiredChangeCriteria=[c.task.acceptance[0]];event='reviewer-added-scope';}
 }
 if(kind==='CHANGE_REVIEW')result={verdict:'accept',rationale:'只增加报告对测量噪声的局限说明；拟合输入、方法和结果均不变。',affectedTaskKeys:['report'],requirementEdits:[],taskImpacts:c.taskFingerprints.map(t=>({...t,affected:t.key==='report',rationale:t.key==='report'?'增加局限说明':'原始输入、拟合方法和验收均保持不变'}))};
 trace.push({kind,event,revision:c.revision,task:c.task?.key??null});
 return Buffer.from(JSON.stringify({revision:c.revision,inputReceipts:files.map(f=>({filename:f.filename,sha256:sha(f.bytes),size:f.bytes.length})),result}));
 }
 return {calculate,counts,trace};}
