# Module Prompt Registry README

EssayCraft must keep every `Module N -> Module N+1` generation prompt in a teacher-editable registry.

## Required runtime location

```text
src/lib/moduleTransitionPrompts.ts
```

Optional compatibility alias:

```text
src/lib/modulePromptRegistry.ts
```

## Why this exists

The prompts are part of the academic writing method, not incidental backend code. The product owner and the English teacher may revise this file after discussing the course workflow.

## Required exports

```ts
MODULE_TRANSITION_PROMPTS
getTransitionPrompt(fromModule)
REFRESH_HIGHLIGHTING_PROMPT
ASSISTANT_SYSTEM_PROMPT
TRANSLATE_SYSTEM_PROMPT
TEXT_FORMAT_CONTRACT
```

## Rule for Codex

Do not bury module prompts inside API route files. API routes must import prompt definitions from this registry.

When changing transition behavior, update both:

1. `src/lib/moduleTransitionPrompts.ts`
2. `docs/MODULE_TRANSITION_PROMPTS.md`
