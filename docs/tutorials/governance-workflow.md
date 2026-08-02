# Video Tutorial Script — Governance Workflow

**Length:** 8–10 minutes  
**Audience:** C-suite, board members, RFC authors, compliance officers  
**Style:** Diagram-heavy + document walkthrough  
**Props:** Markdown editor, terminal, git log, Brain Console governance panel

---

## Scene 1 — Intro (0:00–1:00)

| Time | Visual | Audio |
|------|--------|-------|
| 0:00 | Fade in on Constitution.md with authority chain highlighted. | "Welcome to the Governance Workflow tutorial. In ForgeOS, no code ships without passing through Constitution, Laws, Standards, RFCs, and Missions." |
| 0:25 | Animated authority chain: Constitution → Laws → Standards → RFCs → Missions → Code. | "This is the ForgeOS authority chain. Lower layers cannot override upper layers." |
| 0:45 | Browser at `http://127.0.0.1:7777/governance`. | "The Brain Console renders the governance source of truth. Let's walk through how a new rule becomes law." |

---

## Scene 2 — Constitution layer (1:00–2:30)

| Time | Visual | Audio |
|------|--------|-------|
| 1:00 | Show `governance/constitution/Constitution.md` in VS Code. | "The Constitution is immutable once ratified. It defines the org structure, decision rights, and non-negotiables." |
| 1:20 | Highlight FES-001..012 (Foundational Engineering Standards). | "FES-001 through FES-012 are the engineering laws: isolation, auditability, mutex, auth, rate limits, graceful shutdown, and more." |
| 1:50 | Show `Ratification.md` with signatures. | "Ratification requires Board approval. Once ratified, amendments need a new RFC and a supermajority." |
| 2:15 | Show `git log --oneline governance/constitution/`. | "Every change is tracked in git. The governance panel shows the last amended date automatically." |

---

## Scene 3 — Laws & standards (2:30–4:00)

| Time | Visual | Audio |
|------|--------|-------|
| 2:30 | Show `governance/laws/AIEthics.md` and `EngineeringLaws.md`. | "Laws are the second layer. They interpret the Constitution for specific domains: AI ethics, security, engineering practices." |
| 2:50 | Show `governance/standards/` (empty or example). | "Standards are operational runbooks. They are the easiest to update — a C-suite owner can propose a change without a full RFC." |
| 3:15 | Show diff: old standard vs new standard in a PR. | "Standards changes still require PR review and the owning agent's sign-off." |
| 3:40 | Show the Brain Console `/api/governance` endpoint returning the file tree. | "The governance API indexes all files so the UI can render a navigable tree." |

---

## Scene 4 — RFC lifecycle (4:00–6:15)

| Time | Visual | Audio |
|------|--------|-------|
| 4:00 | Show `governance/rfcs/RFC-0000.md`. | "RFCs are the change mechanism. Every feature, architecture decision, or process change starts as an RFC." |
| 4:20 | Type `cp governance/rfcs/RFC-0000.md governance/rfcs/RFC-0012.md` and edit title to *"Add backup auto-rotation"*. | "To propose a new RFC, copy the template, fill in Problem, Proposal, and Impact sections." |
| 4:45 | Show RFC frontmatter: `status: proposed`, `author: cto/cto`, `date: 2026-08-02`. | "The RFC starts as `proposed`. The owning C-suite agent reviews it." |
| 5:05 | Edit status to `approved`. Show `git add` + `git commit`. | "If approved, the author merges and updates status to `approved`. The Constitution guarantees this is the only path to change." |
| 5:30 | Show `PATCH /api/missions/<rfc-mission-id>` to advance mission. | "Each RFC is also a mission. The Mission Center tracks RFC progress alongside engineering work." |
| 5:55 | Show `/api/ledger` recording the approval event. | "The decision ledger captures the approval with a timestamp and the approving agent." |

---

## Scene 5 — Mission to code (6:15–7:45)

| Time | Visual | Audio |
|------|--------|-------|
| 6:15 | Show `apps/poolleague/` with `manifest.json`. | "Once an RFC is approved, it becomes a mission in the Mission Center and work begins in the relevant app." |
| 6:30 | Show CI pipeline (GitHub Actions) triggering on PR. | "Pull requests must reference an RFC ID. The CI linter checks for the reference and fails the build if it is missing." |
| 6:50 | Show code merge to `main`. | "After review and CI pass, the code merges. The mission advances to `executing`." |
| 7:10 | Show deploy to VPS. | "Deploys require COO/CEO sign-off per ORG §3.6. The console records the deploy decision in the brain." |
| 7:35 | Mission moves to `review` then `done`. | "Post-deploy review closes the loop. The RFC, the code, and the deploy decision are all linked in the brain." |

---

## Scene 6 — Wrap (7:45–8:30)

| Time | Visual | Audio |
|------|--------|-------|
| 7:45 | Host back on camera with authority chain diagram. | "Governance is not bureaucracy. It is the guarantee that the org's AI acts with integrity, auditability, and human oversight." |
| 8:05 | Show links to Constitution, ORG.md, and FES-001..012. | "Read the Constitution, open an RFC, and ship with confidence." |
| 8:20 | End screen. | "Thanks for watching." |

---

## Production notes

- Use a 2-monitor setup: one for the markdown editor, one for the console.
- Enable spellcheck and line numbers in the editor for readability.
- Keep diagram overlays minimal; the authority chain is the hero visual.
- Add a PDF download link to the Constitution in the video description.
