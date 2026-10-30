import type {SPProject} from '@vibe-git/protocol';
import type {ResearchTarget,TeamState} from './research-model';
export const replayCases = {isolated:{label:'三成员 · 真实恢复与权限验收',purpose:'一个队长、两个成员身份；真实 Codex 与 SciencePAL 执行，验证返工、原线程续接和连接器恢复。单机单账号，故障为主动测试。'},iris:{label:'Iris · 两次退回与交接',purpose:'公开 Iris：Codex 核验源数据，SciencePAL Biology 计算统计；双方交叉评审，保留两次退回与返工。'},'1crn':{label:'1CRN · 专业计算与独立复核',purpose:'公开蛋白 1CRN：Codex 算几何，SciencePAL 用 Biology 工具算表面积，双方交叉复核。'}} as const;
export function replayResourceUrl(path:string):string{return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;}
export type ReplayCaseId=keyof typeof replayCases;
export function replayCaseId(value:string|null):ReplayCaseId{return value==='isolated'?'isolated':value==='iris'?'iris':'1crn';}
export interface ReplayFile {filename:string;url:string;sha256:string;size:number}
export interface ReplayScienceReport extends ReplayFile {artifactId:string;candidateSha256:string;reviewArtifactId:string}
export interface ReplayStep {id:string;title:string;summary:string;observedAt:string;origin:'captured-snapshot'|'continuation-receipt';source:string;focus:ResearchTarget;state:TeamState}
export interface ResearchReplay {formatVersion:1;id:ReplayCaseId;title:string;scope:string;scienceReports?:ReplayScienceReport[];brief?:string;guide:string;files:Record<string,ReplayFile>;evidenceUrl:string;remoteEvidenceUrl:string;steps:ReplayStep[]}
export interface ReplayContext {id:ReplayCaseId;stepId:string;scienceReports?:ReplayScienceReport[];brief?:string;guide:string;files:Record<string,ReplayFile>;evidenceUrl:string;remoteEvidenceUrl:string}
export function parseReplay(value:unknown):ResearchReplay{
 const b=value as ResearchReplay;
 if(b?.formatVersion!==1||!Object.hasOwn(replayCases,b.id)||!Array.isArray(b.steps)||b.steps.length<1||b.steps.length>20||new Set(b.steps.map(s=>s.id)).size!==b.steps.length)throw Error('回放清单格式无效');
 const prefix=`/research-replay/${b.id}/`;
 if(b.id==='iris'&&typeof b.brief!=='string')throw Error('回放案例说明缺失');
 if(!b.files||![b.evidenceUrl,b.remoteEvidenceUrl,...Object.values(b.files).map(f=>f.url),...(b.scienceReports??[]).map(f=>f.url)].every(u=>typeof u==='string'&&u.startsWith(prefix)&&!u.includes('..')&&!/[?#%\\]/.test(u)))throw Error('回放文件路径无效');
 for(const s of b.steps){if(!s.id||!s.state?.viewer||s.state.projects?.length!==1||!Array.isArray(s.state.members)||!['captured-snapshot','continuation-receipt'].includes(s.origin)||!Number.isFinite(Date.parse(s.observedAt)))throw Error('回放阶段缺少真实记录');}
 for(const report of b.scienceReports??[]){if(!b.files[report.artifactId]||b.files[report.artifactId]!.sha256!==report.candidateSha256||!b.files[report.reviewArtifactId]||!/^([a-f0-9]{64})$/.test(report.sha256)||!Number.isInteger(report.size)||report.size<1)throw Error('复核证据未绑定真实成果');}
 return b;
}
export function replayState(bundle:ResearchReplay,index:number):TeamState{
 const step=bundle.steps[index];if(!step)throw Error('回放阶段不存在');
 // Never inherit capabilities, CSRF, live presence or local entry flags from an export.
 return {viewer:step.state.viewer,members:step.state.members,projects:step.state.projects,replay:{id:bundle.id,stepId:step.id,scienceReports:(bundle.scienceReports??[]).filter(report=>{const p=step.state.projects[0]!;return p.tasks.some(t=>t.artifactId===report.artifactId&&t.status==='APPROVED')&&p.runs.some(r=>r.kind==='REVIEW'&&r.status==='COLLECTED'&&r.output?.id===report.reviewArtifactId&&r.inputs.some(f=>f.artifactId===report.artifactId&&f.sha256===report.candidateSha256));}).map(r=>({...r,url:replayResourceUrl(r.url)})),...(bundle.brief?{brief:bundle.brief}:{}),guide:bundle.guide,files:Object.fromEntries(Object.entries(bundle.files).map(([id,f])=>[id,{...f,url:replayResourceUrl(f.url)}])),evidenceUrl:replayResourceUrl(bundle.evidenceUrl),remoteEvidenceUrl:replayResourceUrl(bundle.remoteEvidenceUrl)}};
}
export function replayArtifactUrl(context:ReplayContext,id:string):string{return context.files[id]?.url??'#';}
export function replayRunSummary(p:SPProject){return p.runs.filter(r=>r.continuations?.length).flatMap(r=>r.continuations!.map(c=>({threadId:c.threadId,previousRunId:c.previousRunId,runId:c.runId})));}
