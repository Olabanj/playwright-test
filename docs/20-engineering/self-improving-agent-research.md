---
id: 5c96e200-f851-58a9-a0e0-c4e36449b379
name: self-improving-agent-research
description: "Gold-standard (2023-2026) techniques for self-improving agents and long-term memory, mapped to our orchestrator + markdown memory + Graphify, with a pragmatic no-new-infra MVP roadmap"
metadata:
  type: reference
  category: engineering
  tags: ["self-improving", "long-term-memory", "reflection", "lesson-bank", "retrieval", "eval-loop", "agentic", "hitl", "research"]
  author: dmytro
  createdAt: 2026-06-17T00:00:00Z
  updatedAt: 2026-06-17T00:00:00Z
  expiresAt: null
---

# Self-Improving Agent + Long-Term Memory — Research & MVP Roadmap

> Research deliverable for the open presentation question *"how will the agent self-learn?"*.
> Scope constraint: **pragmatic MVP** — keep the file-based two-tier memory + Graphify; **no** migration to
> LangGraph/LangMem and no heavy/paid infra. Sources verified via adversarial multi-source check
> (23/25 claims confirmed; 2 refuted and dropped). Findings dated; primary sources only.

---

## 1. TL;DR

1. **The single most important, most-replicated finding: unaided self-correction does not work.** An LLM grading
   and fixing its *own* output with no external signal is unreliable and frequently makes results *worse*
   (GPT-3.5 on GSM8K: fixed 7.6% of wrong answers but flipped 8.8% of correct ones to wrong — net negative).
   Improvement must be driven by **external feedback**: tools, verifiers, real test output, a *separate* critic, or a human.
   *(Huang et al., ICLR 2024, arXiv:2310.01798; TACL 2024 survey, arXiv:2406.01297)*
2. **Reflection / self-critique is mature and free**, but it is a *within-task* loop (improves the current answer),
   not learning across runs. Self-Refine reports ~20% absolute average gain — but only when grounded in external verification.
   *(Self-Refine arXiv:2303.17651; Reflexion arXiv:2303.11366; CRITIC arXiv:2305.11738, all 2023)*
3. **"Learning from mistakes" = episodic→semantic consolidation**, and it works with frozen API models, no weight
   updates. ExpeL extracts natural-language *insights* from past trajectories; Generative Agents keep an append-only
   memory stream that is periodically synthesized into higher-level reflections. This maps **almost 1:1 onto a
   markdown "lesson bank" + our Graphify graph.** *(ExpeL, AAAI 2024, arXiv:2308.10144; Generative Agents, UIST 2023, arXiv:2304.03442)*
4. **Retrieval is a solved pattern**: rank memories by `relevance × recency × importance` with recency decay as
   the forgetting mechanism. **Selective retrieval beats stuffing full context** (Mem0: ~91% lower p95 latency,
   >90% token savings vs full-context — vendor self-reported, ~5-6pp accuracy tradeoff). *(Generative Agents arXiv:2304.03442; Mem0 arXiv:2504.19413, Apr 2025)*
5. **Training-based self-correction (SFT/RL) is real but out of scope.** SCoRe (DeepMind, ICLR 2025) shows durable
   self-correction *can* be instilled — but only via multi-turn online RL; naive SFT collapses. Confirms the MVP
   should stay in-context + external-feedback, not fine-tuning. *(SCoRe arXiv:2409.12917)*
6. **The eval-driven loop is the weakest-evidenced of the four mechanisms.** No primary-source claim survived
   adversarial verification for "eval failure → auto-update prompt/memory" or for metrics like error-recurrence /
   lesson-hit-rate / regression-rate. These exist in tooling docs (LangSmith/Braintrust/promptfoo) but not as a
   validated standard. Treat the eval loop as **engineering hygiene we build ourselves**, not a citable gold standard.
7. **Risks (memory poisoning, accumulating wrong lessons, self-confirmation) are addressed only indirectly** in the
   literature — the mitigation it implies is exactly: don't let a model's self-judgment gate a memory write; require
   grounded verification + Human-in-the-Loop.

> **Net recommendation.** Keep markdown two-tier memory + Graphify retrieval. Route self-critique through the
> **separate** reviewer agent we already have, grounded in **real test/tool output** (never same-model self-judgment).
> Add a structured **lesson bank** written from *verified* failures, retrieved by `relevance × recency × importance`,
> and **gate lesson-writes behind HITL**. This is the entire self-learning loop, built on infra we already own.

