# API Spec

All AI calls are server-side Next.js route handlers. The browser never calls DeepSeek directly and never receives `DEEPSEEK_API_KEY`.

## Environment Variables

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
```

If `DEEPSEEK_API_KEY` is missing, each route uses deterministic mock output so the demo remains usable. Interactive routes use the fast model/timeout path. If DeepSeek times out or returns an invalid/no-op edit preview, the server returns a deterministic fallback preview and the UI keeps the same preview/Accept flow.

## POST /api/refresh

Purpose: classify existing text ranges. When unresolved inline notes are present, return a revision preview that uses those notes as instructions. The route never directly mutates project state.

Request:

```ts
{
  topic: string;
  projectTitle?: string;
  moduleNumber: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  sources: SourceCard[];
}
```

Response:

```ts
type RefreshResponse =
  | {
      kind: "annotations";
      annotations: Annotation[];
      globalFeedback: string[];
      warnings: string[];
      providerMode: "deepseek" | "mock" | "fallback";
    }
  | {
      kind: "revision";
      sourceText: string;
      proposedText: string;
      annotations: Annotation[];
      proposedAnnotations: Annotation[];
      originalSummary?: string;
      rationale?: string;
      patchResolutionPlan: string[];
      globalFeedback: string[];
      warnings: string[];
      providerMode: "deepseek" | "mock" | "fallback";
    }
  | {
      kind: "moduleReview";
      annotations: Annotation[];
      reviewSummary: string;
      reviewChecklist: Array<{
        label: string;
        status: "ready" | "review" | "issue";
        detail: string;
      }>;
      reviewSuggestions: string[];
      issueCount: number;
      citationGaps?: number;
      inTextCitations?: number;
      realSourceCards?: number;
      referenceStatus?: string;
      nextStep?: string;
      globalFeedback: string[];
      warnings: string[];
      providerMode: "deepseek" | "mock" | "fallback";
    };
```

Constraints:

- With no open notes, refresh is annotation-only and preserves exact text.
- Modules 5 and 6 may return `kind: "moduleReview"` so the client can show a visible citation/final-review card while still preserving exact text.
- Module 6 review checks content, structure, clarity, style, proofreading, citations/references, and conclusion readiness.
- With open notes, refresh returns a preview. The client snapshots and applies only after explicit Accept.
- Reject leaves both text and notes unchanged.
- If provider output is unchanged after a note asks for a change, EssayCraft falls back to deterministic mock revision instead of presenting a no-op as success.
- All input/output text is cleaned with the note-kernel guard so internal note ids, `NOTE` sentinels, and `[object Object]` cannot enter canonical module text.

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
  providerMode: "deepseek" | "mock" | "fallback";
}
```

Constraint: no invented citations or references. Modules 2 and 3 use source-needed planning language. Draft/referencing modules mark missing support with `[citation needed]` and/or `issue`.

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
  mode: "en-to-zh" | "zh-to-en" | "auto-to-zh";
  annotations: Annotation[];
  warnings: string[];
  providerMode: "deepseek" | "mock" | "fallback";
}
```

Translation is preview-only. The route never mutates project state; the Translate modal can create a preview and copy text only. If the student wants translated wording inserted into the essay, use the AI Assistant preview/apply path.
