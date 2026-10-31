/** Real UI/Host/connectors, generated data, deterministic Agent doubles; no provider calls. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {EventEmitter} from 'node:events';
import {buildApp} from '../dist/app.js';
import {buildResearchPanel} from '../dist/sciencepal/local-panel.js';
import {SciencePALMemberConnector} from '../dist/sciencepal/member-connector.js';
import {ResearchRemote} from './research-simulation-fixture.mjs';
import {cases,scenario,reference} from './workflow-experiment-fixtures.mjs';
const out=resolve(process.env.VIBE_EXPERIMENT_OUT||'data/workflow-experiments');await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href:'playwright-core');
const browser=await chromium.launch({headless:true}),summary={scope:'Generated data; actual local calculations and browser actions; deterministic Agent doubles, no real provider or cross-computer runs.',cases:[]};
try{for(const study of cases){
 const dir=join(out,study.id);await mkdir(dir,{recursive:true});await writeFile(join(dir,study.id+'.csv'),study.csv);
 const root=await mkdtemp(join(tmpdir(),'vibe-experiment-')),sim=scenario(study),workers=[];
 const hostRemote=new ResearchRemote('host');hostRemote.configured=false;
 const app=await buildApp({dbPath:':memory:',dataDir:root,staticDir:false,backupDatabase:false,sciencepal:{remote:hostRemote,worker:false}});
 app.addHook('onSend',async(r,reply,payload)=>{if(r.url==='/api/sciencepal-team/state'&&reply.statusCode===200&&typeof payload==='string'){const d=JSON.parse(payload);d.interactiveSimulation=true;return JSON.stringify(d);}return payload;});
 const host=await app.listen({host:'127.0.0.1',port:0}),captain=JSON.parse(await readFile(join(root,'captain.json'))),invite=JSON.parse(await readFile(join(root,'invite.json'))),pipeline=app.sciencepalPipeline;
 app.v20Service.repo.putNode({...app.v20Service.repo.getNode(captain.nodeId),label:'队长 · Codex（模拟）'});
 const req=token=>async(path,body,method)=>{const r=await fetch(host+path,{method:method??(body===undefined?'GET':'POST'),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();if(!r.ok)throw Error(d.error);return d;};
 const options={allowLocalExecution:false,remote:()=>new ResearchRemote('directory'),worker:env=>{
  const child=new EventEmitter();child.stopped=false;child.kill=()=>{child.stopped=true;child.emit('exit',0);return true;};
  child.ready=(async()=>{const credentials=JSON.parse(await readFile(env.VIBE_GIT_MEMBER_FILE));child.request=req(credentials.nodeToken);child.env=env;child.connector=new SciencePALMemberConnector(new ResearchRemote('sim-science',sim.calculate),req(credentials.nodeToken),{phase:'IDLE',projectId:env.VIBE_GIT_PROJECT_ID},async()=>{});})();workers.push(child);return child;
 }};
 const leader=await buildResearchPanel({...options,profileDir:join(root,'leader'),captainFile:join(root,'captain.json'),hostUrl:host});await leader.listen();
 const member=await buildResearchPanel({...options,profileDir:join(root,'member')});await member.listen();
 const ca=await browser.newContext({viewport:{width:1440,height:1000}}),cb=await browser.newContext({viewport:{width:1440,height:1000}}),pa=await ca.newPage(),pb=await cb.newPage();
 const result={id:study.id,title:study.title,actions:[],checkpoints:[],screenshots:[],pageErrors:[]};summary.cases.push(result);
 for(const page of [pa,pb])page.on('pageerror',e=>result.pageErrors.push(e.message));
 const click=async(page,name)=>{const scope=await page.locator('.top-popover').isVisible()?page.locator('.top-popover'):page;await scope.getByRole('button',{name,exact:true}).click({timeout:12000});result.actions.push({actor:page===pa?'captain':'scientist',click:name});};
 const fill=async(page,label,value)=>{await page.getByLabel(label,{exact:true}).fill(value,{timeout:12000});result.actions.push({actor:page===pa?'captain':'scientist',fill:label});};
 const check=(name,value)=>{assert.ok(value,name);result.checkpoints.push({name,passed:true});console.log('PASS',study.id,name);};
 const screenshot=async(name)=>{await pa.waitForTimeout(250);await pa.screenshot({path:join(dir,name+'.png'),fullPage:true,animations:'disabled'});result.screenshots.push(name+'.png');};
 const project=()=>pipeline.list()[0],delay=ms=>new Promise(r=>setTimeout(r,ms));
 const next=async()=>{await pa.reload();await click(pa,'我的研究变更');};
 const command=async(name,note)=>{await next();await click(pa,name);if(note)await fill(pa,name==='提出研究变更'?'研究变更说明':'返工说明',note);await click(pa,'确认'+name);await pa.getByLabel(name+'确认',{exact:true}).waitFor({state:'hidden',timeout:12000});};
 async function localStep(){await next();await click(pa,'准备本人任务包');await pa.getByRole('button',{name:'复制给 Codex 的任务说明',exact:true}).waitFor({timeout:12000});
  const p=project(),r=p.runs.find(r=>r.ownerNodeId===captain.nodeId&&r.revision===p.revision&&['STARTING','RUNNING'].includes(r.status));assert.ok(r,'Local task claimed through UI');
  const info=await pa.evaluate(async({id,rid})=>fetch('/api/local/research/codex-task?'+new URLSearchParams({projectId:id,runId:rid})).then(r=>r.json()),{id:p.id,rid:r.id});
  const packet=JSON.parse(await readFile(join(info.directory,'task.json'))).packet,files=await Promise.all(packet.files.map(async f=>({filename:f.filename,bytes:await readFile(join(info.directory,'inputs',f.filename))})));
  await writeFile(info.outputPath,sim.calculate(r.kind,files));await click(pa,'检查并交回成果');
  for(let n=0;n<40&&['STARTING','RUNNING'].includes(pipeline.get(p.id).runs.find(x=>x.id===r.id).status);n++)await delay(50);
 }
 async function until(phase){for(let i=0;i<90;i++){await delay(20);await pipeline.tick();const p=project();if(p.phase===phase)return p;
  if(['BLOCKED','CHANGES_REQUESTED'].includes(p.phase))throw Error(`Unexpected ${p.phase}: ${p.error??p.tasks.find(t=>t.review)?.review?.summary}`);
  if(p.runs.some(r=>r.ownerNodeId===captain.nodeId&&r.revision===p.revision&&r.status==='READY'))await localStep();
  for(const w of workers){await w.ready;if(!w.stopped){await w.request('/api/sciencepal-team/heartbeat',{channel:'connector',instanceId:w.env.VIBE_GIT_CONNECTOR_INSTANCE,projectId:w.env.VIBE_GIT_PROJECT_ID,status:w.connector.journal.phase==='IDLE'?'ready':'working'});await w.connector.step();}}
 }throw Error('Timeout waiting '+phase);}
 try{
 await pa.goto(leader.ticket());await pb.goto(member.ticket());
 await fill(pb,'邀请链接',host+'/join/'+invite.inviteToken);await click(pb,'加入房间');
 await fill(pb,'SciencePAL API Key','SIMULATED-ONLY');await click(pb,'验证账号并读取 Agent');await click(pb,'接入算力网');
 await fill(pb,'我的研究提案',study.scientist);await click(pb,'保存我的提案');
 await pa.locator('.codex-trigger').click();await pa.getByLabel('执行平台',{exact:true}).selectOption('codex');await click(pa,'接入算力网');
 await fill(pa,'我的研究提案',study.captain);await click(pa,'保存我的提案');await click(pa,'选择成员并建立研究');
 await fill(pa,'科研项目名称',study.title);await pa.getByLabel('科研源文件',{exact:true}).setInputFiles(join(dir,study.id+'.csv'));
 await fill(pa,'科研来源网址','https://github.com/WeihanChen000/vibe-git-research');await fill(pa,'科研来源署名','本项目自行生成的教学模拟数据；可随开源项目使用，不代表真实测量。');await click(pa,'冻结提案并建立项目');
 for(let i=0;i<40&&!project();i++)await delay(50);
 check('UI creates governed project with uploaded bytes',project()?.governance?.version===1&&project().source.artifact.size===Buffer.byteLength(study.csv));
 await command('启动协议对齐');let p=await until('BLOCKED');check('Omitted original requirement blocks publication',p.error.includes('遗漏冻结需求'));await next();await screenshot('01-omission');
 result.omissionExplainsOriginalText=(await pa.locator('body').innerText()).includes(study.scientist.split('\n')[1]);check('Failure explains the omitted original requirement',result.omissionExplainsOriginalText);
 await command('重试失败任务');await until('READY');await next();await click(pa,'协议');
 await pa.getByText('发布前添加约束',{exact:true}).click();await pa.getByLabel('约束任务',{exact:true}).selectOption('fit');await fill(pa,'约束字段','method');await fill(pa,'约束值',study.method);await click(pa,'冻结这条约束');
 await next();await click(pa,'协议');await pa.getByText('发布前添加数值检查',{exact:true}).click();await pa.getByLabel('科学检查任务',{exact:true}).selectOption('fit');await pa.getByLabel('科学检查方式',{exact:true}).selectOption('reference');
 await fill(pa,'科学检查数值字段',study.metric);await fill(pa,'独立参考数值',String(reference(study,Buffer.from(study.csv))));await fill(pa,'科学检查容差','0.00000001');await fill(pa,'参考来源与依据',study.id==='kinetics'?'独立端点浓度比 ln(C0/C10)/10，由模拟输入计算':'独立原始求和公式 (nΣxy−ΣxΣy)/(nΣx²−(Σx)²)，不是复制待验结果');await click(pa,'冻结数值检查');
 await next();await click(pa,'协议');await screenshot('02-frozen-protocol');await command('发布研究任务');
 await pb.reload();await pb.locator('.codex-trigger').click();await click(pb,'启动本人连接器');
 p=await until('BLOCKED');check(study.id==='calibration'?'Method change blocked before reviewer':'Plausible method label cannot hide wrong numeric result',study.id==='calibration'?p.error.includes('冻结值')&&p.runs.filter(r=>r.kind==='REVIEW').length===0:p.runs.some(r=>r.scientificValidation?.status==='FAILED'));await next();await screenshot('03-execution-block');
 await command('重试失败任务');p=await until('BLOCKED');check('Reviewer cannot add an unrelated experiment',p.error.includes('不得新增要求'));const fitCount=sim.counts.fit;await next();check('Review failure explicitly preserves the calculation',(await pa.locator('body').innerText()).includes('不重新执行科研计算'));await screenshot('05-review-scope');
 await command('重试失败任务');p=await until('CHANGES_REQUESTED');check('Review retry does not recompute author result',sim.counts.fit===fitCount);check('Real missing unit triggers legitimate rework',p.tasks[0].review.requiredChanges.join().includes(study.unit));await next();await screenshot('06-rework');
 await command('安排返工');p=await until('COMPLETED');check('Repair completes independent review and handoff',pipeline.evidence(p.id).allApproved);const first=p.tasks.find(t=>t.key==='fit').artifactId;
 result.firstResult=JSON.parse(Buffer.from(pipeline.file(p.id,p.tasks.find(t=>t.key==='report').artifactId).bytes)).result;await next();await screenshot('07-completed');
 await command('提出研究变更','报告补充真实测量噪声尚未考虑这一局限；原拟合数据与方法保持不变。');await until('CHANGE_READY');await next();await click(pa,'应用研究变更');await screenshot('08-change-impact');await click(pa,'确认应用研究变更');await until('READY');await command('发布研究任务');p=await until('COMPLETED');
 check('Approved fitting output reused after report-only change',p.tasks.find(t=>t.key==='fit').artifactId===first&&p.tasks.find(t=>t.key==='fit').carriedFrom.revision===1);check('Both revisions retain verifiable handoff',pipeline.evidence(p.id,1).allApproved&&pipeline.evidence(p.id,2).allApproved);await next();await screenshot('09-final');
 const evidence=pipeline.evidence(p.id),prior=pipeline.evidence(p.id,1);await writeFile(join(dir,'evidence.json'),JSON.stringify(evidence,null,2));await writeFile(join(dir,'evidence-r1.json'),JSON.stringify(prior,null,2));const filesDir=join(dir,'files');await mkdir(filesDir,{recursive:true});for(const f of new Map([...prior.files,...evidence.files].map(f=>[f.id,f])).values())await writeFile(join(filesDir,f.id+'-'+f.filename),pipeline.file(p.id,f.id).bytes);
 result.trace=sim.trace;result.finalRevision=p.revision;check('No browser runtime errors',result.pageErrors.length===0);
 }catch(e){result.failure=e.message;await pa.screenshot({path:join(dir,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(join(dir,'failure-ui.txt'),await pa.locator('body').innerText()).catch(()=>{});throw e;}
 finally{await writeFile(join(out,'summary.json'),JSON.stringify(summary,null,2));for(const w of workers)w.kill();await ca.close();await cb.close();await leader.app.close();await member.app.close();await app.close();}
}}finally{await browser.close();}
console.log(JSON.stringify({passed:true,cases:summary.cases.map(c=>({id:c.id,checks:c.checkpoints.length,actions:c.actions.length,omissionExplainsOriginalText:c.omissionExplainsOriginalText}))}));
