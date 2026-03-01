# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI Project Sync — an AI-powered tool that syncs code changes from a base project to multiple variant projects using Claude LLM, AST analysis, and semantic code mapping.

## Commands

```bash
# Root (Turbo orchestrated)
pnpm install              # Install all workspace dependencies
npm run build             # Build all packages (dependency-ordered)
npm run test              # Run all tests
npm run lint              # Lint all packages

# AI Engine (core logic, 121 tests)
cd packages/ai-engine
npx jest                           # Run all tests
npx jest __tests__/feedback        # Run specific test directory
npx jest --testPathPattern=mapper  # Run single test file by pattern

# API (NestJS)
cd packages/api
pnpm migration:dev        # Run Prisma migrations
pnpm seed                 # Seed dev data
pnpm test                 # Unit tests
pnpm test:e2e             # E2E tests

# Web (Vite dev server on :8080, proxies /api to :3000)
cd packages/web
pnpm dev
```

## Architecture

```
cli ──→ ai-engine ──→ shared
api ──→ ai-engine ──→ shared
worker ──→ ai-engine ──→ shared
web (standalone, talks to api via HTTP/WebSocket)
vscode-extension (standalone, talks to api via HTTP)
```

**Sync pipeline** flows through 3 async stages (BullMQ queues):
1. `sync:analyze` — extract diff, parse AST, detect mappings/conflicts
2. `sync:generate` — call Claude LLM to generate adapted patches per variant
3. `sync:execute` — apply patches, create branches/PRs

**Review flow**: generated patches go through human review (or auto-approve if trust score + confidence thresholds are met).

## Key Packages

- `shared` — Type definitions: `GeneratedPatch`, `SyncResult`, `ProjectConfig`, `ChangeType`, `RiskLevel`
- `ai-engine` — Core intelligence: AST parsing (TS/JS/Python), code embeddings, 3-pass mapping (exact name → fingerprint → vector similarity), conflict detection/resolution, feedback learning, knowledge graph, quality analysis
- `api` — NestJS backend: JWT auth, project-group/sync/review/git-integration modules, WebSocket gateway, Prometheus metrics at `/metrics`
- `worker` — BullMQ processors with exponential backoff retry (3 attempts), concurrency limits per queue
- `cli` — Commander.js tool: `ai-sync sync --base <path> --variant <path> --commit <hash>`
- `web` — React + Vite dashboard with socket.io-client for real-time sync updates

## Database

Prisma ORM with PostgreSQL. Schema at `packages/api/prisma/schema.prisma` — 10 models: User, ProjectGroup, Project, DiffRegion, CodeMapping, SyncTask, SyncResult, Review, FeedbackHistory, AuditLog.

## Testing

Jest with ts-jest. Tests live in `packages/ai-engine/__tests__/` organized by module. The `moduleNameMapper` in jest.config.js maps `@ai-project-sync/shared` to source for direct TS imports without building.

## Conventions

- Immutable data patterns — always return new objects, never mutate
- NestJS modules are self-contained with DTOs using class-validator
- API routes prefixed with `/api/v1/`
- Webhook endpoints at `/api/v1/webhooks/github` and `/api/v1/webhooks/gitlab` (no auth guard)
- Monitoring stack config in `infra/monitoring/` (Prometheus + Grafana + AlertManager)
