# AGENTS.md

Codex entrypoint for this repository.

Before making code changes, read and follow:

1. `docs/agent-harness.md` - shared project rules for all coding agents
2. `docs/architecture.md` - current system architecture
3. `docs/progress.md` - current project status

Use `docs/agent-harness.md` as the single source of truth for project-level agent behavior. When it routes a task to a file under `docs/agent-skills/`, read that file before acting. The old `.cursor/rules/` and `.cursor/skills/` files are historical Cursor-facing references; do not treat them as the primary rule source unless `docs/agent-harness.md` explicitly points to them.
