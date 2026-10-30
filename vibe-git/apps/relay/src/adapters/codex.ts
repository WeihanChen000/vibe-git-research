import {existsSync} from "node:fs";
import {join} from "node:path";
import type {ExecutionCommand,ExecutionTransport} from '@vibe-git/protocol';
import {CodexExecutor} from '../executor.js';
import {probeCodex,type CodexProbe} from '../codex-capability.js';
import type {AgentAdapter} from '../agent-types.js';
export class CodexAdapter implements AgentAdapter {
 readonly kind='codex' as const;
 constructor(private readonly capability?:CodexProbe,private readonly executable?:string){}
 private bin(env:NodeJS.ProcessEnv){if(env.CODEX_BIN?.trim()||this.executable)return env.CODEX_BIN?.trim()||this.executable!;
 if(process.platform==='win32'&&env.APPDATA){const arch=process.arch==='arm64'?'aarch64':'x86_64',pkg=process.arch==='arm64'?'arm64':'x64';const exe=join(env.APPDATA,'npm','node_modules','@openai','codex','node_modules','@openai',`codex-win32-${pkg}`,'vendor',`${arch}-pc-windows-msvc`,'bin','codex.exe');if(existsSync(exe))return exe;}return 'codex';}
 probe(env:NodeJS.ProcessEnv=process.env){return {kind:this.kind,...(this.capability??probeCodex(this.bin(env),env.CODEX_TRANSPORT as ExecutionTransport,env))};}
 start(prompt:string,workspace:string,requested:ExecutionTransport,env:NodeJS.ProcessEnv=process.env){return new CodexExecutor(this.capability??this.probe(env),this.bin(env),env).start({prompt,transportRequested:requested} as ExecutionCommand,workspace);}
}
