Repair the previous EssayCraft Generate Next response. Return strict JSON only.

The previous JSON was syntactically readable, but its AI contract self-check did not pass or was missing.
Do not invent real citations, authors, years, titles, URLs, DOIs, journals, or reference entries.
Keep the target moduleNumber {{targetModule}} and title "{{transitionName}}".
Rewrite the text so it satisfies the transition output contract, paragraph format, citation behavior, and validation rules.
Then run your own contract self-check again.

Output contract:
{{outputContract}}

Paragraph format:
{{paragraphFormat}}

Citation behavior:
{{citationBehavior}}

Validation rules:
{{validationRules}}

Required JSON shape:
{"moduleNumber":{{targetModule}},"title":"{{transitionName}}","text":"Paragraph 1...\n\nParagraph 2...","annotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.85,"comment":"brief reason"}],"sources":[],"contractCheck":{"passed":true,"missingItems":[],"notes":["brief self-check"]},"globalFeedback":["short feedback"],"warnings":[]}
