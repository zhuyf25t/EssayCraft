import { expect, test } from "@playwright/test";
import * as h from "./helpers";

test.beforeEach(h.setupPage);

test("generate-next API returns valid mock response shape", async ({ request }) => {
  const response = await request.post("/api/generate-next", {
    data: {
      topic: "AI study tools",
      sourceModuleNumber: 2,
      sourceTitle: "Research & Evidence",
      sourceText: `Research plan for: AI study tools

Argument branch 1: guided feedback can improve revision
Evidence needed: classroom writing source

Argument branch 2: students need boundaries to avoid outsourcing thinking
Evidence needed: academic integrity source`,
      sourceAnnotations: [],
      sourcePatches: [],
      sourceSources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.moduleNumber).toBe(3);
  expect(body.providerMode).toBe("mock");
  expect(body.text).toContain("Introduction plan");
  expect(body.text).toContain("Body paragraph 1");
  expect(body.text).toContain("Evidence to use");
  expect(body.text).toMatch(/\[source needed(?::[^\]]*)?\]/);
  expect(body.text.length).toBeGreaterThan(50);
  expect(Array.isArray(body.annotations)).toBe(true);
  expect(Array.isArray(body.sources)).toBe(true);
  expect(Array.isArray(body.globalFeedback)).toBe(true);
  expect(Array.isArray(body.warnings)).toBe(true);
  for (const annotation of body.annotations) {
    expect(annotation.start).toBeGreaterThanOrEqual(0);
    expect(annotation.end).toBeGreaterThan(annotation.start);
    expect(annotation.end).toBeLessThanOrEqual(body.text.length);
    expect(body.text.slice(annotation.start, annotation.end)).toBe(annotation.text);
  }
});

test("diagnostics API exposes provider metadata without secrets", async ({ request }) => {
  const response = await request.get("/api/diagnostics");

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(typeof body.providerConfigured).toBe("boolean");
  expect(typeof body.forceMock).toBe("boolean");
  expect(typeof body.model).toBe("string");
  expect(typeof body.fastModel).toBe("string");
  expect(typeof body.highQualityModel).toBe("string");
  expect(typeof body.interactiveTimeoutMs).toBe("number");
  expect(body.assistTimeoutMs).toBeGreaterThan(2500);
  expect(body.refreshTimeoutMs).toBeGreaterThan(2500);
  expect(body.translateTimeoutMs).toBeGreaterThan(2500);
  expect(body.generateTimeoutMs).toBeGreaterThanOrEqual(30000);
  expect(typeof body.baseUrlConfigured).toBe("boolean");
  expect(JSON.stringify(body)).not.toMatch(/DEEPSEEK_API_KEY|NEXT_PUBLIC|api[_-]?key|sk-[A-Za-z0-9]/i);
});

test("refresh API mock visibly revises naturalness notes", async ({ request }) => {
  const sourceText = "Research question: How can we strike a healthier social media balance?";
  const response = await request.post("/api/refresh", {
    data: {
      topic: "Social media balance",
      moduleNumber: 1,
      text: sourceText,
      annotations: [],
      patches: [{
        id: "patch-natural",
        moduleNumber: 1,
        anchorStart: 0,
        anchorEnd: sourceText.length,
        anchorQuote: sourceText,
        text: "让它更自然一点，也更有研究感。",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "open",
        resolved: false,
        stale: false
      }],
      sources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("revision");
  expect(body.proposedText).not.toBe(sourceText);
  expect(body.proposedText).toContain("individuals, schools, and social media platforms");
  expect(JSON.stringify(body)).not.toMatch(/DeepSeek|debug|AI returned|no API key/i);
});

test("assist API mock uses Project Title for Chinese rewrite instructions", async ({ request }) => {
  const selected = "Research question: How can social media be healthier?";
  const response = await request.post("/api/assist", {
    data: {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 1,
      moduleTitle: "Topic & Question",
      text: selected,
      annotations: [],
      patches: [],
      sources: [],
      selectedRange: { start: 0, end: selected.length },
      selectedText: selected,
      action: "根据我的 title 重写，可以把问题写得更长一点",
      history: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("edit");
  expect(body.proposedText).toContain("Research question:");
  expect(body.proposedText).toMatch(/technolog|human/i);
  expect(body.proposedText).not.toBe(selected);
  expect(body.proposedText.length).toBeGreaterThan(selected.length);
  expect(body.proposedText).not.toMatch(/A more academic version could state|Here is a revised version|The student should|In this context/i);
});

test("refresh API mock uses Project Title without inserting note text", async ({ request }) => {
  const text = "Topic: Social media balance\n\nResearch question: How can social media be healthier?";
  const response = await request.post("/api/refresh", {
    data: {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 1,
      text,
      annotations: [],
      patches: [{
        id: "patch-title",
        moduleNumber: 1,
        anchorStart: 0,
        anchorEnd: "Topic: Social media balance".length,
        anchorQuote: "Topic: Social media balance",
        text: "根据我的 title 重写这个 topic",
        createdAt: "2026-05-10T00:00:00.000Z",
        status: "open",
        resolved: false
      }],
      sources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("revision");
  expect(body.sourceText).toBe(text);
  expect(body.proposedText).toContain("Topic: Technology vs. Humanity");
  expect(body.proposedText).not.toContain("根据我的 title");
  expect(body.proposedText).not.toMatch(h.NOTE_LEAK_RE);
});

test("refresh API mock returns Module 6 final review without rewriting text", async ({ request }) => {
  const text = `Technology should serve humanity by protecting human agency.

The essay argues that schools, designers, and users share responsibility for ethical technology use.

One evidence claim still needs source support [citation needed].

Overall, the conclusion should return to the thesis and explain why the issue matters.`;
  const response = await request.post("/api/refresh", {
    data: {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 6,
      text,
      annotations: [],
      patches: [],
      sources: []
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.kind).toBe("moduleReview");
  expect(body.proposedText).toBeUndefined();
  expect(body.reviewSummary).toContain("argumentative direction");
  for (const label of ["Content", "Structure", "Clarity", "Style", "Proofreading", "Citations / References", "Conclusion"]) {
    expect(JSON.stringify(body.reviewChecklist)).toContain(label);
  }
  expect(body.citationGaps).toBeGreaterThanOrEqual(1);
});

test("assist API mock separates Explain and Analyze as read-only inspect responses", async ({ request }) => {
  const text = "Technology has always changed the way human beings live.";
  const explain = await request.post("/api/assist", {
    data: {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 6,
      moduleTitle: "Final Review / Conclusion / Export",
      text,
      annotations: [{ id: "ann-cite", start: 0, end: text.length, text, label: "citation", confidence: 0.8, comment: "May need support." }],
      patches: [],
      sources: [],
      selectedRange: { start: 0, end: text.length },
      selectedText: text,
      action: "Explain this highlight",
      history: []
    }
  });
  expect(explain.status()).toBe(200);
  const explainBody = await explain.json();
  expect(explainBody.kind).toBe("inspect");
  expect(explainBody.actionType).toBe("highlight-explanation");
  expect(explainBody.reply).toContain("Technology has always changed");
  expect(explainBody.reply).toMatch(/Citation|source|citation/i);
  expect(explainBody.reply).toMatch(/source cards|source-support/i);
  expect(explainBody.proposedText).toBeUndefined();

  const analyze = await request.post("/api/assist", {
    data: {
      topic: "Technology vs. Humanity.",
      projectTitle: "Technology vs. Humanity.",
      moduleNumber: 6,
      moduleTitle: "Final Review / Conclusion / Export",
      text,
      annotations: [],
      patches: [],
      sources: [],
      selectedRange: { start: 0, end: text.length },
      selectedText: text,
      action: "Analyze selected text: 你评价一下这句话。用中文。",
      history: []
    }
  });
  expect(analyze.status()).toBe(200);
  const analyzeBody = await analyze.json();
  expect(analyzeBody.kind).toBe("inspect");
  expect(analyzeBody.actionType).toBe("analyze-selection");
  expect(analyzeBody.reply).toMatch(/这句话|建议/);
  expect(analyzeBody.reply).toMatch(/Technology vs\. Humanity|human agency|human judgment/);
  expect(analyzeBody.proposedText).toBeUndefined();
});
