import type {
  Annotation,
  ModuleDocument,
  ModuleNumber,
  Patch,
  Project,
  Snapshot,
  SourceCard
} from "@/types/essaycraft";
import { buildMockAnnotations, normalizeAnnotations, normalizeText } from "@/lib/annotations";
import { id, nowIso } from "@/lib/utils";

export const MODULE_TITLES: Record<ModuleNumber, string> = {
  1: "Topic & Question",
  2: "Research & Evidence",
  3: "Outline",
  4: "Drafting",
  5: "Referencing / Citation Check",
  6: "Final Review / Conclusion / Export"
};

const SAMPLE_TOPIC = "How can we strike a healthier social media balance?";

const SAMPLE_MODULE_1 = `Topic: Social media balance and youth wellbeing

Research question: How can we strike a healthier social media balance?

Working thesis: A healthier social media balance is possible when users build intentional habits, platforms redesign engagement systems, and schools teach stronger digital literacy.
Thesis map:
- Reason 1: Users can build intentional habits that reduce passive scrolling.
- Reason 2: Platforms can redesign engagement systems that intensify comparison and distraction.
- Reason 3: Schools can teach digital literacy so students evaluate social media more critically.`;

const SAMPLE_MODULE_2 = `Research plan for: How can we strike a healthier social media balance?

Working thesis: A healthier social media balance is possible when users build intentional habits, platforms redesign engagement systems, and schools teach stronger digital literacy.

Argument branch 1: Intentional user habits can reduce passive scrolling, distraction, and comparison.
Evidence needed: Scholarly or professional source about anxiety, attention, or sleep [citation needed].
Possible source type: scholarly article / professional report
Search keywords: social media habits; adolescent attention; sleep; anxiety
Source status: source needed

Argument branch 2: Platform design choices shape what users see and how long they stay engaged.
Evidence needed: Source on algorithms, notifications, or engagement design [citation needed].
Possible source type: professional technology report / scholarly article
Search keywords: social media algorithms; engagement design; notifications
Source status: source needed

Argument branch 3: Digital literacy can help students use social media critically rather than passively.
Evidence needed: Education-focused source about digital literacy programs [citation needed].
Possible source type: government report / scholarly article
Search keywords: digital literacy; media education; social media wellbeing
Source status: source needed

Counterargument to investigate: Some people argue that bans or strict limits are necessary to protect young users.

Source notes:
- Add source cards in the Source Workbench. Do not invent citations.`;

const SAMPLE_MODULE_3 = `Introduction
- Hook / context: Social media is now a central part of everyday communication and identity.
- Importance: The problem matters because young users face pressure, comparison, and constant distraction.
- Thesis: A healthier balance requires intentional habits, platform design changes, and stronger digital literacy.

Body paragraph 1
- Topic sentence: Individual habits can reduce the most harmful patterns of use.
- Evidence: Screen-time research or mental health study [citation needed].
- Analysis: Explain how habits such as no-phone study time or app limits reduce passive scrolling.

Body paragraph 2
- Topic sentence: Platforms also have responsibility because their designs shape user behaviour.
- Evidence: Source on algorithms, engagement design, or notifications [citation needed].
- Analysis: Explain why design changes are needed beyond individual self-control.

Counterargument
- Some argue that social media's benefits outweigh the risks.
- Response: Benefits are real, but they do not require constant or unlimited use.

Conclusion
- Restate thesis and explain why balance is more practical than total rejection.`;

function createModule(moduleNumber: ModuleNumber, seedText = ""): ModuleDocument {
  const text = normalizeText(seedText);
  return {
    moduleNumber,
    title: MODULE_TITLES[moduleNumber],
    text,
    annotations: text ? buildMockAnnotations(text) : [],
    patches: [],
    snapshots: [],
    sources: [],
    globalFeedback: [],
    updatedAt: nowIso()
  };
}

