import { describe,it,expect } from 'vitest';
import type { SPProject,SPTask,SPRun } from '@vibe-git/protocol';
import { reviewsForAttempt,taskDisplay,connectionSummary,researchHandoffs,stageProject,actionTarget,taskActionText } from './research-model.js';
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
