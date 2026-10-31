// Run against an npm-installed package outside this source workspace.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp, readFile, realpath, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, dirname, isAbsolute, resolve, sep} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const input = process.argv[2];
assert(input && isAbsolute(input), "Provide the absolute installed @vibe-git/vibe-git directory");
const installed = await realpath(input);
const source = await realpath(fileURLToPath(new URL("..", import.meta.url)));
assert(installed !== source && !installed.startsWith(source + sep), "Use an isolated installation outside the source workspace");
const load = relative => import(pathToFileURL(resolve(installed, relative)).href);
delete process.env.SCIENCEPAL_ENABLED;
const {buildApp} = await load("apps/host/dist/app.js");
const {AgentRegistry} = await load("node_modules/@vibe-git/relay/dist/agent-registry.js");
const registry = new AgentRegistry();
assert.equal(registry.resolve({}).kind, "codex");
for (const kind of ["codex", "claude", "cursor", "gemini", "opencode", "deepseek", "sciencepal"])
  assert.equal(registry.resolve({VIBE_AGENT:kind}).kind, kind);
const cli = spawnSync(process.execPath, [resolve(installed,"apps/cli/dist/index.js"),"--help"], {
  cwd:installed, encoding:"utf8", windowsHide:true, timeout:15000
});
assert.equal(cli.status, 0, cli.stderr);
assert.match(cli.stdout, /task start/);
assert.match(cli.stdout, /review start.*apply <review-id>/);
const temp = await mkdtemp(resolve(tmpdir(), "vibe-package-smoke-"));
let remoteCalls = 0;
const remote = new Proxy({configured:false}, {get(target,key) {
  return key in target ? target[key] : () => {remoteCalls++; throw Error("Remote execution is forbidden in package smoke tests");};
}});
const results = [];
try {
  for (const enabled of [false,true]) {
    const dataDir = resolve(temp, enabled ? "research" : "software");
    const app = await buildApp({dbPath:":memory:", dataDir, staticDir:resolve(installed,"apps/web/dist"),
      backupDatabase:false, cloudflareManager:{async close(){},async status(){return {phase:"stopped",installed:false,running:false,version:null,url:null,logs:[],lastError:null,updatedAt:new Date().toISOString()};}},
      ...(enabled ? {sciencepal:{remote,worker:false}} : {})});
    try {
      const captain = JSON.parse(await readFile(resolve(dataDir,"captain.json"),"utf8"));
      const headers = {authorization:`Bearer ${captain.nodeToken}`};
      assert.equal((await app.inject({method:"GET",url:"/health"})).statusCode,200);
      assert.equal((await app.inject({method:"GET",url:"/?view=software"})).statusCode,200);
      const bootstrap = await app.inject({method:"GET",url:"/api/v1/bootstrap",headers});
      assert.equal(bootstrap.statusCode,200,bootstrap.body);
      const proposal = await app.inject({method:"POST",url:"/api/v1/plans",headers,
        payload:{filename:"original-plan.md",content:"# Original software task\nKeep the original workflow available."}});
      assert.equal(proposal.statusCode,200,proposal.body);
      const research = await app.inject({method:"GET",url:"/api/sciencepal-team/state",headers});
      assert.equal(research.statusCode,enabled?200:404,research.body);
      results.push({mode:enabled?"software-and-research":"software-only", health:true, originalUI:true, originalBootstrap:true, originalProposal:true, researchRoute:enabled});
    } finally {await app.close();}
  }
  assert.equal(remoteCalls,0);
  console.log(JSON.stringify({ok:true,bundledAdapters:7,defaultAgent:"codex",cliHelp:true,remoteCalls,results},null,2));
} finally {
  assert.equal(dirname(temp),resolve(tmpdir()));
  assert(basename(temp).startsWith("vibe-package-smoke-"));
  await rm(temp,{recursive:true,force:true});
}
