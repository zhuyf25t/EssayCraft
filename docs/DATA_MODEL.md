# Data Model

EssayCraft stores module writing as canonical plain text plus metadata. The editor does not store HTML, rich text fragments, or one editable span per sentence.

```ts
type ModuleNumber = 1 | 2 | 3 | 4 | 5 | 6;

type SegmentLabel =
  | "background"
  | "thesis"
  | "evidence"
  | "analysis"
  | "counterargument"
  | "citation"
  | "conclusion"
  | "issue"
  | "plain";

type Annotation = {
  id: string;
  start: number;
  end: number;
  text: string;
  label: SegmentLabel;
  confidence?: number;
  comment?: string;
  sourceIds?: string[];
};

type Patch = {
  id: string;
  moduleNumber?: ModuleNumber;
  anchorStart: number;
  anchorEnd: number;
  anchorQuote: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  appliedAt?: string;
  status?: "open" | "resolved";
  resolved?: boolean;
  stale?: boolean;
};

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
  placeholder?: boolean;
  createdAt: string;
};

type ModuleDocument = {
  moduleNumber: ModuleNumber;
  title: string;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  snapshots: Snapshot[];
  sources: SourceCard[];
  globalFeedback?: string[];
  updatedAt: string;
};
```

Inline notes use the `Patch` shape. They render as editor tokens, but remain metadata. `module.text` must not contain note ids, sentinel strings, `[object Object]`, or note text unless the student typed that prose directly into the essay.

Project JSON includes `schemaVersion: 1`, six independent module documents, assistant history, timestamps, snapshots, patches, annotations, and source cards. It must never include API keys.
