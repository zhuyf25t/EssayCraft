# EssayCraft Translate Spec

Implement after the core workflow is complete, validated, and committed.

## Button

Add `Translate` to toolbar and/or AI Assistant quick actions.

## Modes

- English → Chinese
- Chinese → English
- Bilingual side-by-side

## Behavior

- If text is selected, translate the selected text.
- Otherwise translate the current module.
- Preserve rhetorical labels where possible.
- Do not overwrite original automatically.
- Show a side-by-side preview modal.
- The Translate modal is preview-only. It must never change module text and must never create snapshots.
- Buttons: `Create Preview`, `Copy translation`, `Close`.
- If the user wants translated wording inserted into the essay, use the AI Assistant preview/apply flow. Assistant apply snapshots first.
- Mock English -> Simplified Chinese must show visible, readable Simplified Chinese characters.

## Endpoint

`POST /api/translate`

Expected response:

```json
{
  "translatedText": "...",
  "mode": "en-to-zh",
  "annotations": [],
  "warnings": [],
  "providerMode": "mock"
}
```
