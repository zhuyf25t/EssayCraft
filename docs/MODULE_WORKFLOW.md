# Module Workflow

## Module 1 — Define the argument

Input: topic.

Output:

- research question
- position
- thesis statement
- possible argument branches

AI should help the user make the thesis clear, concise, and arguable.

## Module 2 — Plan evidence

Input: Module 1.

Output:

- brainstorming / mind map notes
- argument branches
- evidence needs
- source-quality notes
- counterargument possibilities

AI should not invent sources. It can ask for or mark needed evidence.

## Module 3 — Build outline

Input: Module 2.

Output:

- introduction plan
- body paragraph plan
- topic sentences
- evidence slots
- analysis slots
- counterargument
- conclusion plan

## Module 4 — Draft

Input: Module 3.

Output:

- academic paragraphs
- clear metadiscourse and signal devices
- hedging where needed
- formal tone
- thesis-driven structure

## Module 5 — Citation and integrity

Input: Module 4.

Output:

- missing citation flags
- paraphrase warnings
- source/citation notes
- reference-list needs

AI must not invent citations.

## Module 6 — Finish strong

Input: Module 5.

Output:

- editing checklist
- proofreading checklist
- final highlighted export
- completion modal

## Module n → Module n+1

When the user clicks Generate Next:

1. Read the current module.
2. Save a snapshot of the target module.
3. Generate the target module.
4. Overwrite target module.
5. Switch to target module.

## Refresh

Refresh is local to the current module:

1. Send current module segments and patches to AI.
2. AI returns labels/comments only.
3. Frontend recolors text.
4. Text itself must not be rewritten.
