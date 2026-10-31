import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect} from "vitest";
import type {SPProject} from "@vibe-git/protocol";
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
