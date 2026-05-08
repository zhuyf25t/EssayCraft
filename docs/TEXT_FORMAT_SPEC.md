# EssayCraft Text Format Specification

This file exists because generated text can easily become messy if the app mixes prose, markdown, HTML, spans, bullets, citations, and annotations in one fragile representation.

EssayCraft must keep **canonical module content as plain text** and keep **formatting/annotations as metadata**.

## Canonical content

Every module stores:

```ts
text: string
annotations: Annotation[]
patches: Patch[]
```

The `text` field is the source of truth. It should be readable if copied into a normal editor. Do not store HTML as the main text. Do not store colored spans inside the text.

## Annotation format

Annotations are ranges over the canonical text:

```ts
type Annotation = {
  id: string;
  start: number;
  end: number;
  text: string;
  label: SegmentLabel;
  confidence?: number;
  comment?: string;
};
```

Rules:

- `start` and `end` are zero-based character offsets in `text`.
- `text.slice(start, end)` must equal or closely match `annotation.text`.
- AI routes must validate and repair offsets when possible.
- If offsets cannot be repaired safely, drop the annotation rather than corrupt the document.
- Refresh Highlighting must preserve `text` exactly.

## Generated output format

AI generation routes should return JSON only:

```json
{
  "moduleNumber": 4,
  "title": "Module 4 Drafting",
  "text": "Paragraph one...\n\nParagraph two...",
  "annotations": [
    {
      "id": "a1",
      "start": 0,
      "end": 14,
      "text": "Paragraph one",
      "label": "background",
      "confidence": 0.86,
      "comment": "Introduces context."
    }
  ],
  "globalFeedback": ["Short practical feedback."],
  "warnings": []
}
```

Never ask the AI to return HTML. Never ask it to return React components. Never ask it to color text directly. The frontend handles colors.

## Module-specific text style

### Module 1: Topic & Question

Use concise planning text, not a full essay. Good format:

```text
Topic: ...

Research question: ...

Working thesis: ...

Possible argument map:
1. ...
2. ...
3. ...
```

### Module 2: Research & Evidence

Use research-plan formatting. Bullets are allowed because this module is planning, not final prose.

```text
Essay question: ...

Working thesis: ...

Argument 1: ...
Evidence needed: ...
Suitable source type: ...
Search keywords: ...
CARS reminder: ...
```

### Module 3: Outline

Use outline formatting with clear headings and bullets. Do not write full body paragraphs yet.

```text
Introduction plan:
- Hook / importance: ...
- Background: ...
- Thesis: ...
- Thesis map: ...

Body paragraph 1:
- Topic sentence: ...
- Evidence: ...
- Analysis: ...
- Link back: ...
```

### Module 4: Drafting

Use paragraph prose. Avoid outline bullets except if a short note is unavoidable. Separate paragraphs with a blank line.

```text
Paragraph 1...

Paragraph 2...

Paragraph 3...
```

### Module 5: Referencing / Citation Check

Preserve the draft as much as possible. Add citation markers and a checklist section after the draft.

```text
Citation-checked draft:
...

Reference checklist:
- In-text citation: ...
- Reference list entry: ...
- Missing details: ...
```

### Module 6: Final Review / Export

Use final essay first, then a clear review checklist.

```text
Final draft:
...

Editing checklist:
- Content: ...
- Structure: ...
- Clarity: ...
- Style: ...

Proofreading checklist:
- Grammar/punctuation: ...
- Formatting: ...
- Citations/references: ...

Conclusion check:
- Rephrased thesis: ...
- So what?: ...
- No major new evidence: ...
```

## Markdown policy

- Allow simple headings and bullet lists in Modules 1, 2, 3, 5, and 6.
- Prefer normal paragraphs in Module 4.
- Do not use markdown tables in generated module text for MVP. Tables are harder to edit in the MVP editor.
- Do not use fenced code blocks in generated essay text.
- Do not use inline HTML.

## Rendering policy

The editor may render headings and bullets visually, but editing must remain normal. If advanced rendering makes editing unstable, prioritize plain text editing and colored highlights.

## Export policy

When exporting:

- Copy Rich Text / Download HTML should convert annotations into background colors.
- Download JSON should preserve full project state.
- Do not export patch notes as if they are essay text; put them in an appendix or separate notes section if included.

## Acceptance criteria

- Refresh does not change the user's text.
- Generate Next produces readable text for the target module.
- Module 4 looks like paragraphs, not a strange bullet dump.
- Module 3 looks like an outline, not a full draft.
- Module 5 does not fabricate references.
- Exported HTML has readable paragraphs and preserved highlights.
