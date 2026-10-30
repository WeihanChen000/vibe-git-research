/** Offline acceptance simulation. Real Host/CLI/connectors; deterministic fake SciencePAL.
 * No API keys, no external requests, no claim of scientific or cross-account validation.
 * Run from vibe-git after npm run build.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { buildApp } from '../dist/app.js';
import { SciencePALMemberConnector } from '../dist/sciencepal/member-connector.js';
import { SciencePALBridge } from '../dist/sciencepal/bridge.js';

const hash = b => createHash('sha256').update(b).digest('hex');
const json = b => JSON.parse(Buffer.from(b).toString());
const root = await mkdtemp(join(tmpdir(), 'vibe-research-sim-'));
const mixed = process.argv.includes('--mixed');
const out = resolve(process.argv.slice(2).find(a => a !== '--mixed') || (mixed ? 'data/mixed-team-simulation' : 'data/usability-simulation'));
await mkdir(out, { recursive: true });
const report = { scope: 'OFFLINE SIMULATION: two local members, fake platform; not two real accounts', at: new Date().toISOString(), checkpoints: [], actions: [] };
report.mode = mixed ? 'ONE TEAM: Codex local CLI + simulated SciencePAL connector' : 'SciencePAL members and separate bridge';
const check = (name, value) => { assert.ok(value, name); report.checkpoints.push({ name, passed: true }); console.log(`PASS ${name}`); };
import {ResearchRemote,simulatedEnvelope} from './research-simulation-fixture.mjs';
const hostRemote = new ResearchRemote('host'); hostRemote.configured = false;
const app = await buildApp({ dbPath: ':memory:', dataDir: root, staticDir: false, backupDatabase: false, sciencepal: { remote: hostRemote, worker: false } });
try {
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  const captain = json(await readFile(join(root, 'captain.json'))), invite = json(await readFile(join(root, 'invite.json')));
  const joinFile = join(root, 'join.txt'), memberFile = join(root, 'member.json');
  await writeFile(joinFile, `${address}/join/${invite.inviteToken}`);
  const baseEnv = { ...process.env, SCIENCEPAL_API_KEY: '', SCIENCEPAL_AUTH_FILE: '', VIBE_GIT_HOST: address, VIBE_GIT_JOIN_FILE: joinFile };
  const cli = async (credential, ...args) => {
    report.actions.push({ actor: credential === memberFile ? 'member B' : 'captain A', command: args[0] });
    return (await promisify(execFile)(process.execPath, [resolve('apps/host/dist/sciencepal/member-main.js'), ...args], { env: { ...baseEnv, VIBE_GIT_MEMBER_FILE: credential } })).stdout;
  };
  await cli(memberFile, 'join');
  const member = json(await readFile(memberFile));
  const request = token => async (path, body, method) => {
    const response = await fetch(address + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    return response.json();
  };
  const a = request(captain.nodeToken), b = request(member.nodeToken);
  for (const [req, file, name] of [[a, join(root, 'captain.json'), 'A'], [b, memberFile, 'B']]) {
    if (mixed && name === 'A') await cli(file, 'bind-codex');
    else await req('/api/sciencepal-team/binding', { agent: (await hostRemote.agents())[0] }, 'PUT');
    const proposal = join(root, `${name}.md`); await writeFile(proposal, `# SIMULATION ${name}\nSynthetic [1,2,3], units a.u.; independent review.`); await cli(file, 'plan', proposal);
  }
  const state = json(await cli(memberFile, 'state'));
  check('Two distinct authenticated members with expected frozen platforms', state.members.length === 2 && captain.nodeId !== member.nodeId && (mixed ? state.members.find(m => m.id === captain.nodeId).binding.agent.platform === 'codex' : state.members.every(m => m.binding.agent.id === 'simulated-research-expert')));
  const configFile = join(root, 'project.json');
  await writeFile(configFile, JSON.stringify({ title: '测量数据复核与统计复现', coordinatorNodeId: captain.nodeId, documentIds: state.members.map(m => m.plan.id) }));
  const p = json(await cli(join(root, 'captain.json'), 'create', configFile)), pipeline = app.sciencepalPipeline;
  const command = (name, body = {}, req = a) => { report.actions.push({ actor: req === a ? 'captain A' : 'member B', command: name }); return req(`/api/sciencepal-team/projects/${p.id}/commands/${name}`, { revision: pipeline.get(p.id).revision, ...body }); };
  const remotes = [new ResearchRemote('A'), new ResearchRemote('B')];
  remotes[1].askReviewOnce = mixed;
  let connectors = remotes.map((r, i) => new SciencePALMemberConnector(r, [a, b][i], { phase: 'IDLE', projectId: p.id }, async value => writeFile(join(root, `journal-${i}.json`), JSON.stringify(value))));
  const nextSnapshots = [];
  const snapshot = async () => { const next = json(await cli(join(root, 'captain.json'), 'next', p.id)); nextSnapshots.push(next); return next; };
  if (mixed) {
    check('Codex doctor works without a SciencePAL key', json(await cli(join(root, 'captain.json'), 'doctor', p.id)).ready);
    check('Draft next action names the captain', (await snapshot()).actions[0].isMine);
    connectors[0] = { step: async () => {
      const current = pipeline.get(p.id), run = current.runs.find(r => r.ownerNodeId === captain.nodeId && r.revision === current.revision && r.status === 'READY');
      if (!run || current.paused || ['BLOCKED', 'CHANGES_REQUESTED', 'CHANGE_READY'].includes(current.phase)) return;
      const dir = join(root, `codex-${run.id}`);
      const task = json(await cli(join(root, 'captain.json'), 'take', p.id, dir));
      const retry = json(await cli(join(root, 'captain.json'), 'take', p.id, dir)); assert.equal(retry.runId, task.runId);
      const packet = json(await readFile(join(dir, 'task.json'))).packet;
      const files = await Promise.all(packet.files.map(async f => ({ filename: f.filename, bytes: await readFile(join(dir, 'inputs', f.filename)) })));
      // Deterministic local fixture computation, not an invocation of a Codex model.
      await writeFile(task.output, simulatedEnvelope(packet.run.kind, files));
      const submitted = json(await cli(join(root, 'captain.json'), 'submit', p.id, dir, task.output)); assert.equal(submitted.status, 'COLLECTED');
    } };
  }
  const until = async phase => { for (let n = 0; n < 60; n++) {
    if (pipeline.get(p.id).phase === phase) return pipeline.get(p.id);
    for (const c of connectors) await c.step();
    if (mixed && connectors[1].journal.remote && await remotes[1].run(connectors[1].journal.remote.runId) === 'asked') {
      const next = await snapshot(); check('Mixed project input prompt belongs to SciencePAL member B', next.actions.some(a => a.kind === 'input' && a.ownerNodeId === member.nodeId && !a.isMine));
      // Explicit scripted answer for this controlled fixture, never a production auto-answer.
      await connectors[1].reply('For this synthetic fixture, use the frozen a.u. acceptance criterion.');
    }
    await pipeline.tick();
  } throw new Error(`Did not reach ${phase}`); };
  await command('align'); await connectors[0].step();
  if (!mixed) {
    check('NEEDS_INPUT blocks instead of guessing', pipeline.get(p.id).runs[0].status === 'NEEDS_INPUT');
    await connectors[0].reply('This is synthetic data. Use a.u. and the frozen acceptance criteria.');
    connectors[0] = new SciencePALMemberConnector(remotes[0], a, json(await readFile(join(root, 'journal-0.json'))), async value => writeFile(join(root, 'journal-0.json'), JSON.stringify(value)));
  }
  let ready = await until('READY');
  if (!mixed) check('Saved connector resumes original thread after restart', ready.runs[0].continuations.length === 1);
  else check('Publish next action contains the actual alignment receipt', (await snapshot()).actions[0].body.alignmentRunId === ready.alignmentRunId);
  await assert.rejects(command('publish', { alignmentRunId: ready.alignmentRunId }, b), /403/);
  check('Member cannot publish for captain', true);
  await command('publish', { alignmentRunId: ready.alignmentRunId });
  const rejected = await until('CHANGES_REQUESTED');
  if (mixed) {
    check('Rework next action identifies actual missing unit', (await snapshot()).actions[0].detail.includes('a.u.'));
    await writeFile(join(out, 'ui-state.json'), JSON.stringify(await a('/api/sciencepal-team/state'), null, 2));
    await writeFile(join(out, 'preview-evidence-repair.json'), JSON.stringify(pipeline.evidence(p.id, 1), null, 2));
  }
  check('Actual missing unit rejected and downstream held', rejected.tasks.find(t => t.key === 'analysis').executionId === null);
  await command('rework', { taskKey: 'data', note: 'Declare a.u. in the actual output, keep the previous version.' });
  const completed = await until('COMPLETED');
  check('Rework creates second attempt with independent approval', completed.runs.filter(r => r.kind === 'TASK' && r.taskKey === 'data').length === 2);
  await command('change', { request: 'Change endpoint to sample variance with n-1 denominator.' }, b);
  const reviewed = await until('CHANGE_READY'); await command('apply-change', { changeId: reviewed.changes[0].id });
  ready = await until('READY'); await command('publish', { alignmentRunId: ready.alignmentRunId });
  const done = await until('COMPLETED');
  const r1 = pipeline.evidence(p.id, 1), r2 = pipeline.evidence(p.id, 2);
  if (mixed) {
    await writeFile(join(out, 'ui-state-completed.json'), JSON.stringify(await a('/api/sciencepal-team/state'), null, 2));
    await writeFile(join(out, 'preview-evidence-completed.json'), JSON.stringify({1:r1,2:r2}, null, 2));
    const ids = new Set(done.runs.flatMap(r => [...r.inputs.map(i=>i.artifactId), ...(r.output?[r.output.id]:[])]));
    const artifacts = Object.fromEntries([...ids].map(id=>{const f=pipeline.file(p.id,id);return [id,{filename:f.filename,sha256:f.sha256,base64:Buffer.from(f.bytes).toString('base64')}];}));
    await writeFile(join(out, 'preview-artifacts.json'), JSON.stringify(artifacts));
  }
  check('Both revisions approved with immutable byte handoff', [r1, r2].every(e => e.allApproved && e.handoffs.every(h => h.checks.every(c => c.passed))));
  const analysis = r2.tasks.find(t => t.task.key === 'analysis');
  check('R2 actually recomputed sample variance = 1', analysis.attempts.at(-1).result.value === 1);
  check('Execution/review owners differ', done.tasks.every(t => done.runs.find(r => r.id === t.executionId).ownerNodeId !== done.runs.find(r => r.id === t.reviewId).ownerNodeId));
  check('Host never executes with a member key', hostRemote.calls.length === 0);
  if (mixed) {
    check('Codex records are local and never fabricated remote threads', done.runs.filter(r => r.agent.platform === 'codex').every(r => r.localExecution && !r.runId && !r.threadId && !r.sandboxId));
    check('Both directions use cross-platform reviews in one project', done.tasks.every(t => done.runs.find(r => r.id === t.executionId).agent.platform !== done.runs.find(r => r.id === t.reviewId).agent.platform));
    check('Completion next action requests evidence instead of waiting forever', (await snapshot()).actions[0].kind === 'completed');
    await writeFile(join(out, 'next-action-snapshots.json'), JSON.stringify(nextSnapshots, null, 2));
  }
  await cli(join(root, 'captain.json'), 'evidence', p.id, join(out, `team-r2-${p.id}.json`));
  await writeFile(join(out, `team-r1-${p.id}.json`), JSON.stringify(r1, null, 2));
  report.team = { projectId: p.id, runs: done.runs.length, continuations: done.runs.reduce((n, r) => n + (r.continuations?.length || 0), 0), revision: done.revision, phase: done.phase };
} finally { await app.close(); }

// Model Codex as the caller: actual bridge, frozen files and CLI export; fake remote.
const bridgeRoot = join(root, 'bridge'); await mkdir(bridgeRoot);
let rounds = 1;
const bridgeRemote = {
  configured: true, agents: async () => [{ id: 'simulated-research-expert', name: 'SIMULATED expert' }],
  start: async () => ({ threadId: 'bridge-thread', runId: 'bridge-1' }), run: async () => 'completed',
  sandbox: async () => ({ sandboxId: 'bridge-sandbox', agentId: 'simulated-research-expert' }),
  download: async () => Buffer.from(JSON.stringify({ synthetic: true, values: [1, 2, 3], mean: rounds === 1 ? 3 : 2 })),
  addMessage: async () => {}, continueRun: async () => ({ runId: `bridge-${++rounds}` }),
};
const db = new DatabaseSync(join(bridgeRoot, 'workspace.db'));
let task;
try {
  const bridge = new SciencePALBridge(db, bridgeRemote);
  task = await bridge.submit({ requestId: 'codex-sim-v1', agentId: 'simulated-research-expert', prompt: 'Compute mean from synthetic [1,2,3].', outputs: ['result.json'] }, [{ filename: 'input.json', bytes: Buffer.from('[1,2,3]') }]);
  const first = await bridge.collect(task.id), old = first.attempts[0].artifacts[0];
  const result = json(bridge.read(task.id, old.id).bytes), recomputed = result.values.reduce((a, b) => a + b, 0) / result.values.length;
  check('Codex-side local recomputation detects wrong mean', result.mean !== recomputed);
  await bridge.respond(task.id, { requestId: 'codex-sim-fix', feedback: `Independent recomputation gives ${recomputed}. Fix the mean and return result-r2.json.` });
  const second = await bridge.collect(task.id);
  check('Bridge rework preserves thread and old bytes', second.attempts[1].threadId === first.attempts[0].threadId && hash(bridge.read(task.id, old.id).bytes) === old.sha256);
  check('Codex-side re-review accepts repaired result', json(bridge.read(task.id, second.attempts[1].artifacts[0].id).bytes).mean === recomputed);
} finally { db.close(); }
const exported = json((await promisify(execFile)(process.execPath, [resolve('apps/host/dist/sciencepal/bridge-main.js'), 'collect', task.id], { env: { ...process.env, SCIENCEPAL_API_KEY: '', SCIENCEPAL_AUTH_FILE: '', VIBE_GIT_DATA_DIR: bridgeRoot } })).stdout);
check('Actual Codex-facing CLI exports a readable versioned file', hash(await readFile(exported.files[0].path)) === exported.files[0].sha256);
report.bridge = { taskId: task.id, attempts: exported.task.attempts.length, status: exported.task.attempts.at(-1).status, exportedFilename: exported.files[0].filename };
report.limitations = ['No real SciencePAL account/API or model-quality evaluation', 'No real second computer, tunnel, browser usability session or participant study', 'Bridge and team tests are separate: no automatic bridge-to-team enrollment exists'];
if (mixed) report.limitations[2] = 'Mixed team verified via actual local take/submit CLI and simulated SciencePAL; no automatic Codex model daemon, no arbitrary bridge-result import';
await writeFile(join(out, 'simulation-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: join(out, 'simulation-report.json'), passed: report.checkpoints.length, team: report.team, bridge: report.bridge }, null, 2));
