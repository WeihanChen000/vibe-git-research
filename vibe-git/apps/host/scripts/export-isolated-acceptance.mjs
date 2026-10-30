/** Export only completed, actually observed acceptance history. No model calls. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.env.VIBE_ACCEPTANCE_ROOT||join(process.env.LOCALAPPDATA||process.env.HOME,'VibeGit','isolated-acceptance-20261031'));
const read=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const state=await read('state.json'),final=await read('project.json'),evidence=await read('evidence.json');
assert.ok(state.completedAt);assert.equal(final.phase,'COMPLETED');assert.ok(evidence.allApproved);
const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['claimId','nodeToken','apiKey','csrfToken','inviteToken'].includes(k)).map(([k,x])=>[k,clean(x)])):v;
const hash=b=>createHash('sha256').update(b).digest('hex');
const out=resolve('apps/web/public/research-replay/isolated'),base='/research-replay/isolated';
const snapshots=await Promise.all(state.snapshots.map(async s=>({...s,p:await read(s.file)})));
const find=predicate=>{const found=snapshots.find(predicate);assert.ok(found,'Required stage was not actually captured');return found;};
const task=(p,key)=>p.tasks.find(t=>t.key===key);
const specifications=[
 ['members','一个队长、两个成员','三个成员身份由同一操作者运行，复用一个 Codex 登录和一个 SciencePAL 账号；不是三位真人、跨账号或操作系统级隔离。',find(s=>s.p.phase==='DRAFT'),{type:'protocol'}],
 ['published','统一科研协议后发布','队长发布对齐稿：SciencePAL 计算，成员 A 汇总，队长独立复核。源文件、参数、数值检查在发布前冻结。',find(s=>s.p.phase==='EXECUTING'),{type:'protocol'}],
 ['disconnect','测试连接器中断','人为使连接器进程在保存真实远端回执后退出。此时 Host 尚未收到启动回执；没有断开电脑网络，也未重发任务。',find(s=>s.label==='连接器进程中断，远端回执已保存'),{type:'task',id:'sasa'}],
 ['needs-input','SciencePAL 真实等待补充输入','预先安排的生命周期测试触发真实等待状态。自动验收只发送测试预授权答复；日常研究仍由本人回答。',find(s=>s.p.runs.some(r=>r.status==='NEEDS_INPUT')),{type:'next'}],
 ['resumed','恢复原线程继续执行','新连接器进程读取原日志；答复后续接原 SciencePAL 线程，保存前后运行 ID，不新开对话。',find(s=>s.p.runs.some(r=>r.continuations?.length)&&!s.p.tasks.some(t=>t.status==='CHANGES_REQUESTED')),{type:'task',id:'sasa'}],
 ['rejected','真实评审退回先导试算','首轮按约定只做 100 点试算，真实 Codex 评审判断没有达到最终精度要求。下游仍未启动；这是预设返工场景。',find(s=>task(s.p,'sasa')?.status==='CHANGES_REQUESTED'),{type:'review',id:'sasa'}],
 ['rework','保留首版，重新执行高精度计算','原评审、首版文件和哈希均保留；SciencePAL 按反馈进行 1000/5000 点计算，仍需数值检查和独立复审。',find(s=>task(s.p,'sasa')?.attempt===2&&task(s.p,'sasa')?.status==='RUNNING'),{type:'task',id:'sasa'}],
 ['released','只交接获批版本','独立复审通过后成员 A 才能领取汇总任务。这个阶段尚无下游成果回执，不提前标成已交接完成。',find(s=>task(s.p,'sasa')?.status==='APPROVED'&&task(s.p,'synthesis')?.status==='RUNNING'),{type:'handoff',id:'sasa--synthesis'}],
 ['completed','完成真实计算与验收','两项科研任务获批。原始文件回执证明交接内容与获批版本一致；权限拒绝、中断恢复和续接另有机器可读验收报告。',find(s=>s.p.phase==='COMPLETED'),{type:'handoff',id:'sasa--synthesis'}],
];
const secondRejection=snapshots.find(s=>task(s.p,'sasa')?.attempt===2&&task(s.p,'sasa')?.status==='CHANGES_REQUESTED');
if(secondRejection){
 const idx=specifications.findIndex(s=>s[0]==='released');
 specifications.splice(idx,0,
  ['evidence-rejected','数值正确，执行证据仍未交齐','第二轮真实复算通过数值检查，但评审指出首次续接历史及执行输出没有完整送到评审任务包。这是本次联调实际暴露的交接缺口。',secondRejection,{type:'review',id:'sasa'}],
  ['evidence-rework','补全证据交接后再次返工','保留第二次评审退回，补交实际工具输出。平台修复让后续评审读取本任务历史续接回执；这些记录不替代独立科学复算。',find(s=>task(s.p,'sasa')?.attempt===3&&task(s.p,'sasa')?.status==='RUNNING'),{type:'task',id:'sasa'}]);
}
const thirdRejection=snapshots.find(s=>task(s.p,'sasa')?.attempt===3&&task(s.p,'sasa')?.status==='CHANGES_REQUESTED');
if(thirdRejection){
 const idx=specifications.findIndex(s=>s[0]==='released');
 specifications.splice(idx,0,
  ['chronology-rejected','计算通过，但首次提问顺序缺证据','第三次提交的数值与工具输出通过复核，首次提问、答复和计算的顺序仍无法从交接包确定。原标准未放宽，下游继续等待。',thirdRejection,{type:'review',id:'sasa'}],
  ['supplement-review','补原线程证据，复审同一份成果','操作者核对 SciencePAL 原对话的提问与计算工具记录，再由队长提交有来源的补充证据。成果字节、计算次数及标准不变；独立评审仍可退回。',find(s=>s.label==='补充原线程事件证据，保留成果重新复审'),{type:'review',id:'sasa'}]);
}
const files={};await mkdir(out,{recursive:true});
// Reject privacy leakage rather than silently rewriting original evidence bytes/hashes.
const sensitive=text=>/"(?:apiKey|nodeToken|csrfToken|inviteToken|claimId)"\s*:|[A-Z]:[\\/]+Users[\\/]+[^\\/\s"']+|\bsk-[A-Za-z0-9_-]{20,}/i.test(text);
for(const r of final.runs)for(const f of [...r.inputs,...(r.output?[r.output]:[])]){
 const id=f.artifactId??f.id;if(files[id])continue;assert.match(id,/^[a-zA-Z0-9-]+$/);assert.match(f.filename,/^[a-zA-Z0-9_.-]+$/);
 const bytes=await readFile(join(root,'artifacts',id));assert.equal(hash(bytes),f.sha256);assert.equal(bytes.length,f.size);assert.ok(!sensitive(bytes.toString('utf8')),'Private data in artifact '+f.filename+'; do not publish');
 await mkdir(join(out,'files',id),{recursive:true});await writeFile(join(out,'files',id,f.filename),bytes);files[id]={filename:f.filename,url:`${base}/files/${id}/${f.filename}`,sha256:f.sha256,size:f.size};
}
const remoteProof=await read('sciencepal/remote-observations.json');
assert.ok(remoteProof.observations.every(r=>r.status==='completed'));assert.ok(remoteProof.observations.some(r=>r.previous.some(x=>x.status==='asked')));
const report={remoteProof,...(state.operatorEvidence?{operatorEvidence:state.operatorEvidence}:{}),formatVersion:1,scope:state.scope,projectId:final.id,completedAt:state.completedAt,checks:state.checks,remoteReceipts:(await readFile(join(root,'sciencepal/transport.jsonl'),'utf8')).trim().split('\n').map(JSON.parse),limitations:['One computer, one person and one SciencePAL account; no cross-account or cross-device validation','Member identity/workspace isolation is application-level; the same OS user still owns the files','Controlled process exit, question and pilot rejection are test arrangements; scientific computation and reviews are actual Agent runs','Numeric checks cover declared predicates only; independent review is not a guarantee of scientific truth','This recorded run needed operator-observed original-thread chronology after three review rejections; it was not unattended end-to-end. Supplemental evidence is attributed observation, not signed provider telemetry']};
const brief=`# 单机三成员真实验收\n\n${state.scope}\n\n一个队长、两个成员。SciencePAL 官方 Biology Agent 执行真实 1CRN 表面积计算，成员 Codex 汇总，队长 Codex 独立复核。\n\n本次主动注入连接器进程退出，并预先安排等待输入与低精度先导退回。没有伪造科研输出，也没有修改电脑网络。只验证应用身份与工作目录隔离，不证明不同 SciencePAL 账号或 OS 用户隔离。\n\n在交接节点可查看真实输入回执；在科学检查中可查看总面积与逐残基求和、残基数量的检查。在阶段间不会提前显示未来的批准或文件交接。\n\n验收报告包含权限 HTTP 403、原线程恢复和远端提交次数；离线核验命令：npm run test:isolated-acceptance。`;
const bundle={formatVersion:1,id:'isolated',title:final.title,scope:report.scope,brief,guide:await readFile('SCIENCEPAL-QUICKSTART.md','utf8'),files,evidenceUrl:`${base}/evidence.json`,remoteEvidenceUrl:`${base}/acceptance-report.json`,steps:specifications.map(([id,title,summary,s,focus])=>{const p=clean(s.p),captain=p.team.members.find(m=>m.nodeId===p.team.captainNodeId);return {id,title,summary,observedAt:s.at,origin:'captured-snapshot',source:s.file,focus,state:{viewer:{id:captain.nodeId,label:captain.label,role:'captain'},members:p.team.members.map(m=>({id:m.nodeId,label:m.label,role:m.nodeId===captain.nodeId?'captain':'member',binding:{agent:m.agent,updatedAt:p.createdAt},plan:null})),projects:[p]}};})};
const outputs=[['case.json',bundle],['evidence.json',clean(evidence)],['acceptance-report.json',clean(report)]];
for(const [name,value] of outputs){const text=JSON.stringify(value,null,2);assert.ok(!sensitive(text),'Private data in '+name);await writeFile(join(out,name),text);}
await writeFile(join(out,'manifest.json'),JSON.stringify({projectId:final.id,files:await Promise.all(outputs.map(async([name])=>{const bytes=await readFile(join(out,name));return {name,sha256:hash(bytes),size:bytes.length};})),artifacts:files},null,2));
console.log(JSON.stringify({steps:bundle.steps.length,files:Object.keys(files).length,checks:state.checks.length,scope:state.scope}));
