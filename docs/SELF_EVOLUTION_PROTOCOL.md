# Self-Evolution Protocol for Codex

EssayCraft should be treated as a product that Codex must experience, test, and improve, not merely as a checklist of features.

## Loop

When no obvious task remains, Codex must run this loop before stopping:

1. **Re-read intent**
   - `AGENTS.md`
   - `CODEX_AUTONOMOUS_EVOLUTION_PROMPT.md`
   - `docs/ACCEPTANCE_CRITERIA.md`
   - `docs/VISUAL_TARGET.md`
   - `docs/NIGHT_RUN_CHECKLIST.md`
   - reference images

2. **Run the app**
   - `npm install` if needed
   - `npm run dev` if possible
   - use browser or available UI testing tools

3. **Act as a student**
   - Create or edit a topic.
   - Move through Module 1 → Module 6.
   - Verify paragraphs remain paragraphs.
   - Try deleting text, pasting text, selecting text, and adding patches.
   - Use Refresh and Generate Next.
   - Save/restore snapshots.
   - Clear one module and restore it.
   - Try citation-gap checks.
   - Export JSON and import it back.
   - Download HTML from Module 6.
   - Try Translate last.

4. **Identify weakness**
   Ask: what currently feels confusing, fragile, ugly, slow, or unsafe?

5. **Pick a task**
   Create a small internal task and implement it. Examples:
   - paragraph breaks collapse after Generate Next
   - patch box overlaps text
   - progress indicator is unclear
   - citation-needed labels are not visible enough
   - Delete Module has no confirmation
   - JSON import silently fails
   - assistant applies text without preview
   - highlight overlay scroll is out of sync
   - Module 3 outline is generated as one paragraph instead of headings/bullets

6. **Validate**
   Run:
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
   Run tests if they exist. Fix failures.

7. **Commit**
   Commit meaningful milestones.

8. **Repeat**
   Stop only when acceptance criteria pass and the product feels coherent.

## Autonomy boundaries

Codex may make reasonable product decisions when requirements are fuzzy, but must preserve these invariants:

- user text is the source of truth
- no citation hallucination
- no API key exposure
- destructive actions snapshot first
- AI suggestions preview before replacing user text unless the user explicitly clicked Generate Next
- paragraphs must remain readable
- UI should approach the provided mockups

## Final summary

When done, Codex must summarize:

- what it built
- how it tested
- what it changed after self-experience
- commands run and results
- branch/commits
- how to configure `.env.local`
- known limitations
- assurance that no API key was committed
