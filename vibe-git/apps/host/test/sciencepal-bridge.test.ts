import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { SciencePALBridge } from "../src/sciencepal/bridge.js";
import { SciencePALError, type SciencePALRemote } from "../src/sciencepal/client.js";

class Remote implements SciencePALRemote {
  configured = true; starts = 0; messages: string[] = []; resumes = 0; uncertain = false; status = "completed"; wrongAgent = false; messageFail = false;
  async agents() { return [{ id: "a", name: "A" }]; }
  async start() { this.starts++; if (this.uncertain) throw new SciencePALError("uncertain", true); return { threadId: "thread", runId: `r${this.starts}` }; }
  async run() { return this.status; }
  async sandbox() { return { sandboxId: "sandbox", projectId: "project", agentId: this.wrongAgent ? "b" : "a" }; }
  async download(_id: string, filename: string) { return Buffer.from(JSON.stringify({ filename, realTestFixture: true })); }
  async addMessage(_t: string, id: string) { this.messages.push(id); if (this.messageFail) throw new SciencePALError("message lost", true); }
  async continueRun() { this.resumes++; if (this.uncertain) throw new SciencePALError("resume lost", true); return { runId: `continued-${this.resumes}` }; }
  async threadRuns() { return [{ id: "recovered", threadId: "thread", agentId: "a", startedAt: new Date().toISOString() }]; }
}
const dbs: DatabaseSync[] = []; afterEach(() => dbs.splice(0).forEach(db => db.close()));
const input = { requestId: "first", agentId: "a", prompt: "Read actual data", outputs: ["result.json"] };
function setup() { const db = new DatabaseSync(":memory:"); dbs.push(db); const remote = new Remote(), bridge = new SciencePALBridge(db, remote); return { db, remote, bridge }; }
describe("Codex SciencePAL unified entrypoint", () => {
  it("recovers a persisted READY task without replaying STARTING", async () => {
    const s = setup(), t = await s.bridge.submit(input);
    t.attempts[0]!.status = "READY"; t.attempts[0]!.runId = null; t.attempts[0]!.threadId = null;
    s.db.prepare("UPDATE sciencepal_bridge_tasks SET data=? WHERE id=?").run(JSON.stringify(t), t.id);
    await new SciencePALBridge(s.db, s.remote).submit(input); expect(s.remote.starts).toBe(2);
    const started = s.bridge.get(t.id); started.attempts[0]!.status = "STARTING";
    s.db.prepare("UPDATE sciencepal_bridge_tasks SET data=? WHERE id=?").run(JSON.stringify(started), t.id);
    await new SciencePALBridge(s.db, s.remote).submit(input); expect(s.remote.starts).toBe(2);
  });
  it("rejects Windows case collisions and generated rework names that overwrite inputs", async () => {
    const { bridge, remote } = setup();
    await expect(bridge.submit({ ...input, outputs: ["result.json", "RESULT.json"] })).rejects.toThrow("重复");
    const t = await bridge.submit(input, [{ filename: "result-r2.json", bytes: Buffer.from("input") }]);
    await bridge.collect(t.id);
    await expect(bridge.respond(t.id, { requestId: "fix", feedback: "Repair" })).rejects.toThrow("覆盖");
    expect(remote.messages).toHaveLength(0);
  });
  it("deduplicates by requestId and frozen bytes, rejects conflicting reuse", async () => {
    const { bridge, remote } = setup(), files = [{ filename: "input.txt", bytes: Buffer.from("original") }];
    const t = await bridge.submit(input, files); expect((await bridge.submit(input, files)).id).toBe(t.id); expect(remote.starts).toBe(1);
    await expect(bridge.submit(input, [{ ...files[0]!, bytes: Buffer.from("changed") }])).rejects.toThrow("不同内容");
  });
  it("does not auto-resubmit uncertain initiation after restart", async () => {
    const s = setup(); s.remote.uncertain = true; const t = await s.bridge.submit(input);
    const restarted = new SciencePALBridge(s.db, s.remote); await restarted.submit(input);
    expect(s.remote.starts).toBe(1); expect(restarted.get(t.id).attempts[0]!.status).toBe("UNKNOWN");
  });
  it("preserves immutable previous output and resumes the same thread using versioned filenames", async () => {
    const { bridge, remote } = setup(), t = await bridge.submit(input); const first = await bridge.collect(t.id);
    const old = first.attempts[0]!.artifacts[0]!;
    const second = await bridge.respond(t.id, { requestId: "fix", feedback: "Repair methodology" });
    expect(second.attempts[1]!.threadId).toBe("thread"); expect(second.attempts[1]!.outputs).toEqual(["result-r2.json"]);
    await bridge.respond(t.id, { requestId: "fix", feedback: "Repair methodology" });
    expect(remote.resumes).toBe(1); expect(remote.starts).toBe(1);
    await bridge.collect(t.id); expect(bridge.read(t.id, old.id).sha256).toBe(old.sha256);
  });
  it("retries only the same message ID after uncertain message delivery", async () => {
    const { bridge, remote } = setup(), t = await bridge.submit(input); await bridge.collect(t.id); remote.messageFail = true;
    await bridge.respond(t.id, { requestId: "fix", feedback: "Same content" }); expect(remote.resumes).toBe(0);
    remote.messageFail = false; await bridge.respond(t.id, { requestId: "fix", feedback: "Same content" });
    expect(remote.messages[0]).toBe(remote.messages[1]); expect(remote.resumes).toBe(1);
  });
  it("does not replay uncertain continuation and recovers a matching remote run", async () => {
    const s = setup(), t = await s.bridge.submit(input); await s.bridge.collect(t.id); s.remote.uncertain = true;
    await s.bridge.respond(t.id, { requestId: "fix", feedback: "Repair" });
    const restarted = new SciencePALBridge(s.db, s.remote); await restarted.respond(t.id, { requestId: "fix", feedback: "Repair" }); expect(s.remote.resumes).toBe(1);
    await expect(restarted.recover(t.id, "wrong", "recovered")).rejects.toThrow("原线程");
    expect((await restarted.recover(t.id, "thread", "recovered")).attempts[1]!.status).toBe("RUNNING");
  });
  it("refuses in-flight feedback, supports explicit reply when asked", async () => {
    const { bridge, remote } = setup(), t = await bridge.submit(input);
    await expect(bridge.respond(t.id, { requestId: "fix", feedback: "Repair" })).rejects.toThrow("先采集");
    remote.status = "asked"; await bridge.status(t.id);
    expect((await bridge.respond(t.id, { requestId: "fix", feedback: "Answer" })).attempts[1]!.status).toBe("RUNNING");
  });
  it.each(["../secret", "CON.json", "file.", "/tmp/x", "a/b"]) ("rejects unsafe output %s before submission", async filename => {
    const { bridge, remote } = setup(); await expect(bridge.submit({ ...input, outputs: [filename] })).rejects.toThrow(); expect(remote.starts).toBe(0);
  });
  it("checks identity and frozen-byte integrity, including after collection", async () => {
    const s = setup(), t = await s.bridge.submit(input); s.remote.wrongAgent = true;
    await expect(s.bridge.collect(t.id)).rejects.toThrow("身份"); s.remote.wrongAgent = false;
    const collected = await s.bridge.collect(t.id), f = collected.attempts[0]!.artifacts[0]!;
    s.db.prepare("UPDATE sciencepal_bridge_files SET bytes=? WHERE id=?").run(Buffer.from("corrupted"), f.id);
    await expect(s.bridge.collect(t.id)).rejects.toThrow("字节");
    expect(() => s.bridge.read("another-task", f.id)).toThrow("不属于");
  });
});
