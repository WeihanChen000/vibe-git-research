// Dedicated local entrypoint; uses the original Vibe-Git Host, database and web bundle.
import { resolve } from "node:path";
import { buildApp } from "../app.js";
process.env.SCIENCEPAL_ENABLED = "1";
process.env.VIBE_GIT_DATA_DIR ||= resolve("data/sciencepal");
// The existing tunnel manager reads PORT as well; keep its target on this Host.
process.env.PORT ||= "8788";
const port = Number(process.env.PORT);
const app = await buildApp({ logger: false });
await app.listen({ host: "127.0.0.1", port });
console.log(`Vibe-Git × SciencePAL: http://127.0.0.1:${port}/sciencepal`);
let closing = false;
async function close() { if (closing) return; closing = true; await app.close(); process.exit(0); }
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
