import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { SciencePALClient, SciencePALError, readSciencePALKey } from "./client.js";
import { SciencePALMemberConnector, type ConnectorJournal, type MemberRequest } from "./member-connector.js";
import {memberJournalPath} from './member-journal.js';
import { localMemberTask } from "./local-member.js";

let shutdownRequested=false;
if(process.send){process.on('message',message=>{if((message as {type?:string})?.type==='vibe-git:stop')shutdownRequested=true;});process.once('disconnect',()=>{shutdownRequested=true;});}
async function readJson(filename: string) { return JSON.parse((await readFile(filename, "utf8")).replace(/^\uFEFF/, "")); }

function validateHost(host: URL) {
  if (host.username || host.password || host.search || host.hash || host.pathname !== "/" || (host.protocol !== "https:" && !(host.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(host.hostname)))) throw new Error("Host 必须为 HTTPS 根地址或本机回环地址");
}
async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  if (command === "help") {
    console.log("统一团队入口：bind-codex | next PROJECT | take PROJECT NEW_DIRECTORY | submit PROJECT DIRECTORY RESULT.json\nCodex 使用本人原成员身份，不需要 SciencePAL Key；take 下载冻结输入及 TASK.md，submit 交回完整 envelope，进入同一项目独立评审。新任务/返工使用新目录。\n");
    console.log("SciencePAL 成员连接器\n环境：VIBE_GIT_MEMBER_FILE、VIBE_GIT_HOST（可取凭据中的 hostUrl）、SCIENCEPAL_AUTH_FILE\n命令：join | invite | panel | state | agents | doctor [PROJECT] | bind AGENT_ID | plan FILE.md | prepare OTHER_NODE TEMPLATE.json | create CONFIG.json | evidence PROJECT FILE.json | tunnel status|install|start | command PROJECT ACTION BODY.json | work PROJECT | reply PROJECT ANSWER.md | recover PROJECT THREAD\nagents 无需先加入 Host。doctor 只读，不启动 Agent；prepare 只输出项目配置，不发布。join 从 VIBE_GIT_JOIN_FILE 读取原项目加入链接，凭据文件必须不存在。work/recover 另设 VIBE_GIT_CONNECTOR_STATE（项目外日志文件）。仅 work 会循环领取指定项目任务。"); return;
  }
  const remote = new SciencePALClient(["agents", "bind", "work", "reply", "recover"].includes(command) ? readSciencePALKey() : "");
  if (command === "agents") {
    if (!remote.configured) throw new Error("请先配置本机 SCIENCEPAL_AUTH_FILE");
    console.log(JSON.stringify(await remote.agents(), null, 2)); return;
  }
  if (!process.env.VIBE_GIT_MEMBER_FILE) throw new Error("请设置 VIBE_GIT_MEMBER_FILE，指向原 Vibe-Git 成员凭据文件");
  if (command === "join") {
    if (!process.env.VIBE_GIT_JOIN_FILE) throw new Error("请将队长的加入链接保存在本机文件，通过 VIBE_GIT_JOIN_FILE 指定");
    const url = new URL((await readFile(process.env.VIBE_GIT_JOIN_FILE, "utf8")).trim());
    const match = url.pathname.match(/^\/join\/([^/]+)\/?$/);
    if (!match?.[1] || url.username || url.password || url.search || url.hash) throw new Error("加入链接无效");
    validateHost(new URL(url.origin));
    const credentialPath = resolve(process.env.VIBE_GIT_MEMBER_FILE);
    await mkdir(dirname(credentialPath), { recursive: true, mode: 0o700 });
    // Exclusive creation prevents replacing the original Vibe-Git member identity.
    const file = await open(credentialPath, "wx", 0o600).catch(() => { throw new Error("成员凭据已存在，不会覆盖；请复用该成员或指定新文件"); });
    try {
      const response = await fetch(`${url.origin}/api/v1/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite: decodeURIComponent(match[1]) }), redirect: "error", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`加入失败：HTTP ${response.status}`);
      const value = await response.json() as { roomId: string; node: { id: string; label: string }; nodeToken: string };
      await file.writeFile(JSON.stringify({ roomId: value.roomId, nodeId: value.node.id, nodeToken: value.nodeToken, hostUrl: url.origin }), "utf8");
      console.log(`已加入：${value.node.label}；凭据保存在指定本机文件`);
    } finally { await file.close(); }
    return;
  }
  const member = await readJson(process.env.VIBE_GIT_MEMBER_FILE);
  if (!member.nodeToken || !member.nodeId) throw new Error("成员凭据缺少 nodeId/nodeToken");
  const host = new URL(process.env.VIBE_GIT_HOST || member.hostUrl);
  validateHost(host);
  if(command==="journal-path"){if(!args[0]||!args[1])throw new Error("需要 PROJECT 和本人个人目录");console.log(await memberJournalPath(args[1],host.origin,member.nodeId,args[0]));return;}
  const request: MemberRequest = async (path, body, method) => {
    let response: Response;
    try { response = await fetch(new URL(path, host), { method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { Authorization: `Bearer ${member.nodeToken}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "error", signal: AbortSignal.timeout(30_000) }); }
    catch { throw new SciencePALError("Host 暂时无法连接；保留原日志，恢复连接后继续", false, true); }
    if (!response.ok) { const err = await response.json().catch(() => ({})) as { error?: string }; throw new SciencePALError(`Host HTTP ${response.status}: ${err.error || "请求失败"}`, false, response.status === 429 || response.status >= 500); }
    return response.json();
  };
  const state = await request("/api/sciencepal-team/state");
  if (state.viewer.id !== member.nodeId) throw new Error("Host 返回的成员身份不匹配");
  if (command === "state") { console.log(JSON.stringify(state, null, 2)); return; }
  if (command === "bind-codex") {
    console.log(JSON.stringify(await request("/api/sciencepal-team/binding", { agent: { id: "codex-local", name: "Codex 本地", platform: "codex" } }, "PUT"), null, 2)); return;
  }
  if (command === "next") {
    if (!args[0]) throw new Error("需要项目 ID");
    console.log(JSON.stringify(await request(`/api/sciencepal-team/projects/${encodeURIComponent(args[0])}/next`), null, 2)); return;
  }
  if (command === "take" || command === "submit") {
    if (!args[0] || !args[1]) throw new Error("需要 PROJECT DIRECTORY；submit 还需要 RESULT.json 路径");
    const result = await localMemberTask(command, request, { host: host.origin, nodeId: member.nodeId, projectId: args[0] }, args[1], args[2]);
    console.log(JSON.stringify(result, null, 2));
    if ("status" in result && result.status !== "COLLECTED") process.exitCode = 1;
    return;
  }
  if (command === "doctor") {
    const checks: { name: string; passed: boolean; detail: string }[] = [];
    checks.push({ name: "Host 与成员身份", passed: true, detail: `${state.viewer.label} (${state.viewer.role})` });
    const binding = state.members.find((m: any) => m.id === member.nodeId)?.binding;
    const frozenProject = args[0] ? await request(`/api/sciencepal-team/projects/${encodeURIComponent(args[0])}`) : undefined;
    const frozenMember = frozenProject?.team?.members.find((m: any) => m.nodeId === member.nodeId);
    if ((frozenMember?.agent ?? binding?.agent)?.platform === "codex") {
      if (args[0]) checks.push({ name: "本人参与冻结项目", passed: !!frozenMember, detail: frozenMember ? "本人拥有项目中的 Codex 绑定" : "本人不在冻结成员列表中" });
      checks.push({ name: "Codex 成员任务入口", passed: true, detail: "使用 next / take / submit；不需要 SciencePAL Key，尚未验证具体模型或本地科研工具" });
      const ready = checks.every(c => c.passed);
      console.log(JSON.stringify({ ready, checks, platform: "codex" }, null, 2)); if (!ready) process.exitCode = 1; return;
    }
    let available: Awaited<ReturnType<SciencePALClient["agents"]>> = [];
    try { available = await new SciencePALClient(readSciencePALKey()).agents(); checks.push({ name: "本人 SciencePAL 账号可访问目录", passed: true, detail: `${available.length} 个可用 Agent；不启动运行` }); }
    catch (e) { checks.push({ name: "本人 SciencePAL 账号可访问目录", passed: false, detail: e instanceof Error ? e.message : "连接失败" }); }
    checks.push({ name: "当前绑定可使用", passed: !!binding && available.some(a => a.id === binding.agent.id), detail: binding?.agent.name ?? "请运行 bind" });
    if (args[0]) {
      const p = await request(`/api/sciencepal-team/projects/${encodeURIComponent(args[0])}`);
      const frozen = p.team?.members.find((m: any) => m.nodeId === member.nodeId);
      checks.push({ name: "冻结项目中的本人专家仍可使用", passed: !!frozen && available.some(a => a.id === (frozen.agent.runtimeAgentId ?? frozen.agent.id)), detail: frozen?.agent.name ?? "本人未参与" });
      checks.push({ name: "连接器日志路径已配置", passed: !!process.env.VIBE_GIT_CONNECTOR_STATE, detail: "每个成员、Host 和项目使用独立日志；work 会核对其作用域与锁" });
    }
    const ready = checks.every(c => c.passed);
    console.log(JSON.stringify({ ready, checks, accountOwnership: "目录访问不能证明两个成员使用不同账号，需两位本人确认；未读取或上传账号身份/密钥" }, null, 2));
    if (!ready) process.exitCode = 1; return;
  }
  if (command === "tunnel") {
    if (state.viewer.role !== "captain" || !["localhost", "127.0.0.1", "[::1]"].includes(host.hostname)) throw new Error("隧道管理仅限队长在本机 Host 操作");
    if (!["status", "install", "start"].includes(args[0] ?? "")) throw new Error("需要 tunnel status|install|start");
    console.log(JSON.stringify(await request(`/api/v1/local/cloudflare${args[0] === "status" ? "" : `/${args[0]}`}`, args[0] === "status" ? undefined : {}), null, 2)); return;
  }
  if (command === "prepare") {
    if (state.viewer.role !== "captain" || !args[0] || !args[1] || args[0] === member.nodeId) throw new Error("队长运行 prepare 队友NODE_ID 模板.json");
    const members = [member.nodeId, args[0]].map(id => state.members.find((m: any) => m.id === id));
    if (members.some(m => !m?.plan || !m?.binding)) throw new Error("两位成员都需要先绑定专家并提交提案");
    const templatePath = resolve(args[1]), template = await readJson(templatePath);
    const source = template.sourceFile ? { filename: template.sourceFile.filename, sourceUrl: template.sourceFile.sourceUrl, attribution: template.sourceFile.attribution,
      base64: (await readFile(resolve(dirname(templatePath), template.sourceFile.path))).toString("base64") } : template.source;
    const prepared = JSON.stringify({ title: template.title, coordinatorNodeId: member.nodeId, documentIds: members.map(m => m.plan.id), ...(source ? { source } : {}), ...(template.resultSchemas ? { resultSchemas: template.resultSchemas } : {}) }, null, 2);
    if (args[2]) { await writeFile(resolve(args[2]), prepared, { flag: "wx" }); console.log("项目配置已保存；尚未创建或运行"); }
    else console.log(prepared);
    return;
  }
  if (command === "evidence") {
    if (!args[0] || !args[1]) throw new Error("需要 evidence 项目ID 新证据文件.json");
    const evidence = await request(`/api/sciencepal-team/projects/${encodeURIComponent(args[0])}/evidence`);
    await writeFile(resolve(args[1]), JSON.stringify(evidence, null, 2), { flag: "wx", mode: 0o600 });
    console.log("已导出证据；成员连接器记录不等同于双账号身份证明"); return;
  }
  if (command === "invite") { console.log(JSON.stringify(await request("/api/v1/invite"), null, 2)); return; }
  if (command === "panel") { const ticket = await request("/api/v1/browser-ticket", {}); console.log(`${ticket.url}?view=sciencepal-team`); return; }
  if (command === "plan") {
    if (!args[0]) throw new Error("缺少 Markdown 文件路径");
    const content = await readFile(args[0], "utf8"), filename = "sciencepal-proposal.md";
    const current = state.members.find((m: any) => m.id === member.nodeId)?.plan;
    const doc = current ? await request(`/api/v1/plans/${current.id}`, { filename, content, expectedRevision: current.revision }, "PUT") : await request("/api/v1/plans", { filename, content });
    console.log(JSON.stringify({ documentId: doc.id, revision: doc.revision, sha256: doc.sha256 })); return;
  }
  if (command === "create") { console.log(JSON.stringify(await request("/api/sciencepal-team/projects", await readJson(args[0]!)), null, 2)); return; }
  if (command === "command") {
    if (!args[0] || !args[1] || !args[2] || !/^[a-z-]+$/.test(args[1])) throw new Error("需要 PROJECT ACTION BODY.json");
    console.log(JSON.stringify(await request(`/api/sciencepal-team/projects/${encodeURIComponent(args[0])}/commands/${args[1]}`, await readJson(args[2])), null, 2)); return;
  }
  if (!remote.configured) throw new Error("请设置自己的 SCIENCEPAL_AUTH_FILE，密钥不得发给 Host 或队友");
  if (command === "bind") {
    const agent = (await remote.agents()).find(a => a.id === args[0]);
    if (!agent) throw new Error("本账号无法使用该 Agent");
    console.log(JSON.stringify(await request("/api/sciencepal-team/binding", { agent }, "PUT"))); return;
  }
  if (!["work", "reply", "recover"].includes(command) || !args[0]) throw new Error("未知命令，请运行 help");
  const project = await request(`/api/sciencepal-team/projects/${encodeURIComponent(args[0])}`);
  if (!project.team?.members.some((m: any) => m.nodeId === member.nodeId)) throw new Error("本人未参与该项目");
  if (project.team.members.find((m: any) => m.nodeId === member.nodeId)?.agent.platform === "codex") throw new Error("本项目的本人平台为 Codex，请使用 next / take / submit");
  if (!process.env.VIBE_GIT_CONNECTOR_STATE) throw new Error("请设置项目外的 VIBE_GIT_CONNECTOR_STATE 日志文件路径");
  const journalPath = resolve(process.env.VIBE_GIT_CONNECTOR_STATE), lockPath = journalPath + ".lock";
  await mkdir(dirname(journalPath), { recursive: true, mode: 0o700 });
  const lock = await open(lockPath, "wx", 0o600).catch(() => { throw new Error("该连接器日志已被锁定；请确认旧连接器已退出后再处理 .lock 文件"); });
  await lock.writeFile(String(process.pid));
  try {
    const scope = createHash("sha256").update(`${host.origin}\n${member.nodeId}\n${args[0]}`).digest("hex");
    let stored: { scope: string; journal: ConnectorJournal };
    try { stored = await readJson(journalPath); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; stored = { scope, journal: { projectId: args[0], phase: "IDLE" } }; }
    if (stored.scope !== scope) throw new Error("日志属于其他成员/Host/项目，请使用独立日志文件");
    const save = async (journal: ConnectorJournal) => {
      await writeFile(journalPath + ".tmp", JSON.stringify({ scope, journal }), { mode: 0o600 });
      await rename(journalPath + ".tmp", journalPath);
    };
    const connector = new SciencePALMemberConnector(remote, request, stored.journal, save);
    if (command === "recover") { if (!args[1]) throw new Error("需要核对后的 THREAD ID"); await connector.recover(args[1]); console.log("已恢复远端 ID，运行 work 继续采集"); return; }
    if (command === "reply") { if (!args[1]) throw new Error("需要本人答复文件 ANSWER.md"); console.log(await connector.reply(await readFile(args[1], "utf8"))); return; }
    let stopping = false, last = "", failures = 0, heartbeatBusy=false;
    let heartbeatStatus="ready";
    const instanceId=process.env.VIBE_GIT_CONNECTOR_INSTANCE||randomUUID();
    const heartbeat=async(status=heartbeatStatus)=>request("/api/sciencepal-team/heartbeat",{channel:"connector",projectId:args[0],instanceId,status});
    await heartbeat();
    const heartbeatTimer=setInterval(()=>{if(!heartbeatBusy){heartbeatBusy=true;void heartbeat().catch(()=>undefined).finally(()=>{heartbeatBusy=false;});}},5000);
    process.once("SIGINT", () => { stopping = true; }); process.once("SIGTERM", () => { stopping = true; });
    try { while (!stopping&&!shutdownRequested) {
      try { heartbeatStatus=connector.journal.phase==="IDLE"?"ready":"working";await heartbeat();if(shutdownRequested||stopping)break;const status = await connector.step(); failures = 0; if (status !== last) { console.log(status); last = status; } if (connector.journal.phase === "UNKNOWN") { heartbeatStatus="unknown";process.exitCode = 1; break; } }
      catch (error) {
        heartbeatStatus="error";
        if (error instanceof SciencePALError && error.retryable) {
          failures++; const notice = `暂时连接失败，按已保存阶段重试：${error.message}`;
          if (last !== notice) { console.error(notice); last = notice; }
        } else { console.error(error instanceof Error ? error.message : "连接失败"); process.exitCode = 1; break; }
      }
      if (!stopping&&!shutdownRequested) await new Promise(resolve => setTimeout(resolve, Math.min(30_000, 3000 * 2 ** Math.min(failures, 4))));
    } } finally {clearInterval(heartbeatTimer);await heartbeat(heartbeatStatus==="unknown"?"unknown":"stopped").catch(()=>undefined);}
  } finally { await lock.close(); await unlink(lockPath); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "连接器错误"); process.exitCode = 1; }).finally(()=>{if(process.connected)process.disconnect();});
