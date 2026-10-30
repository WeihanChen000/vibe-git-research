import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { IRIS_CASE, IRIS_RESULT_SCHEMAS } from "@vibe-git/protocol";
const strict = process.argv.includes("--strict");
const manifest = `data/sciencepal/evidence/iris${strict ? "-strict" : ""}-project.json`;
const title = strict ? "公开科研数据复核 · Iris 冻结格式验证" : IRIS_CASE.title;
const base = "http://127.0.0.1:8788/api/sciencepal";
async function api(path, body) {
  const r = await fetch(base + path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-Vibe-SciencePAL": "1" }, body: JSON.stringify(body) });
  const data = await r.json(); if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`); return data;
}
const bytes = await readFile("fixtures/iris/bezdekIris.data"), sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== "0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc") throw new Error("Official pinned Iris bytes changed");
const ids = ["d3b9e520-3ae0-46d0-a2a9-d3df80f5c23d", "ba5dc9e9-a01c-4563-848f-5c2a082de793"];
let saved; try { saved = JSON.parse(await readFile(manifest, "utf8")); } catch (e) { if (e.code !== "ENOENT") throw e; }
const candidates = (await api("/projects")).filter(p => (saved ? p.id === saved.projectId : p.title === title) && p.source?.artifact.sha256 === sha256);
if (saved && !candidates.length) throw new Error("Saved research project missing; inspect before creating another");
if (candidates.length > 1) throw new Error("Multiple matching projects; inspect before proceeding");
let project = candidates[0];
if (!project) project = await api("/projects", { title, coordinatorId: ids[0], ...(strict ? { resultSchemas: IRIS_RESULT_SCHEMAS } : {}),
  proposals: IRIS_CASE.proposals.map((content, i) => ({ agentId: ids[i], content })),
  source: { filename: "source-iris.csv", base64: bytes.toString("base64"), sourceUrl: IRIS_CASE.sourceUrl, attribution: IRIS_CASE.attribution } });
if (strict && !project.resultContracts) throw new Error("Host did not freeze result contracts; rebuild and restart before proceeding");
await writeFile(manifest, JSON.stringify({ projectId: project.id, sha256, createdAt: project.createdAt }, null, 2));
if (project.phase === "DRAFT") project = await api(`/projects/${project.id}/commands/align`, { revision: project.revision });
console.log(JSON.stringify({ projectId: project.id, phase: project.phase, sourceSha256: sha256, sourceBytes: bytes.length, runs: project.runs.length }, null, 2));
