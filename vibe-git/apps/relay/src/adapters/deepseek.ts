// Adapted from the teammate's adapter; lifecycle and safe defaults are shared.
import type {ExecutionTransport} from '@vibe-git/protocol';
import type {AgentAdapter} from '../agent-types.js';
import {probeCli,startCli} from './cli-runtime.js';
export class DeepSeekAdapter implements AgentAdapter {
 readonly kind='deepseek' as const;
 constructor(private readonly executable?:string){}
 private bin(env:NodeJS.ProcessEnv){return env.DEEPSEEK_BIN?.trim()||this.executable||'dsh';}
 probe(env:NodeJS.ProcessEnv=process.env){return probeCli(this.bin(env),this.kind,env);}
 start(prompt:string,workspace:string,requested:ExecutionTransport,env:NodeJS.ProcessEnv=process.env){return startCli(this.kind,this.bin(env),['--profile','headless',prompt],workspace,requested,env,false);}
}
