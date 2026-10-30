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
