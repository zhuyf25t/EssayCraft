# Implementation Plan

## Phase 1 — Core app shell

- Next.js + TypeScript + Tailwind
- one-page layout
- module sidebar
- toolbar
- localStorage persistence

## Phase 2 — Editor engine

- canonical plain text data model
- annotation ranges over text
- textarea plus synchronized highlight backdrop
- selected range state
- range-anchored patch note keyboard flow

## Phase 3 — AI routes

- `/api/refresh`
- `/api/generate-next`
- `/api/assist`
- `/api/translate`
- Zod validation
- DeepSeek client
- mock fallback

## Phase 4 — Versioning and export

- snapshots before overwrite
- manual snapshots
- restore
- copy rich text
- download HTML/JSON
- Module 6 finish modal

## Phase 5 — QA

- typecheck
- lint
- build
- manual flow review
- API-key leakage check
- no fabricated citation check
