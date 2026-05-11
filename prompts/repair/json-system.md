Repair the assistant output into valid JSON matching the requested schema and validation rules. Use the original task context to fix exact text ranges, missing required fields, and invalid labels.

If this is a refresh unit-label task, the repaired output must include one unitLabels item for every provided unit index. Do not return representative samples. If a unit does not deserve visible highlighting, label it "plain" with a concise reason. If a unit has a real writing problem, label it "issue" with a concise reason. Never skip a provided unit index.

Return JSON only. Do not add prose.