---

## 2. The Landscape — four mechanisms, what's mature vs research

The four mechanisms form one loop: **act → self-check → store the lesson → retrieve the lesson next time → measure improvement.**

| Mechanism | Role in the loop | Horizon | Maturity |
|---|---|---|---|
| Reflection / self-critique | **source** of lessons | one run | **Mature**, training-free |
| Learning into long-term memory | **write** | across runs | **Mature/canonical** research pattern, lightweight |
| Retrieval / ranking | **read** | every call | **Mature** production standard |
| Eval-driven loop | **guard** | every iteration | **Weak evidence** — build it ourselves |

### 2.1 Reflection / self-critique — *source of lessons* (MATURE)
- **Self-Refine** (arXiv:2303.17651, Mar 2023): one model as generator → feedback → refiner, iteratively, "no supervised
  training data, additional training, or RL." ~20% absolute average gain.
- **Reflexion** (arXiv:2303.11366, NeurIPS 2023): reinforces agents "not by updating weights, but through linguistic
  feedback," stored in an episodic buffer reused in **subsequent trials of the same task** — explicitly within-task.
- **CRITIC** (arXiv:2305.11738, May 2023): verify-then-correct using **external tools** (search for facts, code interpreter
  for debugging) — names "the crucial importance of external feedback."
- **The hard caveat** (arXiv:2310.01798 ICLR 2024; arXiv:2406.01297 TACL 2024): intrinsic self-correction (model grading
  itself) is unreliable and can degrade output. "Self-correction works well [only] in tasks that can use reliable external feedback."

> **Design implication:** a same-model critic is the reward-hacking-prone configuration. A **separate** reviewer agent
> grounded in actual test results is the correct design — and self-judgment alone must never gate a memory write.

### 2.2 Learning mistakes into long-term memory — *write* (MATURE/CANONICAL)
- **ExpeL** (AAAI 2024, arXiv:2308.10144): "autonomously gathers experiences and extracts knowledge using natural
  language… without requiring parametric updates" — explicitly targets GPT-4/Claude APIs. Keeps **two stores**: raw
  episodic trajectories *and* distilled natural-language insights/rules; at inference recalls both.
- **Generative Agents** (UIST 2023, arXiv:2304.03442): append-only **memory stream** of experiences in natural language,
  periodically **synthesized into higher-level reflections** — the canonical episodic→semantic consolidation.
- **A-MEM** (arXiv:2502.12110, Feb 2025, *early research*): Zettelkasten-style note network, no fixed schema, with
  "memory evolution" — a new note can **retroactively update existing notes**. Interesting for a self-organizing
  lesson graph (cf. Graphify) but the retroactive rewrite is exactly what needs drift protection / HITL.
- **Voyager** (arXiv:2305.16291, May 2023): a *skill library* of reusable, verified code — the "store successful
  procedures, not just lessons" variant.

> **Design implication:** ExpeL's insight-bank maps 1:1 onto a markdown lesson bank. Two tiers, like ours:
> raw episodes (work-log / incidents) → distilled rules (decisions / lessons).

### 2.3 Retrieval / ranking — *read* (MATURE PRODUCTION STANDARD)
- **Generative Agents** canonical score: `relevance` (embedding cosine) `× recency` (exponential decay on last access)
  `× importance` (LLM-scored 1–10). Decay *is* the forgetting mechanism.
- **Mem0** (arXiv:2504.19413, Apr 2025): dynamic extract/consolidate/retrieve; vs full-context, "91% lower p95 latency
  and >90% token cost" savings. *Caveat: vendor-self-reported on one benchmark (LOCOMO), ~5-6pp accuracy tradeoff;
  a separate "26% over OpenAI memory" claim was refuted in verification and dropped.*

> **Design implication:** relevance×recency×importance over the lesson bank + our existing Graphify hybrid retrieval is
> the right approach. A dedicated vector store is only needed once keyword+graph relevance degrades at scale
> (our existing Qdrant threshold in `_meta/memory-rules.md` already encodes this trigger).

