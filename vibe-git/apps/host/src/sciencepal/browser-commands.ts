import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { SPProject } from "@vibe-git/protocol";
import { forbidden } from "../domain/errors.js";

export const browserCommands = new Set(["set-constraints", "align", "decide", "publish", "rework", "retry", "pause", "resume", "change", "apply-change", "dismiss-change"]);
export const commandSnapshot = (p: SPProject) => createHash("sha256").update(JSON.stringify(p)).digest("hex");

/** A per-process synchronizer token bound to the HttpOnly session, never the member bearer. */
export function browserCommandGuard() {
  const secret = randomBytes(32);
  const token = (r: FastifyRequest) => {
    const session = r.headers.cookie?.split(";").map(v=>v.trim()).find(v=>v.startsWith("vibe_session="));
    if (!session) throw forbidden("缺少本人浏览器会话");
    return createHmac("sha256",secret).update(session).digest("hex");
  };
  return { token, verify(r: FastifyRequest) {
    let origin: URL;
    try { origin = new URL(String(r.headers.origin)); } catch { throw forbidden("缺少同源操作来源，请刷新页面"); }
    if (!["http:","https:"].includes(origin.protocol) || origin.host !== r.headers.host || r.headers["sec-fetch-site"] === "cross-site") throw forbidden("禁止跨站操作");
    const supplied = r.headers["x-vibe-csrf"];
    if (typeof supplied !== "string" || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token(r)))) throw forbidden("操作凭据已失效，请刷新页面后重试");
    if (!r.headers["content-type"]?.startsWith("application/json")) throw forbidden("操作必须使用 JSON 请求");
  } };
}
