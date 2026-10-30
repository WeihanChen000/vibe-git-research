import type {ExecutionTransport} from '@vibe-git/protocol';
import type {AgentAdapter,AgentProbe,ActiveRun,ResearchExecution,SciencePALBackend,ExecutionCompletion} from '../agent-types.js';
/** Cloud adapter consumes the same frozen files. Durable claiming/recovery stays in the member connector. */
export class SciencePALAdapter implements AgentAdapter {
 readonly kind='sciencepal' as const;
 constructor(private readonly backend?:SciencePALBackend){}
 probe():AgentProbe{return {kind:this.kind,state:this.backend?.configured?'unverified':'unsupported',version:null,detail:'SciencePAL 云端；专家与账号由本人连接器验证，CLI/App Server 不适用',transports:{appServer:'unsupported',cli:'unsupported',preferred:'auto'}};}
 async start(prompt:string,_workspace:string,requested:ExecutionTransport,_env?:NodeJS.ProcessEnv,research?:ResearchExecution):Promise<ActiveRun>{
  if(requested!=='auto')throw Error('SciencePAL 使用云端接口，不支持本地 CLI/App Server 传输');
  if(!this.backend?.configured||!research?.agentId||!research.files.length)throw Error('SciencePAL 需要已验证的本人连接器和冻结科研任务包');
  const remote=await this.backend.start(research.agentId,prompt,research.files[0],research.files.slice(1));
  let completion:Promise<ExecutionCompletion>|undefined;
  const poll=async():Promise<ExecutionCompletion>=>{for(;;){const s=await this.backend!.run(remote.runId);if(s==='completed')return {status:'COMPLETED',detail:'云端执行结束；成果仍须下载、核验与评审',outputSummary:null};if(['asked','paused','waiting_for_input'].includes(s))return {status:'NEEDS_INPUT',detail:'由本人在原线程回答，连接器负责续接',outputSummary:null};if(['failed','stopped','cancelled','error'].includes(s))return {status:'FAILED',detail:'云端执行失败',outputSummary:null};await new Promise(r=>setTimeout(r,1000));}};
  return {transport:'cloud',remote,runtimeId:remote.runId,get done(){return completion??=poll();},interrupt:async()=>{throw Error('当前 SciencePAL 适配器不支持远端取消；停止连接器不等于取消云端运行');}};
 }
}
