# EssayCraft AI Assistant Spec

## Role

The AI Assistant is a right-side helper, not the main document authority. It helps the user understand and revise selected text, but destructive edits require preview/apply and snapshot first.

## Inputs

Assistant requests should include:

- topic/project title
- current module number and title
- full current module text
- annotations
- patches
- selected range and selected text if any
- recent assistant messages
- requested action

## Quick actions

- Explain current highlight
- Relabel selected sentence
- Rewrite selected passage
- Make more academic
- Add analysis after evidence
- Find missing citations
- Refresh highlighting
- Translate selected/current module

## Endpoint

`POST /api/assist`

Expected JSON response:

```json
{
  "reply": "Clear human-readable assistant response.",
  "proposedText": "Optional replacement text.",
  "replaceRange": { "start": 0, "end": 20 },
  "annotations": [],
  "warnings": []
}
```

## Safety rules

- Never invent real citations.
- If source needed, say `[citation needed]`.
- If applying proposed text, snapshot before replacing.
- Do not overwrite the whole module unless the user explicitly asked.
