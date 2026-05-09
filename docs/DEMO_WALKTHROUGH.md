# EssayCraft 5-Minute Demo Walkthrough

## Setup

For a deterministic demo:

```bash
npm install
$env:ESSAYCRAFT_FORCE_MOCK_AI="1"
npm run dev
```

Open `http://localhost:3000`.

## Script

1. Start in Module 1: Topic & Question.
   - Show the project title and Module 1 text.
   - Point out that the editor stores plain text with paragraph breaks.

2. Generate Module 2.
   - Click `Generate Module 2 from Module 1`.
   - Show that Module 2 opens at the top and becomes a research/source-needs plan.

3. Generate Module 3.
   - Click `Generate Module 3 from Module 2`.
   - Show the paragraph-based outline and `[source needed: ...]` planning markers.

4. Generate Module 4.
   - Click `Generate Module 4 from Module 3`.
   - Show the essay draft with real paragraphs, not outline-label prose.

5. Inspect citation gaps and source cards.
   - Open the Sources tab.
   - Add a real source card manually or create a source need.
   - Emphasize that EssayCraft does not invent or verify sources.

6. Use Assistant on selected text.
   - Select a sentence in the editor.
   - Open the Assistant tab.
   - Show the two modes: `Chat` for module discussion and `Edit` for local sentence/range work.
   - Click a sentence to activate it, or drag-select a passage.
   - Click `Rewrite` or `Make academic`.
   - Show the Accept / Reject / Copy preview.
   - Accept only if desired; accepting snapshots first and changes only the selected range.
   - Show that `Translate` and `Explain highlight` are read-only previews.

7. Use Reference Translation.
   - Open the Export tab -> Reference Translation.
   - Create a preview.
   - Copy or Send to Assistant.
   - Confirm the original module text does not change.

8. Go to Module 6 and export.
   - Generate through Module 5 and Module 6, or switch to Module 6 for the export view.
   - Open the Export tab.
   - Show the final review checklist.
   - Point out `Download full project JSON`, which includes all six modules, annotations, patches, snapshots, sources, and assistant history.
   - Click `Finalize / Export` to show the finish modal.

9. Show patch and highlight assistance.
   - Press Ctrl/Cmd+Enter in the editor to add a patch note.
   - Show the visible inline marker and amber note marker.
   - Explain that notes are metadata, not essay text.
   - Click `Apply Notes & Refresh`.
   - Show the Accept / Reject / Copy revision preview; reject leaves text unchanged, accept snapshots and resolves the notes.
   - Use the toast `Undo` action, or Ctrl/Cmd+Z immediately after accepting, to restore the previous text and notes.
   - Click a highlighted sentence and show the label/explanation inside Copilot Edit mode.

## Talking Points

- EssayCraft is a writing-process workspace, not a black-box essay generator.
- User text is the source of truth.
- AI changes preview before apply.
- Patch notes are anchored metadata and are visible in the editor.
- Highlight explanations are available from the Assistant tab after clicking a highlighted range.
- Manual source cards are student-supplied and not verified by EssayCraft.
- Reference Translation is preview-only.
- No API keys are committed or exposed to the browser.
