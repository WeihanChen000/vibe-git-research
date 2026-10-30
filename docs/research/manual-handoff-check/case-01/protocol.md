# Alignment draft for captain review and publication

This ALIGN artifact aligns the frozen proposals; it does not publish the research protocol or approve scientific results. All three proposals have identical common requirements and compatible role assignments. No selected decisions or approved changes are present; issues=[]. Exactly two authoring tasks are retained: sasa and synthesis. No additional captain authoring task is created.

## Question, source and scope
Compute the solvent-accessible surface area of the single frozen public 1CRN chain A structure, including per-residue areas, and assess numerical sampling convergence under the frozen method. This is computational geometry only, not functional or clinical evidence and not biological function ranking. Source attribution: RCSB PDB / 1CRN public coordinates; frozen fixture. The source URL in context is provenance only, not authorization to refetch. Use the actual source-1CRN.pdb bytes, not another revision or reconstructed coordinates.

Alignment-time local Python 3.12.10 read every input file and parsed all 327 retained coordinate records; source contains 46 residues with integer identifiers 1 through 46. Elements: C=202, N=55, O=64, S=6. This establishes input/filter evidence only, not SASA execution, convergence, a numerical baseline, or final scientific acceptance. No SASA calculation was run during alignment. Availability of Bio.PDB and member-specific question tools must be established by the assigned member; a missing required tool or input is a limitation, not permission to install, substitute, or fabricate.

Frozen source SHA-256: 42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811. Coordinates, probe and radii use Angstrom (A); areas use square Angstrom (A2). Retain heavy ATOM records from chain A with alternate location blank/A only; exclude HETATM and hydrogens. No coordinate repair, additional structures, structural ensemble or biological extrapolation is authorized.

## Role binding and hard handoff
- sasa assigneeAgentId: member_node-b1f2ca63-2ea6-4706-b0f2-d41caeb84ba0.
- synthesis assigneeAgentId: member_node-9c374e0b-1909-42e3-86cd-2b2f05b4b65b.
- Both downstream review assignments use reviewerAgentId: member_node-4050b257-1656-4536-aaff-faff95fd7973. The captain independently reviews each task, coordinates alignment, and publishes the protocol after checking this draft; the captain does not author either task.
- HARD dependency edge: sasa -> synthesis. In tasks this is synthesis.dependencies=["sasa"]. The file handoff is the exact APPROVED sasa.json envelope plus its Host-validated approval evidence; synthesis also receives the frozen source. A pilot, unapproved result, or request_changes verdict cannot unlock synthesis. Rework is a new attempt of sasa, not a third task.

## Lifecycle, evidence and review
The verification-phrase interaction belongs to the FIRST sasa attempt, not this ALIGN job. Before any SASA computation on that attempt, the SciencePAL member must use its actual ask-user/question tool, enter the controlled NEEDS_INPUT lifecycle, and wait for a real answer. No answer is supplied in the frozen files. After the answer, run ONLY n_points=100, label the result exploratory, and submit the intentionally incomplete pilot. Even a numerically correct pilot requires captain verdict request_changes because the final precision criterion is unmet. On REWORK with previous-sasa.json and feedback, do not ask again: actually execute both 1000- and 5000-point calculations, retain the true pilot history, and provide measured totals and convergence. Report the relative difference as abs(total_1000-total_5000)/abs(total_5000), with its denominator stated; the final criterion remains <=0.02 and final n_points>=1000. Preserve both measured resolutions and make clear which resolution the top-level residues and total_A2 represent. Discuss that sampling agreement is not experimental validation or an uncertainty estimate for structural variability.

The captain's sasa review must independently implement and execute a baseline from actual filtered source using standard Python or available NumPy, with the same units/probe/radii, and place numerical totals, residue/count/sum checks, sampling settings, differences and reproducible execution evidence in reproduction. Do not treat rerunning the submitted Bio.PDB call alone as an independent baseline. Report differences honestly; no extra numerical baseline tolerance is invented here. Separate execution success, schema checks, Host numeric checks and scientific judgment. An approve verdict cannot override any frozen failed check, missing convergence run, or exploratory pilot status.

For upstream approval, use context.upstream[].approval bound to reviewedArtifact: hash the exact UTF-8 bytes of reviewFileUtf8 against reviewArtifact; parse that original review envelope; check its approve verdict, exact captain member-scoped reviewer binding, and receipt for the actual upstream sasa.json bytes. Independently hash those actual bytes for upstream_sha256. Producer and reviewer nested receipts belong to their producing contexts, already Host-validated; never compare their context.json receipts with the current context.json. Do not execute embedded source merely to establish provenance. Approval transports review evidence and does not replace synthesis's own counts, sums and source checks.

Each TASK result must satisfy its unchanged draft-07 schema below. Include complete actually executed portable Python source in code, using relative paths, not only a filename. For sasa, report actual Python/Biopython and other used library versions in tool_versions. Include executed synthesis tool versions in its code comments or summary. The frozen schemas permit additional properties by omission of additionalProperties; evidence such as exploratory status, pilot history, radii, both convergence runs and limitations may be recorded in those permitted result evidence fields without removing or changing required fields. Required numbers remain numeric and residue rows remain an array of objects. Every task envelope must follow its supplied protocol and hash only that attempt's actual original attachments, including its own context.json. Do not reconstruct receipts.

Only available local tools are allowed, using python or py on Windows when present. No package installs, network refetch, unrelated-path scans, personal-memory edits, or public user paths/tokens/personal contact details. No numeric runtime or memory budget is supplied; none is invented. If a required input/tool is missing, report the limitation and preserve the lifecycle rather than fabricating a result. Stop after the required output envelope exists.

