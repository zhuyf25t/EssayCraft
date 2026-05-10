# API Spec

All AI calls are server-side Next.js route handlers. The browser never calls DeepSeek directly and never receives `DEEPSEEK_API_KEY`.

## Provider-First Behavior

EssayCraft is AI-native:

- `ESSAYCRAFT_FORCE_MOCK_AI=1` uses the deterministic mock provider and labels results `mock`.
- Otherwise, if `DEEPSEEK_API_KEY` is configured, routes call DeepSeek.
- Otherwise, routes return `AI unavailable` metadata and do not create semantic keyword/template output.
- Provider timeout, invalid JSON, invalid schema, or no-op semantic output returns unavailable/validation failure. It does not silently turn into local essay writing.

Every AI result includes:

```ts
{
  providerMode: "deepseek" | "mock" | "unavailable";
  modelUsed: string;
  latencyMs: number;
  fallbackReason?: string; // provider issue / unavailable reason, never an API key
}
```

## Environment Variables

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FAST_MODEL=deepseek-v4-pro
DEEPSEEK_HIGH_QUALITY_MODEL=deepseek-v4-pro
ESSAYCRAFT_FORCE_MOCK_AI=0
ESSAYCRAFT_ALLOW_OFFLINE_MOCK=0
ESSAYCRAFT_CHAT_TIMEOUT_MS=60000
ESSAYCRAFT_EDIT_TIMEOUT_MS=60000
ESSAYCRAFT_REFRESH_TIMEOUT_MS=60000
ESSAYCRAFT_TRANSLATE_TIMEOUT_MS=60000
ESSAYCRAFT_GENERATE_TIMEOUT_MS=90000
ESSAYCRAFT_GENERATE_MAX_TOKENS=16384
```

## AI Tasks

Routes use the server task registry in `src/lib/ai/tasks.ts` and router in `src/lib/ai/taskRouter.ts`.

Task ids:

- `chatModule`
- `rewriteSelection`
- `academicRewrite`
- `analyzeSelection`
- `translateSelection`
- `explainHighlight`
- `refreshAnnotations`
- `applyNotesRevision`
- `generateNextModule`
- `citationReview`
- `finalReview`

Engineering validates ranges, schemas, previews, snapshots, and metadata. Semantic writing, analysis, translation, annotation, and generation must come from DeepSeek or explicit mock mode.

## POST /api/refresh

Purpose: classify existing text ranges. When unresolved inline notes are present, return a revision preview that uses those notes as instructions. The route never directly mutates project state.

With no notes, the response is annotation/review output and preserves exact text. With notes, the response is a revision preview; the client snapshots and applies only after explicit Accept.

## POST /api/generate-next

Purpose: generate Module N+1 from Module N using `src/lib/moduleTransitionPrompts.ts`.

If DeepSeek is unavailable and mock mode is not forced, this route returns HTTP 503 with unavailable metadata. It does not overwrite the target module.

## POST /api/assist

Purpose: Chat/Edit/Analyze/Translate/Explain for the current module or selection.

Changing actions return preview data only. The client snapshots and applies only after explicit Accept. Read-only actions never mutate text.

## POST /api/translate

Purpose: preview English-to-Chinese or Chinese-to-English translation for selected text or the current module.

Translation is preview-only. Provider failures return an unavailable message unless mock mode is explicitly forced.

## Diagnostics

`GET /api/diagnostics` returns provider configuration, model names, timeout settings, and the no-silent-fallback note without exposing secrets.

`POST /api/diagnostics/test` sends a tiny server-side provider health check and returns success/failure, latency, model, and provider mode.
