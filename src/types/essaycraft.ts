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

export type Annotation = {
  id: string;
  start: number;
  end: number;
  text: string;
  label: SegmentLabel;
  confidence?: number;
  comment?: string;
  sourceIds?: string[];
};

export type Patch = {
  id: string;
  anchorStart: number;
  anchorEnd: number;
  anchorQuote: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
};

export type SourceCard = {
  id: string;
  title?: string;
  authors?: string[];
  year?: string;
  containerTitle?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  sourceType?: "scholarly" | "professional" | "government" | "popular" | "social" | "unknown";
  cars?: {
    credible?: boolean;
    accurate?: boolean;
    reasonable?: boolean;
    support?: boolean;
  };
  credibilityNotes?: string;
  userNotes?: string;
  verified?: boolean;
  placeholder?: boolean;
  createdAt: string;
};

export type Snapshot = {
  id: string;
  createdAt: string;
  reason: string;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  sources: SourceCard[];
};

export type ModuleDocument = {
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

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type Project = {
  schemaVersion: 1;
  id: string;
  title: string;
  topic: string;
  currentModule: ModuleNumber;
  modules: Record<ModuleNumber, ModuleDocument>;
  assistantHistory: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
};

export type TextRange = {
  start: number;
  end: number;
};

export type RefreshRequest = {
  topic: string;
  moduleNumber: ModuleNumber;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  sources: SourceCard[];
};

export type RefreshResponse = {
  annotations: Annotation[];
  globalFeedback: string[];
  warnings: string[];
};

export type GenerateNextRequest = {
  topic: string;
  sourceModuleNumber: Exclude<ModuleNumber, 6>;
  sourceTitle: string;
  sourceText: string;
  sourceAnnotations: Annotation[];
  sourcePatches: Patch[];
  sourceSources: SourceCard[];
};

export type GenerateNextResponse = {
  moduleNumber: Exclude<ModuleNumber, 1>;
  title: string;
  text: string;
  annotations: Annotation[];
  sources: SourceCard[];
  globalFeedback: string[];
  warnings: string[];
  providerMode: "deepseek" | "mock" | "fallback";
};

export type AssistRequest = {
  topic: string;
  moduleNumber: ModuleNumber;
  moduleTitle: string;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  sources: SourceCard[];
  selectedRange?: TextRange;
  selectedText?: string;
  action: string;
  history?: AssistantMessage[];
};

export type AssistResponse = {
  reply: string;
  proposedText?: string;
  replaceRange?: TextRange;
  originalText?: string;
  annotations: Annotation[];
  warnings: string[];
};

export type TranslateRequest = {
  topic: string;
  moduleNumber: ModuleNumber;
  text: string;
  selectedRange?: TextRange;
  mode: "en-to-zh" | "zh-to-en" | "auto-to-zh";
};

export type TranslateResponse = {
  translatedText: string;
  mode: "en-to-zh" | "zh-to-en" | "auto-to-zh";
  annotations: Annotation[];
  warnings: string[];
  providerMode: "deepseek" | "mock" | "fallback";
};
