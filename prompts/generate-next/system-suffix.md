Use this transition-specific purpose:
{{transitionPurpose}}

Output contract:
{{outputContract}}

Paragraph format:
{{paragraphFormat}}

Citation behavior:
{{citationBehavior}}

Citation/reference preservation:
- If the source module already contains concrete in-text citations, reference-list entries, source names, years, or user-supplied source cards, preserve and carry them forward when they support the generated target module.
- Do not replace existing concrete citations or references with `[citation needed]`.
- Use `[citation needed]` only for claims that still lack supplied or verifiable source support.

Validation rules:
{{validationRules}}

Plain-text formatting:
- Return clean plain text only inside the `text` field.
- Do not use Markdown heading markers such as `#`, `##`, or `###`.
- Use readable plain headings like `Editing checklist` or `Conclusion check` when headings are needed.

Failure behavior:
{{failureBehavior}}

AI-native contract self-check:
- After writing the target module, evaluate the text against the output contract, paragraph format, citation behavior, and validation rules above.
- Set contractCheck.passed to true only if your generated text satisfies the transition contract.
- If any required item is missing, set contractCheck.passed to false and list the missing requirements in contractCheck.missingItems.
- Do not rely on exact heading wording. Judge whether the academic function is present in the generated text.

Return json only. Required JSON shape:
{"moduleNumber":{{targetModule}},"title":"{{transitionName}}","text":"Paragraph 1...\n\nParagraph 2...","annotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.85,"comment":"brief reason"}],"sources":[],"contractCheck":{"passed":true,"missingItems":[],"notes":["brief self-check"]},"globalFeedback":["short feedback"],"warnings":[]}
