# API Spec

All AI calls are server-side Next.js route handlers. The browser never calls DeepSeek directly and never receives `DEEPSEEK_API_KEY`.

## Environment Variables

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
```

If `DEEPSEEK_API_KEY` is missing, each route uses deterministic mock output so the demo remains usable.

## POST /api/refresh

Purpose: classify existing text ranges without rewriting the user's text.

Request:

```ts
{
  topic: string;
  moduleNumber: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  sources: SourceCard[];
}
```

Response:

```ts
{
  annotations: Annotation[];
  globalFeedback: string[];
  warnings: string[];
}
```

Constraint: `text` is not returned or modified. Annotation offsets are validated against the exact submitted text.

## POST /api/generate-next

Purpose: generate Module N+1 from Module N using `src/lib/moduleTransitionPrompts.ts`.

Request:

```ts
{
  topic: string;
  sourceModuleNumber: 1 | 2 | 3 | 4 | 5;
  sourceTitle: string;
  sourceText: string;
  sourceAnnotations: Annotation[];
  sourcePatches: Patch[];
  sourceSources: SourceCard[];
}
```

Response:

```ts
{
  moduleNumber: 2 | 3 | 4 | 5 | 6;
  title: string;
  text: string;
  annotations: Annotation[];
  sources: SourceCard[];
  globalFeedback: string[];
  warnings: string[];
}
```

Constraint: no invented citations or references. Missing support is marked with `[citation needed]` and/or `issue`.

## POST /api/assist

Purpose: produce preview-only assistant suggestions for selected text or the current module.

Response:

```ts
{
  reply: string;
  proposedText?: string;
  replaceRange?: { start: number; end: number };
  annotations: Annotation[];
  warnings: string[];
}
```

Applying a suggestion is a client action that snapshots first.

## POST /api/translate

Purpose: preview English-to-Chinese or Chinese-to-English translation for selected text or the current module.

Response:

```ts
{
  translatedText: string;
  mode: "en-to-zh" | "zh-to-en";
  annotations: Annotation[];
  warnings: string[];
}
```

Translation never overwrites automatically. Applying snapshots first.
