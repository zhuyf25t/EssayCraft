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
- Show a preview modal or side panel.
- Only apply after user clicks `Apply translation`.
- Snapshot before applying.

## Endpoint

`POST /api/translate`

Expected response:

```json
{
  "translatedText": "...",
  "mode": "en-to-zh",
  "annotations": [],
  "warnings": []
}
```
