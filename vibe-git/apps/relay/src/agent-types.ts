import type { CapabilityState, ExecutionTransport } from "@vibe-git/protocol";

/**
 * 支持的 Agent 类型。
 * 每个 Agent 通过一个可执行 CLI 在成员本机运行,负责在 Git 工作区里写代码。
 * 新增 Agent 只需在 AGENT_REGISTRY 里注册一个适配器。
 */
export type AgentKind =
  | "codex"
  | "claude"
  | "cursor"
  | "gemini"
  | "opencode"
  | "deepseek"
  | "sciencepal";

export const AGENT_KINDS: readonly AgentKind[] = [
  "codex",
  "claude",
  "cursor",
  "gemini",
  "opencode",
  "deepseek",
  "sciencepal",
];

export function isAgentKind(value: string): value is AgentKind {
  return (AGENT_KINDS as readonly string[]).includes(value);
}

/** 单个 Agent 的能力探测结果。 */
export interface AgentProbe {
  kind: AgentKind;
  state: CapabilityState;
  detail: string;
  version: string | null;
  /** 该 Agent 支持的执行传输方式。 */
  transports: {
    /** 长驻服务(如 Codex App Server)。 */
    appServer: CapabilityState;
    /** 一次性 CLI 调用。 */
    cli: CapabilityState;
    preferred: ExecutionTransport;
  };
}

/** 一次真实执行的运行句柄,与具体 Agent 无关。 */
export interface ActiveRun {
  transport: "app-server" | "cli" | "cloud";
  remote?: {threadId:string;runId:string};
  runtimeId: string;
  done: Promise<ExecutionCompletion>;
  interrupt(): Promise<ExecutionCompletion>;
}

export interface ExecutionCompletion {
  status: "COMPLETED" | "FAILED" | "INTERRUPTED" | "NEEDS_INPUT";
  detail: string;
  outputSummary: string | null;
}

/** 每个 Agent 适配器必须实现的接口。 */
export interface AgentAdapter {
  readonly kind: AgentKind;
  /** 探测本机是否安装了该 Agent 的 CLI 并可用。 */
  probe(env?: NodeJS.ProcessEnv): AgentProbe;
  /** 在 workspace 里启动一次真实执行。 */
  start(
    prompt: string,
    workspace: string,
    requested: ExecutionTransport,
    env?: NodeJS.ProcessEnv,
    research?: ResearchExecution,
  ): Promise<ActiveRun>;
}

export interface ResearchExecution {agentId:string;files:{filename:string;bytes:Uint8Array}[]}
export interface SciencePALBackend {
 configured:boolean;
 start(agentId:string,prompt:string,file?:{filename:string;bytes:Uint8Array},files?:{filename:string;bytes:Uint8Array}[]):Promise<{threadId:string;runId:string}>;
 run(runId:string):Promise<string>;
}
