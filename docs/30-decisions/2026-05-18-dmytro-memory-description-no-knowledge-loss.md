---
id: 744cbf0c-7abe-5af7-a9c5-13ba6e122396
name: 2026-05-18-dmytro-memory-description-no-knowledge-loss
description: "Frontmatter descriptions and MEMORY.md entries must never lose knowledge — rewrites and expansions are allowed, but only if all existing terms and meaning are preserved"
metadata:
  type: feedback
  category: decisions
  tags: ["decisions", "memory", "rp-memory", "quality", "description", "knowledge"]
  author: dmytro
  createdAt: 2026-05-18T00:00:00Z
  updatedAt: 2026-05-18T00:00:00Z
  expiresAt: null
---

# Decision: Memory Descriptions Must Never Lose Knowledge

When updating a frontmatter `description` field or a MEMORY.md index entry, the update must **never reduce the quality or completeness** of the existing description.

## Rule

- **Allowed:** expand, reword, merge, clarify — as long as all previous meaning is preserved.
- **Not allowed:** replace a description with one that omits terms, domain concepts, or structural details that were present before.
- **When in doubt:** append to the existing description rather than rewrite it.

## Why

Memory is designed to grow. The AI uses descriptions for retrieval — a term missing from a description is a term the AI cannot find. Losing "KYC/KYB, payments, EOR" from the glossary description or losing "single config with projects[], no 3-lane" from the architecture plan description means those concepts become invisible to retrieval until someone manually restores them.

## How to Apply

Before writing a new description, compare it against the current one (both frontmatter and MEMORY.md). If the new version is missing any term, concept, or structural detail — merge them. The merged description should be a superset of both.

This rule applies to:
- Frontmatter `description:` fields in all `playwright-e2e/docs/` files
- The auto-generated block in `MEMORY.md`
- Any summary or index entry that refers to a memory file
