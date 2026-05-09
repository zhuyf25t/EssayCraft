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
   - Click `Rewrite selected passage` or `Strengthen analysis`.
   - Show the preview card.
   - Apply only if desired; applying snapshots first.

7. Use Reference Translation.
   - Open More tools -> Reference Translation.
   - Create a preview.
   - Copy or Send to Assistant.
   - Confirm the original module text does not change.

8. Go to Module 6 and export.
   - Generate through Module 5 and Module 6, or switch to Module 6 for the export view.
   - Open the Export tab.
   - Show the final review checklist.
   - Click `Finalize / Export` to show the finish modal.

## Talking Points

- EssayCraft is a writing-process workspace, not a black-box essay generator.
- User text is the source of truth.
- AI changes preview before apply.
- Manual source cards are student-supplied and not verified by EssayCraft.
- Reference Translation is preview-only.
- No API keys are committed or exposed to the browser.
