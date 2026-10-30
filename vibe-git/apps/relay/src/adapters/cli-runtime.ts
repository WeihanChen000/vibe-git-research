import {spawn,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import type {ActiveRun,AgentKind,AgentProbe,ExecutionCompletion} from '../agent-types.js';
import type {ExecutionTransport} from '@vibe-git/protocol';
/** No shell, no permission-bypass switches, no implicit fallback transport. */
export function probeCli(executable:string,kind:AgentKind,env:NodeJS.ProcessEnv):AgentProbe {
 try {const version=execFileSync(executable,['--version'],{env,encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:32768,stdio:['ignore','pipe','ignore']}).trim();return {kind,state:'unverified',version,detail:`${kind} CLI 已安装；账号与实际执行尚未验证`,transports:{appServer:'unsupported',cli:'unverified',preferred:'cli'}};}
 catch{return {kind,state:'unsupported',version:null,detail:`未发现可直接执行的 ${kind} CLI；Windows 请将 *_BIN 配为真实可执行文件`,transports:{appServer:'unsupported',cli:'unsupported',preferred:'auto'}};}
}
export async function startCli(kind:AgentKind,executable:string,args:string[],workspace:string,requested:ExecutionTransport,env:NodeJS.ProcessEnv,streamJson=false):Promise<ActiveRun>{
 if(requested!=='auto'&&requested!=='cli')throw Error(`${kind} 不支持 ${requested}`);
 const child=spawn(executable,args,{cwd:workspace,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let interrupted=false,failed=false,stdout='',stderr='',pending='';
 let finish!:(r:ExecutionCompletion)=>void;const done=new Promise<ExecutionCompletion>(r=>finish=r);
 child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
 const event=(line:string)=>{try{const e=JSON.parse(line);if(e.is_error||e.type==='error'||e.error)failed=true;}catch{/* Plain diagnostic lines remain text, never commands. */}};
 child.stdout.on('data',(chunk:string)=>{stdout=(stdout+chunk).slice(-32000);if(streamJson){pending+=chunk;const lines=pending.split('\n');pending=lines.pop()!.slice(-32000);lines.forEach(event);}});
 child.stderr.on('data',(chunk:string)=>{stderr=(stderr+chunk).slice(-32000);});
 child.stdin.on('error',()=>{});child.stdin.end();
 child.once('error',e=>finish({status:'FAILED',detail:e.message,outputSummary:null}));
 child.once('close',code=>{if(streamJson&&pending)event(pending);finish({status:interrupted?'INTERRUPTED':code===0&&!failed?'COMPLETED':'FAILED',detail:interrupted?'本人已中断':code===0&&!failed?'进程完成；成果仍需校验与评审':stderr.slice(-2000)||'执行失败或返回错误事件',outputSummary:stdout.trim().slice(-8000)||null});});
 await new Promise<void>((ok,no)=>{child.once('spawn',ok);child.once('error',no);});
 return {transport:'cli',runtimeId:`${kind}:${randomUUID()}`,done,interrupt:async()=>{interrupted=true;if(child.exitCode===null&&!child.killed)child.kill();return done;}};
}
