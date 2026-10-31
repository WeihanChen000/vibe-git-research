# Preserve upstream functionality

This repository extends the team's Vibe-Git; research features must not replace its existing software workflow.

- Preservation baseline: `f3e888f796f06cc6d219d368ac547969adfb3b47`. The review document's `b9bbe3b` is a different upstream version, not an interchangeable baseline.
- Preserve the original CLI, explicit task start/completion, captain/member permissions, proposal revisions and freezes, conflict decisions, selective change impact, Git/fingerprint-bound evidence invalidation, interface contracts, topology, Gantt, and original Skill submodule.
- UI and interaction baseline is the original Vibe-Git, not a new research dashboard. Reuse its topology/Gantt views, command bar, member cards, popovers, inspector drawers, components, CSS, spacing, colors, typography and status conventions. Do not introduce a separate visual language or parallel navigation system.
- Integrate research tasks, Agent selection, file handoff and anti-drift evidence into the corresponding original controls. Preserve the proposal -> alignment/captain decision -> publish -> member execution -> review/change sequence and who may act at each step. Renaming scientific content must not silently change permissions, confirmations or completion semantics.
- For UI changes, compare the same screen and action against the original implementation, including entry location, clicks and feedback as well as appearance. Disclose existing deviations; preserving a similar color palette alone is not compliance. User approval is required before intentionally redesigning the original style or workflow.
- Research additions must keep the original software entry accessible. A local research proxy is not an authenticated software room; do not broaden its permissions just to make navigation work.
- The teammate's AgentAdapter/AgentRegistry/AgentExecutor and local adapters are shared infrastructure. Default remains Codex. Report which actual entry points use them; original v0.20 CLI execution is still Codex-specific.
- Do not replace original anti-drift mechanisms with scientific numeric checks. Scientific checks supplement governance and cannot prove complete semantic alignment.
- Research governance v1 supports source-line coverage, incremental requirements, per-task impact evidence and verified reuse of unaffected approved outputs at phase boundaries. Preserve legacy project semantics. Do not equate this with the original software workflow's mid-execution selective pause, or claim semantic/scientific correctness from structural checks alone.
- Preserve original attribution. Do not infer personal authorship from integration commit authors, or claim byte-identical ZIP reuse without the source archive.
- Before shipping changes to shared execution, routing, protocols or packaging, run `npm run test:compatibility` in `vibe-git`, plus affected research tests and build. Packaging changes require an isolated installed-package smoke check, not only workspace tests.
- Keep historical real-run evidence immutable. Document simulated tests and outstanding real-platform coverage separately.

See `docs/research/ORIGINAL-FUNCTION-PRESERVATION.md` for the baseline comparison, evidence and remaining gaps. Parent machine-safety instructions still apply.
