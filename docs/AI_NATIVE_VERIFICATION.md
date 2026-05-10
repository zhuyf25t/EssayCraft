# AI Native Verification

## Configure DeepSeek

Copy `.env.example` to `.env.local` and set:

```bash
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_FAST_MODEL=deepseek-v4-pro
DEEPSEEK_HIGH_QUALITY_MODEL=deepseek-v4-pro
ESSAYCRAFT_GENERATE_MAX_TOKENS=16384
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
