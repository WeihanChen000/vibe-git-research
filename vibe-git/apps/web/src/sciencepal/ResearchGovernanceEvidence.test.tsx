import {verifiedJson,loadIndependentVerification,ProofReadStatus} from './ScientificEvidence';
import {SourceFileInput,readResearchSourceFile} from './SourceFileInput';
import {CompletedDeliverables,SciencePALThreadEntry} from "./ResearchInspector";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect,vi} from "vitest";
import {reworkGuidance,RecoveryImpact,PublishTaskChecks,PublishTaskAcceptance,ChangeImpactSummary} from "./ResearchCommand";
import type {SPTaskDraft,SPProject,SPRun} from "@vibe-git/protocol";
import {ResearchGovernanceEvidence} from "./ResearchGovernanceEvidence";
describe("Governance evidence in the original inspector",()=>{
 it("shows uncovered original requirements without claiming they passed",()=>{
  const p={tasks:[],alignment:{tasks:[{title:"Data",requirementIds:["a"]}]},governance:{version:1,decisions:[],requirements:[{id:"a",text:"Use frozen method"},{id:"b",text:"Report uncertainty"}]}} as unknown as SPProject;
  const html=renderToStaticMarkup(createElement(ResearchGovernanceEvidence,{p}));
  expect(html).toContain("原文覆盖 1 / 2 条");expect(html).toContain("Report uncertainty");expect(html).toContain("等待对齐到任务");expect(html).toContain('class="rt-detail-section"');
 });
 it("labels legacy projects honestly rather than retroactively asserting coverage",()=>{
  const html=renderToStaticMarkup(createElement(ResearchGovernanceEvidence,{p:{} as SPProject}));
  expect(html).toContain("历史协议");expect(html).toContain("未记录逐条原文覆盖");
 });
});

describe('Publish-time frozen parameter review',()=>{
 it('shows actual numeric constraints and tolerance before approval, even when the value is surprising',()=>{
  const task={resultSchema:{type:'object',properties:{n_points:{type:'number',const:-11000},probe_radius_A:{type:'number',const:1.4},source_sha256:{type:'string',const:'a'.repeat(64)}}},scientificChecks:[{id:'reference',kind:'reference',path:'total_A2',expected:2973.16,absoluteTolerance:59.46,relativeTolerance:0,provenance:'independent'}]} as unknown as SPTaskDraft;
  const html=renderToStaticMarkup(createElement(PublishTaskChecks,{task}));
  expect(html).toContain('n_points');expect(html).toContain('-11000');expect(html).toContain('1.4');expect(html).toContain('2973.16');expect(html).toContain('59.46');expect(html).toContain('绑定上传源文件指纹');expect(html).not.toContain('a'.repeat(64));
 });
});


describe("Decision detail disclosure without weakening the protocol",()=>{
 it("retains every exact acceptance criterion in closed native details",()=>{
  const task={acceptance:['Keep probe 1.4 A','[REQ:r-0123456789abcdef] 核对原提案要求：Do not replace the source.']} as SPTaskDraft;
  const before=JSON.stringify(task);
  const html=renderToStaticMarkup(createElement(PublishTaskAcceptance,{task}));
  expect(html).toMatch(/^<details><summary>/);expect(html).not.toContain(' open');
  for(const text of task.acceptance)expect(html).toContain(text);
  expect(JSON.stringify(task)).toBe(before);
 });
 it("shows affected and retained tasks before long rationale, preserving actual delta and source edits",()=>{
  const p={revision:1,tasks:[{key:'compute',title:'Compute frozen data'},{key:'report',title:'Write report'}],governance:{requirements:[{id:'original',text:'Original source rule'}]}} as unknown as SPProject;
  const change={request:'Add a Chinese summary only',result:{affectedTaskKeys:['report'],taskImpacts:[{key:'compute',affected:false,rationale:'Source and method unchanged'},{key:'report',affected:true,rationale:'Presentation changed'}],rationale:'Long review evidence '.repeat(300),requirementMarkdown:'Full protocol remains available',requirementEdits:[{requirementId:'original',replacement:'Approved replacement rule',reason:'Explicit source change'}]}} as SPProject['changes'][number];
  const before=JSON.stringify({p,change}),html=renderToStaticMarkup(createElement(ChangeImpactSummary,{p,change}));
  expect(html.indexOf('需要更新的任务')).toBeLessThan(html.indexOf('<details>'));
  expect(html.indexOf('获批成果须核验后复用')).toBeLessThan(html.indexOf('<details>'));
  expect(html).not.toContain(' open');
  for(const text of [change.request,change.result!.rationale,'Full protocol remains available','Original source rule','Approved replacement rule'])expect(html).toContain(text);
  expect(JSON.stringify({p,change})).toBe(before);
 });
});


