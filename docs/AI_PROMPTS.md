# AI Prompt Design

## Refresh prompt

The refresh prompt must instruct the model to:

- classify each segment
- return JSON only
- preserve every id
- avoid rewriting text
- respect patch notes
- label unsupported evidence as `issue`

## Generate-next prompt

The generate-next prompt must instruct the model to:

- generate target module from source module
- preserve the user's position
- output sentence-level segments
- label segments
- mark missing sources as `[citation needed]`
- avoid fabricated citations

## JSON contract

Use `response_format: { type: "json_object" }` and validate with Zod. If parsing fails, return a safe error to the client.

## Citation safety rule

The model may write:

```text
[citation needed]
```

The model may not write:

```text
Smith (2023) found...
```

unless Smith (2023) appears in the user's provided sources or a trusted future source-search integration.
