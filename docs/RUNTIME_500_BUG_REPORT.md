# Runtime 500 Bug Report

Date: 2026-05-08
Branch: fix/runtime-500-homepage

## Reproduction Steps

Initial user-visible failure:

1. Open `http://localhost:3000`.
2. Browser shows `500: Internal Server Error`.
3. `Invoke-WebRequest http://localhost:3000` returned HTTP 500 while port 3000 was owned by an existing `next start-server.js` process.

Clean reproduction from the requested branch:

```powershell
git checkout feat/product-reset-polish
git checkout -b fix/runtime-500-homepage
Stop-Process <process listening on 3000>
Remove-Item .next -Recurse -Force
npm install
$env:ESSAYCRAFT_FORCE_MOCK_AI='1'
npm run dev
curl.exe -i http://localhost:3000
```

## Terminal Stack Trace / Runtime Log

The stale server that returned HTTP 500 was not attached to a captured log stream. After stopping that process and clearing generated `.next` output, the fresh dev server produced no app stack trace and returned HTTP 200:

```text
> essaycraft-mvp@0.1.0 dev
> next dev

Next.js 15.5.18
- Local:        http://localhost:3000
- Environments: .env.local

Starting...
Ready in 3s
Compiling / ...
Compiled / in 5.7s (645 modules)
GET / 200 in 6315ms
HEAD / 200 in 107ms
```

HTTP proof:

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

## Root Cause

The homepage source did not have a current SSR/runtime crash. The visible 500 came from a stale Next dev process on port 3000 using generated state from a previous run. Clearing `.next` and restarting the dev server from `feat/product-reset-polish` restored `/` to HTTP 200.

This pass adds regression checks so the project fails validation if the homepage cannot render in forced mock mode.

## Fix Summary

- Stopped the stale process on port 3000.
- Cleared generated `.next` output before reproduction.
- Added a runtime smoke script that starts the app with `ESSAYCRAFT_FORCE_MOCK_AI=1`, requests `/`, and requires HTTP 200 plus EssayCraft markup.
- Added a dedicated Playwright homepage regression test that asserts the EssayCraft title and fixed app shell render.
- Captured `docs/runtime-500-homepage-fixed.png` as browser proof.

## Proof After Fix

- `curl.exe -I http://localhost:3000` returned `HTTP/1.1 200 OK`.
- Browser screenshot: `docs/runtime-500-homepage-fixed.png`.
- `npm run smoke` now includes the runtime HTTP check.
