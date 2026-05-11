# EssayCraft AI Prompt Flow

Editable system prompts live in the root `prompts/` directory. User prompts are assembled in `src/lib/prompts.ts`, where EssayCraft chooses a context profile for each task.

## Context Profiles

`/api/assist` no longer sends the full module text for every Edit action.

| Profile | Used by | Context sent |
| --- | --- | --- |
| `chat-full-module` | Chat mode | current module text, selected/active context, annotation summary, open-note summary, source summary, recent chat history |
| `edit-selection` | Rewrite, Academic | selected clean text, surrounding paragraph, notes inside selection, active annotation context, source summary |
| `translation-selection` | Edit-mode Translate | selected clean text, surrounding paragraph, target-language instruction |
| `analysis-selection` | Analyze | selected clean text, surrounding paragraph, instruction, notes/annotation context |
| `highlight-explanation` | Explain | active highlight text, label/comment, surrounding paragraph |

The local Edit `Refresh` button is not an Assist task. It calls `/api/refresh` with the current module text, an expanded complete-sentence range, and the user's local correction.

## Route Map

| Route | Primary prompt files | Notes |
| --- | --- | --- |
| `/api/assist` | `prompts/assist/system.md` | Chat and Edit actions. User prompt is context-profiled. |
| `/api/refresh` | `prompts/refresh/unit-label-system.md` | Global or local annotation refresh. Text is preserved. |
| `/api/refresh` with notes | `prompts/refresh/revision-system.md` | Returns revision preview before text changes. |
| `/api/generate-next` | `prompts/module-transitions/*.md`, `prompts/generate-next/system-suffix.md` | Generates the next course module. |
| `/api/translate` | `prompts/translate/system.md` | Standalone preview-only reference translation. |
| JSON repair | `prompts/repair/json-system.md` | One schema repair attempt for task-router routes. |

## Token Cost Expectations

- Rewrite / Academic / Edit Translate / Analyze / Explain should scale mainly with selected text and surrounding paragraph length.
- Chat scales with the current module because it needs module-level context.
- Global Refresh scales with the current module twice in practice: once as full context and once as segmented units. This preserves whole-essay context while forcing sentence/rhetorical-unit labels.
- Generate Next scales with source module length, transition prompt length, source cards, and annotation output.

For the detailed Chinese editing guide, see `../../prompts/README.zh-CN.md`.

