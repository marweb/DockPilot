# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.8] - 2026-07-08

### Added

- Internal API secret (`INTERNAL_API_SECRET`) for secured service-to-service event pipeline
- Audit log API exposed at `/api/audit/logs`
- Dashboard wired with real data: StatsOverview, ResourceChart, ActivityFeed
- CONTRIBUTING.md and CODE_OF_CONDUCT.md
- ESLint 10 flat config

### Changed

- Upgraded to Fastify 5, React 19, Vite 8, Tailwind 4, Zod 4, TanStack Query 5
- Node.js 22 and pnpm 10 in Docker images and CI
- Notification rules/history restricted to admin users
- CI builds all 4 Docker images and typechecks frontend

### Security

- Fixed internal events endpoint authentication bypass
- Propagated `MASTER_KEY` to api-gateway and tunnel-control
- Cloudflare credentials encrypted at rest with migration for plain-text files
- Removed unauthenticated legacy WebSocket routes from docker-control
- Removed `privileged: true` from docker-control in production compose

### Fixed

- `docker-compose.dev.yml` build context paths
- Chinese i18n translation errors
- Footer documentation/support links
- Test suite updated for notification channels API response shape

## [2.0.0] - 2024-02-15

### Added

- Automatic event notification system
- 30+ notification events across 5 categories
- Event-channel mapping matrix UI
- Notification history and tracking
- Cooldown periods for deduplication
- Retry mechanism with exponential backoff
- Severity-based filtering (info/warning/critical)
- Event dispatcher with async processing

### Changed

- Enhanced Settings page with Events tab
- Updated notification channels with event support
- Improved error handling in notification service

### Security

- Added security event notifications
- Brute force attack detection
- Unauthorized access alerts

## [1.0.0] - 2024-01-XX

### Added

- Initial release
- Container management (create, start, stop, delete)
- Image management
- Volume and network management
- Docker Compose support
- Repository deployment
- Webhook integration
- RBAC authentication
- Audit logging