describe("Waiting-input entry in the original inspector",()=>{
 it("links the exact original thread without displaying CLI instructions",()=>{
  const run={agent:{platform:"sciencepal"},projectId:"project-1",threadId:"thread-1"} as SPRun;
  const html=renderToStaticMarkup(createElement(SciencePALThreadEntry,{run}));
  expect(html).toContain('href="https://sciencepal.ai/projects/project-1/thread/thread-1"');
  expect(html).toContain("打开本次 SciencePAL 原线程");expect(html).not.toContain("停止 work");
  expect(html).toContain("<details><summary>查看原线程编号");
 });
 it("labels the dashboard fallback honestly and never constructs an unbound or foreign URL",()=>{
  for(const run of [undefined,{agent:{},projectId:null,threadId:"thread-1"},{agent:{},projectId:"../other",threadId:"thread-1"},{agent:{platform:"codex"},projectId:"project-1",threadId:"thread-1"}]){
   const html=renderToStaticMarkup(createElement(SciencePALThreadEntry,{run:run as SPRun|undefined}));
   expect(html).toContain('href="https://sciencepal.ai/dashboard"');expect(html).toContain("尚未取得原线程地址");
   expect(html).not.toContain("打开本次 SciencePAL 原线程");
  }
 });
});


describe('Source selection recovery',()=>{
 it('states supported formats and limits before any selection',()=>{
  const html=renderToStaticMarkup(createElement(SourceFileInput,{source:undefined,onChange:()=>{},onExample:()=>{}}));
  expect(html).toContain('单份 CSV、TSV、TXT、JSON、DATA 或 PDB');expect(html).toContain('256 KiB');expect(html).toContain('失败不会清除原文件');
 });
 it('validates a replacement without changing the caller-owned original source',async()=>{
  const previous={filename:'source-old.csv',base64:btoa('a,b'),sourceUrl:'https://example.com',attribution:'own data'},before=JSON.stringify(previous);
  const file=(name:string,bytes:number[])=>({name,size:bytes.length,arrayBuffer:async()=>new Uint8Array(bytes).buffer});
  await expect(readResearchSourceFile(file('bad.csv',[255]))).rejects.toThrow('UTF-8');
  await expect(readResearchSourceFile(file('bad.pdf',[1]))).rejects.toThrow('仅支持');
  await expect(readResearchSourceFile(file('empty.csv',[]))).rejects.toThrow('非空');
  expect(JSON.stringify(previous)).toBe(before);
  const next=await readResearchSourceFile(file('new.csv',[97,44,98]));
  expect(next).toEqual({filename:'source-new.csv',base64:btoa('a,b'),sourceUrl:'',attribution:''});
 });
 it('rejects an oversized file before reading it',async()=>{
  let reads=0;
  await expect(readResearchSourceFile({name:'large.csv',size:256*1024+1,arrayBuffer:async()=>{reads++;return new ArrayBuffer(0);}})).rejects.toThrow('256 KiB');
  expect(reads).toBe(0);
 });
});


