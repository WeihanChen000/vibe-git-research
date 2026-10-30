import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {irisEnvelope} from '../../host/scripts/iris-experiment-fixture.mjs';
import {IRIS_CASE} from '@vibe-git/protocol';
const out=resolve('data/iris-ui-experiment'),{launcher:launch,invite}=JSON.parse(await readFile(join(out,'preview.json')));
const profile=await mkdtemp(join(tmpdir(),'vibe-topology-qa-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;const checks=[],errors=[],requests=[];
try{
 let port;for(let i=0;i<80;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}}
 assert.ok(port,'Chrome CDP ready');const targets=await (await fetch(`http://127.0.0.1:${port}/json`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}else if(v.method==='Network.requestWillBeSent' && v.params.request.url.includes('/commands/')) requests.push(v.params.request.url.split('/').at(-1));else if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails.text+': '+v.params.exceptionDetails.exception?.description);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<250;i++){if(await ev(`Boolean(${expression})`))return;await delay(100);}throw Error('Timeout '+expression);};
 const shot=async name=>{await delay(250);await writeFile(join(out,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));};
 const click=async selector=>{const pt=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;if(e.closest(".rt-inspector,.top-popover"))e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);assert.ok(pt,selector);await send('Input.dispatchMouseEvent',{type:'mousePressed',...pt,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...pt,button:'left',clickCount:1});await delay(100);};
 const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name);};

 const button=async text=>{const selector=await ev(`(()=>{const b=[...document.querySelectorAll('.top-popover button,.rt-inspector button,.canvas-toolbar button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b)return null;b.setAttribute('data-qa-target','click');return '[data-qa-target="click"]'})()`);assert.ok(selector,'Button '+text);await click(selector);await ev("document.querySelector('[data-qa-target]')?.removeAttribute('data-qa-target')");};
 const fill=async(selector,text)=>{await click(selector);await send('Input.insertText',{text});};
 const replace=async(selector,text)=>{await click(selector);await ev(`document.querySelector(${JSON.stringify(selector)}).select()`);await send('Input.insertText',{text});};
 const select=async(selector,value)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const has=text=>`[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===${JSON.stringify(text)})`;
 const state=()=>ev("fetch('/api/sciencepal-team/state').then(r=>r.json())");
 const close=()=>click('.top-popover header button');
 const enter=async role=>{await send('Page.navigate',{url:launch+'/'+role});await wait("document.querySelector('.command-bar')");await delay(400);};
 const proposal=async text=>{await click('.personal-actions button:first-child');await fill('textarea[aria-label="我的研究提案"]',text);await button('保存我的提案');await wait("document.querySelector('.top-popover [role=status]')?.textContent.includes('已保存')");await close();};

 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const enabled=text=>`[...document.querySelectorAll('button')].some(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled)`;
 const taskDirectories=[];
 const codex=async(kind,bad=false)=>{
  await wait(enabled('准备本人任务包'));const before=await state(),p=before.projects[0],run=p.runs.find(r=>r.ownerNodeId===before.viewer.id&&r.status==='READY'&&r.revision===p.revision);assert.equal(run.kind,kind);
  await button('准备本人任务包');await wait("document.querySelector('.rt-local-task')?.textContent.includes('说明文件')");
  const info=await ev(`fetch('/api/local/research/codex-task?'+new URLSearchParams({projectId:${JSON.stringify(p.id)},runId:${JSON.stringify(run.id)}})).then(r=>r.json())`);
  const saved=JSON.parse(await readFile(join(info.directory,'task.json'),'utf8'));assert.equal(saved.runId,run.id);taskDirectories.push(info.directory);
  const files=await Promise.all(saved.packet.files.map(async f=>{const bytes=await readFile(join(info.directory,'inputs',f.filename));assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);return {filename:f.filename,bytes};}));
  check('Owned '+kind+' task package has verified frozen inputs and a scoped local directory',info.prepared&&info.directory.includes('codex-tasks'));
  if(kind==='ALIGN'){
   check('Submit stays disabled until Codex creates the result file',!await ev(enabled('检查并交回成果')));await shot('codex-task-ready');
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});check('Task paths fit narrow original drawer',await ev('document.documentElement.scrollWidth<=innerWidth'));await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }
  if(bad){await writeFile(info.outputPath,'{"result":{"invalid":true}}');await wait(enabled('检查并交回成果'));await button('检查并交回成果');await wait("document.querySelector('.rt-local-task [role=alert]')");check('Malformed local result stays on the original run for correction',(await state()).projects[0].runs.find(r=>r.id===run.id).status===info.status);await shot('codex-invalid-output');}
  if(kind==='ALIGN')await writeFile(info.outputPath,irisEnvelope(kind,files));else execFileSync(process.env.VIBE_GIT_PYTHON||'python',['-X','utf8','fixtures/iris/calculate-experiment.py',info.directory,kind==='REVIEW'?'review':bad?'fault':'correct',info.outputPath]);await wait(enabled('检查并交回成果'));await button('检查并交回成果');
  await wait(`fetch('/api/sciencepal-team/state').then(r=>r.json()).then(s=>s.projects[0].runs.find(r=>r.id===${JSON.stringify(run.id)})?.status==='COLLECTED')`);
  return {runId:run.id,...info};
 };
 const template=async label=>{await click('.personal-actions button:first-child');await click('.top-popover.plan details summary');await button(label);await button('保存我的提案');await wait("document.querySelector('.top-popover [role=status]')?.textContent.includes('已保存')");await close();};
 const upload=async file=>{const doc=await send('DOM.getDocument'),node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[aria-label="科研源文件"]'});await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[resolve(file)]});await delay(250);};
 await enter('captain');await wait("document.querySelector('.research-room')");await click('.codex-trigger');await select('select[aria-label="执行平台"]','codex');await button('接入算力网');await wait("document.querySelector('.top-popover [role=status]')?.textContent.includes('已接入')");await close();await template('填入 Iris 数据核验提案');
 await enter('member');await wait(`document.querySelector('input[aria-label="邀请链接"]')`);await fill('input[aria-label="邀请链接"]',invite);await button('加入房间');await wait("document.querySelector('input[type=password]')");await fill('input[type=password]','DEMO-KEY');await button('验证账号并读取 Agent');await wait(`document.querySelector('select[aria-label="科研 Agent"]')`);await button('接入算力网');await wait("document.querySelector('.top-popover [role=status]')?.textContent.includes('已接入')");await close();await template('填入 Iris 统计复核提案');
 check('Both members save only their own Iris proposal through the original menu',(await state()).members.every(m=>m.plan?.content.includes('source-iris.csv')));
 const forbidden=await ev("(async()=>{const i=await fetch('/api/local/research').then(r=>r.json());return (await fetch('/api/sciencepal-team/projects',{method:'POST',headers:{'Content-Type':'application/json','X-Vibe-CSRF':i.csrfToken},body:JSON.stringify({title:'unauthorized',source:{filename:'source-x.csv',base64:'YQ=='}})})).status})()");check('Member cannot upload a source by creating a captain-only project',forbidden===403);
 await enter('captain');await wait("document.querySelectorAll('.member-node').length===2");await click('.canvas-brand');await fill('input[aria-label="科研项目名称"]','Iris 界面上传与复核实验');await ev("document.querySelectorAll('.research-member-check input').forEach(e=>e.click())");
 await ev("(()=>{const original=window.fetch;window.restoreFetch=()=>{window.fetch=original};window.fetch=async(...a)=>{if(String(a[0]).includes('sciencepal-examples'))await new Promise(r=>setTimeout(r,1200));return original(...a)}})()");
 await button('使用 Iris 公开数据复核模板');check('Creating stays disabled while the source is loading',!await ev(enabled('冻结提案并建立项目')));await button('移除数据文件');await delay(1400);
 check('Removing a pending example prevents a late response from restoring it',!await ev("!!document.querySelector('.research-result-contract')||!!document.querySelector('input[aria-label=\"科研来源网址\"]')"));await ev('window.restoreFetch()');
 await button('使用 Iris 公开数据复核模板');await wait("document.querySelector('.research-result-contract')");
 check('Template freezes result formats without replacing either member proposal',(await state()).members.every(m=>m.plan?.content.includes('source-iris.csv')));
 await writeFile(join(out,'invalid.bin'),'invalid');await upload(join(out,'invalid.bin'));await wait("document.querySelector('.sp-source-input [role=alert]')");
 check('Failed replacement cannot silently reuse the previous source or contracts',!await ev(enabled('冻结提案并建立项目'))&&!await ev("!!document.querySelector('.research-result-contract')"));await button('移除数据文件');
 await upload('fixtures/expert-case/1CRN.pdb');await wait("document.querySelector('.sp-source-input')?.textContent.includes('source-1CRN.pdb')");check('Research PDB uploads are accepted and still require provenance',!await ev(enabled('冻结提案并建立项目')));await button('移除数据文件');
 await upload('fixtures/iris/bezdekIris.data');await wait(`document.querySelector('input[aria-label="科研来源网址"]')`);check('Uploaded real data shows its digest and blocks creation before attribution',await ev("document.querySelector('.research-source-digest')?.textContent.includes('0fed2a99')")&&!await ev(enabled('冻结提案并建立项目')));
 await fill('input[aria-label="科研来源网址"]',IRIS_CASE.sourceUrl);await fill('textarea[aria-label="科研来源署名"]',IRIS_CASE.attribution);check('A custom upload can create a project once provenance is supplied',await ev(enabled('冻结提案并建立项目')));
 await replace('input[aria-label="科研来源网址"]','https://user:secret@example.org/data');check('Credential-bearing source URLs are blocked before submission',!await ev(enabled('冻结提案并建立项目')));
 await button('使用 Iris 公开数据复核模板');await wait("document.querySelector('.research-result-contract')");await wait(enabled('冻结提案并建立项目'));await close();await click('.canvas-brand');
 check('Closing and reopening the original project menu preserves selected source and draft',await ev("!!document.querySelector('.research-result-contract')&&document.querySelector('input[aria-label=\"科研项目名称\"]').value.includes('Iris')"));
 check('Upload section inherits the original dark popover instead of old light-page styling',await ev("getComputedStyle(document.querySelector('.sp-source-input')).backgroundColor==='rgba(0, 0, 0, 0)'"));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});check('Source creation form fits mobile width',await ev('document.documentElement.scrollWidth<=innerWidth'));await shot('source-mobile');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await shot('01-create-with-source');
 await button('冻结提案并建立项目');await wait(has('启动协议对齐'));const created=(await state()).projects[0];
 check('Project creation freezes original data bytes and contracts from the UI',created.source.artifact.sha256==='0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc'&&!!created.resultContracts);
