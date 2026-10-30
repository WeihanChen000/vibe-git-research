import type { SPSourceInput } from "@vibe-git/protocol";
import { badRequest } from "../domain/errors.js";
import { string } from "./pipeline-contract.js";

export const MAX_SOURCE_BYTES = 256 * 1024;
export function validateSource(source: SPSourceInput) {
  const filename = string(source?.filename, "来源文件名", 100);
  if (!/^source-[a-zA-Z0-9_-]+\.(csv|tsv|txt|json|data|pdb)$/.test(filename)) throw badRequest("来源文件须以 source- 开头，使用安全英文文件名及 csv/tsv/txt/json/data/pdb 扩展名");
  const encoded = source?.base64;
  if (typeof encoded !== "string" || !encoded.length || encoded.length > Math.ceil(MAX_SOURCE_BYTES / 3) * 4) throw badRequest("来源文件须为 1–256 KiB 的 UTF-8 文本");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES || bytes.toString("base64") !== encoded) throw badRequest("来源文件编码无效或超过 256 KiB");
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw badRequest("来源文件必须采用 UTF-8 编码"); }
  const sourceUrl = string(source.sourceUrl, "来源网址", 2000), attribution = string(source.attribution, "来源署名与许可", 2000);
  let url: URL;
  try { url = new URL(sourceUrl); } catch { throw badRequest("来源网址无效"); }
  if (url.protocol !== "https:" || url.username || url.password) throw badRequest("来源网址须为不含凭据的 HTTPS 链接");
  return { filename, bytes, sourceUrl, attribution };
}
