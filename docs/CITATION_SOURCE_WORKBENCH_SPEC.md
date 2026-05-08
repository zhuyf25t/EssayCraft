# Citation and Source Workbench Spec

EssayCraft should be safe and practical about citations.

## Core rule

Never invent real citations, authors, years, article titles, journal names, DOIs, URLs, or reference entries.

If no source is available, mark the need:

```text
[citation needed]
```

and/or add an `issue` annotation.

In Modules 2 and 3, source needs are planning items. Prefer `source needed` or `[source needed: ...]` language there. Treat `[citation needed]` as a draft/referencing gap mainly in Modules 4 and 5.

## Source card model

```ts
type SourceCard = {
  id: string;
  title?: string;
  authors?: string[];
  year?: string;
  containerTitle?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  sourceType?: "scholarly" | "professional" | "popular" | "social" | "unknown";
  credibilityNotes?: string;
  userNotes?: string;
  verified?: boolean;
  createdAt: string;
};
```

MVP does not need automatic web search. It must allow manual source cards and citation gap marking.

## Citation display

In the editor:

- citation signals can be gray highlight,
- missing citation issues can be red/dashed issue highlight,
- source cards appear in right panel or Module 5 workbench.

## Module 5 behavior

Module 5 is not just a rewrite. It is a citation/source-integrity check:

- Identify evidence/factual claims.
- Preserve existing in-text citations.
- Mark missing citations.
- Check whether each in-text citation has a matching reference-list entry when possible.
- Check whether each reference-list entry appears to be cited in text when possible.
- Create source card placeholders for missing details.
- Explain that sources have two halves: in-text citation and reference list entry.

## Source Needs vs Citation Gaps

- Source needs: planned evidence to search for in Modules 2 and 3.
- Citation gaps: draft claims that need in-text citations in Modules 4 and 5.
- Placeholder source cards are not real sources and cannot insert citations.
- Reference previews are built only from student-supplied source card metadata.

## Future source search

If Codex has time, it may add a source-search placeholder UI. It should not call random web sources unless explicitly implemented and documented. If source lookup is added, prefer metadata APIs later; do not block MVP on this.
