import { readFileSync } from "node:fs";
import type { SciencePALAgent } from "@vibe-git/protocol";

export const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;
export interface SciencePALInputFile { filename: string; bytes: Uint8Array }
const BASE = "https://sciencepal.ai/api";
export class SciencePALError extends Error {
  constructor(message: string, readonly uncertain = false, readonly retryable = false) { super(message); }
}
export interface SciencePALRemote {
  configured: boolean;
  agents(): Promise<SciencePALAgent[]>;
  start(agentId: string, prompt: string, file?: SciencePALInputFile, additionalFiles?: SciencePALInputFile[]): Promise<{ threadId: string; runId: string }>;
  run(runId: string): Promise<string>;
  threadRuns?(threadId: string): Promise<{ id: string; threadId: string; agentId: string; startedAt: string }[]>;
  sandbox(threadId: string): Promise<{ sandboxId: string; agentId: string; projectId?: string }>;
  download(sandboxId: string, filename: string): Promise<Uint8Array>;
  addMessage?(threadId: string, messageId: string, content: string): Promise<void>;
  continueRun?(threadId: string): Promise<{ runId: string }>;
}
export function readSciencePALKey(): string {
  if (process.env.SCIENCEPAL_API_KEY?.trim()) return process.env.SCIENCEPAL_API_KEY.trim();
  const filename = process.env.SCIENCEPAL_AUTH_FILE;
  if (!filename) return "";
  // Only a local operator can supply this path; it is never accepted from HTTP.
  const parsed = JSON.parse(readFileSync(filename, "utf8").replace(/^\uFEFF/, "")) as { apiKey?: string };
  if (!parsed.apiKey?.trim()) throw new Error("SCIENCEPAL_AUTH_FILE 缺少 apiKey");
  return parsed.apiKey.trim();
}
function remoteId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(value)) throw new SciencePALError("SciencePAL 返回了无效的远端标识", true);
  return value;
}
export class SciencePALClient implements SciencePALRemote {
  readonly configured: boolean;
  constructor(private readonly key: string, private readonly transport: typeof fetch = fetch) { this.configured = !!key; }
  private async request(path: string, body?: FormData | Record<string, unknown>): Promise<Response> {
    if (!this.key) throw new SciencePALError("尚未配置 SciencePAL API Key，请在 Host 环境变量中配置");
    let response: Response;
    try {
      response = await this.transport(BASE + path, {
        method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${this.key}`, ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}), redirect: "error", signal: AbortSignal.timeout(body ? 180_000 : 45_000),
      });
    } catch {
      throw new SciencePALError(body ? "提交结果未知，请到 SciencePAL 核对；系统不会自动重发" : "SciencePAL 网络请求失败，可稍后刷新", !!body, true);
    }
    if (!response.ok) {
      await response.body?.cancel();
      const reason = response.status === 401 || response.status === 403 ? "SciencePAL 认证失败或 Key 已过期" : `SciencePAL 返回 HTTP ${response.status}`;
      throw new SciencePALError(reason, !!body && response.status >= 500, response.status === 429 || response.status >= 500);
    }
    return response;
  }
  private async json(path: string): Promise<any> {
    const r = await this.request(path);
    try { return await r.json(); } catch { throw new SciencePALError("SciencePAL 返回格式无效"); }
  }
  async agents(): Promise<SciencePALAgent[]> {
    // Official SDK >= 0.2.3: /agents is owned-only, not the usable runtime catalog.
    // Do not silently fall back: doing so would hide built-in/shared research experts.
    const data = await this.json("/agent-catalog?usable_only=true");
    if (!Array.isArray(data.agents)) throw new SciencePALError("SciencePAL 可用 Agent 目录格式无效");
    const seen = new Set<string>();
    return data.agents.map((a: any) => {
      const id = remoteId(a.agent_id);
      if (seen.has(id)) throw new SciencePALError("SciencePAL 可用 Agent 目录包含重复身份");
      seen.add(id);
      return { id, name: String(a.name || id),
        ...(typeof a.source === "string" ? { source: a.source } : {}),
        ...(typeof a.runtime_agent_type === "string" ? { runtimeAgentType: a.runtime_agent_type } : {}),
        ...(typeof a.description === "string" ? { description: a.description } : {}),
        ...(typeof a.tool_profile === "string" ? { toolProfile: a.tool_profile } : {}) };
    });
  }
  async start(agentId: string, prompt: string, file?: SciencePALInputFile, additionalFiles: SciencePALInputFile[] = []) {
    const body = new FormData();
    for (const [k, v] of Object.entries({ agent_id: agentId, agent_select_type: "manual", prompt, stream: "true", web_search_on: "false" })) body.set(k, v);
    for (const item of [...(file ? [file] : []), ...additionalFiles]) body.append("files", new Blob([new Uint8Array(item.bytes)]), item.filename);
    const r = await this.request("/agent/initiate", body);
    try {
      const data = await r.json() as any;
      return { threadId: remoteId(data.thread_id), runId: remoteId(data.agent_run_id) };
    } catch { throw new SciencePALError("提交响应无法解析，请到 SciencePAL 核对；不会自动重发", true); }
  }
  async run(runId: string): Promise<string> {
    const data = await this.json(`/agent-run/${encodeURIComponent(runId)}`);
    if (typeof data.status !== "string") throw new SciencePALError("SciencePAL 运行状态格式无效");
    return data.status.toLowerCase();
  }
  async addMessage(threadId: string, messageId: string, content: string) {
    const response = await this.request(`/thread/${encodeURIComponent(threadId)}/messages`, { message_id: messageId, content });
    await response.body?.cancel();
  }
  async continueRun(threadId: string) {
    const response = await this.request(`/thread/${encodeURIComponent(threadId)}/agent/start`, {});
    try { const data = await response.json() as any; return { runId: remoteId(data.agent_run_id) }; }
    catch { throw new SciencePALError("续接响应未知；检查原线程，禁止自动重发", true); }
  }
  async threadRuns(threadId: string) {
    const data = await this.json(`/thread/${encodeURIComponent(threadId)}/agent-runs`);
    if (!Array.isArray(data.agent_runs)) throw new SciencePALError("SciencePAL 线程运行列表格式无效");
    return data.agent_runs.map((r: any) => ({ id: remoteId(r.id), threadId: remoteId(r.thread_id), agentId: remoteId(r.agent_id), startedAt: String(r.started_at || r.created_at || "") }));
  }
  async sandbox(threadId: string) {
    const id = encodeURIComponent(threadId);
    const [sandbox, identity] = await Promise.all([this.json(`/thread/${id}/sandbox`), this.json(`/thread/${id}/agent`)]);
    // sandbox_info can contain VNC credentials: never persist or return it.
    return { sandboxId: remoteId(sandbox.sandbox_id), projectId: remoteId(sandbox.project_id), agentId: remoteId(identity.agent?.agent_id) };
  }
  async download(sandboxId: string, filename: string): Promise<Uint8Array> {
    const r = await this.request(`/sandboxes/${encodeURIComponent(sandboxId)}/files/content?path=${encodeURIComponent(`/workspace/${filename}`)}`);
    if (Number(r.headers.get("content-length") || 0) > MAX_ARTIFACT_BYTES) { await r.body?.cancel(); throw new SciencePALError("成果文件超过 5 MiB"); }
    const reader = r.body?.getReader();
    if (!reader) throw new SciencePALError("成果文件响应为空");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_ARTIFACT_BYTES) { await reader.cancel(); throw new SciencePALError("成果文件超过 5 MiB"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks);
  }
}
