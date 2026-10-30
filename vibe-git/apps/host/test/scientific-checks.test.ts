import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {crnScientificChecks} from "@vibe-git/protocol";
import {validateScientificChecks,checkScientificResult} from "../src/sciencepal/scientific-checks.js";
const dir=new URL("../../../fixtures/integrated-live/",import.meta.url);
const raw=JSON.parse(readFileSync(new URL("d66660eb-1ad0-4bb2-8730-ecb834277164.json",dir),"utf8"));
const source=createHash("sha256").update(readFileSync(new URL("source-1crn.pdb",dir))).digest("hex");
const config=validateScientificChecks(crnScientificChecks(true),source);
const check=(result:unknown)=>checkScientificResult(config,"sasa",result,"rules","artifact",source)!;
describe("bounded scientific checks on real saved SciencePAL output",()=>{
 it("accepts the immutable real result against independent reference",()=>expect(check(raw.result).status).toBe("PASSED"));
 it("rejects internally consistent but scientifically wrong rescaled numbers",()=>{const x=structuredClone(raw.result);x.total_A2*=1.2;x.residues.forEach((r:any)=>r.area_A2*=1.2);expect(check(x).status).toBe("FAILED");expect(check(x).checks.find(c=>c.id==="sum-residues")!.passed).toBe(true);});
 it("rejects residual redistribution even if total is unchanged",()=>{const x=structuredClone(raw.result);x.residues[0].area_A2+=20;x.residues[6].area_A2-=20;expect(check(x).checks.find(c=>c.id==="independent-residues")!.passed).toBe(false);});
 it.each([null,"1",Infinity,NaN])("rejects missing/non-finite/string numbers %s",v=>{const x=structuredClone(raw.result);x.total_A2=v;expect(check(x).status).toBe("FAILED");});
 it("uses unique residue keys, not input order",()=>{const x=structuredClone(raw.result);x.residues.reverse();expect(check(x).status).toBe("PASSED");x.residues[1].residue_number=x.residues[0].residue_number;expect(check(x).status).toBe("FAILED");});
 it("fails closed for mismatched source, unsupported engine and invalid tolerance",()=>{expect(()=>validateScientificChecks(config,"wrong")).toThrow();expect(()=>validateScientificChecks({...config,version:2},source)).toThrow();const x=structuredClone(config);x.tasks.sasa![0]!.absoluteTolerance=-1;expect(()=>validateScientificChecks(x,source)).toThrow();});
 it("does not execute fields containing code and rejects unsafe paths",()=>{const x=structuredClone(config);(x.tasks.sasa![0] as any).path="__proto__.value";expect(()=>validateScientificChecks(x,source)).toThrow();expect(check({...raw.result,code:"throw Error('do not execute')"}).status).toBe("PASSED");});
});


describe("new acceptance profile on the latest isolated artifact", () => {
 const replay = new URL("../../../apps/web/public/research-replay/isolated/",import.meta.url);
 const bundle = JSON.parse(readFileSync(new URL("case.json",replay),"utf8"));
 const project = bundle.steps.at(-1).state.projects[0];
 const file = (id:string) => JSON.parse(readFileSync(new URL(`files/${id}/${bundle.files[id].filename}`,replay),"utf8"));
 const latestRun = project.runs.findLast((r:any)=>r.kind==="TASK"&&r.taskKey==="sasa");
 const latest = file(latestRun.output.id).result;
 const legacy = validateScientificChecks(file(latestRun.inputs.find((f:any)=>f.filename==="context.json").artifactId).scientificChecks,source);
 const strengthened = validateScientificChecks(JSON.parse(readFileSync(new URL("../../../fixtures/acceptance-scientific-v2/checks.json",import.meta.url),"utf8")),source);
 const validate = (rules:typeof legacy,value:unknown) => checkScientificResult(rules,"sasa",value,"rules","artifact",source)!;
 it("accepts the saved final real result using the separate independent reference",()=>{
  expect(validate(strengthened,latest).status).toBe("PASSED");
  expect(strengthened.tasks.sasa!.some(r=>r.kind==="reference-table"&&r.keyField==="residue_id")).toBe(true);
 });
 it("documents the old sum/count blind spot and blocks a consistent 20 percent scaling",()=>{
  const wrong=structuredClone(latest);wrong.total_A2*=1.2;wrong.residues.forEach((r:any)=>r.area_A2*=1.2);
  expect(validate(legacy,wrong).status).toBe("PASSED");
  const checked=validate(strengthened,wrong);expect(checked.status).toBe("FAILED");
  expect(checked.checks.find(c=>c.id==="sum-residues")!.passed).toBe(true);
  expect(checked.checks.find(c=>c.id==="independent-total")!.passed).toBe(false);
 });
 it("blocks redistribution across residues even when the total and sum still pass",()=>{
  const wrong=structuredClone(latest);wrong.residues[0].area_A2+=20;wrong.residues[6].area_A2-=20;
  expect(validate(legacy,wrong).status).toBe("PASSED");
  const checked=validate(strengthened,wrong);expect(checked.status).toBe("FAILED");
  expect(checked.checks.find(c=>c.id==="sum-residues")!.passed).toBe(true);
  expect(checked.checks.find(c=>c.id==="independent-total")!.passed).toBe(true);
  expect(checked.checks.find(c=>c.id==="independent-residues")!.passed).toBe(false);
 });
});
