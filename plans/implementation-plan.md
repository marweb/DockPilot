# DockPilot - Implementation Plan

## Project Overview

DockPilot is a self-hosted web-based Docker administration GUI, designed as a mobile-first, multilingual alternative to Docker Desktop. It provides complete Docker management capabilities through a modern web interface.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DOCKPILOT SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         CLIENT LAYER                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  apps/web - React + Vite + Tailwind + i18next                   │ │   │
│  │  │  - Mobile-first responsive UI                                   │ │   │
│  │  │  - Light/Dark theme                                             │ │   │
│  │  │  - 7 languages: ES, EN, FR, DE, ZH, RU, JA                      │ │   │
│  │  │  - WebSocket for real-time updates                              │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         API GATEWAY                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │  services/api-gateway - Fastify                                 │ │   │
│  │  │  - Authentication (JWT + local users)                           │ │   │
│  │  │  - RBAC (admin/operator/viewer)                                 │ │   │
│  │  │  - Rate limiting                                                │ │   │
│  │  │  - WebSocket proxy                                              │ │   │
│  │  │  - Request routing to microservices                             │ │   │
│  │  │  - Audit logging                                                │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                         │                    │                               │
│           ┌─────────────┴─────────┐    ┌────┴─────────────┐                 │
│           ▼                       ▼    ▼                  │                 │
│  ┌────────────────────┐  ┌────────────────────┐          │                 │
│  │  DOCKER CONTROL    │  │  TUNNEL CONTROL    │          │                 │
│  │  ┌──────────────┐  │  │  ┌──────────────┐  │          │                 │
│  │  │ Fastify +    │  │  │  │ Fastify +    │  │          │                 │
│  │  │ dockerode    │  │  │  │ cloudflared  │  │          │                 │
│  │  │              │  │  │  │ management   │  │          │                 │
│  │  │ - Containers │  │  │  │              │  │          │                 │
│  │  │ - Images     │  │  │  │ - Create     │  │          │                 │
│  │  │ - Volumes    │  │  │  │ - List       │  │          │                 │
│  │  │ - Networks   │  │  │  │ - Start/Stop │  │          │                 │
│  │  │ - Builds     │  │  │  │ - Delete     │  │          │                 │
│  │  │ - Compose    │  │  │  │ - Ingress    │  │          │                 │
│  │  └──────────────┘  │  │  └──────────────┘  │          │                 │
│  └─────────┬──────────┘  └────────────────────┘          │                 │
│            │                                              │                 │
│            ▼                                              ▼                 │
│  ┌────────────────────┐                       ┌────────────────────┐        │
│  │  Docker Engine     │                       │  Cloudflare API    │        │
│  │  /var/run/         │                       │  + cloudflared     │        │
│  │  docker.sock       │                       │  binary            │        │
│  └────────────────────┘                       └────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
dockpilot/
├── package.json                    # Root package.json for workspaces
├── pnpm-workspace.yaml            # pnpm workspace configuration
├── tsconfig.json                   # Base TypeScript config
├── .eslintrc.js                    # ESLint configuration
├── .prettierrc                     # Prettier configuration
├── turbo.json                      # Turborepo configuration
│
├── services/
│   ├── api-gateway/               # API Gateway Service
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── app.ts             # Fastify app setup
│   │   │   ├── config/
│   │   │   │   └── index.ts       # Environment config
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        # Authentication routes
│   │   │   │   ├── users.ts       # User management
│   │   │   │   └── health.ts      # Health check
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # JWT verification
│   │   │   │   ├── rbac.ts        # Role-based access
│   │   │   │   ├── rateLimit.ts   # Rate limiting
│   │   │   │   └── audit.ts       # Audit logging
│   │   │   ├── proxy/
│   │   │   │   ├── docker.ts      # Proxy to docker-control
│   │   │   │   └── tunnel.ts      # Proxy to tunnel-control
│   │   │   ├── websocket/
│   │   │   │   └── proxy.ts       # WebSocket proxy
│   │   │   └── utils/
│   │   │       ├── password.ts    # Argon2 hashing
│   │   │       └── jwt.ts         # JWT utilities
│   │   └── Dockerfile
│   │
│   ├── docker-control/            # Docker Control Service
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── app.ts             # Fastify app setup
│   │   │   ├── config/
│   │   │   ├── routes/
│   │   │   │   ├── containers.ts  # Container operations
│   │   │   │   ├── images.ts      # Image operations
│   │   │   │   ├── volumes.ts     # Volume operations
│   │   │   │   ├── networks.ts    # Network operations
│   │   │   │   ├── builds.ts      # Build operations
│   │   │   │   ├── compose.ts     # Compose operations
│   │   │   │   └── system.ts      # Docker info/version
│   │   │   ├── services/
│   │   │   │   ├── docker.ts      # Dockerode wrapper
│   │   │   │   ├── compose.ts     # Compose CLI wrapper
│   │   │   │   └── build.ts       # Build service
│   │   │   ├── websocket/
│   │   │   │   ├── logs.ts        # Log streaming
│   │   │   │   ├── exec.ts        # Exec shell
│   │   │   │   └── build.ts       # Build progress
│   │   │   └── schemas/
│   │   │       └── index.ts       # Zod schemas
│   │   └── Dockerfile
│   │
│   └── tunnel-control/            # Tunnel Control Service
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts           # Entry point
│       │   ├── app.ts             # Fastify app setup
│       │   ├── config/
│       │   ├── routes/
│       │   │   ├── tunnels.ts     # Tunnel CRUD
│       │   │   ├── auth.ts        # Cloudflare auth
│       │   │   ├── ingress.ts     # Ingress rules
│       │   │   └── health.ts      # Health check
│       │   ├── services/
│       │   │   ├── cloudflared.ts # Cloudflared process manager
│       │   │   ├── cloudflare-api.ts # Cloudflare API client
│       │   │   └── credentials.ts # Credential management
│       │   └── schemas/
│       │       └── index.ts       # Zod schemas
│       └── Dockerfile
│
├── apps/
│   └── web/                       # React Web Application
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── index.html
│       ├── public/
│       │   └── locales/           # i18n translation files
│       │       ├── en/
│       │       │   ├── common.json
│       │       │   ├── containers.json
│       │       │   ├── images.json
│       │       │   ├── volumes.json
│       │       │   ├── networks.json
│       │       │   ├── builds.json
│       │       │   ├── compose.json
│       │       │   ├── tunnels.json
│       │       │   └── settings.json
│       │       ├── es/
│       │       ├── fr/
│       │       ├── de/
│       │       ├── zh/
│       │       ├── ru/
│       │       └── ja/
│       └── src/
│           ├── main.tsx           # Entry point
│           ├── App.tsx            # Root component
│           ├── vite-env.d.ts
│           ├── api/
│           │   ├── client.ts      # Axios/fetch client
│           │   ├── containers.ts
│           │   ├── images.ts
│           │   ├── volumes.ts
│           │   ├── networks.ts
│           │   ├── builds.ts
│           │   ├── compose.ts
│           │   └── tunnels.ts
│           ├── components/
│           │   ├── layout/
│           │   │   ├── Header.tsx
│           │   │   ├── Sidebar.tsx
│           │   │   ├── Footer.tsx
│           │   │   └── MobileNav.tsx
│           │   ├── common/
│           │   │   ├── Button.tsx
│           │   │   ├── Modal.tsx
│           │   │   ├── Table.tsx
│           │   │   ├── SearchInput.tsx
│           │   │   ├── Pagination.tsx
│           │   │   ├── ConfirmDialog.tsx
│           │   │   ├── StatusBadge.tsx
│           │   │   └── ThemeToggle.tsx
│           │   ├── containers/
│           │   │   ├── ContainerList.tsx
│           │   │   ├── ContainerDetails.tsx
│           │   │   ├── ContainerLogs.tsx
│           │   │   ├── ContainerExec.tsx
│           │   │   └── ContainerStats.tsx
│           │   ├── images/
│           │   │   ├── ImageList.tsx
│           │   │   ├── ImagePull.tsx
│           │   │   └── ImageDetails.tsx
│           │   ├── volumes/
│           │   │   ├── VolumeList.tsx
│           │   │   └── VolumeDetails.tsx
│           │   ├── networks/
│           │   │   ├── NetworkList.tsx
│           │   │   └── NetworkDetails.tsx
│           │   ├── builds/
│           │   │   ├── BuildForm.tsx
│           │   │   └── BuildProgress.tsx
│           │   ├── compose/
│           │   │   ├── ComposeEditor.tsx
│           │   │   ├── StackList.tsx
│           │   │   └── StackDetails.tsx
│           │   ├── tunnels/
│           │   │   ├── TunnelList.tsx
│           │   │   ├── TunnelCreate.tsx
│           │   │   └── TunnelDetails.tsx
│           │   └── dashboard/
│           │       ├── Dashboard.tsx
│           │       ├── StatsCard.tsx
│           │       └── QuickActions.tsx
│           ├── hooks/
│           │   ├── useAuth.ts
│           │   ├── useTheme.ts
│           │   ├── useLocale.ts
│           │   ├── useWebSocket.ts
│           │   └── usePagination.ts
│           ├── contexts/
│           │   ├── AuthContext.tsx
│           │   ├── ThemeContext.tsx
│           │   └── LocaleContext.tsx
│           ├── pages/
│           │   ├── Dashboard.tsx
│           │   ├── Containers.tsx
│           │   ├── Images.tsx
│           │   ├── Volumes.tsx
│           │   ├── Networks.tsx
│           │   ├── Builds.tsx
│           │   ├── Compose.tsx
│           │   ├── Tunnels.tsx
│           │   ├── Settings.tsx
│           │   └── Login.tsx
│           ├── router/
│           │   └── index.tsx
│           ├── utils/
│           │   ├── format.ts
│           │   └── validation.ts
│           └── i18n/
│               └── index.ts       # i18next configuration
│
├── infra/
│   ├── docker-compose.yml         # Production compose
│   ├── docker-compose.dev.yml     # Development compose
│   ├── .env.example               # Environment template
│   └── systemd/
│       └── dockpilot.service      # Systemd unit file
│
├── installer/
│   ├── install.sh                 # Main TUI installer
│   ├── uninstall.sh               # Uninstaller
│   └── lib/
│       ├── common.sh              # Common functions
│       ├── detect-distro.sh       # Distro detection
│       ├── install-docker.sh      # Docker installation
│       ├── install-cloudflared.sh # Cloudflared installation
│       ├── setup-systemd.sh       # Systemd setup
│       └── tui.sh                 # TUI components
│
├── scripts/
│   ├── dev.sh                     # Start dev environment
│   ├── build.sh                   # Build for production
│   └── test.sh                    # Run tests
│
├── docs/
│   ├── architecture.md            # Architecture documentation
│   ├── api.md                     # API documentation
│   ├── installation.md            # Installation guide
│   └── troubleshooting.md         # Troubleshooting guide
│
├── tests/
│   ├── unit/
│   │   ├── api-gateway/
│   │   │   ├── auth.test.ts
│   │   │   └── rbac.test.ts
│   │   ├── docker-control/
│   │   │   └── containers.test.ts
│   │   └── tunnel-control/
│   │       └── tunnels.test.ts
│   └── e2e/
│       └── playwright.config.ts
│
└── README.md                      # Main documentation
```

## Implementation Phases

### Phase 1: Project Scaffold
- Initialize pnpm monorepo with workspaces
- Configure TypeScript, ESLint, Prettier
- Setup Turborepo for build orchestration
- Create base Dockerfiles for each service

### Phase 2: Docker Control Service
- Setup Fastify server with pino logging
- Implement dockerode connection to Docker socket
- Create REST endpoints for containers, images, volumes, networks
- Implement WebSocket for logs streaming and exec
- Add compose support via CLI wrapper
- Implement build functionality with progress streaming

### Phase 3: API Gateway Service
- Setup Fastify server with CORS, helmet
- Implement user authentication with JWT
- Create RBAC middleware (admin/operator/viewer)
- Setup proxy routes to docker-control and tunnel-control
- Implement WebSocket proxy for real-time features
- Add rate limiting and audit logging

### Phase 4: Tunnel Control Service
- Setup Fastify server
- Implement cloudflared binary management
- Create Cloudflare API integration
- Implement tunnel CRUD operations
- Add credential management with encryption
- Create ingress rule management

### Phase 5: Web Application
- Setup React + Vite + Tailwind
- Implement i18next with all 7 languages
- Create responsive layout with mobile navigation
- Build dashboard with stats overview
- Implement all management pages
- Add WebSocket integration for real-time updates
- Implement theme switching

### Phase 6: Installer
- Create TUI installer with gum/whiptail
- Implement distro detection
- Add Docker installation logic
- Add cloudflared installation
- Create systemd service setup
- Implement idempotent checks

### Phase 7: Documentation & Testing
- Write comprehensive README
- Create architecture documentation
- Add unit tests for critical routes
- Create troubleshooting guide

## Technology Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify 4.x
- **Docker Integration**: dockerode
- **Validation**: Zod
- **Logging**: pino
- **Auth**: JWT + argon2
- **Process Management**: node child_process for cloudflared

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **State**: React Query + Context
- **Routing**: React Router 6
- **i18n**: i18next + react-i18next
- **WebSocket**: native WebSocket API
- **Icons**: Lucide React

### Infrastructure
- **Container Runtime**: Docker + Docker Compose v2
- **Process Manager**: systemd
- **Reverse Proxy**: Built-in Fastify or optional Traefik

### Development
- **Package Manager**: pnpm 8
- **Monorepo**: pnpm workspaces + Turborepo
- **Linting**: ESLint + typescript-eslint
- **Formatting**: Prettier
- **Testing**: Vitest + Playwright

## Security Considerations

1. **Authentication**
   - JWT tokens with short expiration
   - Refresh token rotation
   - Secure password hashing with argon2

2. **Authorization**
   - RBAC with three roles: admin, operator, viewer
   - Resource-level permissions
   - API endpoint protection

3. **Input Validation**
   - Zod schemas for all inputs
   - SQL injection prevention (N/A - no SQL)
   - Command injection prevention in exec

4. **Transport Security**
   - HTTPS recommended in production
   - Secure cookie settings
   - CSP headers

5. **Docker Socket**
   - Clear warning about socket exposure
   - Future: TLS socket support

6. **Credential Storage**
   - Filesystem with strict permissions (600)
   - Optional encryption at rest
   - No credentials in logs

## API Endpoints Overview

### Auth Endpoints
```
POST   /api/auth/login          # Login
POST   /api/auth/logout         # Logout
POST   /api/auth/refresh        # Refresh token
POST   /api/auth/setup          # Initial setup (first user)
GET    /api/auth/me             # Current user
PUT    /api/auth/password       # Change password
```

### Container Endpoints
```
GET    /api/containers          # List containers
POST   /api/containers          # Create container
GET    /api/containers/:id      # Get container
POST   /api/containers/:id/start
POST   /api/containers/:id/stop
POST   /api/containers/:id/restart
POST   /api/containers/:id/kill
DELETE /api/containers/:id
POST   /api/containers/:id/rename
GET    /api/containers/:id/logs
WS     /api/containers/:id/logs/stream
WS     /api/containers/:id/exec
GET    /api/containers/:id/stats
GET    /api/containers/:id/inspect
POST   /api/containers/prune
```

### Image Endpoints
```
GET    /api/images              # List images
POST   /api/images/pull         # Pull image
POST   /api/images/:id/tag      # Tag image
DELETE /api/images/:id
GET    /api/images/:id/inspect
GET    /api/images/:id/history
POST   /api/images/prune
```

### Volume Endpoints
```
GET    /api/volumes             # List volumes
POST   /api/volumes             # Create volume
GET    /api/volumes/:name       # Get volume
DELETE /api/volumes/:name
POST   /api/volumes/prune
```

### Network Endpoints
```
GET    /api/networks            # List networks
POST   /api/networks            # Create network
GET    /api/networks/:id        # Get network
DELETE /api/networks/:id
POST   /api/networks/:id/connect
POST   /api/networks/:id/disconnect
```

### Build Endpoints
```
POST   /api/builds              # Build image
WS     /api/builds/:id/stream   # Build progress
```

### Compose Endpoints
```
GET    /api/compose/stacks      # List stacks
POST   /api/compose/validate    # Validate compose
POST   /api/compose/up          # Up stack
POST   /api/compose/down        # Down stack
GET    /api/compose/:name/logs  # Stack logs
```

### Tunnel Endpoints
```
GET    /api/tunnels             # List tunnels
POST   /api/tunnels             # Create tunnel
GET    /api/tunnels/:id         # Get tunnel
DELETE /api/tunnels/:id
POST   /api/tunnels/:id/start
POST   /api/tunnels/:id/stop
GET    /api/tunnels/:id/logs
POST   /api/tunnels/:id/ingress # Update ingress
POST   /api/tunnels/auth/login  # Cloudflare login
GET    /api/tunnels/auth/status # Auth status
```

### System Endpoints
```
GET    /api/system/info         # Docker info
GET    /api/system/version      # Docker version
GET    /api/system/df           # Disk usage
GET    /api/system/events       # Docker events (WS)
```

## Environment Variables

### API Gateway
```bash
PORT=3000
JWT_SECRET=<generated>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
DOCKER_CONTROL_URL=http://docker-control:3001
TUNNEL_CONTROL_URL=http://tunnel-control:3002
INITIAL_ADMIN_PASSWORD=<generated>
```

### Docker Control
```bash
PORT=3001
DOCKER_HOST=unix:///var/run/docker.sock
```

### Tunnel Control
```bash
PORT=3002
CLOUDFLARED_PATH=/usr/local/bin/cloudflared
CREDENTIALS_DIR=/data/tunnels
ENCRYPTION_KEY=<optional>
```

## Next Steps

1. Review and approve this plan
2. Switch to Code mode to begin implementation
3. Start with Phase 1: Project Scaffold
