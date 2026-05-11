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
  providerMode?: "deepseek" | "mock" | "unavailable";
  modelUsed?: string;
  latencyMs?: number;
  totalTokens?: number;
  warnings?: string[];
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
  projectTitle?: string;
  moduleNumber: ModuleNumber;
  text: string;
  selectedRange?: TextRange;
  instruction?: string;
  annotations: Annotation[];
  patches: Patch[];
  sources: SourceCard[];
};

export type RefreshResponse = {
  kind?: "annotations" | "revision" | "moduleReview";
  annotations: Annotation[];
  globalFeedback: string[];
  warnings: string[];
  proposedText?: string;
  sourceText?: string;
  proposedAnnotations?: Annotation[];
  originalSummary?: string;
  rationale?: string;
  patchResolutionPlan?: string[];
  reviewSummary?: string;
  reviewChecklist?: Array<{
    label: string;
    status: "ready" | "review" | "issue";
    detail: string;
  }>;
  reviewSuggestions?: string[];
  issueCount?: number;
  citationGaps?: number;
  inTextCitations?: number;
  realSourceCards?: number;
  referenceStatus?: string;
  nextStep?: string;
  providerMode?: "deepseek" | "mock" | "unavailable";
  modelUsed?: string;
  latencyMs?: number;
  totalTokens?: number;
  fallbackReason?: string;
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
  contractCheck?: {
    passed: boolean;
    missingItems: string[];
    notes: string[];
  };
  globalFeedback: string[];
  warnings: string[];
  providerMode: "deepseek" | "mock" | "unavailable";
  modelUsed?: string;
  latencyMs?: number;
  totalTokens?: number;
  fallbackReason?: string;
};

export type AssistRequest = {
  topic: string;
  projectTitle?: string;
  moduleNumber: ModuleNumber;
  moduleTitle: string;
  text: string;
  annotations: Annotation[];
  patches: Patch[];
  sources: SourceCard[];
  selectedRange?: TextRange;
  selectedText?: string;
  selectedPatches?: Patch[];
  action: string;
  history?: AssistantMessage[];
};

type AssistResponseBase = {
  kind: "chat" | "edit" | "inspect";
  reply: string;
  title?: string;
  actionType?: string;
  explanation?: string;
  providerMode?: "deepseek" | "mock" | "unavailable";
  modelUsed?: string;
  latencyMs?: number;
  totalTokens?: number;
  fallbackReason?: string;
  annotations: Annotation[];
  warnings: string[];
};

export type ChatAssistResponse = AssistResponseBase & {
  kind: "chat";
  proposedText?: undefined;
  replaceRange?: undefined;
  originalText?: undefined;
  originalExcerpt?: undefined;
};

export type EditAssistResponse = AssistResponseBase & {
  kind: "edit";
  proposedText: string;
  replaceRange: TextRange;
  originalText?: string;
  originalExcerpt?: string;
};

export type InspectAssistResponse = AssistResponseBase & {
  kind: "inspect";
  proposedText?: undefined;
  replaceRange?: undefined;
  originalText?: undefined;
  originalExcerpt?: string;
};

export type AssistResponse = ChatAssistResponse | EditAssistResponse | InspectAssistResponse;

export type AssistResponseLegacy = {
  kind?: "chat" | "edit" | "inspect";
  reply: string;
  title?: string;
  actionType?: string;
  originalExcerpt?: string;
  explanation?: string;
  providerMode?: "deepseek" | "mock" | "unavailable";
  modelUsed?: string;
  latencyMs?: number;
  totalTokens?: number;
  fallbackReason?: string;
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
  providerMode: "deepseek" | "mock" | "unavailable";
  modelUsed?: string;
  latencyMs?: number;
  totalTokens?: number;
  fallbackReason?: string;
};
