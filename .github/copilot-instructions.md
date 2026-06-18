# Dynamic Questionnaire Generator — GitHub Copilot Instructions

Dynamic Questionnaire Generator bridges ORKG templates and questionnaires. It dynamically generates interactive surveys from Open Research Knowledge Graph templates and supports export to JSON and fillable PDF, developed within the SciD-QuESt project.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, HeroUI, Tailwind CSS
- **ORKG:** SPARQL endpoint proxies, template fetching, resource autocomplete
- **Questionnaire:** ScidQuest (`@orkg/scidquest`) adapter layer
- **AI:** Vercel AI SDK via `app/api/ai/generate` (OpenRouter, server-side only)
- **Export:** JSON and PDF (`jspdf`, `pdf-lib`, `react-pdf`)

## Key directories

| Path | Purpose |
| ---- | ------- |
| `app/questionnaire/` | Dynamic questionnaire pages by template ID |
| `app/api/orkg/` | ORKG API proxies (resources, SPARQL) |
| `app/api/templates/` | Template list and single-template endpoints |
| `app/api/ai/generate/` | Server-side LLM text generation |
| `components/questionnaire/` | Form UI, field inputs, PDF/JSON export |
| `lib/orkg-templates.ts` | ORKG template fetching and preprocessing |
| `lib/orkg-to-scidquest-adapter.ts` | ORKG → ScidQuest questionnaire mapping |

## Issue creation guidelines

When creating or expanding GitHub issues from a user's rough description:

1. **Pick the right template:** bug, feature, docs, or refactor (see `.github/ISSUE_TEMPLATE/`).
2. **Stay concise:** Aim for ~125 words total unless the user provided extensive detail. Focused issues work better for AI agents.
3. **Do not invent facts:** Mark unknown environment details, versions, or reproduction steps as `TBD` or ask the user.
4. **Include acceptance criteria** for features and refactors.
5. **Name affected areas:** frontend, API routes, ORKG/SPARQL, questionnaire/ScidQuest, PDF export, AI, template preprocessing, ORKG Sandbox.
6. **Suggest labels** matching template defaults: `bug`, `enhancement`, `documentation`, `refactor`, `triage`.

### Bug reports must include

- Summary, steps to reproduce, expected vs actual behavior
- Area dropdown value and environment when known
- Reference relevant files only when confident (e.g. `components/questionnaire/questionnaire-export-pdf.ts`)

### Feature requests must include

- Problem/motivation, proposed solution, acceptance criteria checklist

## Branch and commit conventions

- Branches: `<type>/<short-description>` — e.g. `bugfix/pdf-nested-template`, `feature/csv-export`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

## Development commands

```sh
npm install
npm run dev              # Next.js dev server
npm run build            # production build
npm run lint             # ESLint
npm run issue:enhance    # expand rough issue text with AI (see CONTRIBUTING.md)
```

## Coding standards

- Smallest correct change; match surrounding patterns
- AI calls go through `app/api/ai/generate` — no client-side API keys
- ORKG credentials for sandbox submission are user-supplied via the in-app modal
- Never commit secrets (`.env.local`, API keys)

## Domain notes (ORKG / questionnaires)

- Templates come from ORKG; nested templates must be handled recursively
- Questionnaire fields map from ORKG properties via the ScidQuest adapter
- Export formats: JSON (structured answers) and fillable PDF forms

When assigned an issue, read linked files, run relevant lint, and keep PR scope aligned with the issue acceptance criteria.