export function createInitialProject(): Project {
  const now = nowIso();

  return {
    schemaVersion: 1,
    id: id("project"),
    title: "How can we strike a healthier social media balance?",
    topic: SAMPLE_TOPIC,
    currentModule: 1,
    modules: {
      1: createModule(1, SAMPLE_MODULE_1),
      2: createModule(2, SAMPLE_MODULE_2),
      3: createModule(3, SAMPLE_MODULE_3),
      4: createModule(4),
      5: createModule(5),
      6: createModule(6)
    },
    assistantHistory: [],
    createdAt: now,
    updatedAt: now
  };
}

export function addSnapshot(moduleDoc: ModuleDocument, reason: string): ModuleDocument {
  const snapshot: Snapshot = {
    id: id("snap"),
    createdAt: nowIso(),
    reason,
    text: moduleDoc.text,
    annotations: cloneAnnotations(moduleDoc.annotations),
    patches: clonePatches(moduleDoc.patches),
    sources: cloneSources(moduleDoc.sources)
  };

  return {
    ...moduleDoc,
    snapshots: [snapshot, ...moduleDoc.snapshots].slice(0, 20),
    updatedAt: nowIso()
  };
}

export function restoreSnapshot(moduleDoc: ModuleDocument, snapshot: Snapshot): ModuleDocument {
  return {
    ...moduleDoc,
    text: snapshot.text,
    annotations: cloneAnnotations(snapshot.annotations),
    patches: clonePatches(snapshot.patches),
    sources: cloneSources(snapshot.sources),
    updatedAt: nowIso()
  };
}

export function clearModule(moduleDoc: ModuleDocument): ModuleDocument {
  const withSnapshot = addSnapshot(moduleDoc, "Before clear module");
  return {
    ...withSnapshot,
    text: "",
    annotations: [],
    patches: [],
    globalFeedback: [],
    updatedAt: nowIso()
  };
}

export function replaceModuleContent(
  moduleDoc: ModuleDocument,
  text: string,
  annotations: Annotation[],
  sources: SourceCard[] = moduleDoc.sources
): ModuleDocument {
  const normalized = normalizeText(text);
  return {
    ...moduleDoc,
    text: normalized,
    annotations: normalizeAnnotations(normalized, annotations),
    patches: [],
    sources: cloneSources(sources),
    updatedAt: nowIso()
  };
}

export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== "object") return createInitialProject();
  const maybe = raw as Partial<Project> & {
    modules?: Record<string, Partial<ModuleDocument> & { segments?: Array<{ text?: string; label?: string; aiComment?: string }> }>;
  };

  if (maybe.schemaVersion === 1 && maybe.modules) {
    return normalizeProject(maybe as Project);
  }

  const initial = createInitialProject();
  if (!maybe.modules) return initial;

  const modules = { ...initial.modules };
  for (const moduleNumber of [1, 2, 3, 4, 5, 6] as ModuleNumber[]) {
    const source = maybe.modules[String(moduleNumber)];
    if (!source) continue;

    const text =
      typeof source.text === "string"
        ? normalizeText(source.text)
        : Array.isArray(source.segments)
          ? source.segments.map((segment) => segment.text ?? "").join(" ")
          : "";

    modules[moduleNumber] = {
      ...modules[moduleNumber],
      text,
      annotations: Array.isArray(source.annotations)
        ? normalizeAnnotations(text, source.annotations as Annotation[])
        : buildMockAnnotations(text),
      patches: normalizePatches(source.patches, text),
      snapshots: [],
      sources: Array.isArray(source.sources) ? cloneSources(source.sources as SourceCard[]) : [],
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : nowIso()
    };
  }

  return {
    ...initial,
    id: typeof maybe.id === "string" ? maybe.id : initial.id,
    title: typeof maybe.title === "string" ? maybe.title : initial.title,
    topic: typeof maybe.topic === "string" ? maybe.topic : initial.topic,
    currentModule: isModuleNumber(maybe.currentModule) ? maybe.currentModule : initial.currentModule,
    modules,
    updatedAt: nowIso()
  };
}

