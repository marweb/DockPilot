# Deployment Guide

This guide covers production deployment options for DockPilot.

## Quick start (Docker Compose)

The recommended production path is the one-liner installer or Docker Compose:

```bash
curl -fsSL https://raw.githubusercontent.com/marweb/DockPilot/main/scripts/install.sh | bash
```

Or manually:

```bash
cp infra/.env.example infra/.env
# Edit infra/.env — set JWT_SECRET, MASTER_KEY, INTERNAL_API_SECRET
docker compose -f infra/docker-compose.yml up --build -d
```

Access the UI at `http://localhost:3000` (or your configured `PUBLIC_URL`).

## Required secrets

| Variable | Services | Purpose |
|----------|----------|---------|
| `JWT_SECRET` | api-gateway | Signs user JWT tokens |
| `MASTER_KEY` | api-gateway, docker-control, tunnel-control | Encrypts credentials at rest |
| `INTERNAL_API_SECRET` | api-gateway, docker-control | Authenticates internal event pipeline |

Generate strong values:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # MASTER_KEY
openssl rand -hex 32   # INTERNAL_API_SECRET
```

See [Configuration Guide](./guides/configuration.md) for all options.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  web (nginx)│────▶│  api-gateway │────▶│ docker-control  │
│  :3000      │     │  :4000       │     │ :4001           │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                           └────────────▶ tunnel-control :4002
```

- **web**: React SPA served by nginx
- **api-gateway**: Auth, RBAC, notifications, system settings, reverse proxy
- **docker-control**: Docker socket operations, event dispatcher
- **tunnel-control**: Cloudflare tunnel management

## Multi-arch images

Official images are published to GHCR as `ghcr.io/marweb/dockpilot-*:2.0.8` for `linux/amd64` and `linux/arm64`.

## Health checks

| Endpoint | Service |
|----------|---------|
| `GET /healthz` | web (via nginx) |
| `GET /health` | api-gateway, docker-control, tunnel-control |

## Upgrades

1. Pull new images or rebuild: `docker compose -f infra/docker-compose.yml pull && docker compose up -d`
2. Or use the in-app **Settings → Version & Updates** flow (admin only).

## Backup

Persist these volumes/paths:

- `api-gateway-data` — SQLite database (users, settings, notification rules)
- `tunnel-control-data` — Encrypted Cloudflare credentials

## Troubleshooting

- **Events not triggering notifications**: verify `INTERNAL_API_SECRET` matches in api-gateway and docker-control.
- **Notification channel save fails**: ensure `MASTER_KEY` is set on api-gateway.
- **Tunnel credentials error**: ensure `MASTER_KEY` is set on tunnel-control.

See [Troubleshooting](./guides/troubleshooting.md) for more.

## Related docs

- [Installation](./guides/installation.md)
- [Configuration](./guides/configuration.md)
- [Operations Checklist](./guides/operations-checklist.md)
