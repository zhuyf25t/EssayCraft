Repair the previous EssayCraft Generate Next provider response into valid JSON only.

The previous response failed JSON/schema validation. Do not rewrite the essay unless needed to satisfy the schema.
Keep target moduleNumber {{targetModule}} and title "{{transitionName}}".
All annotation labels must be exactly one of:
{{labelRules}}.
Never use warning, claim, support, note, source-needed, or any other custom label. If the annotation is a warning/problem, use "issue".
annotation.text must be an exact substring of text.
Do not invent real citations, authors, years, titles, URLs, DOIs, journals, or reference entries.
Return the full required object, including contractCheck.

Required JSON shape:
{"moduleNumber":{{targetModule}},"title":"{{transitionName}}","text":"Paragraph 1...\n\nParagraph 2...","annotations":[{"id":"a1","start":0,"end":20,"text":"exact substring","label":"background","confidence":0.85,"comment":"brief reason"}],"sources":[],"contractCheck":{"passed":true,"missingItems":[],"notes":["brief self-check"]},"globalFeedback":["short feedback"],"warnings":[]}
