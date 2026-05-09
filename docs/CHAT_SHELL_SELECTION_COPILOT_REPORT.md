# Chat Shell / Selection Copilot Pass

Branch: `feat/chat-shell-selection-copilot`

## Product Goal

This pass turns the right-side Assistant tab into a clearer Essay Copilot instead of a mixed list of buttons and preview cards. The core split is:

- `Chat`: whole-module conversation. Replies are chat bubbles only and never show Apply controls.
- `Selection`: active sentence or selected range editing. Rewrite/academic/analysis/translation actions return preview cards before Apply.
- `Inspect`: active highlight inspection. The panel shows label, confidence, excerpt, comment, relabel control, and explain action.

## What Changed

- Chat mode now uses a fixed-height shell with a small header, one scrollable message list, and a sticky bottom composer.
- Module-level asks append user and assistant chat messages to `assistantHistory`.
- Selection actions use edit-only previews with `Apply to selection`, `Copy`, `Save as patch`, and `Dismiss`.
- Inspect mode explains only the active highlight/annotation and does not render selection rewrite cards.
- Reference Translation remains preview-only in the Export tab. `Send to Assistant` now appends a copy-only chat message instead of creating an editable preview.
- Patch markers remain visible in the editor, and patch creation/editing remains anchored to the current selection/sentence.

## Schema Separation

Assistant responses are now separated into:

- `chat`: requires only a human-readable `reply`.
- `edit`: requires `proposedText` and `replaceRange`.
- `inspect`: explains or relabels annotation context without replacement fields.

Server-side parsing accepts old provider shapes but normalizes them into one of these kinds. Raw validation details such as `proposedText null`, `replaceRange null`, or Zod path messages are logged server-side or converted to compact fallback messages rather than shown to students.

## Fast Model Defaults

Interactive operations continue to prefer fast DeepSeek configuration:

- `DEEPSEEK_MODEL=deepseek-v4-flash`
- `DEEPSEEK_FAST_MODEL=deepseek-v4-flash`
- `DEEPSEEK_HIGH_QUALITY_MODEL=deepseek-v4-pro`

API keys remain server-only via `DEEPSEEK_API_KEY`; no `NEXT_PUBLIC_` key is used.

## Screenshots

- `docs/chat-pass-assistant-chat-mode.png`
- `docs/chat-pass-selection-mode.png`
- `docs/chat-pass-selection-preview.png`
- `docs/chat-pass-inspect-mode.png`
- `docs/chat-pass-patch-marker.png`
- `docs/chat-pass-compact-surface.png`
- `docs/chat-pass-export-reference-translation.png`

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run smoke`
- `ESSAYCRAFT_FORCE_MOCK_AI=1 npm run test:e2e`

All passed during this pass. The only noted warning is the existing Next.js dev-server cross-origin warning during Playwright runs.

## Remaining Limitations

- Assistant intelligence still depends on provider quality when real DeepSeek is enabled; mock mode is deterministic and useful but limited.
- Source verification/search remains intentionally unimplemented.
- The Copilot can repair and snapshot range edits, but complex overlapping annotation edits are still conservative.
