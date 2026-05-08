# Data Model

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

type Segment = {
  id: string;
  text: string;
  label: SegmentLabel;
  confidence?: number;
  aiComment?: string;
};

type Patch = {
  id: string;
  segmentId: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
};

type Snapshot = {
  id: string;
  createdAt: string;
  reason: string;
  segments: Segment[];
  patches: Patch[];
};

type ModuleDocument = {
  moduleNumber: ModuleNumber;
  segments: Segment[];
  patches: Patch[];
  snapshots: Snapshot[];
  updatedAt: string;
};

type Project = {
  id: string;
  title: string;
  topic: string;
  currentModule: ModuleNumber;
  modules: Record<ModuleNumber, ModuleDocument>;
};
```

The document is segment-first. The AI labels segments; the frontend renders colors. This avoids AI-generated HTML and makes editing/snapshotting easier.
