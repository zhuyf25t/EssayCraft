# Implementation Plan

## Phase 1 — Core app shell

- Next.js + TypeScript + Tailwind
- one-page layout
- module sidebar
- toolbar
- localStorage persistence

## Phase 2 — Editor engine

- segment data model
- colored spans
- contentEditable direct editing
- selected segment state
- patch note keyboard flow

## Phase 3 — AI routes

- `/api/refresh`
- `/api/generate-next`
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
