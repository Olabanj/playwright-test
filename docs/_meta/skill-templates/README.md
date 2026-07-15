# Skill template

Copyable skeleton for a new skill, authored to the contract in [`../skill-rules.md`](../skill-rules.md).

1. Copy `SKILL.md` into `.claude/skills/<name>.md` (single-file project helper). Personal/operator skills live in the user's `~/.claude/skills/<name>/` (folder-style when they ship companions) and are not version-controlled here.
2. Set `name` to the dir/file basename, write the `description` (the sole triggering signal), and fill the `metadata:` block (owner, capability from the taxonomy, status, eval).
3. Fill every required H2 section: Trigger, Inputs, Outputs, Tools & MCPs, Guardrails, Examples, Evaluation (`## Procedure` is optional).
4. Run `npm run lint:skills` from `playwright-e2e/` — it must exit 0 before commit.
