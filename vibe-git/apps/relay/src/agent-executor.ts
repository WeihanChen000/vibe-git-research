import { resolve } from "node:path";
import type { ExecutionCommand } from "@vibe-git/protocol";
import type { ResearchExecution, ActiveRun, AgentAdapter, AgentKind, AgentProbe, ExecutionCompletion } from "./agent-types.js";
import { AgentRegistry } from "./agent-registry.js";

/**
 * 通用 Agent 执行器。
 * 取代原先硬编码的 CodexExecutor:根据 VIBE_AGENT 选择适配器,
 * 把 ExecutionCommand 转成一次真实执行,并返回统一的 ActiveRun。
 *
 * 向后兼容:默认 VIBE_AGENT=codex,行为与旧 CodexExecutor 完全一致。
 */
export class AgentExecutor {
  private readonly registry: AgentRegistry;
  private readonly adapter: AgentAdapter;
  readonly kind: AgentKind;
  readonly probe: AgentProbe;

  constructor(registry = new AgentRegistry(), private readonly env: NodeJS.ProcessEnv = process.env) {
    this.registry = registry;
    this.adapter = registry.resolve(env);
    this.kind = this.adapter.kind;
    this.probe = this.adapter.probe(env);
  }

  /** 当前成员使用的 Agent 能力探测结果。 */
  capability(): AgentProbe {
    return this.probe;
  }

  /** 所有已注册 Agent 的能力(用于上报给 Host 展示)。 */
  probeAll(env: NodeJS.ProcessEnv = process.env): Record<AgentKind, AgentProbe> {
    return this.registry.probeAll(env);
  }

  async start(command: ExecutionCommand, workspaceRaw: string, research?: ResearchExecution): Promise<ActiveRun> {
    if (!command.prompt) throw new Error("开工命令缺少任务提示");
    const workspace = resolve(workspaceRaw);
    return this.adapter.start(command.prompt, workspace, command.transportRequested, this.env, research);
  }
}

export type { ActiveRun, ExecutionCompletion, AgentKind, AgentProbe };
