# Test Plan

## Manual MVP test

1. Start app with no API key.
2. Click Refresh Highlighting; verify mock colors appear.
3. Edit a sentence.
4. Press Enter on sentence; verify patch box opens.
5. Type patch and press Enter; verify it saves.
6. Click Generate Next; verify target module is overwritten and opened.
7. Restore snapshot from snapshot panel.
8. Copy rich text and paste into a rich editor.
9. Download JSON.
10. Go to Module 6 and click Download HTML; verify finish modal with image appears.

## API-key test

1. Add `.env.local` with DeepSeek key.
2. Restart dev server.
3. Refresh a module; verify labels are AI-generated.
4. Generate next module; verify AI text does not invent citations.

## Command checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Security checks

- No `.env.local` committed.
- No `NEXT_PUBLIC_DEEPSEEK_API_KEY`.
- No browser-side OpenAI/DeepSeek client.
- API routes handle parse errors.
