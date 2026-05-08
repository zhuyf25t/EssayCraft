# Paragraph and Text Format Spec

## Core decision

EssayCraft must store module writing as canonical plain text plus annotation metadata.

Do not store generated essay text as:

- HTML,
- JSX,
- arrays of colored spans,
- rich text fragments,
- one sentence per editable `contentEditable` span.

## Canonical document model

```ts
type ModuleDocument = {
  moduleNumber: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  snapshots: Snapshot[];
  sources: SourceCard[];
  updatedAt: string;
};
```

Paragraphs are stored with blank lines:

```text
Paragraph one.

Paragraph two.

Paragraph three.
```

The exact separator is `\n\n`.

## Annotation model

```ts
type Annotation = {
  id: string;
  start: number;
  end: number;
  text: string; // exact substring at time of annotation
  label: "background" | "thesis" | "evidence" | "analysis" | "counterargument" | "citation" | "conclusion" | "issue" | "plain";
  confidence?: number;
  comment?: string;
  sourceIds?: string[];
};
```

When text changes, annotations may be invalid. Implement one of these strategies:

1. Best: adjust offsets around edits.
2. Acceptable MVP: keep text, clear stale annotations for edited range and ask user to Refresh.
3. Never silently apply annotations to wrong substrings.

## AI output contract

AI routes must return JSON with canonical text and annotation offsets. Example:

```json
{
  "moduleNumber": 4,
  "title": "Drafting",
  "text": "Paragraph 1...\n\nParagraph 2...\n\nParagraph 3...",
  "annotations": [
    {
      "id": "a1",
      "start": 0,
      "end": 90,
      "text": "Paragraph 1...",
      "label": "background",
      "confidence": 0.88,
      "comment": "Introduces context."
    }
  ],
  "globalFeedback": [],
  "warnings": []
}
```

## Module-specific formatting

- Module 1: concise planning text; short headings allowed.
- Module 2: research/evidence plan; headings and bullets allowed.
- Module 3: outline; headings and bullets expected.
- Module 4: full paragraph prose with blank lines between paragraphs.
- Module 5: citation-checked draft plus reference checklist; preserve draft paragraphs.
- Module 6: final draft plus editing/proofreading/conclusion checklist.

## Rendering

Editor display must preserve:

- line breaks,
- blank lines,
- paragraph spacing,
- indentation/bullets if used,
- highlight colors.

If using textarea + highlight backdrop:

- textarea contains canonical text,
- backdrop renders escaped text with annotations,
- scroll positions sync,
- font metrics match,
- paragraph spacing is stable.

## Export

HTML export converts paragraphs to `<p>` blocks. Consecutive blank lines become separate paragraphs. Highlight ranges become nested/segmented spans inside paragraphs.

JSON export writes canonical project data. JSON import must validate schema and restore all modules.