describe('Recovery cost and approved delivery',()=>{
 it('distinguishes review retry from recomputation and counts continuations without quoting a price',()=>{
  const p={runs:[{id:'r',kind:'REVIEW',continuations:[{}]}],maxRuns:12} as SPProject;
  const review=renderToStaticMarkup(createElement(RecoveryImpact,{p,operation:'retry',runId:'r'}));
  expect(review).toContain('保留原计算成果');expect(review).toContain('2 / 12');expect(review).toContain('费用未获取');
  const rework=renderToStaticMarkup(createElement(RecoveryImpact,{p,operation:'rework'}));
  expect(rework).toContain('重新执行本任务');expect(rework).toContain('两个运行名额');
  const supplement=renderToStaticMarkup(createElement(RecoveryImpact,{p,operation:'supplement-review'}));
  expect(supplement).toContain('不重新计算');
 });
 it('links only the currently approved artifact and its bound review, including reused results',()=>{
  const p={id:'project',phase:'COMPLETED',revision:2,maxRuns:12,tasks:[{key:'fit',title:'Fit',status:'APPROVED',executionId:'execution',artifactId:'approved',reviewId:'review',carriedFrom:{revision:1}}],runs:[
   {id:'execution',kind:'TASK',revision:1,taskKey:'fit',output:{id:'approved',filename:'fit.json'},scientificValidation:{status:'PASSED'}},
   {id:'review',kind:'REVIEW',revision:1,taskKey:'fit',status:'COLLECTED',inputs:[{artifactId:'approved'}],output:{id:'approval',filename:'review.json'}},
   {id:'old',kind:'TASK',revision:1,taskKey:'fit',output:{id:'rejected',filename:'old.json'}}
  ]} as unknown as SPProject;
  const render=()=>renderToStaticMarkup(createElement(CompletedDeliverables,{p,open:()=>{}}));
  const html=render();expect(html).toContain('/artifacts/approved');expect(html).toContain('/artifacts/approval');expect(html).not.toContain('/artifacts/rejected');
  expect(html).toContain('沿用 R1');expect(html).toContain('3 / 12');
  p.tasks[0]!.artifactId='different';const stale=render();expect(stale).not.toContain('/artifacts/approved');expect(stale).not.toContain('/artifacts/approval');expect(stale).toContain('未对应');
 });
 it('does not label absent scientific checks as passed or show incomplete work as a delivery',()=>{
  const p={id:'p',phase:'COMPLETED',revision:1,maxRuns:12,tasks:[],runs:[]} as unknown as SPProject;
  p.tasks=[{key:'report',title:'Report',status:'APPROVED',executionId:'r',artifactId:'f'} as any];
  p.runs=[{id:'r',kind:'TASK',taskKey:'report',revision:1,output:{id:'f',filename:'report.json'}} as any];
  const render=()=>renderToStaticMarkup(createElement(CompletedDeliverables,{p,open:()=>{}}));
  expect(render()).toContain('未记录可执行数值检查');
  p.phase='REVIEWING';expect(render()).toBe('');
 });
});


it('retains the failed replacement warning when reopening the project panel',()=>{
 const source={filename:'source-original.csv',base64:btoa('a,b'),sourceUrl:'https://example.com/data',attribution:'Original attribution'};
 const html=renderToStaticMarkup(createElement(SourceFileInput,{source,selectionError:'文件不是 UTF-8，请先转换编码。',onChange:()=>{},onExample:()=>{}}));
 expect(html).toContain('继续使用原文件');expect(html).toContain('source-original.csv');expect(html).toContain('Original attribution');expect(html).toContain('替换未成功');
});


