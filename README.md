# My Agent

[中文](./README.zh-CN.md) · English

**A personality-first desktop AI companion** — not only a coding harness, but a digital partner with character, memory, and a living world.

> Status: **early public alpha** (`v0.1.0`). APIs and UI will keep moving while we iterate in the open.

## Why this project

Most agents optimize for tools and throughput. My Agent optimizes for **relationship continuity**:

- **Three protagonist slots** — switch who you talk to; only one is active at a time
- **Living world** — day scripts, Moments (life feed), wardrobe / bookshelf, cast summoning
- **Growth** — MUTABLE behavior layer with gated reflection (not a static system prompt skin)
- **Memory that lasts** — structured store + vector recall, citations you can correct
- **Local-first** — SQLite + local vectors; your data stays on your machine
- **Harness you can trust** — Agent Loop, sandbox / permission engine, MCP & Skills

## Highlights

| Area | What you get |
|------|----------------|
| Companion world | Role packs, LifeEngine ticks, Catch-up, Moments, assets, cast summon |
| Agent runtime | Streaming loop, prompt assembly, context compaction, task queue |
| Tools | Files, shell, search, memory, RAG, and more (permission-gated) |
| MCP | Stdio + SSE clients for external servers |
| Skills | Markdown playbooks injected on demand |
| LLM | OpenAI / Anthropic / Gemini / DeepSeek-style providers + failover |
| Safety | read-only / workspace-write / full-access + command classes + approvals |
| UI | Multi-theme desktop chat, companion surfaces, Dev Playground |

## Tech stack

| Layer | Stack |
|-------|--------|
| Shell | Electron |
| Language | TypeScript (main + renderer) |
| UI | React + Tailwind CSS |
| Storage | sql.js (SQLite) + Vectra |
| Core | AsyncGenerator Agent Loop + Runtime |
| Tests | Vitest + Playwright |
| Package | electron-builder |

## Quick start

**Requirements:** Node.js ≥ 20, npm ≥ 10

```bash
git clone https://github.com/Joshuayang228/my-agent.git
cd my-agent
npm install
cp .env.example .env   # add your API keys
npm run dev
```

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev app (Vite + Electron) |
| `npm run test` | Unit tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run package` | Production build + installer |

## Architecture (sketch)

```text
┌────────────────────────────────────────────────────┐
│                   Electron App                     │
│  ┌─────────────┐   IPC / stream    ┌────────────┐  │
│  │  Renderer   │◄────────────────►│ Main       │  │
│  │  React UI   │  AgentStreamEvent │ Node.js    │  │
│  │  Chat /     │                   │ Loop ·     │  │
│  │  Moments /  │                   │ Runtime ·  │  │
│  │  Settings   │                   │ Tools ·    │  │
│  └─────────────┘                   │ Companion  │  │
│                                    │ Memory ·   │  │
│                                    │ Sandbox    │  │
│                                    └────────────┘  │
└────────────────────────────────────────────────────┘
```

Deeper map: [docs/architecture.md](docs/architecture.md) (Chinese technical notes for now).

## Documentation

文档变更会由 `docs:check`、staged 变更影响检查和 GitHub Actions 自动复核；开发者不需要手动维护历史流水账，历史快照统一在 `_archive/`。


We maintain a small **four-dimension** doc system (product / architecture / quality / ledgers) plus **construction contracts** under `docs/requirements/`.

| Doc | Role |
|-----|------|
| [docs/modules/README.md](docs/modules/README.md) | Product modules (companion, memory, permission, runtime) |
| [docs/architecture.md](docs/architecture.md) | System architecture |
| [docs/quality.md](docs/quality.md) | Unit / Eval / E2E gates |
| [docs/requirements/README.md](docs/requirements/README.md) | Construction contracts (large changes) |
| [docs/changelog.md](docs/changelog.md) | User-facing changes |
| [docs/progress.md](docs/progress.md) | Internal progress |
| [docs/wishlist.md](docs/wishlist.md) | Deferred ideas & gaps |
| [docs/deferred/README.md](docs/deferred/README.md) | Feasibility evaluations currently deferred |
| [methodology/README.md](methodology/README.md) | Deep design rationale and methodology |
| [docs/docs-system.md](docs/docs-system.md) | How docs are organized |

> Most long-form docs are currently in **Chinese** (authoring language). English READMEs are the public front door; we will bilingualize more as the repo grows.

## Roadmap (high level)

- Polish companion UX and Pack content
- Strengthen observability & eval coverage
- Continue polishing the unified frontend and companion surfaces
- Native / reliable voice input (deferred — see [docs/deferred/README.md](docs/deferred/README.md))
- Image Moments & multi-universe (out of scope for now)

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)**. Issues and PRs welcome.

For large changes, write a **construction contract** under `docs/requirements/` first (see root `AGENTS.md`).

## License

[MIT](LICENSE) · © [Joshuayang228](https://github.com/Joshuayang228)
