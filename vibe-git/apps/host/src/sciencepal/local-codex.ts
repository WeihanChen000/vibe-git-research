import { isLocalResearchPlatform, researchPlatformName } from "@vibe-git/protocol";
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {isLatestSPRun,type SPProject} from '@vibe-git/protocol';
import {badRequest,forbidden,revisionConflict} from '../domain/errors.js';
import type {MemberRequest} from './member-connector.js';
import {localMemberTask} from './local-member.js';
import {bridgeFilename} from './bridge.js';

async function ordinary(path:string,directory=false){
 try{const s=await lstat(path);if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile()))throw badRequest('任务文件或目录不能是链接');return true;}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}
}
/** The browser supplies IDs only. Paths and output filenames come from this member's frozen run. */
export async function managedCodexTask(command:'inspect'|'take'|'submit',request:MemberRequest,context:{host:string;nodeId:string;projectId:string;runId:string;profileDir:string}){
 const {projectId,runId}=context;
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(projectId)||!/^[a-zA-Z0-9_-]{1,120}$/.test(runId))throw badRequest('请选择本项目的具体任务');
 const p=await request<SPProject>(`/api/sciencepal-team/projects/${projectId}`),run=p.runs.find(r=>r.id===runId);
 if(!run||run.ownerNodeId!==context.nodeId||!isLocalResearchPlatform(run.agent.platform))throw forbidden('只能处理本人冻结为本地 Agent 的任务');
 if(run.revision!==p.revision||!isLatestSPRun(p.runs,run))throw revisionConflict('任务已被新版或返工替代，请回到当前待办');
 const scope=createHash('sha256').update(`${context.host}\n${context.nodeId}\n${projectId}`).digest('hex');
 const parent=join(context.profileDir,'codex-tasks'),directory=join(parent,createHash('sha256').update(`${scope}\n${runId}`).digest('hex'));
 await ordinary(parent,true);await ordinary(directory,true);
 const marker=join(directory,'task.json'),instructions=join(directory,'TASK.md'),output=join(directory,bridgeFilename(run.outputFilename));
 const exists=await ordinary(marker);
 if(exists){const saved=JSON.parse(await readFile(marker,'utf8'));if(saved.scope!==scope||saved.runId!==runId||saved.projectId!==projectId)throw forbidden('本机任务目录身份不匹配，保留文件并核对');}
 if(command==='take'){
  if(run.status!=='READY'&&!exists)throw revisionConflict('此任务已在其他入口领取，请继续使用原任务目录，不会创建第二份领取');
  await localMemberTask('take',request,{...context,runId},directory);
 }
 if(command==='submit'){
  if(!exists)throw badRequest('请先准备本人任务包；CLI 已领取的任务继续从原目录交回');
  if(!await ordinary(output))throw badRequest('尚未找到本次成果文件，请先让本人 Agent 按 TASK.md 完成任务');
  const result=await localMemberTask('submit',request,context,directory,output);
  if(result.status!=='COLLECTED')throw badRequest(result.error||'成果未通过校验，请查看任务失败原因');
  return {...result,directory,instructions,outputPath:output};
 }
 return {projectId,runId,directory,instructions,outputPath:output,exists:exists||command==='take',prepared:await ordinary(instructions),outputExists:await ordinary(output),status:run.status};
}
