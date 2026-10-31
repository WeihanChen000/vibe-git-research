import { isLocalResearchPlatform, researchPlatformName } from "@vibe-git/protocol";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { projectNextActions, type CollaborationNode, type SPAgentBinding, type SPCreateProject, type SPProject, type SPTeam } from "@vibe-git/protocol";
import { badRequest, forbidden, revisionConflict } from "../domain/errors.js";
import type { V20Service } from "../v20/service.js";
import type { SciencePALPipeline } from "./pipeline.js";
import { object, string } from "./pipeline-contract.js";
import { browserCommandGuard, browserCommands, commandSnapshot } from "./browser-commands.js";
import { memberPresence, recordPresence } from "./presence.js";

/** Original Vibe-Git identity and proposal storage; no SciencePAL credentials accepted here. */
export async function registerSciencePALTeamRoutes(app: FastifyInstance, service: V20Service, pipeline: SciencePALPipeline) {
  const repo = service.repo;
  const browser = browserCommandGuard();
  const auth = (r: FastifyRequest): CollaborationNode => {
    if (r.headers.authorization) return service.authenticateBearer(r.headers.authorization);
    if (r.method === "GET") return service.authenticateSession(r.headers.cookie);
    throw forbidden("请通过自己电脑上的成员连接器操作");
  };
  const captain = (n: CollaborationNode) => { if (n.role !== "captain") throw forbidden("该操作仅限队长"); };
  const access = (n: CollaborationNode, p: SPProject) => {
    if (!p.team || (p.team.captainNodeId !== n.id && !p.team.members.some(m => m.nodeId === n.id))) throw forbidden("你不是此项目的参与成员");
    return p;
  };
  const binding = (id: string): { agent: SPAgentBinding; updatedAt: string } | null => {
    const data = repo.getMeta(`sciencepal_binding_${id}`); return data ? JSON.parse(data) : null;
  };
  await app.register(async api => {
    api.addHook("onRequest", async (_r, reply) => { reply.header("Cache-Control", "no-store"); });
    api.get("/state", async r => {
      const viewer = auth(r);
      const members = repo.listNodes().filter(n => !n.revoked).map(n => {
        const plan = repo.latestDocument(n.id, "plan", null);
        return { id: n.id, label: n.label, role: n.role, presence:memberPresence(repo,n.id,""), binding: binding(n.id), plan: repo.getMeta(`v20_plan_withdrawn_${n.id}`) ? null : plan ?? null };
      });
      const projects = pipeline.list().filter(p => p.team && (p.team.captainNodeId === viewer.id || p.team.members.some(m => m.nodeId === viewer.id)));
      return { viewer: { id: viewer.id, label: viewer.label, role: viewer.role }, members, projects,
        serverTime:new Date().toISOString(),presence:Object.fromEntries(projects.map(p=>[p.id,Object.fromEntries(p.team!.members.map(m=>[m.nodeId,memberPresence(repo,m.nodeId,p.id)]))])),
        commandSnapshots:Object.fromEntries(projects.map(p=>[p.id,commandSnapshot(p)])),
        ...(!r.headers.authorization ? { browserCommands: true, csrfToken: browser.token(r) } : {}) };
    });
    api.post<{Body:Record<string,unknown>}>("/heartbeat",async r=>{
      const n=auth(r),body=object(r.body),id=typeof body.projectId==="string"?body.projectId:"";
      if(body.channel==="connector"){
        const p=access(n,pipeline.get(id));
        if(isLocalResearchPlatform(p.team!.members.find(m=>m.nodeId===n.id)?.agent.platform))throw forbidden("Codex 本机入口不能冒充 SciencePAL 连接器");
      }
      recordPresence(repo,n.id,id,body);return {ok:true};
    });
    api.put<{ Body: { agent: SPAgentBinding } }>("/binding", async r => {
      const node = auth(r), agent = object(r.body?.agent);
      const id = string(agent.id, "Agent ID", 120), name = string(agent.name, "Agent 名称", 120);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw badRequest("无效 Agent ID");
      if (agent.platform !== undefined && !(agent.platform === "sciencepal" || isLocalResearchPlatform(agent.platform))) throw badRequest("不支持的执行平台");
      if (isLocalResearchPlatform(agent.platform) && id !== `${agent.platform}-local`) throw badRequest("本地平台必须使用对应的 platform-local 绑定");
      const value = { agent: { id, name, ...(agent.platform ? { platform: agent.platform } : {}) }, updatedAt: new Date().toISOString() };
      repo.setMeta(`sciencepal_binding_${node.id}`, JSON.stringify(value));
      return { ...value, nodeId: node.id, verification: "member-connector" };
    });
    api.post<{ Body: { governanceVersion?:1; title: string; coordinatorNodeId: string; documentIds: string[]; scientificChecks?: SPCreateProject["scientificChecks"]; source?: SPCreateProject["source"]; resultSchemas?: SPCreateProject["resultSchemas"] } }>("/projects", async r => {
      const node = auth(r); captain(node);
      const data = r.body;
      if (!Array.isArray(data?.documentIds) || data.documentIds.length < 2 || data.documentIds.length > 4) throw badRequest("选择 2–4 位成员的当前提案");
      const members: SPTeam["members"] = [], proposals: SPCreateProject["proposals"] = [];
      for (const id of data.documentIds) {
        const doc = repo.getDocument(string(id, "提案 ID", 120));
        const owner = doc ? repo.getNode(doc.ownerNodeId) : undefined;
        if (!doc || doc.kind !== "plan" || !owner || owner.revoked || repo.latestDocument(owner.id, "plan", null)?.id !== doc.id || repo.getMeta(`v20_plan_withdrawn_${owner.id}`)) throw revisionConflict("提案不存在、已更新或已撤回，请刷新成员列表");
        const registered = binding(owner.id);
        if (!registered) throw badRequest("成员尚未通过自己的连接器绑定 Agent");
        // Built-in ids can be shared across accounts. Ownership follows the member.
        const agent = { ...registered.agent, id: `member_${owner.id}`, runtimeAgentId: registered.agent.id, name: `${owner.label} · ${registered.agent.name}` };
        members.push({ nodeId: owner.id, label: owner.label, agent, documentId: doc.id, documentRevision: doc.revision });
        proposals.push({ agentId: agent.id, content: doc.content });
      }
      if (new Set(members.map(m => m.nodeId)).size !== members.length) throw badRequest("必须选择不同成员");
      const coordinator = members.find(m => m.nodeId === data.coordinatorNodeId);
      if (!coordinator) throw badRequest("对齐负责人必须参与项目");
      if(data.governanceVersion!==undefined&&data.governanceVersion!==1)throw badRequest("不支持的科研治理版本");
      return pipeline.create({ ...(data.governanceVersion===1?{governanceVersion:1 as const}:{}), title: data.title, coordinatorId: coordinator.agent.id, proposals, ...(data.scientificChecks ? {scientificChecks:data.scientificChecks} : {}), ...(data.source ? { source: data.source } : {}), ...(data.resultSchemas ? { resultSchemas: data.resultSchemas } : {}) }, { captainNodeId: node.id, members });
    });
    api.get<{ Params: { id: string } }>("/projects/:id", async r => access(auth(r), pipeline.get(r.params.id)));
    api.get<{ Params: { id: string } }>("/projects/:id/next", async r => {
      const node = auth(r); return projectNextActions(access(node, pipeline.get(r.params.id)), node.id);
    });
    api.post<{ Params: { id: string; action: string }; Body: Record<string, unknown> }>("/projects/:id/commands/:action", async r => {
      const isBrowser = !r.headers.authorization;
      if (isBrowser) {
        browser.verify(r);
        if (!browserCommands.has(r.params.action)) throw forbidden("此操作必须由本人连接器完成");
        if (typeof r.body?.expectedState !== "string") throw badRequest("缺少待确认的项目快照，请刷新页面");
      }
      const node = isBrowser ? service.authenticateSession(r.headers.cookie) : auth(r), p = access(node, pipeline.get(r.params.id));
      if (r.params.action !== "change") { captain(node); if (p.team!.captainNodeId !== node.id) throw forbidden("只有此项目的队长可操作"); }
      if (r.params.action === "recover") throw badRequest("成员运行必须由原连接器使用已保存的远端 ID 恢复");
      if (r.params.action === "align" && p.team!.members.some(m => repo.getNode(m.nodeId)?.revoked)) throw forbidden("参与成员已撤销，请重新建立项目");
      return pipeline.command(p.id, r.params.action, r.body, node.id);
    });
    api.get<{ Params: { id: string }; Querystring: { revision?: string } }>("/projects/:id/evidence", async r => {
      access(auth(r), pipeline.get(r.params.id)); return pipeline.evidence(r.params.id, r.query.revision === undefined ? undefined : Number(r.query.revision));
    });
    api.get<{ Params: { id: string; artifactId: string } }>("/projects/:id/artifacts/:artifactId", async (r, reply) => {
      access(auth(r), pipeline.get(r.params.id)); const f = pipeline.file(r.params.id, r.params.artifactId);
      reply.header("Content-Disposition", `attachment; filename="${f.filename}"`).header("X-Content-Type-Options", "nosniff").header("X-Artifact-SHA256", f.sha256);
      return reply.type("application/octet-stream").send(Buffer.from(f.bytes));
    });
    api.get("/jobs", async r => {
      const node = auth(r);
      return pipeline.list().filter(p => p.team?.members.some(m => m.nodeId === node.id)).flatMap(p => p.runs
        .filter(run => run.ownerNodeId === node.id && run.revision === p.revision && ["READY", "STARTING", "RUNNING", "NEEDS_INPUT", "UNKNOWN"].includes(run.status))
        .map(run => ({ projectId: p.id, paused: p.paused, phase: p.phase, run })));
    });
    type RunParams = { id: string; runId: string };
    api.post<{ Params: RunParams; Body: { claimId: string } }>("/projects/:id/runs/:runId/claim", async r => pipeline.claim(r.params.id, auth(r).id, r.params.runId, r.body?.claimId));
    api.post<{ Params: RunParams; Body: { threadId: string; runId: string } }>("/projects/:id/runs/:runId/started", async r => pipeline.memberStarted(r.params.id, auth(r).id, r.params.runId, r.body));
    api.post<{ Params: RunParams; Body: Parameters<SciencePALPipeline["memberContinued"]>[3] }>("/projects/:id/runs/:runId/continued", async r => pipeline.memberContinued(r.params.id, auth(r).id, r.params.runId, r.body));
    api.post<{ Params: RunParams; Body: Parameters<SciencePALPipeline["memberComplete"]>[3] }>("/projects/:id/runs/:runId/complete", { bodyLimit: 8 * 1024 * 1024 }, async r => pipeline.memberComplete(r.params.id, auth(r).id, r.params.runId, r.body));
    api.post<{ Params: RunParams; Body: { claimId: string; base64: string } }>("/projects/:id/runs/:runId/complete-local", { bodyLimit: 8 * 1024 * 1024 }, async r => pipeline.memberCompleteLocal(r.params.id, auth(r).id, r.params.runId, r.body));
    api.post<{ Params: RunParams; Body: { claimId: string } }>("/projects/:id/runs/:runId/failed-local", async r => pipeline.memberLocalFailed(r.params.id, auth(r).id, r.params.runId, r.body));
    api.post<{ Params: RunParams; Body: { status: string; location?: unknown } }>("/projects/:id/runs/:runId/status", async r => pipeline.memberStatus(r.params.id, auth(r).id, r.params.runId, r.body.status, r.body.location));
  }, { prefix: "/api/sciencepal-team" });
}
