# API Segmentation, Note UX, and Provider Routing Pass

## Summary

This pass focused on integration reliability rather than broad UI redesign. The key fixes are:

- sentence/rhetorical-unit segmentation no longer splits decimals, common abbreviations, initials, URLs, DOIs, or parenthetical citations;
- refresh classification now uses safer sentence-level units and guards against over-labeling full essays as Citation;
- Assist, Refresh, Translate, and Generate Next now use provider-first routing: forced mock, configured provider, or AI unavailable after provider failure;
- task-specific AI timeouts replace the old one-size 2500ms interaction timeout;
- Chat keeps a visible Thinking state while waiting longer for real provider responses;
- inline note editing is more compact and stays in the document flow;
- selections that include notes send clean selected text plus notes separately as AI instructions.

## Segmentation

`src/lib/annotations.ts` now uses `Intl.Segmenter` when available, but validates candidate boundaries before accepting them. The fallback scanner protects:

- decimals such as `33.9` and percentages such as `55.5%`;
- abbreviations such as `e.g.`, `i.e.`, `Dr.`, `Prof.`, `U.S.`, and `U.K.`;
- author initials such as `J. K. Smith`;
- parenthetical citations such as `(Stanford HAI, 2025)`;
- URLs and DOI strings.

Refresh validation rejects unusually broad annotation spans and returns an unavailable/invalid-provider result rather than inventing semantic labels when provider output is unusable.

## Provider Routing

All AI route handlers now follow the same server-side rule:

1. `ESSAYCRAFT_FORCE_MOCK_AI=1` uses deterministic mock output.
2. If a DeepSeek key is configured, the route attempts the provider first.
3. If the provider times out or errors, the route returns `AI unavailable` metadata.
4. If no key is configured, the route returns unavailable unless forced mock is enabled.

Each response can include compact metadata:

- `providerMode`
- `modelUsed`
- `latencyMs`
- `fallbackReason`

The writing surface shows only small DeepSeek/Mock/AI unavailable badges. Raw provider errors and schema details stay out of the main UI.

## Timeouts

New task-specific environment variables:

- `ESSAYCRAFT_CHAT_TIMEOUT_MS=60000`
- `ESSAYCRAFT_EDIT_TIMEOUT_MS=60000`
- `ESSAYCRAFT_REFRESH_TIMEOUT_MS=60000`
- `ESSAYCRAFT_TRANSLATE_TIMEOUT_MS=60000`
- `ESSAYCRAFT_GENERATE_TIMEOUT_MS=90000`

Timeouts now mark provider tasks unavailable instead of silently switching to local semantic output.

## Chat

Streaming was not added in this pass. Chat uses the longer provider timeout and a visible `Thinking...` state while the provider or explicit mock mode is working.

Chat keyboard behavior remains:

- `Enter`: send
- `Ctrl/Cmd+Enter`: send
- `Shift+Enter`: newline

## Note Editor

The note editor remains the existing inline-token editor, but its editing state is now more compact:

- smaller inline amber editor;
- less vertical gap;
- no shadow-heavy popover appearance;
- focused with `preventScroll`;
- autosizes only enough for note content;
- keeps Chinese input visible while typing.

Saved notes still render as inline document annotations and remain separate from canonical `module.text`.

## Selection With Notes

When a user selection visually includes one or more inline notes:

- selected essay text is cleaned so note text is excluded;
- notes inside the selected range are collected separately;
- the Edit panel indicates that notes are included as instructions;
- Rewrite/Academic payloads receive `selectedText` and `selectedPatches` separately;
- Translate ignores notes unless the user explicitly asks otherwise;
- accepted rewrite can resolve the included notes, while rejected rewrite keeps them.

## Screenshots

- `docs/api-pass-decimal-segmentation.png`
- `docs/api-pass-module6-mixed-labels.png`
- `docs/api-pass-chat-contextual-cn.png`
- `docs/api-pass-chat-thinking-or-streaming.png`
- `docs/api-pass-edit-provider-metadata.png`
- `docs/api-pass-note-compact-editor.png`
- `docs/api-pass-selection-with-notes.png`
- `docs/api-pass-refresh-result.png`

## Remaining Limitations

- Chat uses longer-timeout Thinking state, not true token streaming.
- Real provider quality still depends on DeepSeek availability and network latency.
- The inline note editor is compact and stable in current tests, but it is still a custom editor layer rather than a full ProseMirror/TipTap document model.
- Source search and citation verification remain intentionally out of scope.
