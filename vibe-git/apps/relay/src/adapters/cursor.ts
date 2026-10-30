// Adapted from the teammate's adapter; lifecycle and safe defaults are shared.
import type {ExecutionTransport} from '@vibe-git/protocol';
import type {AgentAdapter} from '../agent-types.js';
import {probeCli,startCli} from './cli-runtime.js';
export class CursorAdapter implements AgentAdapter {
 readonly kind='cursor' as const;
 constructor(private readonly executable?:string){}
 private bin(env:NodeJS.ProcessEnv){return env.CURSOR_BIN?.trim()||this.executable||'cursor-agent';}
 probe(env:NodeJS.ProcessEnv=process.env){return probeCli(this.bin(env),this.kind,env);}
 start(prompt:string,workspace:string,requested:ExecutionTransport,env:NodeJS.ProcessEnv=process.env){return startCli(this.kind,this.bin(env),['-p',prompt,'--output-format','stream-json'],workspace,requested,env,true);}
}
