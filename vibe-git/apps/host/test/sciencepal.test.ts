import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "../src/db/database.js";
import { V20Repository } from "../src/v20/repository.js";
import { SciencePALService } from "../src/sciencepal/service.js";
import { MAX_ARTIFACT_BYTES, SciencePALClient, SciencePALError, type SciencePALRemote } from "../src/sciencepal/client.js";
import { buildApp } from "../src/app.js";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
class Remote implements SciencePALRemote {
  configured = true;
  input = Buffer.from('{"nonce":"private-random-value","note":"真实字节"}\n');
  calls: { agentId: string; prompt: string; file?: { filename: string; bytes: Uint8Array } }[] = [];
  status = "completed"; wrongAgent = false; badHash = false;
  async agents() { return [{ id: "agent-a", name: "Producer" }, { id: "agent-b", name: "Consumer" }]; }
  async start(agentId: string, prompt: string, file?: { filename: string; bytes: Uint8Array }) {
    this.calls.push({ agentId, prompt, ...(file ? { file } : {}) });
    return { threadId: `thread-${agentId}`, runId: `run-${agentId}` };
  }
  async run() { return this.status; }
  async sandbox(threadId: string) { return { sandboxId: `sandbox-${threadId}`, agentId: this.wrongAgent ? "impostor" : threadId.replace("thread-", "") }; }
  async download(_sandboxId: string, filename: string) {
    if (filename !== "receipt.json") return this.input;
    return Buffer.from(JSON.stringify({ input_filename: "data.json", input_sha256: this.badHash ? "incorrect" : sha(this.input), input_size_bytes: this.input.length, read_method: "python_file_bytes", result: { answer: 42 } }));
  }
}
const input = { title: "File handoff", producerAgentId: "agent-a", consumerAgentId: "agent-b", producerPrompt: "Generate data", consumerPrompt: "Review data", outputFilename: "data.json" };
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
function setup(remote = new Remote()) {
  const db = openDatabase(":memory:"); cleanup.push(() => db.close());
  const repo = new V20Repository(db); repo.putRoom({ id: "existing-vibe-room", createdAt: new Date().toISOString() });
  return { db, repo, remote, service: new SciencePALService(repo, remote) };
}
async function produce(service: SciencePALService, id: string) {
  await service.start(id, "producer"); await service.sync(id); await service.collect(id, "producer");
}
async function consume(service: SciencePALService, id: string) {
  await service.start(id, "consumer"); await service.sync(id); await service.collect(id, "consumer");
}
describe("SciencePAL collaboration", () => {
  it("distinguishes transient reads, authentication failures and uncertain mutations", async () => {
    const network = new SciencePALClient("secret", vi.fn().mockRejectedValue(new Error("network secret")) as typeof fetch);
    await expect(network.agents()).rejects.toMatchObject({ retryable: true, uncertain: false });
    await expect(network.continueRun("thread")).rejects.toMatchObject({ retryable: true, uncertain: true });
    const unauthorized = new SciencePALClient("secret", vi.fn().mockResolvedValue(new Response(null, { status: 401 })) as typeof fetch);
    await expect(unauthorized.agents()).rejects.toMatchObject({ retryable: false, uncertain: false });
    const throttled = new SciencePALClient("secret", vi.fn().mockResolvedValue(new Response(null, { status: 429 })) as typeof fetch);
    await expect(throttled.agents()).rejects.toMatchObject({ retryable: true, uncertain: false });
  });
  it("shares the original room and transfers frozen bytes, not a summary or leaked expected hash", async () => {
    const { service, remote } = setup(); const w = await service.create(input);
    expect(w.roomId).toBe("existing-vibe-room");
    await expect(service.start(w.id, "consumer")).rejects.toThrow("必须先采集");
    expect(remote.calls).toHaveLength(0);
    await produce(service, w.id); await consume(service, w.id);
    const b = remote.calls[1]!;
    expect(Buffer.from(b.file!.bytes)).toEqual(remote.input);
    expect(b.prompt).not.toContain(sha(remote.input)); expect(b.prompt).not.toContain("private-random-value");
    const done = await service.verify(w.id);
    expect(done.verification?.passed).toBe(true); expect(done.verification?.checks).toHaveLength(8);
    expect(service.artifact(w.id, done.tasks[0].artifact!.id).bytes).toEqual(new Uint8Array(remote.input));
  });
  it("prevents concurrent starts and duplicate clicks", async () => {
    const { service, remote } = setup(); const w = await service.create(input);
    const attempts = await Promise.allSettled([service.start(w.id, "producer"), service.start(w.id, "producer")]);
    expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    await expect(service.start(w.id, "producer")).rejects.toThrow("重复启动");
    expect(remote.calls).toHaveLength(1);
  });
  it("keeps unknown submissions blocked across restarts", async () => {
    const { service, remote, repo } = setup(); const w = await service.create(input);
    remote.start = vi.fn().mockRejectedValue(new SciencePALError("Unknown submission", true));
    expect((await service.start(w.id, "producer")).tasks[0].status).toBe("UNKNOWN");
    const restored = new SciencePALService(repo, remote);
    await expect(restored.start(w.id, "producer")).rejects.toThrow("重复启动");
    expect(remote.start).toHaveBeenCalledTimes(1);
    const pending = restored.get(w.id); pending.tasks[0].status = "STARTING";
    repo.db.prepare("UPDATE sciencepal_workflows SET data=? WHERE id=?").run(JSON.stringify(pending), w.id);
    expect(new SciencePALService(repo, remote).get(w.id).tasks[0].status).toBe("UNKNOWN");
  });
  it("resumes known runs after restart without submitting another run", async () => {
    const { service, remote, repo } = setup(); const w = await service.create(input);
    await service.start(w.id, "producer");
    const restored = new SciencePALService(repo, remote);
    expect((await restored.sync(w.id)).tasks[0].status).toBe("COMPLETED");
    await restored.collect(w.id, "producer"); expect(remote.calls).toHaveLength(1);
  });
  it("does not equate remote completed with collected output, and verifies identity", async () => {
    const { service, remote } = setup(); const w = await service.create(input);
    await service.start(w.id, "producer"); await service.sync(w.id);
    await expect(service.start(w.id, "consumer")).rejects.toThrow("必须先采集");
    remote.wrongAgent = true;
    await expect(service.collect(w.id, "producer")).rejects.toThrow("身份");
    expect(service.get(w.id).tasks[0].artifact).toBeNull();
  });
  it("fails verification when consumer hashes differ and preserves the evidence", async () => {
    const { service, remote } = setup(); const w = await service.create(input);
    await produce(service, w.id); remote.badHash = true; await consume(service, w.id);
    const result = await service.verify(w.id);
    expect(result.verification?.passed).toBe(false);
    expect(result.verification?.checks.find(c => c.name.includes("SHA-256"))?.passed).toBe(false);
    expect(result.tasks[1].artifact).not.toBeNull();
  });
  it("rejects same-agent workflows and unsafe filenames before execution", async () => {
    const { service, remote } = setup();
    await expect(service.create({ ...input, consumerAgentId: input.producerAgentId })).rejects.toThrow("不同");
    for (const filename of ["../secret", "/etc/passwd", "receipt.json", "x\r\n.json"]) {
      await expect(service.create({ ...input, outputFilename: filename })).rejects.toThrow();
    }
    expect(remote.calls).toHaveLength(0);
  });
  it("detects local artifact tampering before sending to B", async () => {
    const { service, db, remote } = setup(); const w = await service.create(input); await produce(service, w.id);
    db.prepare("UPDATE sciencepal_artifacts SET bytes=?").run(Buffer.from("tampered"));
    await expect(service.start(w.id, "consumer")).rejects.toThrow("校验失败");
    expect(remote.calls).toHaveLength(1);
  });
  it("retains waiting and auth errors without inventing completion", async () => {
    const { service, remote } = setup(); const w = await service.create(input); await service.start(w.id, "producer");
    remote.status = "asked"; expect((await service.sync(w.id)).tasks[0].status).toBe("NEEDS_INPUT");
    remote.run = vi.fn().mockRejectedValue(new SciencePALError("Key expired"));
    const failedSync = await service.sync(w.id);
    expect(failedSync.tasks[0].status).toBe("NEEDS_INPUT"); expect(failedSync.tasks[0].error).toBe("Key expired");
  });
});
describe("SciencePAL API adapter", () => {
  it("discovers usable built-in, owned and shared Agents through the official catalog", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json({ agents: [
      { agent_id: "bio", name: "Biology", source: "builtin", runtime_agent_type: "biology", tool_profile: "standard" },
      { agent_id: "owned", name: "Mine", source: "custom" },
      { agent_id: "shared", name: "Lab", source: "shared" },
    ] }));
    const agents = await new SciencePALClient("secret", transport as typeof fetch).agents();
    expect(transport.mock.calls[0]![0]).toBe("https://sciencepal.ai/api/agent-catalog?usable_only=true");
    expect(agents.map(a => a.id)).toEqual(["bio", "owned", "shared"]);
    expect(agents[0]).toMatchObject({ source: "builtin", runtimeAgentType: "biology", toolProfile: "standard" });
  });
  it("does not hide unsupported catalog access behind an owned-only fallback", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(new SciencePALClient("secret", transport as typeof fetch).agents()).rejects.toThrow("404");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("rejects duplicate catalog identities", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json({ agents: [{ agent_id: "same" }, { agent_id: "same" }] }));
    await expect(new SciencePALClient("secret", transport as typeof fetch).agents()).rejects.toThrow("重复");
  });
  it("adds an idempotent JSON message and explicitly continues the same thread", async () => {
    const transport = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ agent_run_id: "run-next" }));
    const client = new SciencePALClient("test-secret", transport as typeof fetch);
    await client.addMessage("thread-a", "message-stable", "Fix the units");
    expect(await client.continueRun("thread-a")).toEqual({ runId: "run-next" });
    const [messageUrl, message] = transport.mock.calls[0]!;
    expect(messageUrl).toBe("https://sciencepal.ai/api/thread/thread-a/messages");
    expect(message.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(message.body)).toEqual({ message_id: "message-stable", content: "Fix the units" });
    const [startUrl, start] = transport.mock.calls[1]!;
    expect(startUrl).toBe("https://sciencepal.ai/api/thread/thread-a/agent/start");
    expect(start.body).toBe("{}"); expect(start.method).toBe("POST");
  });
  it("uses multipart files and never retries an uncertain POST", async () => {
    const transport = vi.fn().mockRejectedValue(new Error("network timeout with secret"));
    const client = new SciencePALClient("test-secret", transport as typeof fetch);
    await expect(client.start("agent-a", "hello", { filename: "data.json", bytes: new Uint8Array([1, 2]) })).rejects.toMatchObject({ uncertain: true });
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, options] = transport.mock.calls[0]!;
    expect(url).toBe("https://sciencepal.ai/api/agent/initiate"); expect(options.redirect).toBe("error");
    expect(options.body.get("agent_select_type")).toBe("manual");
    expect(options.body.get("files").name).toBe("data.json");
  });
  it("redacts upstream errors and limits streamed downloads", async () => {
    const client = new SciencePALClient("secret", vi.fn().mockResolvedValue(new Response("secret VNC URL", { status: 401 })) as typeof fetch);
    await expect(client.agents()).rejects.toThrow("认证失败");
    const huge = new SciencePALClient("secret", vi.fn().mockResolvedValue(new Response(new Uint8Array(MAX_ARTIFACT_BYTES + 1))) as typeof fetch);
    await expect(huge.download("box", "data.json")).rejects.toThrow("超过");
  });
});
describe("local Host routes", () => {
  it("allows local UI, rejects remote/rebinding/CSRF requests and returns downloadable evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "vg-sp-test-"));
    cleanup.push(() => rm(root, { force: true, recursive: true }));
    const app = await buildApp({ dbPath: join(root, "test.db"), dataDir: join(root, "v20"), staticDir: false, backupDatabase: false, sciencepal: { remote: new Remote() } });
    cleanup.push(() => app.close());
    const state = await app.inject({ url: "/api/sciencepal/state" }); expect(state.statusCode).toBe(200);
    expect(state.json().configured).toBe(true); expect(state.body).not.toContain("apiKey");
    for (const headers of [{ host: "evil.example" }, { origin: "https://evil.example" }]) {
      expect((await app.inject({ url: "/api/sciencepal/state", headers })).statusCode).toBe(403);
    }
    expect((await app.inject({ url: "/api/sciencepal/state", remoteAddress: "10.0.0.2", headers: { "x-forwarded-for": "127.0.0.1" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/sciencepal/workflows", payload: input })).statusCode).toBe(403);
    const headers = { "x-vibe-sciencepal": "1" };
    const created = await app.inject({ method: "POST", url: "/api/sciencepal/workflows", payload: input, headers });
    expect(created.statusCode).toBe(200); const id = created.json().id;
    for (const path of ["producer/start", "sync", "producer/collect", "consumer/start", "sync", "consumer/collect", "verify"]) {
      const r = await app.inject({ method: "POST", url: `/api/sciencepal/workflows/${id}/${path}`, payload: {}, headers });
      expect(r.statusCode, r.body).toBe(200);
    }
    const w = (await app.inject({ url: "/api/sciencepal/state" })).json().workflows[0]; expect(w.verification.passed).toBe(true);
    const file = await app.inject({ url: `/api/sciencepal/workflows/${id}/artifacts/${w.tasks[0].artifact.id}` });
    expect(file.headers["content-disposition"]).toContain("attachment"); expect(file.headers["x-artifact-sha256"]).toBe(w.tasks[0].artifact.sha256);
    expect((await app.inject({ url: "/health" })).statusCode).toBe(200);
  });
});
