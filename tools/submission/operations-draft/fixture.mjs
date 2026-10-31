import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\\/g,'/').replace(/\/$/,'');
const source=readFileSync(root+'/vibe-git/fixtures/expert-case/1CRN.pdb','utf8');
const saved=JSON.parse(readFileSync(root+'/docs/research/latest-governance-live/files/ead0e927-fa96-48eb-a3b2-f62d05e6a311/sasa.json','utf8')).result;
const hash=b=>createHash('sha256').update(b).digest('hex');
export const cases=[{id:'1crn',title:'操作演示 · 1CRN 科研交接',csv:source,method:'Shrake-Rupley',metric:'total_A2',
scientist:'计算冻结的 1CRN A 链重原子溶剂可及表面积，使用 Shrake-Rupley、1000 点、1.4 埃探针。\n交付总面积、逐残基面积、原代码及工具版本和执行日志。演示输出由模拟执行器提供，不是新的科研计算。',
captain:'独立复核输入、方法、参考值与执行证据；获批前不能交接报告。\n使用获批成果撰写报告，说明固定结构几何计算的局限，不作生物功能推断。'}];
export function reference(){return 2973.1627706139175;}
export function scenario(study){const counts={align:0,compute:0,review:0,report:0},trace=[];
function calculate(kind,files){const c=JSON.parse(files.find(f=>f.filename==='context.json').bytes);let result;
if(kind==='ALIGN'){
 counts.align++;
 const scientist=c.agents.find(a=>a.platform==='sciencepal'),captain=c.agents.find(a=>a.platform==='codex'),owner=c.proposals.find(p=>p.agentId===scientist.id).id,requirements=c.governance.requirements.filter(r=>!r.retiredBy),prior=c.previousTasks?.find(t=>t.key==='sasa');
 result={alignmentMarkdown:'# 1CRN 科研交接操作演示\n本段使用确定性模拟执行器；不调用真实模型。固定 1CRN 输入、Shrake-Rupley、1000 点、1.4 埃探针。SciencePAL 计算，Codex 复核与报告，报告由另一成员评审。',issues:[],tasks:[
 prior?{...prior,acceptance:prior.acceptance.filter(v=>!v.startsWith('[REQ:'))}:{key:'sasa',title:'计算表面积并交付原始证据',goal:'交付冻结方法下的 SASA 及复核材料',boundary:'仅计算固定结构几何量，不推断功能',acceptance:['输入、方法与数值符合固定协议','交付原代码、工具版本与执行日志'],dependencies:[],assigneeAgentId:scientist.id,requirementIds:requirements.filter(r=>r.sourceId===owner).map(r=>r.id)},
 {key:'report',title:'用获批结果撰写研究报告',goal:'核对批准依据后报告结果与局限',boundary:'只消费获批成果及绑定评审',acceptance:['引用获批结果及批准依据','说明几何结论的适用限制'],dependencies:['sasa'],assigneeAgentId:captain.id,requirementIds:requirements.filter(r=>r.sourceId!==owner).map(r=>r.id)}]};
}
if(kind==='TASK'&&c.task.key==='sasa'){counts.compute++;result={...saved,synthetic:true,simulationNotice:'录像用模拟执行器。数值取自已公开历史产物，不代表本次调用 SciencePAL 计算。'};}
if(kind==='TASK'&&c.task.key==='report'){counts.report++;result={synthetic:true,total_A2:saved.total_A2,summary:'固定 1CRN A 链的几何表面积结果；不是生物功能发现。',limitations:'固定结构与固定采样参数，未考虑构象动态。'+(c.revision>1?' 中文补充：不能据此推断蛋白生物功能。':''),source:'approved sasa.json',simulationNotice:'模拟执行器生成报告，仅演示操作。'};}
if(kind==='REVIEW'){
 const supplemental=String(c.feedback??'').includes('Captain-supplied supplemental evidence');
 const reject=c.task.key==='sasa'&&!supplemental;
 const checks=c.task.acceptance.map(criterion=>({criterion,passed:!(reject&&criterion.includes('代码')),evidence:reject&&criterion.includes('代码')?'演示预设：结果文件可用，但缺原代码和版本日志。':supplemental?'模拟评审：补证内容可供本演示复核；原数值文件保持不变。':'模拟评审：按本演示固定验收逐项核对。'}));
 const failed=checks.filter(x=>!x.passed);
 result={verdict:failed.length?'request_changes':'approve',summary:failed.length?'数值可核查，但缺原代码和版本日志；补齐原执行证据后复审。':'模拟独立评审通过，允许交接。',checks,requiredChanges:failed.length?['补充原计算代码、工具版本与执行日志；保留原数值文件。']:[],requiredChangeCriteria:failed.map(x=>x.criterion)};
 counts.review++;
}
if(kind==='CHANGE_REVIEW')result={verdict:'accept',rationale:'只增加报告中文摘要和限制，不改变上游输入、方法、数值或验收。',affectedTaskKeys:['report'],requirementEdits:[],taskImpacts:c.taskFingerprints.map(t=>({...t,affected:t.key==='report',rationale:t.key==='report'?'补充报告说明':'原成果及批准继续有效'}))};
trace.push({kind,revision:c.revision,task:c.task?.key});
return Buffer.from(JSON.stringify({revision:c.revision,inputReceipts:files.map(f=>({filename:f.filename,sha256:hash(f.bytes),size:f.bytes.length})),result}));
}return{calculate,counts,trace};}
