# Reference Translation Tool Spec

## Purpose

Reference Translation is a reading aid. It helps the student understand selected text or the current module in another language. It is not an editing command.

## Rules

- It never modifies module text.
- It never creates snapshots.
- It has no Apply button.
- It preserves paragraph breaks in the preview.
- It supports:
  - English to Simplified Chinese.
  - Simplified Chinese to English.
  - Auto-detect to Simplified Chinese.
- It may translate a selected range or the current module.
- If the student wants translated text inserted into the essay, they must use AI Assistant on a selected range and apply a previewed replacement.

## UI

Toolbar label:

```text
Reference Translation
```

Modal buttons:

```text
Create Preview
Copy translation
Send to Assistant
Close
```

`Send to Assistant` creates a copy-only assistant preview. It does not overwrite the editor.

## Provider Behavior

With a configured server-side provider, `/api/translate` validates the response shape and rejects English-to-Chinese responses that contain too little Chinese or echo too much source English.

Without a provider, the deterministic fallback returns readable Chinese or English preview text and sets provider mode to `fallback`.

## Safety

Project JSON export must never include API keys. The DeepSeek key belongs only in `.env.local` as `DEEPSEEK_API_KEY`. Never expose it through `NEXT_PUBLIC_`.
