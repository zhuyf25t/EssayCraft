# Test Plan

## Manual MVP test

1. Start app with no API key.
2. Click Refresh Highlighting; verify mock colors appear.
3. Edit a sentence.
4. Press Ctrl/Cmd+Enter on a sentence or selection; verify patch box opens.
5. Type patch and press Ctrl/Cmd+Enter; verify it saves. Shift+Enter should create a newline.
6. Click Generate Next; verify target module is overwritten and opened.
7. Restore snapshot from snapshot panel.
8. Copy rich text and paste into a rich editor.
9. Download JSON.
10. Go to Module 6 and click Download HTML; verify finish modal with image appears.
11. Generate Module 4 from a Module 3 outline and verify the result is real essay prose, not a draft about `Introduction plan` or `Topic sentence`.
12. Open Translate, create English -> Chinese preview, copy it, close it, and verify the editor text and snapshots did not change.

## API-key test

1. Add `.env.local` with DeepSeek key.
2. Restart dev server.
3. Refresh a module; verify labels are AI-generated.
4. Generate next module; verify AI text does not invent citations.

## Command checks

```bash
npm run typecheck
npm run lint
npm run test
npm run smoke
npm run test:e2e
npm run build
```

`npm run test:e2e` starts a local Next dev server on port 3210 by default with `ESSAYCRAFT_FORCE_MOCK_AI=1`, so browser smoke tests do not wait for a configured provider key. Override with `PLAYWRIGHT_PORT` if that port is occupied.

Regression coverage includes:

- Module 1 -> 2 source-needs planning.
- Module 2 -> 3 branch-specific outline generation.
- Module 3 -> 4 draft prose without outline-template phrases.
- Fallback annotation labels for structured module text.
- Source needs vs citation gaps.
- Translate preview-only semantics.

## Security checks

- No `.env.local` committed.
- No `NEXT_PUBLIC_DEEPSEEK_API_KEY`.
- No browser-side OpenAI/DeepSeek client.
- API routes handle parse errors.
