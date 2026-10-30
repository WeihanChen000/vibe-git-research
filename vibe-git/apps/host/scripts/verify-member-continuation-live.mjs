// Explicit, bounded live lifecycle probe. One account, synthetic team identities.
// Never counts as a real cross-account research result. No remote work on import.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../dist/app.js';
import { SciencePALClient, readSciencePALKey } from '../dist/sciencepal/client.js';
import { SciencePALMemberConnector } from '../dist/sciencepal/member-connector.js';

const action = process.argv[2];
if (!['init', 'tick', 'reply', 'export'].includes(action)) throw Error('Use init | tick | reply | export. init/reply spend real SciencePAL quota.');
const root = resolve('data/team-continuation-live');
await mkdir(root, { recursive: true });
const hostRemote = { configured: false, agents: async () => { throw Error('Host must not use a SciencePAL key'); } };
const app = await buildApp({ dbPath: resolve(root, 'host.db'), dataDir: resolve(root, 'members'), staticDir: false, backupDatabase: false, sciencepal: { remote: hostRemote, worker: false } });
try {
  const captain = JSON.parse(await readFile(resolve(root, 'members/captain.json'), 'utf8'));
  const request = async (path, body, method, token = captain.nodeToken) => {
    const r = await app.inject({ method: method ?? (body === undefined ? 'GET' : 'POST'), url: path, headers: { authorization: 'Bearer ' + token }, ...(body === undefined ? {} : { payload: body }) });
    if (r.statusCode >= 400) throw Error('Host ' + r.statusCode + ': ' + r.body);
    return r.json();
  };
  const pipeline = app.sciencepalPipeline;
  const statePath = resolve(root, 'probe.json');
  let state;
  if (action === 'init') {
    try { await readFile(statePath); throw Error('Probe already exists. Use tick; never create duplicate runs.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const agentId = '10000000-0000-0000-0000-000000000001';
    const remote = new SciencePALClient(readSciencePALKey());
    if (!(await remote.agents()).some(a => a.id === agentId)) throw Error('General Agent not available');
    const invite = JSON.parse(await readFile(resolve(root, 'members/invite.json'), 'utf8'));
    const member = app.v20Service.join(invite.inviteToken, 'http://localhost');
    const binding = { agent: { id: agentId, name: 'General (one-account probe)' } };
    await request('/api/sciencepal-team/binding', binding, 'PUT');
    await request('/api/sciencepal-team/binding', binding, 'PUT', member.nodeToken);
    const a = await request('/api/v1/plans', { filename: 'a.md', content: '# Synthetic lifecycle validation\nMy task data creates [1,2,3]; no research claims.' });
    const b = await request('/api/v1/plans', { filename: 'b.md', content: '# Synthetic lifecycle validation\nMy task analysis reads approved data and sums it; no research claims.' }, 'POST', member.nodeToken);
    let p = await request('/api/sciencepal-team/projects', { title: 'Live NEEDS_INPUT connector probe; not cross-account', coordinatorNodeId: captain.nodeId, documentIds: [a.id, b.id] });
    p = await request(`/api/sciencepal-team/projects/${p.id}/commands/align`, { revision: 1 });
    // Deliberate test fixture replaces the usual no-questions prompt BEFORE dispatch.
    p.runs[0].prompt = `This is an explicitly authorized connector lifecycle test, not a scientific finding. FIRST TURN: use the available user-question tool to ask exactly "Please provide the verification code for this continuation test." Stop and wait for user input. Do not create align-result.json yet. AFTER the user replies with VIBEGIT-CONTINUE-20261030: read the original context.json attachment bytes, compute its true SHA256 and size with Python, and create /workspace/align-result.json as UTF-8 JSON with {revision:1,inputReceipts:[{filename:"context.json",sha256:actual_hash,size:actual_size}],result:{alignmentMarkdown:"Synthetic continuation test; no research claims",issues:[],tasks:[{key:"data",title:"Data",goal:"Create [1,2,3]",boundary:"Synthetic only",acceptance:["Three values"],dependencies:[],assigneeAgentId:context.agents[0].id},{key:"analysis",title:"Analysis",goal:"Read data and sum",boundary:"Synthetic only",acceptance:["Sum is six"],dependencies:["data"],assigneeAgentId:context.agents[1].id}]}}. Substitute actual member binding IDs from context, do not hardcode runtimeAgentId. Use actual tools, no network or installation, no memory changes. Finish after the file exists. If code is absent, ask and wait. This test intentionally requires a real asked/NEEDS_INPUT state.`;
    app.v20Service.repo.db.prepare('UPDATE sciencepal_projects SET data=? WHERE id=?').run(JSON.stringify(p), p.id);
    state = { scope: 'single SciencePAL account; synthetic member identities; controlled lifecycle test', projectId: p.id, journal: { projectId: p.id, phase: 'IDLE' } };
    await writeFile(statePath, JSON.stringify(state, null, 2), { flag: 'wx' });
  } else state = JSON.parse(await readFile(statePath, 'utf8'));
  const connector = new SciencePALMemberConnector(new SciencePALClient(readSciencePALKey()), request, state.journal, async journal => {
    state.journal = journal; await writeFile(statePath, JSON.stringify(state, null, 2));
  });
  if (action === 'reply') console.log(await connector.reply('VIBEGIT-CONTINUE-20261030. Continue with the unchanged frozen input and requested alignment envelope.'));
  else if (action !== 'export') console.log(await connector.step());
  const p = pipeline.get(state.projectId), r = p.runs[0];
  if (action === 'export') {
    if (r.status !== 'COLLECTED' || r.continuations?.length !== 1 || r.continuations[0].source !== 'member-reply') throw Error('Actual continuation has not completed');
    const remote = new SciencePALClient(readSciencePALKey());
    const remoteObserved = { previous: await remote.run(r.continuations[0].previousRunId), current: await remote.run(r.runId) };
    const f = pipeline.file(p.id, r.output.id);
    await writeFile(resolve(root, 'align-result.json'), f.bytes);
    await writeFile(resolve(root, 'verification.json'), JSON.stringify({ scope: state.scope, projectId: p.id, phase: p.phase, run: r, remoteObserved, checks: { previousActuallyAsked: remoteObserved.previous === 'asked', newRunActuallyCompleted: remoteObserved.current === 'completed', originalThreadPreserved: r.threadId === r.continuations[0].threadId, newRunRecorded: r.runId !== r.continuations[0].previousRunId, actualFrozenOutput: f.sha256 === r.output.sha256, hostAcceptedEnvelope: p.phase === 'READY' } }, null, 2));
  }
  console.log(JSON.stringify({ scope: state.scope, projectId: p.id, phase: p.phase, status: r.status, threadId: r.threadId, runId: r.runId, continuations: r.continuations ?? [], journalPhase: state.journal.phase, followUpStage: state.journal.followUp?.stage }));
} finally { await app.close(); }
