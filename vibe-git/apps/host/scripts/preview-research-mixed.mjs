/** Complete onboarding demo: real local panels and Host, synthetic Agent workers only. */
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {EventEmitter} from 'node:events';
import {createServer} from 'node:http';
import {buildApp} from '../dist/app.js';
import {buildResearchPanel} from '../dist/sciencepal/local-panel.js';
import {SciencePALMemberConnector} from '../dist/sciencepal/member-connector.js';
import {localMemberTask} from '../dist/sciencepal/local-member.js';
import {ResearchRemote,simulatedEnvelope} from './research-simulation-fixture.mjs';
const root=await mkdtemp(join(tmpdir(),'vibe-onboard-demo-')),out=resolve('data/mixed-ui-demo');await mkdir(out,{recursive:true});
const noRemote=new ResearchRemote('HOST');noRemote.configured=false;
const app=await buildApp({dbPath:':memory:',dataDir:root,staticDir:false,backupDatabase:false,sciencepal:{remote:noRemote,worker:false}});
app.addHook('onSend',async(r,reply,payload)=>{if(r.url==='/api/sciencepal-team/state'&&reply.statusCode===200&&typeof payload==='string'){const d=JSON.parse(payload);d.interactiveSimulation=true;return JSON.stringify(d);}return payload;});
const origin=await app.listen({host:'127.0.0.1',port:0}),captain=JSON.parse(await readFile(join(root,'captain.json'))),invite=JSON.parse(await readFile(join(root,'invite.json'))),service=app.v20Service,pipeline=app.sciencepalPipeline;
service.repo.putNode({...service.repo.getNode(captain.nodeId),label:'研究员 A'});
const request=token=>async(path,body,method)=>{const r=await fetch(origin+path,{method:method||(body===undefined?'GET':'POST'),headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
const a=request(captain.nodeToken),children=new Set();
const workerJournals=new Map();
function fakeWorker(env){const child=new EventEmitter();let stopping=false,busy=false,connector,req;children.add(child);
 const ready=(async()=>{const c=JSON.parse(await readFile(env.VIBE_GIT_MEMBER_FILE));req=request(c.nodeToken);service.repo.putNode({...service.repo.getNode(c.nodeId),label:'研究员 B'});let saved=workerJournals.get(env.VIBE_GIT_CONNECTOR_STATE);if(!saved){saved={remote:new ResearchRemote('DEMO-B'),journal:{projectId:env.VIBE_GIT_PROJECT_ID,phase:'IDLE'}};saved.remote.askReviewOnce=true;workerJournals.set(env.VIBE_GIT_CONNECTOR_STATE,saved);}connector=new SciencePALMemberConnector(saved.remote,req,saved.journal,async()=>{});})();
 const timer=setInterval(async()=>{if(stopping||busy)return;busy=true;try{await ready;await req('/api/sciencepal-team/heartbeat',{channel:'connector',instanceId:env.VIBE_GIT_CONNECTOR_INSTANCE,projectId:env.VIBE_GIT_PROJECT_ID,status:connector.journal.phase==='IDLE'?'ready':'working'});await connector.step();}catch(e){console.error('Synthetic worker:',e.message);}finally{busy=false;}},700);
 child.kill=()=>{stopping=true;clearInterval(timer);children.delete(child);child.emit('exit',0);return true;};return child;}
const base={remote:key=>{const directory=new ResearchRemote('directory');directory.agents=async()=>{if(key==='EMPTY-KEY')return [];if(key!=='DEMO-KEY')throw Error('Synthetic invalid key');return [{id:'simulated-research-expert',name:'SIMULATED expert'}];};return directory;},worker:fakeWorker};
const leader=await buildResearchPanel({...base,profileDir:join(root,'captain-profile'),captainFile:join(root,'captain.json'),hostUrl:origin});await leader.listen();
const member=await buildResearchPanel({...base,profileDir:join(root,'member-profile')});await member.listen();
const opened=await member.app.inject({url:new URL(member.ticket()).pathname}),cookie=String(opened.headers['set-cookie']).split(';')[0];
const localInfo=(await member.app.inject({url:'/api/local/research',headers:{cookie}})).json();
const localPost=async(path,body)=>{const response=await member.app.inject({method:'POST',url:'/api/local/research/'+path,headers:{cookie,origin:member.origin(),'x-vibe-csrf':localInfo.csrfToken},payload:body});if(response.statusCode!==200)throw Error(response.body);return response.json();};
await localPost('join',{invite:origin+'/join/'+invite.inviteToken});await localPost('agents',{apiKey:'DEMO-KEY'});await localPost('bind',{platform:'sciencepal',agentId:'simulated-research-expert'});
const credentialB=JSON.parse(await readFile(join(root,'member-profile','member.json'))),b=request(credentialB.nodeToken);service.repo.putNode({...service.repo.getNode(credentialB.nodeId),label:'研究员 B'});
await a('/api/sciencepal-team/binding',{agent:{id:'codex-local',name:'本人 Codex',platform:'codex'}},'PUT');
const proposals=await Promise.all([a('/api/v1/plans',{filename:'a.md',content:'# Codex 提案\n复核合成测量数据 [1,2,3] 和单位。'}),b('/api/v1/plans',{filename:'b.md',content:'# SciencePAL 提案\n独立复核文件与统计量，交叉评审。'})]);
await a('/api/sciencepal-team/projects',{title:'同项目协作演练 · Codex 与 SciencePAL',coordinatorNodeId:captain.nodeId,documentIds:proposals.map(p=>p.id)});
let busy=false;const tick=setInterval(async()=>{if(busy)return;busy=true;try{await pipeline.tick();}finally{busy=false;}},700);
const launch=createServer(async(req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(route==='/simulation/answer'&&req.method==='POST'){
  if(req.headers.origin){res.writeHead(403);res.end();return;}
  try{for(const saved of workerJournals.values()){const previous=saved.remote.history.find(r=>saved.remote.states.get(r.id)==='asked'&&saved.remote.history.filter(x=>x.threadId===r.threadId).length===1);if(previous){const next=await saved.remote.continueRun(previous.threadId);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({threadId:previous.threadId,previousRunId:previous.id,runId:next.runId}));return;}}res.writeHead(409);res.end('No unresponded simulated input');}catch{res.writeHead(500);res.end('Synthetic response failed');}return;
 }
 if(route==='/simulation/evidence'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({projects:pipeline.list(),remoteCalls:[...workerJournals.values()].flatMap(s=>s.remote.calls.map(c=>({id:c.id,kind:c.kind}))),messages:[...workerJournals.values()].reduce((n,s)=>n+s.remote.messages.size,0)}));return;}
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}const path=new URL(req.url,'http://localhost').pathname;if(['/captain','/member'].includes(path)){res.writeHead(302,{Location:path==='/captain'?leader.ticket():member.ticket(),'Cache-Control':'no-store'});res.end();return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<html lang="zh"><meta name="viewport" content="width=device-width"><style>body{background:#0c0e13;color:#f5f7fa;font:15px/1.8 'Segoe UI',sans-serif;max-width:760px;margin:8vh auto;padding:24px}a{display:inline-block;color:#90bbff;margin-right:16px;padding:12px 18px;border:1px solid #414958;border-radius:7px}code{display:block;background:#151922;padding:12px;overflow-wrap:anywhere}small{color:#929aa8}</style><h1>同项目协作 · 手动 Codex 任务包演练</h1><p>两个独立本机面板，真实成员权限与心跳；Agent 输出为合成结果，不使用真实账号或 Key。</p><p><a href="/captain" target="_blank">队长本机面板</a><a href="/member" target="_blank">队友本机面板</a></p><p>队友加入链接：</p><code>${origin}/join/${invite.inviteToken}</code><p>模拟 SciencePAL Key 填 <b>DEMO-KEY</b>。两位成员和项目已经准备好。队长在原待办启动对齐并准备本人任务包；队友在原算力网启动连接器。</p><small>这里没有自动 Codex worker：准备任务包后需在本人 Codex 完成并交回。SciencePAL 仍使用合成结果。关闭后不影响真实团队数据。</small></html>`);});await new Promise(r=>launch.listen(0,'127.0.0.1',r));
const launcher=`http://127.0.0.1:${launch.address().port}`;await writeFile(join(out,'preview.json'),JSON.stringify({launcher,captain:leader.origin(),member:member.origin(),invite:origin+'/join/'+invite.inviteToken,pid:process.pid,scope:'synthetic onboarding; no real credentials'},null,2));console.log(launcher);
process.on('SIGINT',async()=>{clearInterval(tick);for(const c of children)c.kill();launch.close();await leader.app.close();await member.app.close();await app.close();process.exit(0);});
