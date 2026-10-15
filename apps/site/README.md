# Opervio site

The public landing page for Opervio. A standalone Vite + React 19 + Tailwind v4 app (same stack as `apps/web`),
separate from the local command center so it can be built and hosted as static files.

```bash
pnpm site:dev     # http://localhost:5180
pnpm site:build   # static output in apps/site/dist
pnpm site:e2e     # build + Playwright smoke tests against `vite preview` (http://127.0.0.1:4180)
```

## Structure

| Path | What lives there |
| --- | --- |
| `src/content.ts` | All copy: team roster, nav, setup commands, hero orb position. Every claim maps to something Opervio does today. |
| `src/components/` | One file per section — `Hero`, `Team` (looping carousel), `Workflows`, `HowItWorks`, `Capabilities`, `GetStarted` (+ footer), `Nav` |
| `src/components/mockups.tsx` | Slices of the real Opervio UI rebuilt in HTML (plan card, records board, judge loop, approvals…) |
| `src/assets/img/` | Optimised art as `<name>-<width>.webp`; `src/lib/img.ts` turns a base name into `src`/`srcSet` |
| `e2e/landing.spec.ts` | Smoke tests: links, nav, menus, carousel, steps, copy button, overflow at 320–1920px, images, a11y basics |

## Keeping it honest

- Specialists are hired by Noor per task and named on the spot. Youssef, Hana, Omar and Karim are presented as
  examples; Noor, the Prompt Engineer and the Result Judge are real, fixed roles.
- There is no signup, pricing, hosted version or public download yet. The primary CTA leads to the real setup
  commands from the root README; "Open Opervio" points at `http://localhost:4100`, where a running install lives.
  When a public repository or download exists, point the CTAs at it.
- Record values in the mockups (Nile Dental, Acme Clinic, revenue chart) are illustrative.

## Art

Character and scene art is original, rendered with Z-Image-Turbo (Tongyi-MAI, Apache-2.0) in a shared
"3D animated feature-film" style; prompts are in `art/prompts.json`. Cut-outs were made with `rembg`
(isnet-general-use). Product screenshots come from the real app running the e2e founder flow against a
throwaway database (`apps/web/e2e/start-server.mjs`), so no personal data appears.
