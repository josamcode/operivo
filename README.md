# Opervio

A quiet operating environment around powerful AI agents. You talk to **Noor**; she organizes your world into focuses and pages, brings in specialist agents, and tells you only what you personally need to do. The agents do the real work with your browser, files, terminal and Python — and every result is checked before it counts as done.

**Thin Opervio, powerful agents.** Opervio supplies context, memory, tools, UI, files, safety and persistence. Claude Code and Codex do the reasoning.

## Run it

Prerequisites: Node 22+, pnpm, Docker, and at least one AI CLI you are signed in to — [Claude Code](https://docs.claude.com/claude-code) and/or Codex. Python 3 is optional (agents get an isolated environment automatically).

```bash
pnpm install
pnpm db:up          # local Postgres on 127.0.0.1:5434
pnpm db:migrate
pnpm app            # builds the web app and serves everything on http://localhost:4100
```

On Windows, `scripts\start.ps1` does all of the above and leaves Opervio running in the background (`scripts\stop.ps1` stops it).

Development: `pnpm dev` (API on :4100 with reload, Vite on :5173).

Your files live in `~/Opervio` (`workspace/` for agent work, `outputs/`, `browser/` for your signed-in sessions, `python/.venv`). Override with `OPERVIO_HOME`.

## How it works

```
Founder ──► Noor (Claude Code / Codex, Opervio MCP tools)
              │  propose_plan · create/update_page · spawn_agent · set_today · remember …
              ▼
         Task (Postgres) ──► p-queue runtime
              │
              ├─ Task Interpreter   objective, type, complexity, deliverable
              ├─ Context Retriever  only relevant founder facts, memory, outputs, records, repo state
              ├─ Prompt Compiler    Role · Objective · Why · Context · Tools · Instructions ·
              │                     Deliverables · Success criteria · Constraints · Stop conditions
              ├─ Prompt Engineer    low-effort AI pass that sharpens (never solves) the task
              ▼
         Specialist run  (Claude Code / Codex + Opervio MCP + Playwright MCP browser + Python)
              │  live activity, files, records ──► SSE ──► UI
              ▼
         Result Judge  (file checks + low-effort AI verdict) ─► complete / incomplete → focused
                                                                feedback to the same agent /
                                                                needs founder / failed
```

| Path | What lives there |
|---|---|
| `packages/contracts` | Zod contracts shared by server and UI: the UI component registry and page grammar, typed record collections, plan proposals, compiled prompts, judge verdicts, effort |
| `apps/server` | Fastify + Prisma 7 + Pino. Provider adapters (`providers/`), runtime (`runtime/`: queue, runner, prompt compiler, judge, scheduler), Opervio MCP server (`mcp/`), Noor (`noor/`), tools (`tools/`: policy hook, Playwright browser, Python) |
| `apps/web` | React + Vite + Tailwind v4 + shadcn/Base UI + TanStack Router/Query/Table, ECharts, dnd-kit, cmdk. Home command center, Noor panel, dynamic page renderer (`components/registry`), agent drawer + effective-prompt inspector, outputs, settings, setup |

### Dynamic pages
Noor composes pages from a fixed registry — hero, KPIs, metric, sparkline, line, bar, funnel, progress, table, kanban, timeline, calendar, list, agents, activity, decisions, outputs, markdown, filters, tabs — bound to data sources (typed record collections, tasks, agents, outputs, decisions, memory, metrics). Every change is validated with Zod; no HTML, no CSS. The renderer owns the design.

### Safety
Routine work never asks for approval. A Claude Code `PreToolUse` hook routes every shell/file call through `tools/policy.ts`: system-critical destruction and credential reads are blocked; consequential actions (force-push, production deploys, publishing, destructive git/db operations) require your approval unless you gave standing permission in Settings. Secrets are redacted from logs, activity and AI context. The browser uses your own signed-in sessions; agents never handle passwords. The server only answers on `localhost`.

## Tests

```bash
pnpm test        # contracts, server (providers, prompt compiler, judge, artifacts, policy), web renderer
pnpm e2e         # Playwright: setup → Noor plan → pages → agent run → judge → page update
```

The e2e test runs against a throwaway database with a scripted provider that drives the real MCP endpoint — no Claude/Codex quota used.
