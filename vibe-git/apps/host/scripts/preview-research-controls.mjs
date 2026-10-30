/** Interactive, disposable loopback demo. Real Host auth/commands/connectors; synthetic Agent output. */
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {buildApp} from '../dist/app.js';
import {SciencePALMemberConnector} from '../dist/sciencepal/member-connector.js';
import {localMemberTask} from '../dist/sciencepal/local-member.js';
import {ResearchRemote,simulatedEnvelope} from './research-simulation-fixture.mjs';
const root=await mkdtemp(join(tmpdir(),'vibe-browser-flow-')),out=resolve('data/browser-flow');await mkdir(out,{recursive:true});
const hostRemote=new ResearchRemote('host');hostRemote.configured=false;
const app=await buildApp({dbPath:':memory:',dataDir:root,staticDir:resolve('apps/web/dist'),backupDatabase:false,sciencepal:{remote:hostRemote,worker:false}});
const service=app.v20Service,pipeline=app.sciencepalPipeline;
// This hook exists only in this separate disposable simulator, never production routes.
app.addHook('onSend',async(req,reply,payload)=>{
 if(req.url==='/api/sciencepal-team/state'&&reply.statusCode===200&&typeof payload==='string'){const s=JSON.parse(payload);s.interactiveSimulation=true;return JSON.stringify(s);}return payload;
});
const origin=await app.listen({host:'127.0.0.1',port:0});
const captain=JSON.parse(await readFile(join(root,'captain.json'))),invite=JSON.parse(await readFile(join(root,'invite.json')));
const member=service.join(invite.inviteToken,origin);
for(const [id,label] of [[captain.nodeId,'研究员 A'],[member.node.id,'研究员 B']])service.repo.putNode({...service.repo.getNode(id),label});
const request=token=>async(path,body,method)=>{const r=await app.inject({url:path,method:method||(body===undefined?'GET':'POST'),headers:{authorization:`Bearer ${token}`},...(body===undefined?{}:{payload:body})});if(r.statusCode>=400)throw Error(r.body);return r.json();};
const a=request(captain.nodeToken),b=request(member.nodeToken);
await a('/api/sciencepal-team/binding',{agent:{id:'codex-local',name:'Codex 本地',platform:'codex'}},'PUT');
await b('/api/sciencepal-team/binding',{agent:{id:'simulated-research-expert',name:'模拟科研专家'}},'PUT');
const plans=[];for(const req of [a,b])plans.push(await req('/api/v1/plans',{filename:'proposal.md',content:'# 模拟研究提案\n对合成数据 [1,2,3] 做独立统计复核，要求单位 a.u.，成果必须经过交叉评审。'}));
const project=await a('/api/sciencepal-team/projects',{title:'交互模拟 · 测量数据复核与统计复现',coordinatorNodeId:captain.nodeId,documentIds:plans.map(p=>p.id)});
const remoteB=new ResearchRemote('B');const connectorB=new SciencePALMemberConnector(remoteB,b,{projectId:project.id,phase:'IDLE'},async()=>{});
let working=false,closing=false;
async function step(){if(working||closing)return;working=true;try{
 await pipeline.tick();const p=pipeline.get(project.id),run=p.runs.find(r=>r.revision===p.revision&&r.ownerNodeId===captain.nodeId&&r.status==='READY');
 if(run&&!p.paused&&!['BLOCKED','CHANGES_REQUESTED','CHANGE_READY'].includes(p.phase)){
  const dir=join(root,`codex-${run.id}`),context={host:origin,nodeId:captain.nodeId,projectId:p.id};
  const task=await localMemberTask('take',a,context,dir);const packet=JSON.parse(await readFile(join(dir,'task.json'))).packet;
  const files=await Promise.all(packet.files.map(async f=>({filename:f.filename,bytes:await readFile(join(dir,'inputs',f.filename))})));
  await writeFile(task.output,simulatedEnvelope(packet.run.kind,files));await localMemberTask('submit',a,context,dir,task.output);
 }
 await connectorB.step();await pipeline.tick();
}catch(e){console.error('Simulator:',e.message);}finally{working=false;}}
const timer=setInterval(()=>void step(),700);
// Demo-only launcher creates a normal expiring session ticket; there are no keys or real users here.
app.server.on('close',()=>clearInterval(timer));
const captainTicket=()=>service.createBrowserTicket(service.repo.getNode(captain.nodeId),origin).url+'?view=sciencepal-team';
const memberTicket=()=>service.createBrowserTicket(service.repo.getNode(member.node.id),origin).url+'?view=sciencepal-team';
// A second tiny loopback launcher keeps tickets out of the command console and provides fresh ones on demand.
const {createServer}=await import('node:http');
const launcher=createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);res.end();return;}const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/captain'||path==='/member'){res.writeHead(302,{Location:path==='/captain'?captainTicket():memberTicket(),'Cache-Control':'no-store'});res.end();return;}
 if(path!=='/'){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html lang="zh"><meta name="viewport" content="width=device-width"><style>body{background:#10141d;color:#e2edfa;font:16px/1.8 sans-serif;max-width:700px;margin:12vh auto;padding:24px}a{display:inline-block;color:#95c7ff;padding:12px 20px;border:1px solid #3b5068;border-radius:6px;margin-right:15px}small{color:#95a7bd}</style><h1>科研协作 · 可操作模拟</h1><p>真实成员会话、权限校验、项目命令与文件回执；Agent 输出为确定性合成结果，不调用真实模型。</p><p><a href="/captain">以队长身份进入</a><a href="/member">以研究成员身份进入</a></p><p>启动对齐 → 检查并发布 → 等待评审退回 → 填写返工说明 → 重新评审通过 → 文件交接。</p><small>两个入口会切换同一浏览器中的当前成员。需要同时对照时请使用独立浏览器会话。数据仅存于本次临时模拟 Host。</small></html>`);});
await new Promise(r=>launcher.listen(0,'127.0.0.1',r));const launch=`http://127.0.0.1:${launcher.address().port}`;
await writeFile(join(out,'preview.json'),JSON.stringify({origin,launch,projectId:project.id,pid:process.pid,scope:'disposable synthetic interactive Host; no API keys'},null,2));
console.log(`交互模拟入口：${launch}`);
process.on('SIGINT',async()=>{closing=true;clearInterval(timer);launcher.close();await app.close();process.exit(0);});
