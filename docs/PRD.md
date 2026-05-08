# EssayCraft PRD

## Product name

EssayCraft

## Product purpose

EssayCraft is a practical academic-writing workflow tool. It helps a student move from topic to final essay through six modules while making the rhetorical function of each sentence visible through colors.

## Problem

Students often struggle with the process behind academic essays:

- unclear thesis
- weak evidence
- evidence without analysis
- unbalanced paragraphs
- missing citations
- conclusion with new information
- revision without a checklist

A normal chatbot hides the writing process. EssayCraft makes the process visible, editable, and reversible.

## MVP principle

The MVP must prove the core engine before visual polish:

- module workflow
- colored rhetorical rendering
- patch notes
- refresh by AI
- generate-next by AI
- safe overwrite with snapshots
- local persistence

No database, no login, no source search, no complex rich-text editor in v1.

## Users

Primary: student writing an argumentative academic essay.

Secondary: teacher, writing center tutor, or course designer who wants students to understand essay structure rather than receive a black-box generated answer.

## Six modules

1. Module 1 — Topic, question, thesis
2. Module 2 — Planning, brainstorming, evidence needs
3. Module 3 — Outline and paragraph structure
4. Module 4 — Drafting and academic language
5. Module 5 — Citation and plagiarism/source-integrity check
6. Module 6 — Editing, proofreading, final export

## MVP acceptance criteria

- User can navigate Module 1–6.
- User can edit colored text directly.
- User can create patch notes with keyboard.
- Refresh sends the full current module to AI and recolors it.
- Refresh does not rewrite text.
- Generate Next overwrites the next module and snapshots the target first.
- Snapshot restore works.
- Highlight Key is always visible.
- DeepSeek key is server-only.
- Mock mode works without key.
- Module 6 save/download shows finish modal with the provided photo and John-Paul Grima credit.
