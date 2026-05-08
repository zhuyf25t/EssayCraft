# API Spec

## Environment variables

```bash
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

These variables must be read only in server code. Do not create `NEXT_PUBLIC_DEEPSEEK_API_KEY`.

## POST /api/refresh

Purpose: classify current module segments by rhetorical function.

Request:

```ts
{
  topic: string;
  moduleNumber: 1 | 2 | 3 | 4 | 5 | 6;
  segments: Segment[];
  patches: Patch[];
}
```

Response:

```ts
{
  segments: Array<{
    id: string;
    label: SegmentLabel;
    confidence?: number;
    aiComment?: string;
  }>;
  globalFeedback: string[];
}
```

Constraint: no rewritten text in the response.

## POST /api/generate-next

Purpose: generate the next module from the current module.

Request:

```ts
{
  topic: string;
  sourceModuleNumber: 1 | 2 | 3 | 4 | 5;
  sourceSegments: Segment[];
  sourcePatches: Patch[];
}
```

Response:

```ts
{
  targetModuleNumber: 2 | 3 | 4 | 5 | 6;
  segments: Segment[];
  summary: string;
}
```

Constraint: do not invent citations. Use `[citation needed]` for missing evidence.

## Mock mode

If `DEEPSEEK_API_KEY` is missing, both routes return deterministic mock output so the demo remains usable.
