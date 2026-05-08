# Progress Bar Spec

EssayCraft needs two progress indicators.

## 1. Module progress

At the top of the app, display:

```text
Module 4 of 6: Drafting
✓ 1 ─ ✓ 2 ─ ✓ 3 ─ ④ ─ 5 ─ 6
```

Behavior:

- Completed modules show a checkmark if they contain meaningful content.
- Current module is highlighted.
- Future modules are muted.
- Clicking a step switches modules.
- Module progress must not imply final completion if text is empty.

## 2. Action progress

During AI operations show a clear progress state:

- Refresh Highlighting: `Reading text → Classifying ranges → Updating colors`
- Generate Next: `Saving snapshot → Generating Module N+1 → Validating JSON → Applying module → Refreshing highlights`
- AI Assist: `Preparing context → Drafting suggestion → Waiting for user preview/apply`
- Translate: `Preparing selection → Translating → Preview ready`

MVP can implement this as a small status bar and spinner. Better version can use step chips.

## Visual style

Use soft progress UI matching the mockups: rounded, light, hand-drawn/crayon accent acceptable, not corporate-heavy.
