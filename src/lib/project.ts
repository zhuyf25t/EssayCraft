import type { ModuleDocument, ModuleNumber, Project, Segment, Snapshot } from "@/types/essaycraft";
import { id, nowIso } from "@/lib/utils";
import { splitTextIntoSegments } from "@/lib/sentence";

const SAMPLE_TOPIC = "How can we strike a healthier social media balance?";

const SAMPLE_MODULE_1 = `Topic: How can we strike a healthier social media balance?

Research question: How can individuals, platforms, and schools reduce the harms of social media while preserving its benefits?

Working thesis: A healthier social media balance is possible when users build intentional habits, platforms redesign engagement systems, and schools teach stronger digital literacy.`;

const SAMPLE_MODULE_2 = `Argument branch 1: Excessive social media use can harm mental health and attention.
Evidence needed: Scholarly or professional source about anxiety, depression, attention, or sleep.

Argument branch 2: Social media also provides benefits, including connection, learning, and public participation.
Evidence needed: Source showing positive social or educational uses.

Argument branch 3: The best response is not simply banning social media, but combining user habits, better platform design, and digital literacy.
Evidence needed: Policy discussion or education-focused source.

Counterargument: Some people argue that bans or strict limits are necessary to protect young users.`;

const SAMPLE_MODULE_3 = `Introduction
- Hook / context: Social media is now a central part of everyday communication and identity.
- Importance: The problem matters because young users face pressure, comparison, and constant distraction.
- Thesis: A healthier balance requires intentional habits, platform design changes, and stronger digital literacy.

Body paragraph 1
- Topic sentence: Individual habits can reduce the most harmful patterns of use.
- Evidence: Screen-time research or mental health study.
- Analysis: Explain how habits such as no-phone study time or app limits reduce passive scrolling.

Body paragraph 2
- Topic sentence: Platforms also have responsibility because their designs shape user behaviour.
- Evidence: Source on algorithms, engagement design, or notifications.
- Analysis: Explain why design changes are needed beyond individual self-control.

Counterargument
- Some argue that social media's benefits outweigh the risks.
- Response: Benefits are real, but they do not require constant or unlimited use.

Conclusion
- Restate thesis and explain why balance is more practical than total rejection.`;

function createModule(moduleNumber: ModuleNumber, seedText = ""): ModuleDocument {
  return {
    moduleNumber,
    segments: seedText ? splitTextIntoSegments(seedText) : [],
    patches: [],
    snapshots: [],
    updatedAt: nowIso()
  };
}

export function createInitialProject(): Project {
  return {
    id: id("project"),
    title: "EssayCraft Demo",
    topic: SAMPLE_TOPIC,
    currentModule: 1,
    modules: {
      1: createModule(1, SAMPLE_MODULE_1),
      2: createModule(2, SAMPLE_MODULE_2),
      3: createModule(3, SAMPLE_MODULE_3),
      4: createModule(4),
      5: createModule(5),
      6: createModule(6)
    }
  };
}

export function addSnapshot(moduleDoc: ModuleDocument, reason: string): ModuleDocument {
  const snapshot: Snapshot = {
    id: id("snap"),
    createdAt: nowIso(),
    reason,
    segments: moduleDoc.segments.map((segment) => ({ ...segment })),
    patches: moduleDoc.patches.map((patch) => ({ ...patch }))
  };

  return {
    ...moduleDoc,
    snapshots: [snapshot, ...moduleDoc.snapshots].slice(0, 20),
    updatedAt: nowIso()
  };
}

export function replaceSegments(moduleDoc: ModuleDocument, segments: Segment[]): ModuleDocument {
  return {
    ...moduleDoc,
    segments,
    updatedAt: nowIso()
  };
}
