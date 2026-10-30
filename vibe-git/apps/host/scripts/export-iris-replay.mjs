/** Export captured Iris history only; never creates runs or contacts an Agent. */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve('data/iris-live-ui-20261030/b75ade29-5566-4a0d-89a1-5ef634d8f72c'),out=resolve('apps/web/public/research-replay/iris'),base='/research-replay/iris';
const read=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const final=await read('project.json'),verification=await read('verification.json');
assert.equal(final.phase,'COMPLETED');assert.equal(verification.passed,verification.total);assert.ok(verification.total>=79);
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['claimId','nodeToken','apiKey','csrfToken','inviteToken'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
const hash=b=>createHash('sha256').update(b).digest('hex'),files={};await mkdir(out,{recursive:true});
for(const r of final.runs)for(const f of [...r.inputs,...(r.output?[r.output]:[])]){
 const id=f.artifactId??f.id;assert.match(id,/^[a-zA-Z0-9-]+$/);assert.match(f.filename,/^[a-zA-Z0-9_.-]+$/);
 const bytes=await readFile(join(root,'runs',r.id,f.filename));assert.equal(hash(bytes),f.sha256);assert.equal(bytes.length,f.size);
 if(files[id]){assert.equal(files[id].sha256,f.sha256);continue;}
 await mkdir(join(out,'files',id),{recursive:true});await writeFile(join(out,'files',id,f.filename),bytes);files[id]={filename:f.filename,url:`${base}/files/${id}/${f.filename}`,sha256:f.sha256,size:f.size};
}
const snapshots=await Promise.all((await readdir(join(root,'snapshots'))).sort().map(async name=>({name,p:await read('snapshots/'+name)})));
const find=fn=>{const s=snapshots.find(x=>fn(x.p));assert.ok(s,'Missing captured stage');return s;};
const task=(p,key)=>p.tasks.find(t=>t.key===key),audit=p=>task(p,'data_audit'),summary=p=>task(p,'species_summary');
const stages=[
 ['source','源文件冻结，进入首次独立评审','通过原界面上传的 UCI Iris CSV 与提案已冻结。此快照已进入首轮评审；不把它伪装成上传瞬间。源数据未修改，首版候选明示注入一个数值错误。',find(p=>audit(p).status==='REVIEWING'&&audit(p).attempt===1),{type:'protocol'}],
 ['numeric-rejected','第一次退回：候选数值与源文件不符','真实 Biology 逐行复算，发现首条萼片长度 6.1 与原始 5.1 不符。受控故障被退回，下游仍被阻断。',find(p=>audit(p).status==='CHANGES_REQUESTED'),{type:'review',id:'data_audit'}],
 ['numeric-rework','Codex 修复后，等待 Biology 重新评审','队长通过原待办安排返工；Codex 重新读取原 CSV，修复受控错误。保留首版和原评审，此刻修正版仍未获批。',find(p=>audit(p).status==='REVIEWING'&&audit(p).attempt===2),{type:'task',id:'data_audit'}],
 ['released','复审通过，获批版本发往 Biology','Biology 真实复审 5/5 通过，统计任务已启动。现在只有派发记录，尚未取得下游文件回执，不能提前标为交接完成。',find(p=>audit(p).status==='APPROVED'&&summary(p).status==='RUNNING'&&summary(p).attempt===1),{type:'handoff',id:'data_audit--species_summary'}],
 ['handoff','收到真实回执，Codex 独立复核统计','Biology 已提交实际 Python 统计结果；输入回执匹配获批 data_audit.json 的 ID、SHA256 与字节数。文件已交接，最终评审仍未通过。',find(p=>summary(p).status==='REVIEWING'&&summary(p).attempt===1),{type:'handoff',id:'data_audit--species_summary'}],
 ['code-rejected','第二次退回：数值正确，但代码没有交付','这是自然出现的交付缺陷。Codex 独立复算确认数值正确，但 Biology 只写了沙箱脚本名，没有按冻结协议交付可复现代码；第 6 项不通过。',find(p=>summary(p).status==='CHANGES_REQUESTED'),{type:'review',id:'species_summary'}],
 ['code-rework','Biology 正在按真实意见补交代码','队长安排第二项任务返工，Biology 重新计算并准备把代码与工具版本嵌入允许的成果字段。旧候选、原评审和已获批上游全部保留。',find(p=>summary(p).status==='RUNNING'&&summary(p).attempt===2),{type:'task',id:'species_summary'}],
 ['code-rereview','代码已补交，等待 Codex 最终复审','真实 Biology 补交 Python 计算源代码及 3.12.3 版本。此阶段尚待 Codex 检查代码计算逻辑、科学边界并从原 CSV 独立复算。',find(p=>summary(p).status==='REVIEWING'&&summary(p).attempt===2),{type:'task',id:'species_summary'}],
 ['completed','交叉复审通过，2 / 2 项完成','Codex 最终 6/6 通过。79 项独立证据核验通过；三组花瓣长度均值为 1.462、4.260、5.552 cm。两次退回及其返工版本均可追溯。',find(p=>p.phase==='COMPLETED'),{type:'next'}],
];
const remote=[];for(const r of final.runs.filter(r=>r.threadId)){const proof=await read(`remote-proof/${r.id}/provenance.json`);assert.equal(proof.status,'completed');assert.equal(proof.runId,r.runId);remote.push(proof);}
const bundle={formatVersion:1,id:'iris',title:final.title,scope:'单账号跨平台真实运行回放；一次明示数值故障，一次自然代码交付缺陷。本轮未触发等待输入，不作为双账号联调证明。只读，不调用模型。',brief:await readFile('SCIENCEPAL-IRIS-REPLAY-BRIEF.md','utf8'),guide:await readFile('SCIENCEPAL-TEAM-START.md','utf8'),files,evidenceUrl:`${base}/evidence.json`,remoteEvidenceUrl:`${base}/remote-observations.json`,steps:stages.map(([id,title,summary,record,focus])=>{const p=clean(record.p),captain=p.team.members.find(m=>m.nodeId===p.team.captainNodeId);return {id,title,summary,observedAt:p.updatedAt,origin:'captured-snapshot',source:record.name,focus,state:{viewer:{id:captain.nodeId,label:captain.label,role:'captain'},members:p.team.members.map(m=>({id:m.nodeId,label:m.label,role:m.nodeId===captain.nodeId?'captain':'member',binding:{agent:m.agent,updatedAt:p.createdAt},plan:null})),projects:[p]}};})};
const outputs=[['case.json',bundle],['evidence.json',clean(await read('evidence.json'))],['remote-observations.json',{scope:bundle.scope,runs:remote}],['verification.json',verification]];
for(const [name,v] of outputs)await writeFile(join(out,name),JSON.stringify(v,null,2));
const manifest={scope:bundle.scope,projectId:final.id,steps:bundle.steps.map(({id,source,origin,observedAt})=>({id,source,origin,observedAt})),files:[...Object.entries(files).map(([artifactId,f])=>({artifactId,...f})),...await Promise.all(outputs.map(async([name])=>{const b=await readFile(join(out,name));return {url:`${base}/${name}`,sha256:hash(b),size:b.length};}))]};await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({steps:bundle.steps.length,artifacts:Object.keys(files).length,out}));
