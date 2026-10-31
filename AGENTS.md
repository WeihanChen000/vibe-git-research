# Preserve upstream functionality

This repository extends the team's Vibe-Git; research features must not replace its existing software workflow.

- Preservation baseline: `f3e888f796f06cc6d219d368ac547969adfb3b47`. The review document's `b9bbe3b` is a different upstream version, not an interchangeable baseline.
- Preserve the original CLI, explicit task start/completion, captain/member permissions, proposal revisions and freezes, conflict decisions, selective change impact, Git/fingerprint-bound evidence invalidation, interface contracts, topology, Gantt, and original Skill submodule.
- Research additions must keep the original software entry accessible. A local research proxy is not an authenticated software room; do not broaden its permissions just to make navigation work.
- The teammate's AgentAdapter/AgentRegistry/AgentExecutor and local adapters are shared infrastructure. Default remains Codex. Report which actual entry points use them; original v0.20 CLI execution is still Codex-specific.
- Do not replace original anti-drift mechanisms with scientific numeric checks. Scientific checks supplement governance and cannot prove complete semantic alignment.
- Do not claim selective change handling or incremental requirements are implemented in research when they remain only in the original software workflow.
- Preserve original attribution. Do not infer personal authorship from integration commit authors, or claim byte-identical ZIP reuse without the source archive.
- Before shipping changes to shared execution, routing, protocols or packaging, run `npm run test:compatibility` in `vibe-git`, plus affected research tests and build. Packaging changes require an isolated installed-package smoke check, not only workspace tests.
- Keep historical real-run evidence immutable. Document simulated tests and outstanding real-platform coverage separately.

See `docs/research/ORIGINAL-FUNCTION-PRESERVATION.md` for the baseline comparison, evidence and remaining gaps. Parent machine-safety instructions still apply.
