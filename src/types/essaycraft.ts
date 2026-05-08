export type ModuleNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type SegmentLabel =
  | "background"
  | "thesis"
  | "evidence"
  | "analysis"
  | "counterargument"
  | "citation"
  | "conclusion"
  | "issue"
  | "plain";

export type Segment = {
  id: string;
  text: string;
  label: SegmentLabel;
  confidence?: number;
  aiComment?: string;
};

export type Patch = {
  id: string;
  segmentId: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
};

export type Snapshot = {
  id: string;
  createdAt: string;
  reason: string;
  segments: Segment[];
  patches: Patch[];
};

export type ModuleDocument = {
  moduleNumber: ModuleNumber;
  segments: Segment[];
  patches: Patch[];
  snapshots: Snapshot[];
  updatedAt: string;
};

export type Project = {
  id: string;
  title: string;
  topic: string;
  currentModule: ModuleNumber;
  modules: Record<ModuleNumber, ModuleDocument>;
};

export type RefreshRequest = {
  topic: string;
  moduleNumber: ModuleNumber;
  segments: Segment[];
  patches: Patch[];
};

export type RefreshResponse = {
  segments: Array<{
    id: string;
    label: SegmentLabel;
    confidence?: number;
    aiComment?: string;
  }>;
  globalFeedback: string[];
};

export type GenerateNextRequest = {
  topic: string;
  sourceModuleNumber: ModuleNumber;
  sourceSegments: Segment[];
  sourcePatches: Patch[];
};

export type GenerateNextResponse = {
  targetModuleNumber: ModuleNumber;
  segments: Segment[];
  summary: string;
};
