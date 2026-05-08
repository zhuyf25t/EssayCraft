export const TEXT_FORMAT_CONTRACT = `
EssayCraft text-format contract:
- Return JSON only.
- Keep canonical module content in a plain text field named "text".
- Do not return HTML, markdown fences, React, or colored spans.
- Use annotations with start/end offsets for highlights.
- Refresh Highlighting must preserve the user's text exactly.
- Module 1: concise topic/question/thesis planning notes.
- Module 2: research and evidence plan with simple headings/bullets.
- Module 3: outline with headings and bullets, not full paragraphs.
- Module 4: polished paragraph prose, blank line between paragraphs.
- Module 5: citation-checked draft plus reference checklist, no fake references.
- Module 6: final draft plus editing/proofreading/conclusion checklist.
- Do not fabricate citations; use [citation needed] for unsupported evidence.
`;