check('Existing original topology opens the mixed project',await ev("!!document.querySelector('.command-bar')&&document.querySelectorAll('.member-node').length===2"));
 await button('启动协议对齐');await button('确认启动协议对齐');await codex('ALIGN');
 await wait(has('发布研究任务'));await button('发布研究任务');await button('确认发布研究任务');const first=await codex('TASK',true);
 check('First Codex output waits for the independent SciencePAL reviewer',(await state()).projects[0].tasks[0].status==='REVIEWING');
 await enter('member');await wait(has('管理本人连接器'));await button('管理本人连接器');await button('启动本人连接器');await close();
 await wait("document.querySelector('.rt-inspector')?.textContent.includes('打开 SciencePAL 回答原线程')");const asked=await state(),projectId=asked.projects[0].id,waiting=asked.projects[0].runs.find(r=>r.status==='NEEDS_INPUT');
 check('NEEDS_INPUT identifies the responsible member and original thread',waiting.ownerNodeId===asked.viewer.id&&await ev(`document.querySelector('.rt-inspector').textContent.includes(${JSON.stringify(waiting.threadId)})`));await shot('sciencepal-needs-input');
 await click('.codex-trigger');await button('停止本人连接器');await wait("document.querySelector('.top-popover').textContent.includes('未启动')");await close();
 const answered=await fetch(launch+'/simulation/answer',{method:'POST'}).then(r=>{assert.equal(r.status,200);return r.json();});
 check('Answer while connector is offline belongs to the original thread',answered.threadId===waiting.threadId&&answered.previousRunId===waiting.runId);
 await click('.codex-trigger');await button('启动本人连接器');await close();await wait("document.querySelector('.rt-projectbar')?.textContent.includes('评审退回')");
 const resumed=await state(),review=resumed.projects[0].runs.find(r=>r.id===waiting.id),midEvidence=await fetch(launch+'/simulation/evidence').then(r=>r.json());
 check('Restart adopts one continuation without reposting the answer or restarting the review',review.threadId===waiting.threadId&&review.runId===answered.runId&&review.continuations.length===1&&review.continuations[0].source==='sciencepal-web'&&midEvidence.remoteCalls.length===1&&midEvidence.messages===0);
 check('Rejected upstream output does not launch downstream analysis',!resumed.projects[0].tasks.find(t=>t.key==='species_summary').executionId);await shot('review-blocks-handoff');
 await enter('captain');await wait(has('安排返工'));await button('安排返工');await button('确认安排返工');const second=await codex('TASK');
 check('Rework has a new directory and preserves the original rejected file',second.directory!==first.directory&&JSON.parse(await readFile(first.outputPath,'utf8')).result.rows[0][0]===6.1&&JSON.parse(await readFile(second.outputPath,'utf8')).result.rows[0][0]===5.1);
 await codex('REVIEW');await wait("document.querySelector('.rt-projectbar')?.textContent.includes('本轮已完成')");const done=(await state()).projects[0],data=done.tasks.find(t=>t.key==='data_audit'),analysis=done.tasks.find(t=>t.key==='species_summary'),up=done.runs.find(r=>r.id===data.executionId),down=done.runs.find(r=>r.id===analysis.executionId);
 check('Approved Codex file is the exact frozen input handed to SciencePAL',down.inputs.some(f=>f.artifactId===data.artifactId&&f.sha256===up.output.sha256));
 check('Both platforms independently review the other member in one completed project',done.tasks.every(t=>t.status==='APPROVED'&&done.runs.find(r=>r.id===t.executionId).ownerNodeId!==done.runs.find(r=>r.id===t.reviewId).ownerNodeId));
 check('Codex execution never claims remote SciencePAL thread identifiers',done.runs.filter(r=>r.agent.platform==='codex').every(r=>r.localExecution&&!r.threadId&&!r.runId));
 check('Every Codex run retains a distinct task directory',new Set(taskDirectories).size===taskDirectories.length);
 const source=(await fetch(launch+'/simulation/evidence').then(r=>r.json())).projects[0].source;
 check('Every execution and review receives the same frozen source bytes',done.runs.every(r=>r.inputs.some(i=>i.artifactId===source.artifact.id&&i.sha256===source.artifact.sha256)));
 await writeFile(join(out,'project.json'),JSON.stringify(done,null,2));
 const result=await ev(`fetch('/api/sciencepal-team/projects/${done.id}/artifacts/${analysis.artifactId}').then(r=>{if(!r.ok)throw Error(r.status);return r.json()})`);
 await writeFile(join(out,'scientific-result.json'),JSON.stringify(result,null,2));

 check('No browser exceptions',errors.length===0);await click('.rt-inspector [aria-label="收起详情"]');await shot('mixed-completed');
 await writeFile(join(out,'qa-report.json'),JSON.stringify({checks,errors,requests,projectId,taskDirectories,continuation:review.continuations[0],at:new Date().toISOString(),scope:'Actual Iris CSV and independent JS/Python computations; complete browser creation, claims, review, rework, handoff and continuation. Simulated Agent dispatch, no live model or second human account.'},null,2));console.log(JSON.stringify({passed:checks.length,out}));await send('Browser.close');
}finally{ws?.close();if(chrome.exitCode===null)chrome.kill();}