export function importProject(raw: unknown): Project {
  if (!raw || typeof raw !== "object") {
    throw new Error("Project JSON must be an object.");
  }
  const maybe = raw as Partial<Project>;
  if (maybe.schemaVersion !== 1) {
    throw new Error("Unsupported or missing EssayCraft schemaVersion.");
  }
  if (!maybe.modules || typeof maybe.modules !== "object") {
    throw new Error("Project JSON is missing the six module documents.");
  }
  for (const moduleNumber of [1, 2, 3, 4, 5, 6] as ModuleNumber[]) {
    const doc = maybe.modules[moduleNumber] ?? maybe.modules[String(moduleNumber) as unknown as ModuleNumber];
    if (!doc || typeof doc.text !== "string") {
      throw new Error(`Module ${moduleNumber} is missing plain text content.`);
    }
  }
  return normalizeProject(maybe as Project);
}

export function normalizeProject(project: Project): Project {
  const initial = createInitialProject();
  const modules = { ...initial.modules };

  for (const moduleNumber of [1, 2, 3, 4, 5, 6] as ModuleNumber[]) {
    const doc = project.modules?.[moduleNumber] ?? project.modules?.[String(moduleNumber) as unknown as ModuleNumber];
    const text = normalizeText(doc?.text ?? "");
    modules[moduleNumber] = {
      moduleNumber,
      title: doc?.title || MODULE_TITLES[moduleNumber],
      text,
      annotations: normalizeAnnotations(text, doc?.annotations ?? []),
      patches: normalizePatches(doc?.patches, text),
      snapshots: Array.isArray(doc?.snapshots) ? normalizeSnapshots(doc.snapshots, text) : [],
      sources: Array.isArray(doc?.sources) ? cloneSources(doc.sources) : [],
      globalFeedback: Array.isArray(doc?.globalFeedback) ? doc.globalFeedback : [],
      updatedAt: typeof doc?.updatedAt === "string" ? doc.updatedAt : nowIso()
    };
  }

  return {
    schemaVersion: 1,
    id: project.id || initial.id,
    title: project.title || initial.title,
    topic: project.topic || initial.topic,
    currentModule: isModuleNumber(project.currentModule) ? project.currentModule : 1,
    modules,
    assistantHistory: Array.isArray(project.assistantHistory) ? project.assistantHistory : [],
    createdAt: project.createdAt || nowIso(),
    updatedAt: project.updatedAt || nowIso()
  };
}

function normalizeSnapshots(snapshots: Snapshot[], fallbackText: string): Snapshot[] {
  return snapshots.slice(0, 20).map((snapshot) => {
    const text = normalizeText(snapshot.text ?? fallbackText);
    return {
      id: snapshot.id || id("snap"),
      createdAt: snapshot.createdAt || nowIso(),
      reason: snapshot.reason || "Snapshot",
      text,
      annotations: normalizeAnnotations(text, snapshot.annotations ?? []),
      patches: normalizePatches(snapshot.patches, text),
      sources: cloneSources(snapshot.sources ?? [])
    };
  });
}

function normalizePatches(patches: unknown, text: string): Patch[] {
  if (!Array.isArray(patches)) return [];
  return patches
    .map((patch) => patch as Partial<Patch>)
    .filter((patch) => typeof patch.text === "string" && patch.text.trim().length > 0)
    .map((patch) => {
      const start = Math.max(0, Math.min(text.length, Number(patch.anchorStart) || 0));
      const end = Math.max(start, Math.min(text.length, Number(patch.anchorEnd) || start));
      return {
        id: patch.id || id("patch"),
        anchorStart: start,
        anchorEnd: end,
        anchorQuote: patch.anchorQuote || text.slice(start, end),
        text: patch.text || "",
        createdAt: patch.createdAt || nowIso(),
        resolved: patch.resolved
      };
    });
}

function cloneAnnotations(annotations: Annotation[]) {
  return annotations.map((annotation) => ({ ...annotation, sourceIds: annotation.sourceIds ? [...annotation.sourceIds] : undefined }));
}

function clonePatches(patches: Patch[]) {
  return patches.map((patch) => ({ ...patch }));
}

function cloneSources(sources: SourceCard[]) {
  return sources.map((source) => ({
    ...source,
    authors: source.authors ? [...source.authors] : undefined,
    cars: source.cars ? { ...source.cars } : undefined
  }));
}

function isModuleNumber(value: unknown): value is ModuleNumber {
  return typeof value === "number" && value >= 1 && value <= 6 && Number.isInteger(value);
}
