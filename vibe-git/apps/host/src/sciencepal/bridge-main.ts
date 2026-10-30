import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SciencePALClient, readSciencePALKey, MAX_ARTIFACT_BYTES } from "./client.js";
import { SciencePALBridge, bridgeHash, type BridgeInput } from "./bridge.js";

async function main() {
  const [action = "help", ...args] = process.argv.slice(2);
  if (action === "help") return { commands: ["agents", "submit request.json", "status TASK_ID", "collect TASK_ID", "respond TASK_ID feedback.json", "recover TASK_ID THREAD_ID RUN_ID", "show TASK_ID", "list"], environment: ["SCIENCEPAL_AUTH_FILE", "VIBE_GIT_DATA_DIR (default data/sciencepal)"], notes: "JSON 输出；requestId 防重复；collect 保存独立结果；不覆盖仓库源文件；UNKNOWN 禁止重发。" };
  const remote = new SciencePALClient(readSciencePALKey());
  if (action === "agents") return remote.agents();
  const root = resolve(process.env.VIBE_GIT_DATA_DIR || "data/sciencepal");
  await mkdir(root, { recursive: true });
  const lockPath = resolve(root, "bridge.lock");
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch { throw new Error("另一个统一入口正在操作；若进程异常退出，请确认 bridge.lock 中的 PID 已退出后删除该锁，保留数据库"); }
  let db: DatabaseSync | undefined;
  try {
    await lock.writeFile(String(process.pid));
    db = new DatabaseSync(resolve(root, "workspace.db")); db.exec("PRAGMA busy_timeout=5000");
    const bridge = new SciencePALBridge(db, remote);
    const json = async (path: string) => JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
    if (action === "list") return bridge.list();
    if (action === "show") return bridge.get(args[0]!);
    if (action === "submit") {
      if (!args[0]) throw new Error("缺少请求文件");
      const requestPath = resolve(args[0]), input = await json(requestPath) as BridgeInput & { inputFiles?: string[] };
      if (input.inputFiles && (!Array.isArray(input.inputFiles) || input.inputFiles.length > 8)) throw new Error("inputFiles 必须为最多八个路径");
      const files = [];
      for (const name of input.inputFiles ?? []) {
        const path = resolve(dirname(requestPath), name), info = await stat(path);
        if (!info.isFile() || info.size > MAX_ARTIFACT_BYTES) throw new Error("输入必须是最多 5 MiB 的普通文件");
        files.push({ filename: basename(path), bytes: await readFile(path) });
      }
      const { inputFiles: _paths, ...request } = input;
      return await bridge.submit(request, files);
    }
    if (action === "status") return await bridge.status(args[0]!);
    if (action === "respond") return await bridge.respond(args[0]!, await json(args[1]!));
    if (action === "recover") return await bridge.recover(args[0]!, args[1]!, args[2]!);
    if (action === "collect") {
      const task = await bridge.collect(args[0]!), attempt = task.attempts.at(-1)!;
      const outputDir = resolve(root, "bridge-results", task.id, `r${attempt.number}`); await mkdir(outputDir, { recursive: true });
      const files = [];
      for (const f of attempt.artifacts) {
        const stored = bridge.read(task.id, f.id), path = resolve(outputDir, f.filename);
        try { await writeFile(path, stored.bytes, { flag: "wx" }); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; if (bridgeHash(await readFile(path)) !== f.sha256) throw new Error("导出文件已被修改，拒绝覆盖；数据库冻结成果仍保留"); }
        files.push({ ...f, path });
      }
      return { task, files };
    }
    throw new Error("未知命令，请运行 help");
  } finally { try { db?.close(); } finally { await lock.close(); await unlink(lockPath); } }
}
main().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(JSON.stringify({ error: error instanceof Error ? error.message : "操作失败" })); process.exitCode = 1; });
