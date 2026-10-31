import {projectNextActions} from '@vibe-git/protocol';
import { describe,it,expect } from 'vitest';
import type { SPProject,SPTask,SPRun } from '@vibe-git/protocol';
import { projectCreationIssues,reviewsForAttempt,taskDisplay,connectionSummary,researchHandoffs,stageProject,actionTarget,taskActionText } from './research-model.js';
const task=(key:string,rest:Partial<SPTask>={}):SPTask=>({key,title:key,goal:'',boundary:'',acceptance:[],dependencies:[],assigneeAgentId:'a',reviewerAgentId:'b',outputFilename:key+'.json',status:'WAITING',attempt:0,executionId:null,reviewId:null,artifactId:null,feedback:'',review:null,...rest});
const run=(rest:Partial<SPRun>={}):SPRun=>({id:'consumer',kind:'TASK',revision:2,taskKey:'analysis',agent:{id:'b',name:'B'},status:'RUNNING',prompt:'',inputs:[],outputFilename:'analysis.json',output:null,threadId:null,runId:null,sandboxId:null,projectId:null,createdAt:'',updatedAt:'',error:null,remoteStatus:null,...rest});
const project=():SPProject=>({id:'p',roomId:'room',title:'test',revision:2,phase:'EXECUTING',paused:false,agents:[],coordinatorId:'a',proposals:[],requirementMarkdown:'R2',alignment:null,alignmentRunId:null,tasks:[task('data',{status:'APPROVED',artifactId:'approved'}),task('analysis',{dependencies:['data'],executionId:'consumer'})],runs:[run({inputs:[{artifactId:'approved',filename:'data.json',sha256:'sha',size:1}]})],changes:[],history:[],maxRuns:10,error:null,createdAt:'',updatedAt:'',events:[]});
describe('Research topology provenance',()=>{
 it('requires the validated downstream receipt before marking delivered',()=>{const p=project();expect(researchHandoffs(p)[0]?.state).toBe('released');p.runs[0]!.status='COLLECTED';expect(researchHandoffs(p)[0]?.state).toBe('delivered');p.runs[0]!.inputs=[];expect(researchHandoffs(p)[0]?.state).toBe('released');});
 it('does not accept matching filenames or stale revision inputs',()=>{const p=project();p.runs[0]!.status='COLLECTED';p.runs[0]!.inputs[0]!.artifactId='old';expect(researchHandoffs(p)[0]?.state).toBe('released');p.runs[0]!.inputs[0]!.artifactId='approved';p.runs[0]!.revision=1;expect(researchHandoffs(p)[0]?.state).toBe('released');});
 it('blocks rejected outputs even when an input receipt exists',()=>{const p=project();p.runs[0]!.status='COLLECTED';p.tasks[0]!.status='CHANGES_REQUESTED';expect(researchHandoffs(p)[0]?.state).toBe('blocked');});
 it('does not infer delivery from a different consumer run',()=>{const p=project();p.runs[0]!.status='COLLECTED';p.tasks[1]!.executionId='new';expect(researchHandoffs(p)[0]?.state).toBe('released');});
 it('uses historical tasks and receipts for archived versions without mutating current',()=>{const p=project();p.history=[{revision:1,requirementMarkdown:'R1',alignment:null,tasks:[task('old')]}];p.runs.push(run({id:'r1',revision:1}));const old=stageProject(p,1);expect(old.tasks[0]!.key).toBe('old');expect(old.runs.map(r=>r.id)).toEqual(['r1']);expect(p.tasks[0]!.key).toBe('data');expect(stageProject(p,9)).toBe(p);});
 it('rework responsibility opens the actual task and preserves revision guard',()=>{const p=project();const a={kind:'decision',title:'',detail:'',ownerNodeId:'captain',ownerLabel:'A',isMine:true,operation:'rework',body:{revision:2,taskKey:'data'}};expect(actionTarget(p,a)).toEqual({type:'task',id:'data'});expect(taskActionText(p,a)).toContain('"revision": 2');expect(taskActionText(p,a)).toContain('command p rework action.json');});
});



it('does not interpret absent panel heartbeat as Codex execution being blocked',()=>{const p=project();p.team={captainNodeId:'a',members:[{nodeId:'a',label:'A',agent:{id:'a',name:'Codex',platform:'codex'},documentId:'d',documentRevision:1}]};p.runs=[run({agent:{id:'a',name:'Codex',platform:'codex'},ownerNodeId:'a',status:'STARTING'})];const state:any={viewer:{id:'a'},members:[],projects:[p]};expect(connectionSummary(state,p,'a').blocker).toBe('等待本人 Codex 提交');expect(connectionSummary(state,p,'a').online).toBe(false);});

