# EssayCraft

EssayCraft is an AI-assisted academic essay workflow editor. It guides a student through six modules:

1. Topic & Question
2. Research & Evidence
3. Outline
4. Drafting
5. Referencing / Citation Check
6. Final Review / Conclusion / Export

The project goal is not a black-box essay generator. EssayCraft should help users see, edit, annotate, and improve the structure of academic writing using color-coded rhetorical functions, module-to-module generation, patch notes, snapshots, citation-gap checking, and AI assistant previews.

## Start for Codex

Read:

```text
AGENTS.md
CODEX_AUTONOMOUS_EVOLUTION_PROMPT.md
docs/SELF_EVOLUTION_PROTOCOL.md
docs/ACCEPTANCE_CRITERIA.md
```

Then follow the prompt. Codex should run autonomously, use subagents when available, experience the app like a student, and keep improving until acceptance criteria pass.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Edit `.env.local`:

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_HIGH_QUALITY_MODEL=deepseek-v4-pro
ESSAYCRAFT_ASSIST_TIMEOUT_MS=12000
ESSAYCRAFT_REFRESH_TIMEOUT_MS=10000
ESSAYCRAFT_TRANSLATE_TIMEOUT_MS=10000
ESSAYCRAFT_GENERATE_TIMEOUT_MS=30000
ESSAYCRAFT_FAST_FALLBACK_MS=2500
ESSAYCRAFT_FORCE_MOCK_AI=0
```

Do not commit `.env.local`.

For deterministic demos and tests, set `ESSAYCRAFT_FORCE_MOCK_AI=1`. The app then uses the server-side mock provider even if `.env.local` contains a DeepSeek key.

For MVP interaction testing, Assistant, Refresh Highlighting, and Reference Translation use `DEEPSEEK_FAST_MODEL` by default. When `DEEPSEEK_API_KEY` is configured and `ESSAYCRAFT_FORCE_MOCK_AI` is not `1`, EssayCraft attempts the provider first. Task-specific timeouts control when it falls back locally: assist/chat defaults to 12s, refresh to 10s, translate to 10s, and Generate Next to 30s. Keep `DEEPSEEK_HIGH_QUALITY_MODEL` available for slower quality passes, but do not expose any key through `NEXT_PUBLIC_`.

Next.js dev-server messages such as `Compiled /api/refresh` are normal local compile logs, not EssayCraft product errors. If DeepSeek is unreachable because of proxy/network latency, the server falls back to deterministic local mock behavior after the configured timeout.

Do not run multiple manual Next processes against the same cache directory. Next rewrites server chunks during build/start, which can make an already-running dev server report errors like `Cannot find module './331.js'`. EssayCraft's smoke and e2e scripts isolate their temporary servers with `NEXT_DIST_DIR` (`.next-smoke-*` and `.next-playwright-*`) and restore Next's generated TypeScript references afterward, so validation can run beside a normal dev server. If a dev server is already corrupted, stop it, remove `.next`, and restart `npm run dev`.

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run smoke
npm run test:e2e
npm run build
```

## Important product rules

- Store writing as canonical plain text with paragraph breaks (`\n\n`).
- Store highlights as annotation ranges, not inline colored text.
- Preserve paragraphs in editor, AI generation, copy, HTML export, JSON export/import.
- Snapshot before destructive operations.
- Each module saves independently.
- Clear/Delete Current Module affects only the current module and snapshots first.
- AI must never invent citations. Use `[citation needed]` and source cards.
- API keys stay server-side only.
