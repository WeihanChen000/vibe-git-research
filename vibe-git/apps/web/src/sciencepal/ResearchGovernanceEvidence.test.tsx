import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect} from "vitest";
import {PublishTaskChecks} from "./ResearchCommand";
import type {SPTaskDraft,SPProject} from "@vibe-git/protocol";
import {ResearchGovernanceEvidence} from "./ResearchGovernanceEvidence";
describe("Governance evidence in the original inspector",()=>{
 it("shows uncovered original requirements without claiming they passed",()=>{
  const p={tasks:[],alignment:{tasks:[{title:"Data",requirementIds:["a"]}]},governance:{version:1,decisions:[],requirements:[{id:"a",text:"Use frozen method"},{id:"b",text:"Report uncertainty"}]}} as unknown as SPProject;
  const html=renderToStaticMarkup(createElement(ResearchGovernanceEvidence,{p}));
  expect(html).toContain("原文覆盖 1 / 2 条");expect(html).toContain("Report uncertainty");expect(html).toContain("等待对齐到任务");expect(html).toContain('class="rt-detail-section"');
 });
 it("labels legacy projects honestly rather than retroactively asserting coverage",()=>{
  const html=renderToStaticMarkup(createElement(ResearchGovernanceEvidence,{p:{} as SPProject}));
  expect(html).toContain("历史协议");expect(html).toContain("未记录逐条原文覆盖");
 });
});

describe('Publish-time frozen parameter review',()=>{
 it('shows actual numeric constraints and tolerance before approval, even when the value is surprising',()=>{
  const task={resultSchema:{type:'object',properties:{n_points:{type:'number',const:-11000},probe_radius_A:{type:'number',const:1.4},source_sha256:{type:'string',const:'a'.repeat(64)}}},scientificChecks:[{id:'reference',kind:'reference',path:'total_A2',expected:2973.16,absoluteTolerance:59.46,relativeTolerance:0,provenance:'independent'}]} as unknown as SPTaskDraft;
  const html=renderToStaticMarkup(createElement(PublishTaskChecks,{task}));
  expect(html).toContain('n_points');expect(html).toContain('-11000');expect(html).toContain('1.4');expect(html).toContain('2973.16');expect(html).toContain('59.46');expect(html).toContain('绑定上传源文件指纹');expect(html).not.toContain('a'.repeat(64));
 });
});