it('shows waiting input consistently and clears it after same-thread continuation',()=>{const p=project(),t=p.tasks[1]!;t.status='RUNNING';p.runs[0]!.status='NEEDS_INPUT';expect(taskDisplay(p,t)).toEqual({label:'等待本人回答',tone:'attention'});p.runs[0]!.status='RUNNING';expect(taskDisplay(p,t)).toEqual({label:'执行中',tone:'active'});});
it('uses the active review and ignores stale waiting executions',()=>{const p=project(),t=p.tasks[1]!;t.status='REVIEWING';t.reviewId='review';p.runs[0]!.status='NEEDS_INPUT';p.runs.push(run({id:'review',kind:'REVIEW'}));expect(taskDisplay(p,t).label).toBe('评审中');p.runs[1]!.status='NEEDS_INPUT';expect(taskDisplay(p,t).label).toBe('评审等待回答');t.status='APPROVED';expect(taskDisplay(p,t).label).toBe('已通过评审');});

it('keeps own review retries but excludes downstream reviews that consume the same artifact',()=>{
 const p=project(),output={id:'candidate',filename:'data.json',sha256:'sha',size:1,collectedAt:''};
 const execution=run({id:'producer',taskKey:'data',output});
 const input={artifactId:output.id,filename:output.filename,sha256:output.sha256,size:output.size};
 p.runs=[execution,run({id:'own-invalid',kind:'REVIEW',taskKey:'data',status:'INVALID',inputs:[input]}),run({id:'own-valid',kind:'REVIEW',taskKey:'data',status:'COLLECTED',inputs:[input]}),run({id:'downstream',kind:'REVIEW',taskKey:'analysis',inputs:[input]}),run({id:'old-version',kind:'REVIEW',taskKey:'data',revision:1,inputs:[input]})];
 expect(reviewsForAttempt(p,execution).map(r=>r.id)).toEqual(['own-invalid','own-valid']);
});

it('keeps origin runs for explicitly reused archived results and does not leak current governance into old stages',()=>{
 const p=project();p.revision=3;p.governance={version:1,requirements:[],decisions:[]};
 const carried=task('data',{carriedFrom:{revision:1,changeId:'c',fingerprint:'f'}});
 p.history=[{revision:1,requirementMarkdown:'legacy',alignment:null,tasks:[]},{revision:2,requirementMarkdown:'R2',alignment:null,tasks:[carried],governance:{version:1,requirements:[],decisions:[]}}];
 p.runs.push(run({id:'origin',revision:1,taskKey:'data'}),run({id:'unrelated',revision:1,taskKey:'other'}));
 expect(stageProject(p,2).runs.map(r=>r.id)).toEqual(['consumer','origin']);
 expect(stageProject(p,1).governance).toBeUndefined();
});

it('keeps origin handoff receipts visible only for explicitly approved carried tasks',()=>{
 const p=project();p.runs[0]!.revision=1;p.runs[0]!.status='COLLECTED';
 const consumer=p.tasks[1]!;consumer.status='APPROVED';consumer.carriedFrom={revision:1,changeId:'c',fingerprint:'f'};
 expect(researchHandoffs(p)[0]).toMatchObject({state:'delivered',label:'文件已交接 · 沿用 R1'});
 consumer.status='WAITING';expect(researchHandoffs(p)[0]!.state).toBe('released');
 consumer.status='APPROVED';p.runs[0]!.inputs=[];expect(researchHandoffs(p)[0]!.state).toBe('released');
});

it('takes a failed review to its actual task and explains that retry preserves the calculation',()=>{
 const p=project();p.phase='BLOCKED';p.team={captainNodeId:'captain',members:[{nodeId:'captain',label:'Captain',agent:{id:'a',name:'A'},documentId:'d',documentRevision:1}]};
 p.runs=[run({id:'bad-review',kind:'REVIEW',status:'INVALID',error:'原验收全部通过，不应追加实验'})];
 const action=projectNextActions(p,'captain').actions.find(a=>a.operation==='retry')!;
 expect(actionTarget(p,action)).toEqual({type:'task',id:'analysis'});
 expect(action.detail).toContain('不重新执行科研计算');
 expect(action.ownerNodeId).toBe('captain');expect(action.body?.runId).toBe('bad-review');
});