### 2.4 Eval-driven loop — *guard* (WEAK EVIDENCE — build it ourselves)
- No primary-source claim survived adversarial verification here. The pattern (golden-set regression eval; "eval failure →
  update prompt/memory"; metrics like error-recurrence / lesson-hit-rate / regression-rate) lives in tooling docs
  (LangSmith, Braintrust, promptfoo, OpenAI Evals), not in a validated standard.
- **Conclusion:** treat the eval loop as our own engineering hygiene, kept deliberately lightweight. It is still
  **mandatory** — it's the only thing that proves self-learning is helping and not silently drifting — but we should not
  over-invest or import a heavy tool for the MVP.

---

## 3. Mapping to our system — technique → our asset → gap it closes

We already own most of the loop. The table shows what plugs where. (Repo references from the agentic system.)

| Gold-standard technique | Our existing asset | Documented gap it closes |
|---|---|---|
| Self-critique grounded in **external feedback** (CRITIC) | `migration-reviewer-agent` + `stabilization-agent`, fed by `test-run` real output | Reviewer already grounded in tests — already correct; just needs to *write lessons* |
| **Separate** critic, never same-model self-judgment | Reviewer is a distinct agent in `.claude/agents/` | Avoids the reward-hacking failure mode by construction |
| Episodic→semantic **lesson bank** (ExpeL, Generative Agents) | `docs/50-work-log/` (episodic) → `docs/30-decisions/` + `docs/_meta/memory-templates/lessons-learned.md` (semantic) | #1 no failure-attribution; #4 no incident taxonomy / "mistake recovery" type |
| Auto consolidation of episodes into rules | currently manual via `/rp-memory` | #2 no automatic "test result → memory" loop; #5 reviewer verdict never flows back as a lesson |
| `relevance × recency × importance` ranked retrieval + decay | Graphify graph (`query_graph`) + `MEMORY.md` index | #3 retrieval not ranked — memory loaded whole, no relevance/recency/importance |
| Selective retrieval (context budget) | Graphify already does community-scoped retrieval | partially solved; add scoring + budget cap on top |
| Eval/regression guard | `progress-tracking` (`inventory.json`/`progress.json`), affected-tests gate G3 | no golden-set for the *agent's own* behavior; no self-improvement metrics |
| HITL before memory write | `clarification-protocol` skill; HITL CP-3/CP-5 in `GUARDRAILS.md` | gate exists for code; extend it to lesson-writes |

**Read-out:** our biggest leverage is **closing the write+read loop** (gaps #1–#3, #5). Reflection (§2.1) is *already*
present and correctly grounded — we don't rebuild it, we make it write. The eval guard (§2.4) we build small.

---

## 4. Pragmatic MVP Roadmap — no new infra

Four phases, in the approved order. Each builds on assets we already have; none requires LangGraph/LangMem, fine-tuning,
or a vector store.

### Phase 0 — Eval baseline + metrics *(the guard, built small)*
- **Build:** a tiny golden-set of past agent decisions with known-correct outcomes (e.g. 15–30 cases pulled from
  `docs/50-work-log/` and resolved blockers). Define 3 metrics: **error-recurrence rate** (same mistake reappears),
  **lesson hit-rate** (a stored lesson was retrieved when relevant), **regression rate** (a green behavior turned red).
- **Files:** new `docs/_meta/eval/golden-set.md` (cases) + a thin scorer script in the agentic tooling lane.
- **Done when:** we can run the set and get a baseline number for all three metrics.
- **Risk:** over-engineering. Keep it markdown + a script; do **not** adopt a heavy eval tool. (§2.4 — weak evidence, low investment.)

### Phase 1 — Failure → lesson capture *(the write; keystone)*
- **Build:** when `migration-reviewer-agent` returns `failed_review` or `stabilization-agent` root-causes a failure,
  emit a **structured lesson** using the existing `lessons-learned.md` template: *situation → root cause →
  rule (stated positively) → how to apply*. Source must be **verified external output** (real test/tool result), never
  the model's self-judgment (§2.1 caveat).
- **Files:** `docs/_meta/memory-templates/lessons-learned.md` (template — exists); write target
  `docs/30-decisions/` (rules) and/or a new `docs/55-lessons/` folder for single-incident episodes.
- **Done when:** a failed batch reliably produces one reviewable lesson record with a real failure attached.
- **Risk:** accumulating wrong lessons → **mitigated by HITL gate (Phase below) + Phase 0 metrics**.

### Phase 2 — Ranked retrieval of lessons *(the read)*
- **Build:** score lesson records by `relevance × recency × importance` (importance = LLM-scored 1–10 once at write
  time; recency = decay on last use) layered over Graphify's existing relevance retrieval. Add a **context budget cap**
  so only top-N lessons enter the prompt (selective retrieval, §2.3).
- **Files:** extend the `graphify-query` / `memory-read` skill path; no new store.
- **Done when:** before a batch, the agent surfaces the top relevant lessons (measured by **lesson hit-rate** from Phase 0).
- **Risk:** context bloat → the budget cap is the direct control.

### Phase 3 — Reflection-to-memory upgrade *(close the loop)*
- **Build:** promote the reviewer from a pure gate into a **lesson source** — after grounding in test output, it proposes
  a lesson; auto-consolidate recurring episodes into a semantic rule (Generative Agents synthesis). Every write stays
  behind HITL until confidence is established.
- **Files:** `migration-reviewer-agent.md` (behavior), `clarification-protocol` (write-approval), `GUARDRAILS.md` (new gate).
- **Done when:** error-recurrence rate (Phase 0) drops measurably across runs — the proof of self-learning.
- **Risk:** drift / self-confirmation → HITL on write + periodic consolidation/pruning + contradiction check.

---

## 5. Risks & anti-patterns (and where HITL is mandatory)

| Risk | Why it bites | Mitigation (from the evidence) |
|---|---|---|
| **Same-model self-judgment gating a write** | unaided self-correction degrades output (§1, §2.1) | use the **separate** reviewer grounded in real test output; never self-grade into memory |
| **Accumulating wrong lessons / memory poisoning** | a bad lesson, once stored, is retrieved forever | **HITL before every lesson-write** (MVP); later add confidence scoring + contradiction detection |
| **Self-confirmation loop** | agent retrieves its own past (wrong) lesson and reinforces it | Phase 0 metrics catch error-recurrence; periodic consolidation/pruning |
| **Context bloat** | loading whole memory drowns the signal | ranked retrieval + top-N budget cap (§2.3) |
| **Retroactive memory rewrite (A-MEM style)** | silently changes prior facts | not in MVP; if adopted, gate behind HITL |
| **Over-investing in eval tooling** | weakly-evidenced ROI (§2.4) | keep eval markdown + a script |

> **HITL is mandatory before a memory write** for generalized *rules* (the dangerous, broadly-applied class).
> Single-incident *episodes* (work-log entries) can be auto-written, since they are scoped and low-blast-radius.
> This mirrors our existing CP-3/CP-5 checkpoint philosophy in `GUARDRAILS.md`.

---

## 6. What we are NOT doing now (and the triggers to revisit)

| Deferred | Why deferred | Revisit trigger |
|---|---|---|
| Fine-tuning / RL self-correction (SCoRe) | heavy infra, self-generated RL data; out of scope | only if in-context + external feedback plateaus and we have an ML pipeline |
| Vector store (Qdrant) | keyword + graph + importance ranking suffices at our scale | the existing `_meta/memory-rules.md` thresholds: >200 docs, >50KB index, or reported missed retrievals |
| LangGraph / LangMem migration | decided against (memory note, 2026-06-11); our stack covers the loop | not planned |
| A-MEM retroactive memory evolution | research-grade; rewrite risk | only after HITL write-gating is proven |
| Heavy eval platform (LangSmith/Braintrust) | weak evidence of standard; cost | if our markdown eval can't scale to the case volume |

---

## 7. Sources (primary, dated; verified)

- Self-Refine — arXiv:2303.17651 (Mar 2023)
- Reflexion — arXiv:2303.11366 (NeurIPS 2023)
- CRITIC — arXiv:2305.11738 (May 2023)
- "LLMs Cannot Self-Correct Reasoning Yet" (Huang et al.) — arXiv:2310.01798 (ICLR 2024)
- Critical survey on self-correction — arXiv:2406.01297 (TACL 2024)
- SCoRe (DeepMind) — arXiv:2409.12917 (ICLR 2025)
- ExpeL — arXiv:2308.10144 (AAAI 2024)
- Generative Agents — arXiv:2304.03442 / DOI 10.1145/3586183.3606763 (UIST 2023)
- A-MEM — arXiv:2502.12110 (Feb 2025)
- Mem0 — arXiv:2504.19413 (Apr 2025)
- Voyager — arXiv:2305.16291 (May 2023)

**Verification note:** 23/25 extracted claims confirmed by ≥2 independent primary sources; 2 refuted and excluded
(an overstated "self-correction is consistently ineffective" framing, and Mem0's "26% over OpenAI memory" LOCOMO number).
The eval-driven loop (§2.4) produced **no** surviving primary-source claim — flagged as build-it-ourselves, not a citable standard.
