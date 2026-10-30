import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { IRIS_RESULT_SCHEMAS } from "@vibe-git/protocol";
const projectId = process.argv[2] || JSON.parse(await readFile("data/sciencepal/evidence/iris-project.json", "utf8")).projectId;
if (!/^[a-f0-9-]{36}$/.test(projectId)) throw Error("Expected project UUID");
const base = `http://127.0.0.1:8788/api/sciencepal/projects/${projectId}`;
async function get(path) { const r = await fetch(base + path); if (!r.ok) throw new Error(`Evidence HTTP ${r.status}`); return r; }
const evidence = await (await get("/evidence")).json();
const dir = `data/sciencepal/evidence/${projectId}`; await mkdir(dir, { recursive: true });
const raw = await readFile("fixtures/iris/bezdekIris.data");
const sourceHash = createHash("sha256").update(raw).digest("hex");
// This oracle parses the pinned source locally with Node, independently of remote Agent Python.
const rows = raw.toString("utf8").trim().split(/\r?\n/).filter(Boolean).map(line => { const parts = line.split(","); if (parts.length !== 5) throw Error("Unexpected source schema"); return [...parts.slice(0, 4).map(Number), parts[4]]; });
if (rows.length !== 150 || rows.some(row => row.slice(0, 4).some(v => !Number.isFinite(v)))) throw Error("Unexpected source records");
const species = [...new Set(rows.map(r => r[4]))];
const columns = ["sepal_length", "sepal_width", "petal_length", "petal_width"];
const oracle = species.map(s => { const group = rows.filter(r => r[4] === s); return { species: s, n: group.length,
  ...Object.fromEntries(columns.map((key, i) => [`${key}_mean`, group.reduce((n, r) => n + r[i], 0) / group.length])),
  petal_length_min: Math.min(...group.map(r => r[2])), petal_length_max: Math.max(...group.map(r => r[2])) }; });
const checks = [], check = (name, passed) => checks.push({ name, passed: !!passed });
check("source-pinned-official-bytes", sourceHash === "0fed2a99db77ec533a62dc66894d3ec6df3b58b6a8f3cf4a6b47e4086b7f97dc");
const downloaded = Buffer.from(await (await get(`/artifacts/${evidence.source.artifact.id}`)).arrayBuffer());
check("uploaded-source-byte-identical", downloaded.equals(raw));
check("all-current-tasks-approved", evidence.allApproved);
const audit = evidence.tasks.find(t => t.task.key === "data_audit"), summary = evidence.tasks.find(t => t.task.key === "species_summary");
if (!audit || !summary) throw new Error("Expected research tasks missing");
const attempts = audit.attempts.filter(a => a.execution.status === "COLLECTED");
check("has-real-data-attempt", attempts.length > 0);
const first = attempts[0], final = attempts.at(-1);
if (!first || !final || !summary.attempts.at(-1)?.result) throw new Error("Research pipeline has not completed yet");
const unitRejectionObserved = first.reviews.some(r => r.result?.verdict === "request_changes" && r.result.checks.some(c => !c.passed && /cm|measurement_unit/.test(c.criterion)));
const plannedFaultTest = evidence.resultContracts ? { status: "NOT_REQUESTED", note: "Strict format validation run; no deliberate unit fault requested." } : { requestedFirstUnit: "mm", observedFirstUnit: first.result.measurement_unit, unitRejectionObserved,
  status: first.result.measurement_unit === "mm" && unitRejectionObserved && attempts.length > 1 ? "REPRODUCED" : "NOT_REPRODUCED",
  note: "The real Agent produced cm on its first attempt. Do not claim a unit-error rejection or rework that did not occur. Previous separate sum-error test remains the rejection/rework evidence." };
