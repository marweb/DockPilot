# Contributing to DockPilot

Thank you for your interest in contributing to DockPilot!

## Development Setup

```bash
git clone https://github.com/marweb/DockPilot.git
cd DockPilot
pnpm install
pnpm dev
```

Requirements:
- Node.js 22+
- pnpm 10+
- Docker (for full stack testing)

## Project Structure

- `services/api-gateway` — Authentication, RBAC, notifications, routing
- `services/docker-control` — Docker operations
- `services/tunnel-control` — Cloudflare tunnel management
- `apps/web` — React frontend
- `packages/types` — Shared TypeScript types and Zod schemas
- `infra/` — Docker Compose and deployment configs
- `tests/e2e/` — Playwright end-to-end tests

## Workflow

1. Create a feature branch from `main`
2. Make your changes with tests
3. Run `pnpm lint`, `pnpm build`, and `pnpm test:unit`
4. Submit a pull request with a clear description

## Code Standards

- TypeScript strict mode
- ESLint + Prettier formatting
- Zod schemas for API validation
- Tests for new features and bug fixes

## Security

- Never commit secrets or `.env` files
- Report security issues privately via GitHub Security Advisories
