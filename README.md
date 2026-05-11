# EssayCraft

EssayCraft is a local-first AI writing workspace for academic essays. It helps students move through a six-module writing process while keeping the student's own text as the source of truth.

## What EssayCraft Does

EssayCraft supports six course modules:

1. Topic & Question
2. Research & Evidence
3. Outline
4. Drafting
5. Referencing / Citation Check
6. Final Review / Conclusion / Export

The app provides:

- a central writing canvas with paragraph-preserving plain text
- color-coded rhetorical highlights
- Chat and Edit assistant modes
- Rewrite, Academic, Refresh, Analyze, Translate, and Explain actions
- Generate Next module workflow
- citation-gap checking without inventing sources
- snapshots before AI text-changing operations
- full project JSON export/import
- final HTML export

EssayCraft is not a black-box essay generator. The student writes and decides; AI helps review, revise, classify, explain, and generate previews.

## One-Click Local Setup

You need Node.js 20 or newer installed first.

### Windows

Double-click:

```text
setup-windows.bat
```

The script will:

1. install dependencies with `npm install`
2. create `.env.local` from `.env.example` if needed
3. start EssayCraft with `npm run dev`

When the terminal shows a line like this, open that URL:

```text
Local: http://localhost:3000
```

If port 3000 is already busy, Next.js may show a different port such as `http://localhost:3001`.

### macOS

Double-click:

```text
setup-mac.command
```

If macOS blocks it the first time, run:

```bash
chmod +x setup-mac.command
./setup-mac.command
```

Then open the `Local:` URL shown in the terminal.

## Manual Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## AI Provider Setup

Edit `.env.local`:

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_HIGH_QUALITY_MODEL=deepseek-v4-flash

ESSAYCRAFT_FORCE_MOCK_AI=0
ESSAYCRAFT_ALLOW_OFFLINE_MOCK=0
ESSAYCRAFT_DEEPSEEK_THINKING=disabled

ESSAYCRAFT_CHAT_TIMEOUT_MS=60000
ESSAYCRAFT_EDIT_TIMEOUT_MS=60000
ESSAYCRAFT_REFRESH_TIMEOUT_MS=300000
ESSAYCRAFT_TRANSLATE_TIMEOUT_MS=60000
ESSAYCRAFT_GENERATE_TIMEOUT_MS=300000

ESSAYCRAFT_REFRESH_MAX_TOKENS=32768
ESSAYCRAFT_TRANSLATE_MAX_TOKENS=32768
ESSAYCRAFT_GENERATE_MAX_TOKENS=32768
```

Do not commit `.env.local`. API keys must stay server-side only and must never use `NEXT_PUBLIC_`.

Provider behavior:

- If `ESSAYCRAFT_FORCE_MOCK_AI=1`, EssayCraft uses mock mode for offline demos and labels results as Mock.
- If `DEEPSEEK_API_KEY` is configured and force mock is off, Chat, Edit, Refresh, Translate, and Generate Next call DeepSeek.
- If the provider is unavailable, EssayCraft reports AI unavailable instead of silently pretending local keyword logic is AI.

Runtime timeout and max-token defaults live in:

```text
prompts/ai-runtime.json
```

Values in `.env.local` override that file.

## Development Notes

Use:

```bash
npm run dev
```

`npm run dev` starts through `scripts/dev-server.mjs`, uses an isolated `.next-dev` cache, clears it before startup, and writes a workspace lock. This avoids common Next.js dev-cache errors such as:

```text
Cannot find module './331.js'
Cannot find module './611.js'
```

`npm run build` still uses the normal `.next` production build directory.

If a local dev server is already corrupted, stop all `next dev` / `node` processes for this repo and run `npm run dev` again.

## Validation

Run these before release:

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run smoke
ESSAYCRAFT_FORCE_MOCK_AI=1 npm run test:e2e
npm run build
```

## Product Rules

- Store essay text as canonical plain text with `\n\n` paragraph breaks.
- Store highlights as annotation ranges, not inline colored text.
- Preserve paragraph breaks in editing, generation, export, and import.
- Snapshot before AI text-changing operations.
- Keep each module independent.
- Never invent real citations, authors, years, titles, DOIs, URLs, journals, or reference entries.
- Use `[citation needed]` or source cards when source support is missing.
- Normal HTML export excludes temporary notes.
- Full project JSON includes project data, modules, annotations, snapshots, sources, and assistant history, but never API keys.

## Final Export

Module 6 final HTML export uses a clean project filename:

```text
project-title.html
```

Earlier module HTML exports keep module numbers:

```text
project-title-module-3.html
```
