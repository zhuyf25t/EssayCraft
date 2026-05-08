import { NextResponse } from "next/server";
import type { GenerateNextResponse, ModuleNumber, Segment, SegmentLabel } from "@/types/essaycraft";
import { createAiClient, AI_MODEL, hasAiKey } from "@/lib/ai-client";
import { buildGenerateNextMessages } from "@/lib/prompts";
import { generateNextRequestSchema, generateNextResponseSchema } from "@/lib/schemas";
import { segmentsToPlainText } from "@/lib/sentence";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = generateNextRequestSchema.parse(json);

    if (input.sourceModuleNumber >= 6) {
      return NextResponse.json({ error: "Module 6 is the final module. There is no Module 7." }, { status: 400 });
    }

    if (!hasAiKey()) {
      return NextResponse.json(mockGenerate(input.topic, input.sourceModuleNumber, input.sourceSegments));
    }

    const client = createAiClient();
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: buildGenerateNextMessages(input),
      response_format: { type: "json_object" },
      max_tokens: 6000,
      temperature: 0.3
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("AI returned empty content.");

    const parsed = generateNextResponseSchema.parse(JSON.parse(raw));
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function mockGenerate(topic: string, sourceModuleNumber: ModuleNumber, sourceSegments: Segment[]): GenerateNextResponse {
  const targetModuleNumber = Math.min(6, sourceModuleNumber + 1) as ModuleNumber;
  const sourceText = segmentsToPlainText(sourceSegments).slice(0, 900);

  const make = (text: string, label: SegmentLabel, index: number): Segment => ({
    id: `mock-${targetModuleNumber}-${index}`,
    text,
    label,
    confidence: 0.62,
    aiComment: "Mock generation. Add DEEPSEEK_API_KEY to enable AI generation."
  });

  const moduleCopy: Record<ModuleNumber, Segment[]> = {
    1: [],
    2: [
      make(`Planning notes for ${topic}: identify two or three arguable branches and attach one source need to each branch.`, "background", 1),
      make("Argument 1 should state a clear reason that supports the thesis.", "analysis", 2),
      make("Evidence needed: add one scholarly or professional source, then paraphrase it in your own words [citation needed].", "issue", 3),
      make("Counterargument: identify a reasonable opposing view before drafting the essay.", "counterargument", 4)
    ],
    3: [
      make("Introduction: orientate the reader, demonstrate why the topic matters, and end with a clear thesis statement.", "background", 1),
      make("Body paragraph 1: begin with a topic sentence, add evidence, then explain how that evidence supports the thesis.", "analysis", 2),
      make("Body paragraph 2: repeat the topic sentence, evidence, and analysis pattern for the next contributing argument.", "analysis", 3),
      make("Counterargument: present a fair opposing view, then explain why the essay's position remains stronger.", "counterargument", 4),
      make("Conclusion: restate the thesis in new language and show why the argument matters.", "conclusion", 5)
    ],
    4: [
      make("Social media has become a defining feature of modern communication, shaping how people learn, build relationships, and understand public issues.", "background", 1),
      make("This essay argues that a healthier social media balance requires intentional user habits, more responsible platform design, and stronger digital literacy education.", "thesis", 2),
      make("One reason balance is necessary is that unlimited use can intensify distraction, comparison, and emotional pressure among young users [citation needed].", "issue", 3),
      make("This matters because individual self-control alone is difficult when platforms are designed to maximize attention and repeated engagement.", "analysis", 4),
      make("Some critics argue that strict age bans are the safest response to online harms.", "counterargument", 5),
      make("However, a balanced approach is more practical because it preserves social media's educational and social benefits while reducing its risks.", "analysis", 6),
      make("Therefore, the goal should not be to reject social media entirely, but to design healthier conditions for using it.", "conclusion", 7)
    ],
    5: [
      make("Citation review: evidence claims with [citation needed] require a real source before final submission.", "issue", 1),
      make("Do not invent authors, dates, statistics, or DOIs; use only sources the user has provided or verified.", "citation", 2),
      make("Check that every in-text citation has a matching reference-list entry.", "citation", 3),
      make("Check that paraphrases use the user's own sentence structure rather than copying source phrasing.", "analysis", 4)
    ],
    6: [
      make(`Final revision for ${topic}: confirm that the introduction and conclusion clearly present the thesis.`, "thesis", 1),
      make("Check whether each body paragraph has a topic sentence, evidence, and analysis.", "analysis", 2),
      make("Proofread grammar, punctuation, transitions, and citation formatting.", "citation", 3),
      make("When the draft is ready, download or copy the highlighted version for final review.", "conclusion", 4)
    ]
  };

  return {
    targetModuleNumber,
    segments: moduleCopy[targetModuleNumber],
    summary: `Mock generated Module ${targetModuleNumber} from Module ${sourceModuleNumber}. Source preview: ${sourceText}`
  };
}