check("approved-unit-cm", final.result.measurement_unit === "cm");
if (evidence.resultContracts) {
  const frozenContract = Buffer.from(await (await get(`/artifacts/${evidence.resultContracts.id}`)).arrayBuffer());
  check("frozen-contract-hash", createHash("sha256").update(frozenContract).digest("hex") === evidence.resultContracts.sha256);
  check("frozen-contract-matches-template", JSON.stringify(JSON.parse(frozenContract.toString("utf8"))) === JSON.stringify(IRIS_RESULT_SCHEMAS));
  check("strict-result-checks-passed", evidence.tasks.every(t => t.attempts.filter(a => a.execution.status === "COLLECTED").every(a => a.execution.resultValidation?.status === "PASSED" && a.execution.resultValidation.contractSha256 === evidence.resultContracts.sha256)));
  check("strict-row-types", final.result.rows.every(row => Array.isArray(row) && row.length === 5 && row.slice(0, 4).every(v => typeof v === "number")));
  check("strict-overlap-boolean", typeof summary.attempts.at(-1).result.versicolor_virginica_range_overlap === "boolean");
  check("strict-limitations-arrays", [final.result, summary.attempts.at(-1).result].every(r => Array.isArray(r.limitations) && r.limitations.length > 0 && r.limitations.every(v => typeof v === "string")));
}
check("review-approved-data", final.reviews.at(-1).result?.verdict === "approve");
for (const [i, attempt] of attempts.entries()) {
  const data = attempt.result;
  check(`audit-${i + 1}:source-hash`, data.source_sha256 === sourceHash);
  check(`audit-${i + 1}:not-synthetic`, data.synthetic === false);
  check(`audit-${i + 1}:150-records`, data.record_count === 150);
  // CSV DictReader commonly preserves numeric cells as strings. Compare their strict
  // numeric values and unchanged species/order, rather than requiring one JSON encoding.
  const numeric = v => typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
  const actualRows = data.rows?.map(row => Array.isArray(row) ? [...row.slice(0, 4).map(numeric), row[4]] : [...columns.map(key => numeric(row[key])), row.species]);
  check(`audit-${i + 1}:all-rows-preserved`, JSON.stringify(actualRows) === JSON.stringify(rows));
  check(`audit-${i + 1}:species-counts`, species.every(s => data.species_counts[s] === 50));
}
if (plannedFaultTest.status === "REPRODUCED") {
  const snapshots = await Promise.all(["before", "after"].map(s => readFile(`${dir}/iris-rejected-${s}.json`, "utf8").then(JSON.parse)));
  check("observed-rejection-gate-15s", Date.parse(snapshots[1].observedAt) - Date.parse(snapshots[0].observedAt) >= 15000);
  for (const [i, s] of snapshots.entries()) check(`rejection-snapshot-${i}:no-downstream`, s.project.phase === "CHANGES_REQUESTED" && s.project.tasks.find(t => t.key === "species_summary").attempt === 0 && !s.project.runs.some(r => r.kind === "TASK" && r.taskKey === "species_summary"));
}
const result = summary.attempts.at(-1).result;
check("summary-source-and-units", result.source_sha256 === sourceHash && result.measurement_unit === "cm" && result.synthetic === false && result.record_count === 150);
check("three-summary-rows", result.summary_rows?.length === 3 && new Set(result.summary_rows.map(r => r.species)).size === 3);
for (const expected of oracle) {
  const actual = result.summary_rows?.find(row => row.species === expected.species);
  check(`${expected.species}:n`, actual?.n === 50);
  for (const key of [...columns.map(c => `${c}_mean`), "petal_length_min", "petal_length_max"]) check(`${expected.species}:${key}`, typeof actual?.[key] === "number" && Math.abs(actual[key] - expected[key]) <= 1e-6);
}
check("mean-rank", JSON.stringify(result.petal_length_mean_order) === JSON.stringify([...oracle].sort((a, b) => a.petal_length_mean - b.petal_length_mean).map(r => r.species)));
const [v, g] = ["Iris-versicolor", "Iris-virginica"].map(s => oracle.find(r => r.species === s));
const overlapResult = result.versicolor_virginica_range_overlap;
const overlap = typeof overlapResult === "boolean" ? overlapResult : overlapResult?.overlap;
check("range-overlap", overlap === (Math.max(v.petal_length_min, g.petal_length_min) <= Math.min(v.petal_length_max, g.petal_length_max)));
if (overlapResult && typeof overlapResult === "object") {
  check("overlap-versicolor-range", JSON.stringify(overlapResult.versicolor_range) === JSON.stringify([v.petal_length_min, v.petal_length_max]));
  check("overlap-virginica-range", JSON.stringify(overlapResult.virginica_range) === JSON.stringify([g.petal_length_min, g.petal_length_max]));
}
check("summary-has-attribution", /10\.24432\/C56C76/.test(JSON.stringify(result.citation)) && /CC BY 4\.0/.test(JSON.stringify(result.citation)));
check("handoff-gates", evidence.handoffs.length > 0 && evidence.handoffs.every(h => h.checks.every(c => c.passed)));
const report = { projectId, checkedAt: new Date().toISOString(), sourceHash, oracle, numericalAndProvenancePassed: checks.every(c => c.passed), plannedFaultTest, checks,
  note: "Numerical and provenance oracle only. conclusion_zh and limitations also need human reading; no claim of new scientific discovery." };
await writeFile(`${dir}/iris-verification.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ projectId, numericalAndProvenancePassed: report.numericalAndProvenancePassed, plannedFaultTest, checks: checks.length, failed: checks.filter(c => !c.passed), oracle }, null, 2));
if (!report.numericalAndProvenancePassed) process.exitCode = 1;
