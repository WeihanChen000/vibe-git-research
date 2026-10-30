import type { FastifyInstance, FastifyRequest } from "fastify";
import type { SciencePALCreateInput, SPCreateProject } from "@vibe-git/protocol";
import { forbidden, unavailable } from "../domain/errors.js";
import { SciencePALError } from "./client.js";
import type { SciencePALService } from "./service.js";
import type { SciencePALPipeline } from "./pipeline.js";

function localOnly(request: FastifyRequest) {
  // Do not trust X-Forwarded-For: a tunnel must not gain local-control privileges.
  const ip = request.raw.socket.remoteAddress?.replace(/^::ffff:/, "");
  if (ip !== "127.0.0.1" && ip !== "::1") throw forbidden("SciencePAL 原型仅允许本机操作");
  let url: URL;
  try { url = new URL(`http://${request.headers.host}`); } catch { throw forbidden("无效的本机 Host"); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw forbidden("SciencePAL 原型必须使用 localhost 或回环地址");
  if (request.headers.origin && request.headers.origin !== url.origin) throw forbidden("不允许跨站操作");
  if (request.method !== "GET" && request.headers["x-vibe-sciencepal"] !== "1") throw forbidden("缺少本机操作标记");
}
export async function registerSciencePALRoutes(app: FastifyInstance, service: SciencePALService, pipeline?: SciencePALPipeline) {
  await app.register(async api => {
    api.addHook("onRequest", async (request, reply) => { localOnly(request); reply.header("Cache-Control", "no-store"); });
    api.addHook("preHandler", async request => {
      const id = (request.params as { id?: string }).id;
      if (pipeline && id && request.url.startsWith("/api/sciencepal/projects/") && pipeline.get(id).team) throw forbidden("多人项目必须通过成员凭据访问");
    });
    api.setErrorHandler((error, _request, reply) => {
      if (error instanceof SciencePALError) return reply.status(502).send({ error: error.message, code: "SCIENCEPAL_ERROR" });
      // Domain errors pass through to the Host's existing handler.
      throw error;
    });
    api.get("/state", async () => ({ enabled: true, configured: service.remote.configured, roomId: service.roomId(), workflows: service.list() }));
    api.get("/agents", async () => service.remote.agents());
    if (pipeline) {
      api.get("/projects", async () => pipeline.list().filter(p => !p.team));
      api.get<{ Params: { id: string }; Querystring: { revision?: string; download?: string } }>("/projects/:id/evidence", async (r, reply) => {
        const report = pipeline.evidence(r.params.id, r.query.revision === undefined ? undefined : Number(r.query.revision));
        if (r.query.download === "1") reply.header("Content-Disposition", `attachment; filename="sciencepal-${report.projectId}-R${report.revision}.json"`);
        reply.header("X-Content-Type-Options", "nosniff");
        return report;
      });
      api.get<{ Params: { id: string; taskKey: string }; Querystring: { revision?: string } }>("/projects/:id/tasks/:taskKey/attempts", async r =>
        pipeline.attempts(r.params.id, r.params.taskKey, r.query.revision === undefined ? undefined : Number(r.query.revision)));
      api.post<{ Body: SPCreateProject }>("/projects", async r => pipeline.create(r.body));
      api.post<{ Params: { id: string; action: string }; Body: unknown }>("/projects/:id/commands/:action", async r => pipeline.command(r.params.id, r.params.action, r.body));
      api.get<{ Params: { id: string; artifactId: string } }>("/projects/:id/artifacts/:artifactId", async (r, reply) => {
        const file = pipeline.file(r.params.id, r.params.artifactId);
        reply.header("Content-Disposition", `attachment; filename="${file.filename}"`);
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("X-Artifact-SHA256", file.sha256);
        return reply.type("application/octet-stream").send(Buffer.from(file.bytes));
      });
    }
    api.post<{ Body: SciencePALCreateInput }>("/workflows", async request => {
      if (!service.remote.configured) throw unavailable("请先配置 Host 的 SciencePAL API Key");
      return service.create(request.body);
    });
    type RoleParams = { id: string; role: string };
    api.post<{ Params: RoleParams }>("/workflows/:id/:role/start", async r => service.start(r.params.id, r.params.role));
    api.post<{ Params: RoleParams }>("/workflows/:id/:role/collect", async r => service.collect(r.params.id, r.params.role));
    api.post<{ Params: { id: string } }>("/workflows/:id/sync", async r => service.sync(r.params.id));
    api.post<{ Params: { id: string } }>("/workflows/:id/verify", async r => service.verify(r.params.id));
    api.get<{ Params: { id: string; artifactId: string } }>("/workflows/:id/artifacts/:artifactId", async (r, reply) => {
      const artifact = service.artifact(r.params.id, r.params.artifactId);
      reply.header("Content-Disposition", `attachment; filename="${artifact.filename}"`);
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Artifact-SHA256", artifact.sha256);
      return reply.type("application/octet-stream").send(Buffer.from(artifact.bytes));
    });
  }, { prefix: "/api/sciencepal" });
}