describe('Recovery actions at the shared run budget',()=>{
 const rejected=()=>{const p=project();p.phase='CHANGES_REQUESTED';p.team={captainNodeId:'captain',members:[{nodeId:'captain',label:'Captain',agent:{id:'a',name:'A'},documentId:'d',documentRevision:1}]};p.tasks=[task('data',{status:'CHANGES_REQUESTED',attempt:1,artifactId:'artifact',reviewId:'review'})];p.runs=[run({id:'review',kind:'REVIEW',taskKey:'data',status:'COLLECTED',inputs:[{artifactId:'artifact',filename:'data.json',sha256:'sha',size:1}],continuations:[{threadId:'t',previousRunId:'old',runId:'next',source:'sciencepal-web',at:''}]})];p.maxRuns=2;return p;};
 it('replaces impossible rework and supplement actions with one truthful budget notice',()=>{
  const p=rejected(),before=JSON.stringify(p),actions=projectNextActions(p,'captain').actions;
  expect(actions.some(a=>['rework','supplement-review','change'].includes(a.operation??''))).toBe(false);
  expect(actions.filter(a=>a.kind==='budget')).toHaveLength(1);
  expect(actions[0]).toMatchObject({ownerNodeId:'captain',isMine:true,operation:'evidence'});
  expect(actions[0]!.detail).toContain('2 / 2');expect(actions[0]!.detail).toContain('续接');
  expect(JSON.stringify(p)).toBe(before);
 });
 it('retains both recovery choices when one slot remains without granting member authority',()=>{
  const p=rejected();p.maxRuns=3;const actions=projectNextActions(p,'member').actions;
  expect(actions.map(a=>a.operation)).toEqual(['rework','supplement-review']);
  expect(actions.every(a=>!a.isMine&&a.ownerNodeId==='captain')).toBe(true);
 });
 it('does not offer failed-review retry at the limit or hide already reserved work',()=>{
  const p=rejected();p.phase='BLOCKED';p.runs[0]!.status='INVALID';
  expect(projectNextActions(p,'captain').actions.map(a=>a.operation)).toEqual(['evidence']);
  p.phase='REVIEWING';p.runs[0]!.status='RUNNING';
  expect(projectNextActions(p,'captain').actions.some(a=>a.kind==='running')).toBe(true);
 });
});


describe('Project creation readiness',()=>{
 const members=[{id:'captain',label:'Captain',binding:{agent:{id:'a',name:'A'}},plan:{id:'p'}},{id:'member',label:'Member',binding:{agent:{id:'b',name:'B'}},plan:{id:'q'}}] as any;
 it('explains missing name and captain selection instead of only disabling creation',()=>{
  const issues=projectCreationIssues('', ['member'], 'captain',members,true,'');
  expect(issues).toEqual(['填写项目名称','选择 2–4 位成员','参与成员必须包含队长本人']);
 });
 it('catches a selected member whose proposal disappeared and unresolved file errors',()=>{
  const stale=[members[0],{...members[1],plan:null}];
  const issues=projectCreationIssues('Study',['captain','member'],'captain',stale,false,'请补充来源署名与使用许可。');
  expect(issues.some(s=>s.includes('Member'))).toBe(true);
  expect(issues.some(s=>s.includes('文件'))).toBe(true);
  expect(issues).toContain('请补充来源署名与使用许可。');
 });
 it('allows a ready two-member project without requiring an optional source file',()=>{
  expect(projectCreationIssues('Study',['captain','member'],'captain',members,true,'')).toEqual([]);
 });
});

it('distinguishes a pending read, a rejected first file and a failed replacement without unlocking creation',()=>{
 const members=[{id:'a',binding:{},plan:{}},{id:'b',binding:{},plan:{}}] as any;
 const base:[string,string[],string,any,boolean,string]=['Study',['a','b'],'a',members,false,''];
 expect(projectCreationIssues(...base)).toEqual(['正在读取文件，请等待完成后再建项。']);
 const first=projectCreationIssues(...base,{error:'UTF-8',hasSource:false});
 expect(first).toHaveLength(1);expect(first[0]).toContain('文件读取失败');expect(first[0]).not.toContain('继续使用原文件');
 const replacement=projectCreationIssues(...base,{error:'UTF-8',hasSource:true});
 expect(replacement).toHaveLength(1);expect(replacement[0]).toContain('继续使用原文件');
 expect(projectCreationIssues('Study',['a','b'],'a',members,true,'',{error:'',hasSource:true})).toEqual([]);
});