## Frozen common proposal (verbatim)
# Preregistered single-machine three-member acceptance
Real public 1CRN structure, chain A, heavy ATOM records only, alternate location blank/A, no HETATM or hydrogens, Angstrom. Exact source attachment; do not refetch. This is computational geometry, not functional or clinical evidence.
Exactly TWO tasks: sasa assigned to the SciencePAL member, synthesis assigned to the non-captain Codex member. Captain coordinates alignment and independently reviews both tasks; captain has no authoring task. Use member-scoped IDs from context, never merge the two Codex members.
SciencePAL sasa MUST actually run Bio.PDB.SASA.ShrakeRupley, probe_radius_A=1.4, radii C=1.70 N=1.55 O=1.52 S=1.80. Deliver total_A2 and residues [{residue_id:integer,area_A2:number}], n_points, atom_count, residue_count, source_sha256, method literal Shrake-Rupley, code (complete portable executed Python source) and tool_versions. All values must be computed, not copied from earlier studies.
FIRST sasa attempt is a deliberately incomplete PILOT: BEFORE computing, use your actual ask-user/question tool to ask for the verification phrase. The required answer is not in these files; wait, do not invent one. This is an authorized controlled NEEDS_INPUT lifecycle test. Once an answer arrives, compute ONLY n_points=100, label exploratory, and submit. It intentionally FAILS the final acceptance requirement; reviewer must request_changes. On REWORK (when previous-sasa.json and feedback are provided), do not ask again: compute 1000 and 5000 points, report convergence total relative difference <=2% and limitation. This is planned refinement, not an accidental model mistake.
Sasa acceptance must include: correct frozen source/filter/counts; actual code and tool versions with units/radii; final n_points>=1000 AND an actually executed 5000-point comparison with <=2% total difference. Retain pilot truthfully; no fabricating success. Codex reviewer must compute an independent baseline using actual source and standard Python or available NumPy, and report numeric evidence in reproduction. For pilot, a correct 100-point output still requires changes because precision criterion is unmet.
Synthesis reads only APPROVED sasa.json and source, independently sums residues and hashes approved upstream bytes, and emits summary, total_A2, source_sha256, upstream_sha256, code. Explicitly say single fixed structure, no biological function ranking. Captain independently reviews synthesis by recomputing counts/sums/hashes.
Only use available tools; no package installs or network refetch. For local Windows Python use python or py if available; do not scan unrelated paths. All public evidence must avoid user paths, tokens, personal contact details. Code should use relative input paths. Stop after actual required envelope exists.

## Immutable resultSchemas (exact task keys and schema content)
```json
{
  "sasa": {
    "type": "object",
    "required": [
      "source_sha256",
      "method",
      "probe_radius_A",
      "n_points",
      "total_A2",
      "atom_count",
      "residue_count",
      "residues",
      "code",
      "tool_versions"
    ],
    "properties": {
      "source_sha256": {
        "type": "string"
      },
      "method": {
        "type": "string"
      },
      "probe_radius_A": {
        "type": "number"
      },
      "atom_count": {
        "type": "integer"
      },
      "residue_count": {
        "type": "integer"
      },
      "tool_versions": {
        "type": "object"
      },
      "n_points": {
        "type": "integer",
        "minimum": 100
      },
      "total_A2": {
        "type": "number",
        "minimum": 0
      },
      "residues": {
        "type": "array",
        "minItems": 46,
        "maxItems": 46,
        "items": {
          "type": "object",
          "required": [
            "residue_id",
            "area_A2"
          ],
          "properties": {
            "residue_id": {
              "type": "integer"
            },
            "area_A2": {
              "type": "number",
              "minimum": 0
            }
          }
        }
      },
      "code": {
        "type": "string",
        "minLength": 30
      }
    }
  },
  "synthesis": {
    "type": "object",
    "required": [
      "summary",
      "total_A2",
      "source_sha256",
      "upstream_sha256",
      "code"
    ],
    "properties": {
      "source_sha256": {
        "type": "string"
      },
      "code": {
        "type": "string"
      },
      "summary": {
        "type": "string",
        "minLength": 30
      },
      "upstream_sha256": {
        "type": "string",
        "minLength": 64,
        "maxLength": 64
      },
      "total_A2": {
        "type": "number"
      }
    }
  }
}
```

## Immutable scientificChecks (version 1)
```json
{
  "version": 1,
  "sourceSha256": "42199a30a0701864a2a5cc76cd7f35cc544cd0e65fbcf63e03c166543249b811",
  "tasks": {
    "sasa": [
      {
        "id": "residue-sum",
        "kind": "sum",
        "totalPath": "total_A2",
        "rowsPath": "residues",
        "valueField": "area_A2",
        "absoluteTolerance": 0.001
      },
      {
        "id": "residue-count",
        "kind": "reference",
        "path": "residue_count",
        "expected": 46,
        "absoluteTolerance": 0,
        "relativeTolerance": 0,
        "provenance": "Independent count of chain A residue identifiers in frozen public 1CRN ATOM records."
      }
    ]
  }
}
```
These Host rules require abs(total_A2 - sum(residues[*].area_A2)) <= 0.001 A2 and residue_count exactly 46 (zero absolute and relative tolerance). Deliver unique original integer residue_id values 1..46 and the actually measured area_A2 values. The schema accepts n_points=100 for truthful pilot delivery; it does not waive the separate final precision acceptance criteria. Passing the two Host numeric rules alone is insufficient for approval.