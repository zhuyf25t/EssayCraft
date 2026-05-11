# AI Native Verification

## Configure DeepSeek

Copy `.env.example` to `.env.local` and set:

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_HIGH_QUALITY_MODEL=deepseek-v4-flash
ESSAYCRAFT_REFRESH_TIMEOUT_MS=120000
ESSAYCRAFT_GENERATE_TIMEOUT_MS=120000
ESSAYCRAFT_REFRESH_MAX_TOKENS=32768
ESSAYCRAFT_TRANSLATE_MAX_TOKENS=32768
ESSAYCRAFT_GENERATE_MAX_TOKENS=32768
ESSAYCRAFT_FORCE_MOCK_AI=0
```

Do not use `NEXT_PUBLIC_` for API keys.

## Verify Provider Use

1. Start the app with `npm run dev`.
2. Open the Export tab.
3. Open `AI diagnostics`.
4. Confirm `Provider configured: yes` and `Force mock: off`.
5. Click `Test provider`.
6. A successful result should show `deepseek`, latency, and model metadata.

AI result cards in the Assistant, Refresh, and Translate flows show a compact badge:

- `DeepSeek`: real provider result.
- `Mock`: deterministic mock, only when `ESSAYCRAFT_FORCE_MOCK_AI=1`.
- `AI unavailable`: no semantic output was generated.

## Generate Next Contract Checking

Generate Next uses DeepSeek to produce the next module and to self-check whether the result satisfies the module transition contract. The server validates engineering constraints such as JSON shape, target module number, clean text, citation-safety cleanup, and annotation ranges. It does not decide academic contract satisfaction through local keyword matching in the provider path.

If DeepSeek returns valid JSON but marks `contractCheck.passed` as false, or omits the self-check, EssayCraft asks DeepSeek to repair the same response against the contract once. If the repaired provider response still fails its own contract check, the UI reports `AI unavailable` rather than pretending local keyword logic can judge or rewrite the essay.

## Offline Demo Mode

For deterministic offline demos and e2e tests:

```bash
ESSAYCRAFT_FORCE_MOCK_AI=1
```

Mock mode is labeled. It is not presented as real AI.

## Unavailable Behavior

If no key is configured, the provider times out, or the provider returns invalid schema/output, EssayCraft reports `AI unavailable` and preserves the document. It does not silently rewrite, analyze, translate, annotate, or generate modules with keyword/template logic.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run smoke
ESSAYCRAFT_FORCE_MOCK_AI=1 npm run test:e2e
npm run build
```