it('recommends supplement review only when that action actually exists',()=>{
 const p={phase:'CHANGES_REQUESTED',paused:false,revision:1,maxRuns:32,team:{captainNodeId:'captain',members:[]},tasks:[{key:'fit',status:'CHANGES_REQUESTED',attempt:2,artifactId:'f',reviewId:'r'}],runs:[{kind:'REVIEW',revision:1,taskKey:'fit',inputs:[{artifactId:'f'}]}]} as unknown as SPProject;
 expect(reworkGuidance(p,'fit')).toContain('选择“补充证据复审”');
 p.runs.push({...p.runs[0]!,status:'INVALID'});
 expect(reworkGuidance(p,'fit')).not.toContain('选择“补充证据复审”');
 expect(reworkGuidance(p,'fit')).toContain('含无效评审');
 p.runs.pop();p.maxRuns=1;
 expect(reworkGuidance(p,'fit')).toContain('剩余运行名额');
 expect(reworkGuidance(p,'fit')).not.toContain('选择“补充证据复审”');
});


it('explains a failed evidence connection in Chinese without exposing raw fetch errors',async()=>{
 const fetchMock=vi.spyOn(globalThis,'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
 try{
  await expect(verifiedJson('/artifact','sha',1,new AbortController().signal)).rejects.toThrow('暂时无法连接成果文件');
  const c=new AbortController();c.abort();
  await expect(verifiedJson('/artifact','sha',1,c.signal)).rejects.toThrow('成果读取超时或已取消');
 }finally{fetchMock.mockRestore();}
});

describe('Independent proof read recovery',()=>{
 it('distinguishes an absent report from a failed read and offers retry only for a bound report',()=>{
  const render=(bound:boolean,error:string)=>renderToStaticMarkup(createElement(ProofReadStatus,{bound,error,onRetry:()=>{}}));
  expect(render(false,'')).toContain('尚未绑定');expect(render(false,'')).not.toContain('重新读取复核记录');
  expect(render(true,'')).toContain('正在读取');expect(render(true,'')).not.toContain('尚未绑定');
  const failed=render(true,'暂时无法连接复核记录文件');
  expect(failed).toContain('重新读取复核记录');expect(failed).toContain('原成果保留');expect(failed).toContain('不启动 Agent');
 });
 it('recovers a proof request, rechecks the candidate and rejects replacement bytes even on retry',async()=>{
  const candidate=JSON.stringify({result:{rate:0.1}}),bytes=new TextEncoder().encode(candidate);
  const hash=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const sha256=await hash(candidate),file={sha256,size:bytes.length};
  const body=JSON.stringify({formatVersion:1,candidateSha256:sha256,reviewArtifactId:'review',method:'independent endpoint reference',passed:true,checks:[{passed:true}],metrics:[{name:'rate',observed:0.1,reference:0.1,tolerance:1e-8,comparison:'absolute',unit:'min^-1'}]});
  const proof={url:'/proof',sha256:await hash(body),size:new TextEncoder().encode(body).length,reviewArtifactId:'review',artifactId:'fit',candidateSha256:sha256,filename:'proof.json'};
  const signal=new AbortController().signal;
  let failed=true,tampered=false;
  const mock=vi.spyOn(globalThis,'fetch').mockImplementation(async url=>{
   if(url==='/candidate')return new Response(tampered?candidate.replace('0.1','0.2'):candidate);
   if(failed)throw new TypeError('Failed to fetch');
   return new Response(body);
  });
  try{
   await expect(loadIndependentVerification('/candidate',file,proof,signal)).rejects.toThrow('暂时无法连接复核记录文件');
   failed=false;await expect(loadIndependentVerification('/candidate',file,proof,signal)).resolves.toMatchObject({passed:true});
   tampered=true;await expect(loadIndependentVerification('/candidate',file,proof,signal)).rejects.toThrow('证据哈希');
   expect(mock.mock.calls.every(([,options])=>!options?.method||options.method==='GET')).toBe(true);
  }finally{mock.mockRestore();}
 });
 it('reports a missing bound file differently from a temporary connection failure',async()=>{
  const mock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:404}));
  try{await expect(verifiedJson('/proof','sha',1,new AbortController().signal,'复核记录')).rejects.toThrow('已绑定的复核记录文件不存在');}finally{mock.mockRestore();}
 });
});
