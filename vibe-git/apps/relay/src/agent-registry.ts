import {SciencePALAdapter} from './adapters/sciencepal.js';
import type { SciencePALBackend, AgentAdapter, AgentKind, AgentProbe } from "./agent-types.js";
import { CodexAdapter } from "./adapters/codex.js";
import { ClaudeAdapter } from "./adapters/claude.js";
import { CursorAdapter } from "./adapters/cursor.js";
import { GeminiAdapter } from "./adapters/gemini.js";
import { OpenCodeAdapter } from "./adapters/opencode.js";
import { DeepSeekAdapter } from "./adapters/deepseek.js";

/**
 * Agent 注册表。
 * 新增 Agent 时:实现一个 AgentAdapter,然后在这里注册即可。
 * 通过环境变量 VIBE_AGENT 选择当前成员使用的 Agent(默认 codex)。
 */
export class AgentRegistry {
  private readonly adapters = new Map<AgentKind, AgentAdapter>();

  constructor(options:{sciencepal?:SciencePALBackend}={}) {
    this.register(new SciencePALAdapter(options.sciencepal));
    this.register(new CodexAdapter());
    this.register(new ClaudeAdapter());
    this.register(new CursorAdapter());
    this.register(new GeminiAdapter());
    this.register(new OpenCodeAdapter());
    this.register(new DeepSeekAdapter());
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  get(kind: AgentKind): AgentAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) throw new Error(`未注册的 Agent:${kind}`);
    return adapter;
  }

  /** 探测所有已注册 Agent 的能力。 */
  probeAll(env: NodeJS.ProcessEnv = process.env): Record<AgentKind, AgentProbe> {
    const result = {} as Record<AgentKind, AgentProbe>;
    for (const [kind, adapter] of this.adapters) {
      result[kind] = adapter.probe(env);
    }
    return result;
  }

  /** 解析当前成员应使用的 Agent。 */
  resolve(env: NodeJS.ProcessEnv = process.env): AgentAdapter {
    const raw = env.VIBE_AGENT?.trim() || "codex";
    const kind = raw as AgentKind;
    if (!this.adapters.has(kind)) {
      throw new Error(`VIBE_AGENT 必须是 ${[...this.adapters.keys()].join(", ")} 之一,当前为 "${raw}"`);
    }
    return this.get(kind);
  }
}
