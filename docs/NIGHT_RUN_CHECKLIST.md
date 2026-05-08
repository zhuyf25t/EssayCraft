# EssayCraft Night Run Checklist

## Before coding

- [ ] Run `git status`.
- [ ] Pull latest main.
- [ ] Create/use branch `feat/essaycraft-overnight-mvp`.
- [ ] Read `AGENTS.md` and docs.
- [ ] Inspect whether repo is empty.

## Core build

- [ ] App bootstrapped with Next.js + TypeScript + Tailwind.
- [ ] Smooth editor implemented.
- [ ] Highlight backdrop implemented.
- [ ] Ctrl/Cmd+Enter patch implemented.
- [ ] Refresh API implemented.
- [ ] Generate Next API implemented with module-specific prompts.
- [ ] AI Assistant implemented.
- [ ] Snapshot/restore implemented.
- [ ] Module 6 finish modal implemented.
- [ ] Copy rich text / Download HTML / Download JSON implemented.
- [ ] Local persistence implemented.

## Commit 1

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Commit: `feat: build EssayCraft core workflow MVP`

## Translate

- [ ] Translate UI implemented.
- [ ] `/api/translate` implemented.
- [ ] Preview before apply.
- [ ] Snapshot before apply.

## Commit 2

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Commit: `feat: add bilingual translate workflow`

## Final QA

- [ ] No API keys committed.
- [ ] No hallucinated citations in prompts/mock output.
- [ ] No broken editor deletion.
- [ ] Refresh preserves exact text.
- [ ] Generate Next works 1→2→3→4→5→6.
- [ ] Reload persists state.
