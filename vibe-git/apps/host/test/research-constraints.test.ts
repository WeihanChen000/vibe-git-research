import {describe,it,expect} from "vitest";
import {constrainResearch} from "../src/sciencepal/research-constraints.js";
import {checkTaskResult} from "../src/sciencepal/result-contract.js";
import type {SPProject} from "@vibe-git/protocol";
const p={alignment:{tasks:[{key:"data"},{key:"analysis"}]},source:{artifact:{sha256:"a".repeat(64)}}} as SPProject;
describe("declarative research constraints",()=>{
 it("binds source hash from the uploaded artifact, not Agent input",()=>{const c=constrainResearch(p,undefined,[{taskKey:"data",field:"source_sha",kind:"source-sha",value:"fake"}]);expect(checkTaskResult(c,"data",{source_sha:"fake"},"hash").status).toBe("FAILED");expect(checkTaskResult(c,"data",{source_sha:"a".repeat(64)},"hash").status).toBe("PASSED");});
 it.each(["__proto__","constructor","prototype","nested.value"])("rejects unsafe or unsupported field %s",field=>{expect(()=>constrainResearch(p,undefined,[{taskKey:"data",field,kind:"number",value:1}])).toThrow();});
 it("retains narrower original bounds",()=>{const c=constrainResearch(p,undefined,[{taskKey:"data",field:"score",kind:"range",min:1,max:2}]);const d=constrainResearch(p,c,[{taskKey:"data",field:"score",kind:"range",min:0,max:3}]);expect(d.data?.properties?.score).toMatchObject({minimum:1,maximum:2});});
 it("does not replace fixed parameters or silently coerce numbers",()=>{const c=constrainResearch(p,undefined,[{taskKey:"data",field:"seed",kind:"number",value:0}]);expect(()=>constrainResearch(p,c,[{taskKey:"data",field:"seed",kind:"number",value:1}])).toThrow();expect(()=>constrainResearch(p,undefined,[{taskKey:"data",field:"seed",kind:"number",value:"1"}])).toThrow();expect(checkTaskResult(c,"data",{seed:0},"h").status).toBe("PASSED");});
});
