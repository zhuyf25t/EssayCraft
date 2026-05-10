# Refresh Review and Analyze Repair

## Scope

This pass made Refresh visibly useful without changing the editor note kernel or module generation prompts.

## Refresh Behavior

- Refresh with no notes now returns and renders a compact result card in the Assistant tab.
- Modules 1-4 show refreshed label counts and a module-specific suggestion.
- Module 5 returns a citation review card with citation gaps, in-text citation count, real source card count, and reference-list status.
- Module 6 returns a final review checklist for content, structure, clarity, style, proofreading, citations/references, and conclusion.
- Refresh still preserves `module.text` exactly when there are no open notes.
- Apply Notes & Refresh still returns a revision preview first. Accept snapshots, applies text, resolves notes, refreshes annotations, and then shows a compact result.

## Explain vs Analyze

- Explain is only for an active highlighted sentence/range. It explains why the current label may apply to the actual sentence.
- Analyze is a separate read-only action for selected or active text. It uses the instruction box and follows the user's language, including Chinese commentary.
- Rewrite and Academic remain the only edit actions that can change text, and they still require Accept/Reject.
- Translate remains read-only in the Edit panel.

## Project Title Context

Refresh and Assistant edit/analyze requests send both the stable topic and the visible `projectTitle`. Fallback rewrite and note application continue to use `projectTitle` for instructions such as `结合 project title`.

## Left Rail and Highlight Key

- Future empty modules use neutral styling instead of red issue styling.
- Real issue status is now more subtle.
- Module icons, spacing, and the lower-left Highlight Key were tightened so the rail fits at 100% zoom.
- The active highlight label still outlines the matching Highlight Key chip.

## Remaining Limitations

- Module review is deterministic/local in mock mode; live provider review can still fall back to local review when unavailable.
- Module 6 review is a practical checklist, not a verified grammar checker or citation verifier.
- Source cards remain manual and unverified unless the student supplies metadata.
