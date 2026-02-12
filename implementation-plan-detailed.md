# DockPilot - Plan de Implementación Detallado

## Análisis del Estado Actual

### ✅ IMPLEMENTADO

- Estructura monorepo con pnpm workspaces
- Backend Docker Control: rutas básicas (containers, images, volumes, networks, builds, compose)
- Backend API Gateway: autenticación JWT, RBAC, rate limiting, proxy
- Backend Tunnel Control: estructura base con cloudflared
- Frontend: Layout, sistema de tema, Dashboard básico, Stores (auth, theme)
- Tipos compartidos en @dockpilot/types
- i18n configurado (EN, ES, FR, DE, ZH)

### ❌ FALTA IMPLEMENTAR

- Frontend: Páginas de gestión (Containers, Images, etc.) - solo tienen "Coming Soon"
- Frontend: Componentes UI específicos
- Frontend: API clients específicos por recurso
- Backend: WebSocket streaming completo para logs/exec/builds
- Backend: Crear contenedores desde UI
- Infra: Docker Compose completo
- Instalador TUI
- Documentación completa
- Tests

---

## GRUPOS DE TAREAS PARALELOS

### 🔧 GRUPO A: INFRAESTRUCTURA Y DOCKER COMPOSE

**Responsable:** Agente DevOps/Infra  
**Dependencias:** Ninguna  
**Prioridad:** CRÍTICA

| ID  | Descripción                                         | Archivos                             | Dependencias | Prioridad | Complejidad |
| --- | --------------------------------------------------- | ------------------------------------ | ------------ | --------- | ----------- |
| A1  | Crear infra/docker-compose.yml para producción      | `infra/docker-compose.yml`           | -            | CRÍTICA   | 5           |
| A2  | Crear infra/docker-compose.dev.yml para desarrollo  | `infra/docker-compose.dev.yml`       | -            | CRÍTICA   | 5           |
| A3  | Crear infra/.env.example con todas las variables    | `infra/.env.example`                 | -            | CRÍTICA   | 3           |
| A4  | Configurar volúmenes persistentes para datos        | Modificar compose files              | A1, A2       | ALTO      | 4           |
| A5  | Configurar redes Docker (frontend, backend, bridge) | Modificar compose files              | A1, A2       | ALTO      | 4           |
| A6  | Crear Dockerfile optimizado para api-gateway        | `services/api-gateway/Dockerfile`    | -            | ALTO      | 5           |
| A7  | Crear Dockerfile optimizado para docker-control     | `services/docker-control/Dockerfile` | -            | ALTO      | 5           |
| A8  | Crear Dockerfile optimizado para tunnel-control     | `services/tunnel-control/Dockerfile` | -            | ALTO      | 5           |
| A9  | Configurar healthchecks en servicios                | Todos los compose                    | A1-A8        | MEDIO     | 4           |
| A10 | Crear systemd service file                          | `infra/systemd/dockpilot.service`    | A1           | BAJO      | 3           |

---

### 🔌 GRUPO B: BACKEND - WEBSOCKETS Y STREAMING

**Responsable:** Agente Backend WebSocket  
**Dependencias:** Ninguna  
**Prioridad:** ALTO

| ID  | Descripción                                                 | Archivos                                          | Dependencias | Prioridad | Complejidad |
| --- | ----------------------------------------------------------- | ------------------------------------------------- | ------------ | --------- | ----------- |
| B1  | Implementar WebSocket para streaming de logs en tiempo real | `services/docker-control/src/websocket/logs.ts`   | -            | CRÍTICA   | 8           |
| B2  | Implementar WebSocket para terminal exec interactivo        | `services/docker-control/src/websocket/exec.ts`   | -            | CRÍTICA   | 9           |
| B3  | Implementar WebSocket para streaming de builds              | `services/docker-control/src/websocket/build.ts`  | -            | CRÍTICA   | 7           |
| B4  | Implementar WebSocket para eventos de Docker                | `services/docker-control/src/websocket/events.ts` | -            | ALTO      | 6           |
| B5  | Actualizar app.ts para registrar rutas WebSocket            | `services/docker-control/src/app.ts`              | B1-B4        | ALTO      | 5           |
| B6  | Crear utilidades para manejo de streams multiplexados       | `services/docker-control/src/utils/streams.ts`    | B1-B4        | MEDIO     | 6           |
| B7  | Implementar reconexión automática en WebSockets             | Modificar websocket files                         | B1-B4        | MEDIO     | 5           |
| B8  | Actualizar api-gateway para proxy WebSocket completo        | `services/api-gateway/src/websocket/proxy.ts`     | B1-B4        | ALTO      | 7           |

---

### 🛡️ GRUPO C: BACKEND - SEGURIDAD Y FEATURES ADICIONALES

**Responsable:** Agente Backend Security  
**Dependencias:** Ninguna  
**Prioridad:** ALTO

| ID  | Descripción                                                       | Archivos                                           | Dependencias | Prioridad | Complejidad |
| --- | ----------------------------------------------------------------- | -------------------------------------------------- | ------------ | --------- | ----------- |
| C1  | Implementar endpoint POST /api/containers para crear contenedores | `services/docker-control/src/routes/containers.ts` | -            | CRÍTICA   | 8           |
| C2  | Agregar rate limiting específico por endpoint                     | `services/api-gateway/src/middleware/rateLimit.ts` | -            | ALTO      | 6           |
| C3  | Implementar endpoint para obtener audit logs                      | `services/api-gateway/src/routes/audit.ts`         | -            | MEDIO     | 5           |
| C4  | Agregar paginación a listados de recursos                         | Modificar rutas existentes                         | -            | ALTO      | 5           |
| C5  | Implementar búsqueda y filtros en endpoints de listado            | Modificar rutas existentes                         | C4           | MEDIO     | 5           |
| C6  | Agregar validaciones de permisos más granulares                   | `services/api-gateway/src/middleware/auth.ts`      | -            | MEDIO     | 6           |
| C7  | Implementar backup y restore de configuración                     | `services/api-gateway/src/routes/backup.ts`        | -            | BAJO      | 5           |
| C8  | Agregar métricas y monitoreo (Prometheus endpoint)                | `services/api-gateway/src/routes/metrics.ts`       | -            | BAJO      | 5           |

---

### 🎨 GRUPO D: FRONTEND - COMPONENTES UI BASE

**Responsable:** Agente Frontend UI  
**Dependencias:** Ninguna  
**Prioridad:** CRÍTICA

| ID  | Descripción                                     | Archivos                                            | Dependencias | Prioridad | Complejidad |
| --- | ----------------------------------------------- | --------------------------------------------------- | ------------ | --------- | ----------- |
| D1  | Crear componente Button con variantes           | `apps/web/src/components/common/Button.tsx`         | -            | CRÍTICA   | 4           |
| D2  | Crear componente Modal/Dialog reutilizable      | `apps/web/src/components/common/Modal.tsx`          | D1           | CRÍTICA   | 5           |
| D3  | Crear componente Table con sorting y pagination | `apps/web/src/components/common/Table.tsx`          | -            | CRÍTICA   | 7           |
| D4  | Crear componente ConfirmDialog                  | `apps/web/src/components/common/ConfirmDialog.tsx`  | D2           | CRÍTICA   | 4           |
| D5  | Crear componente StatusBadge para estados       | `apps/web/src/components/common/StatusBadge.tsx`    | -            | CRÍTICA   | 3           |
| D6  | Crear componente SearchInput con debounce       | `apps/web/src/components/common/SearchInput.tsx`    | -            | ALTO      | 4           |
| D7  | Crear componente LoadingSpinner/Skeleton        | `apps/web/src/components/common/LoadingSpinner.tsx` | -            | ALTO      | 3           |
| D8  | Crear componente EmptyState                     | `apps/web/src/components/common/EmptyState.tsx`     | -            | MEDIO     | 3           |
| D9  | Crear componente ErrorBoundary                  | `apps/web/src/components/common/ErrorBoundary.tsx`  | -            | ALTO      | 5           |
| D10 | Crear componente Toast/Notification system      | `apps/web/src/components/common/Toast.tsx`          | -            | ALTO      | 6           |

---

### 🌐 GRUPO E: FRONTEND - API CLIENTS Y HOOKS

**Responsable:** Agente Frontend API  
**Dependencias:** Ninguna  
**Prioridad:** CRÍTICA

| ID  | Descripción                                               | Archivos                                  | Dependencias | Prioridad | Complejidad |
| --- | --------------------------------------------------------- | ----------------------------------------- | ------------ | --------- | ----------- |
| E1  | Crear API client para containers                          | `apps/web/src/api/containers.ts`          | -            | CRÍTICA   | 6           |
| E2  | Crear API client para images                              | `apps/web/src/api/images.ts`              | -            | CRÍTICA   | 6           |
| E3  | Crear API client para volumes                             | `apps/web/src/api/volumes.ts`             | -            | CRÍTICA   | 5           |
| E4  | Crear API client para networks                            | `apps/web/src/api/networks.ts`            | -            | CRÍTICA   | 5           |
| E5  | Crear API client para builds                              | `apps/web/src/api/builds.ts`              | -            | CRÍTICA   | 6           |
| E6  | Crear API client para compose                             | `apps/web/src/api/compose.ts`             | -            | CRÍTICA   | 6           |
| E7  | Crear API client para tunnels                             | `apps/web/src/api/tunnels.ts`             | -            | CRÍTICA   | 5           |
| E8  | Crear hook useWebSocket para conexiones WS                | `apps/web/src/hooks/useWebSocket.ts`      | -            | CRÍTICA   | 7           |
| E9  | Crear hook useContainers para manejo de estado            | `apps/web/src/hooks/useContainers.ts`     | E1           | ALTO      | 5           |
| E10 | Crear hook useImages para manejo de estado                | `apps/web/src/hooks/useImages.ts`         | E2           | ALTO      | 5           |
| E11 | Crear hook useVolumes para manejo de estado               | `apps/web/src/hooks/useVolumes.ts`        | E3           | MEDIO     | 4           |
| E12 | Crear hook useNetworks para manejo de estado              | `apps/web/src/hooks/useNetworks.ts`       | E4           | MEDIO     | 4           |
| E13 | Crear hook useBuilds para manejo de estado                | `apps/web/src/hooks/useBuilds.ts`         | E5           | MEDIO     | 5           |
| E14 | Crear hook useCompose para manejo de estado               | `apps/web/src/hooks/useCompose.ts`        | E6           | MEDIO     | 5           |
| E15 | Crear hook useTunnels para manejo de estado               | `apps/web/src/hooks/useTunnels.ts`        | E7           | MEDIO     | 5           |
| E16 | Crear hook usePagination reutilizable                     | `apps/web/src/hooks/usePagination.ts`     | -            | ALTO      | 4           |
| E17 | Crear hook useSearch con debounce                         | `apps/web/src/hooks/useSearch.ts`         | -            | ALTO      | 4           |
| E18 | Crear hook useContainerStats para métricas en tiempo real | `apps/web/src/hooks/useContainerStats.ts` | E1, E8       | ALTO      | 6           |

---

### 📄 GRUPO F: FRONTEND - PÁGINAS DE GESTIÓN

**Responsable:** Agente Frontend Pages (puede dividirse en 2-3 agentes)  
**Dependencias:** GRUPOS D, E  
**Prioridad:** CRÍTICA

| ID  | Descripción                                  | Archivos                                                      | Dependencias        | Prioridad | Complejidad |
| --- | -------------------------------------------- | ------------------------------------------------------------- | ------------------- | --------- | ----------- |
| F1  | Implementar página Containers completa       | `apps/web/src/pages/Containers.tsx`                           | D1-D10, E1, E9, E18 | CRÍTICA   | 9           |
| F2  | Crear componente ContainerList con acciones  | `apps/web/src/components/containers/ContainerList.tsx`        | D3, D4, D5, E9      | CRÍTICA   | 7           |
| F3  | Crear componente ContainerDetails modal      | `apps/web/src/components/containers/ContainerDetails.tsx`     | D2, E9              | CRÍTICA   | 6           |
| F4  | Crear componente ContainerLogs con WebSocket | `apps/web/src/components/containers/ContainerLogs.tsx`        | D2, E8, E9          | CRÍTICA   | 8           |
| F5  | Crear componente ContainerExec (terminal)    | `apps/web/src/components/containers/ContainerExec.tsx`        | D2, E8, E9          | CRÍTICA   | 9           |
| F6  | Crear componente ContainerStats              | `apps/web/src/components/containers/ContainerStats.tsx`       | E18                 | ALTO      | 6           |
| F7  | Crear modal CreateContainer                  | `apps/web/src/components/containers/CreateContainerModal.tsx` | D2, E1              | CRÍTICA   | 8           |
| F8  | Implementar página Images completa           | `apps/web/src/pages/Images.tsx`                               | D1-D10, E2, E10     | CRÍTICA   | 8           |
| F9  | Crear componente ImageList con acciones      | `apps/web/src/components/images/ImageList.tsx`                | D3, D4, E10         | CRÍTICA   | 6           |
| F10 | Crear componente ImagePull modal             | `apps/web/src/components/images/ImagePull.tsx`                | D2, E2              | ALTO      | 6           |
| F11 | Crear componente ImageDetails                | `apps/web/src/components/images/ImageDetails.tsx`             | D2, E10             | ALTO      | 5           |
| F12 | Implementar página Volumes completa          | `apps/web/src/pages/Volumes.tsx`                              | D1-D10, E3, E11     | CRÍTICA   | 7           |
| F13 | Crear componente VolumeList                  | `apps/web/src/components/volumes/VolumeList.tsx`              | D3, D4, E11         | CRÍTICA   | 6           |
| F14 | Crear componente VolumeDetails               | `apps/web/src/components/volumes/VolumeDetails.tsx`           | D2, E11             | ALTO      | 5           |
| F15 | Crear modal CreateVolume                     | `apps/web/src/components/volumes/CreateVolumeModal.tsx`       | D2, E3              | MEDIO     | 5           |
| F16 | Implementar página Networks completa         | `apps/web/src/pages/Networks.tsx`                             | D1-D10, E4, E12     | CRÍTICA   | 7           |
| F17 | Crear componente NetworkList                 | `apps/web/src/components/networks/NetworkList.tsx`            | D3, D4, E12         | CRÍTICA   | 6           |
| F18 | Crear componente NetworkDetails              | `apps/web/src/components/networks/NetworkDetails.tsx`         | D2, E12             | ALTO      | 5           |
| F19 | Crear modal CreateNetwork                    | `apps/web/src/components/networks/CreateNetworkModal.tsx`     | D2, E4              | MEDIO     | 5           |
| F20 | Implementar página Builds completa           | `apps/web/src/pages/Builds.tsx`                               | D1-D10, E5, E13     | ALTO      | 8           |
| F21 | Crear componente BuildForm                   | `apps/web/src/components/builds/BuildForm.tsx`                | D2, E5              | ALTO      | 7           |
| F22 | Crear componente BuildProgress con WebSocket | `apps/web/src/components/builds/BuildProgress.tsx`            | D2, E8, E13         | ALTO      | 7           |
| F23 | Implementar página Compose completa          | `apps/web/src/pages/Compose.tsx`                              | D1-D10, E6, E14     | ALTO      | 8           |
| F24 | Crear componente StackList                   | `apps/web/src/components/compose/StackList.tsx`               | D3, E14             | ALTO      | 6           |
| F25 | Crear componente ComposeEditor (YAML)        | `apps/web/src/components/compose/ComposeEditor.tsx`           | D2, E14             | ALTO      | 7           |
| F26 | Crear componente StackDetails                | `apps/web/src/components/compose/StackDetails.tsx`            | D2, E14             | MEDIO     | 5           |

---

### ⚛️ GRUPO G: FRONTEND - SISTEMA REACT (Contextos y Configuración)

**Responsable:** Agente Frontend Core  
**Dependencias:** Ninguna  
**Prioridad:** ALTO

| ID  | Descripción                                     | Archivos                                     | Dependencias | Prioridad | Complejidad |
| --- | ----------------------------------------------- | -------------------------------------------- | ------------ | --------- | ----------- |
| G1  | Crear ThemeContext para manejo de tema          | `apps/web/src/contexts/ThemeContext.tsx`     | -            | ALTO      | 4           |
| G2  | Crear AuthContext (alternativa al store)        | `apps/web/src/contexts/AuthContext.tsx`      | -            | MEDIO     | 5           |
| G3  | Crear LocaleContext para i18n                   | `apps/web/src/contexts/LocaleContext.tsx`    | -            | MEDIO     | 4           |
| G4  | Crear WebSocketContext para conexiones globales | `apps/web/src/contexts/WebSocketContext.tsx` | -            | ALTO      | 6           |
| G5  | Configurar React Query para caching             | `apps/web/src/lib/queryClient.ts`            | -            | ALTO      | 5           |
| G6  | Crear router con lazy loading                   | `apps/web/src/router/index.tsx`              | -            | MEDIO     | 5           |
| G7  | Actualizar App.tsx para usar nuevos contextos   | `apps/web/src/App.tsx`                       | G1-G4        | ALTO      | 4           |
| G8  | Configurar PWA (manifest, service worker)       | `apps/web/public/manifest.json`, `sw.ts`     | -            | BAJO      | 6           |
| G9  | Optimizar bundle con code splitting             | `vite.config.ts`                             | -            | BAJO      | 5           |

---

### 🔒 GRUPO H: TUNNEL CONTROL COMPLETO

**Responsable:** Agente Backend Tunnel  
**Dependencias:** Ninguna  
**Prioridad:** MEDIO

| ID  | Descripción                                           | Archivos                                                 | Dependencias | Prioridad | Complejidad |
| --- | ----------------------------------------------------- | -------------------------------------------------------- | ------------ | --------- | ----------- |
| H1  | Completar implementación de Cloudflare API client     | `services/tunnel-control/src/services/cloudflare-api.ts` | -            | CRÍTICA   | 7           |
| H2  | Mejorar manejo de credenciales con cifrado            | `services/tunnel-control/src/services/credentials.ts`    | -            | ALTO      | 6           |
| H3  | Implementar rutas CRUD completas para ingress rules   | `services/tunnel-control/src/routes/ingress.ts`          | -            | ALTO      | 6           |
| H4  | Agregar autenticación OAuth con Cloudflare            | `services/tunnel-control/src/routes/auth.ts`             | -            | ALTO      | 7           |
| H5  | Implementar monitoreo de estado de túneles            | `services/tunnel-control/src/services/monitor.ts`        | -            | MEDIO     | 5           |
| H6  | Agregar logs persistentes de túneles                  | `services/tunnel-control/src/services/logs.ts`           | -            | MEDIO     | 5           |
| H7  | Crear WebSocket para estado de túneles en tiempo real | Modificar tunnel routes                                  | H5           | MEDIO     | 6           |
| H8  | Implementar página Tunnels completa (Frontend)        | `apps/web/src/pages/Tunnels.tsx`                         | E7, E15      | ALTO      | 7           |
| H9  | Crear componente TunnelList                           | `apps/web/src/components/tunnels/TunnelList.tsx`         | D3, E15      | ALTO      | 6           |
| H10 | Crear componente TunnelCreate                         | `apps/web/src/components/tunnels/TunnelCreate.tsx`       | D2, E15      | MEDIO     | 6           |
| H11 | Crear componente TunnelDetails                        | `apps/web/src/components/tunnels/TunnelDetails.tsx`      | D2, E15      | MEDIO     | 5           |
| H12 | Crear componente IngressRuleEditor                    | `apps/web/src/components/tunnels/IngressRuleEditor.tsx`  | D2, E15      | MEDIO     | 6           |

---

### 📦 GRUPO I: INSTALADOR TUI

**Responsable:** Agente DevOps/Installer  
**Dependencias:** A1-A10 (para entender estructura)  
**Prioridad:** MEDIO

| ID  | Descripción                                  | Archivos                               | Dependencias | Prioridad | Complejidad |
| --- | -------------------------------------------- | -------------------------------------- | ------------ | --------- | ----------- |
| I1  | Crear script install.sh principal            | `installer/install.sh`                 | A1-A10       | CRÍTICA   | 7           |
| I2  | Crear librería de funciones comunes          | `installer/lib/common.sh`              | I1           | CRÍTICA   | 6           |
| I3  | Implementar detección de distribución Linux  | `installer/lib/detect-distro.sh`       | I2           | CRÍTICA   | 5           |
| I4  | Crear componentes TUI con gum/whiptail       | `installer/lib/tui.sh`                 | I2           | CRÍTICA   | 6           |
| I5  | Implementar instalación automática de Docker | `installer/lib/install-docker.sh`      | I3           | ALTO      | 6           |
| I6  | Implementar instalación de cloudflared       | `installer/lib/install-cloudflared.sh` | I3           | ALTO      | 6           |
| I7  | Crear configuración de systemd service       | `installer/lib/setup-systemd.sh`       | I4           | ALTO      | 5           |
| I8  | Implementar verificación de requisitos       | `installer/lib/check-requirements.sh`  | I3           | ALTO      | 4           |
| I9  | Crear script uninstall.sh                    | `installer/uninstall.sh`               | I1           | MEDIO     | 5           |
| I10 | Implementar migración de datos               | `installer/lib/migrate.sh`             | I4           | BAJO      | 5           |
| I11 | Agregar modo non-interactive (CI/CD)         | Modificar install.sh                   | I1-I8        | BAJO      | 4           |
| I12 | Crear tests para instalador                  | `installer/tests/`                     | I1-I11       | BAJO      | 6           |

---

### 📚 GRUPO J: DOCUMENTACIÓN

**Responsable:** Agente Technical Writer  
**Dependencias:** Todos los grupos (para documentar)  
**Prioridad:** MEDIO

| ID  | Descripción                         | Archivos                  | Dependencias       | Prioridad | Complejidad |
| --- | ----------------------------------- | ------------------------- | ------------------ | --------- | ----------- |
| J1  | Escribir README.md principal        | `README.md`               | -                  | CRÍTICA   | 5           |
| J2  | Documentar arquitectura del sistema | `docs/architecture.md`    | Todos              | CRÍTICA   | 6           |
| J3  | Crear guía de instalación detallada | `docs/installation.md`    | I1-I12             | CRÍTICA   | 5           |
| J4  | Documentar API completa             | `docs/api.md`             | Todos los backend  | CRÍTICA   | 7           |
| J5  | Crear guía de usuario               | `docs/user-guide.md`      | Todos los frontend | ALTO      | 6           |
| J6  | Documentar configuración            | `docs/configuration.md`   | A1-A10             | ALTO      | 5           |
| J7  | Crear troubleshooting guide         | `docs/troubleshooting.md` | Todos              | ALTO      | 6           |
| J8  | Documentar seguridad                | `docs/security.md`        | C1-C8              | MEDIO     | 5           |
| J9  | Crear guía de contribución          | `CONTRIBUTING.md`         | -                  | BAJO      | 4           |
| J10 | Documentar despliegue en producción | `docs/deployment.md`      | A1-A10             | MEDIO     | 6           |
| J11 | Crear changelog                     | `CHANGELOG.md`            | -                  | BAJO      | 3           |
| J12 | Documentar desarrollo local         | `docs/development.md`     | A2, B1-B8          | MEDIO     | 5           |

---

### 🧪 GRUPO K: TESTS

**Responsable:** Agente QA/Testing  
**Dependencias:** Implementaciones de backend/frontend  
**Prioridad:** MEDIO

| ID  | Descripción                                 | Archivos                                       | Dependencias | Prioridad | Complejidad |
| --- | ------------------------------------------- | ---------------------------------------------- | ------------ | --------- | ----------- |
| K1  | Configurar Vitest para backend              | `vitest.config.ts` en cada servicio            | -            | CRÍTICA   | 5           |
| K2  | Configurar Vitest para frontend             | `apps/web/vitest.config.ts`                    | -            | CRÍTICA   | 5           |
| K3  | Crear tests unitarios para auth             | `tests/unit/api-gateway/auth.test.ts`          | C1-C8        | CRÍTICA   | 7           |
| K4  | Crear tests unitarios para containers       | `tests/unit/docker-control/containers.test.ts` | B1-B8        | ALTO      | 7           |
| K5  | Crear tests unitarios para images           | `tests/unit/docker-control/images.test.ts`     | B1-B8        | ALTO      | 6           |
| K6  | Crear tests unitarios para volumes          | `tests/unit/docker-control/volumes.test.ts`    | B1-B8        | MEDIO     | 5           |
| K7  | Crear tests unitarios para networks         | `tests/unit/docker-control/networks.test.ts`   | B1-B8        | MEDIO     | 5           |
| K8  | Crear tests unitarios para tunnels          | `tests/unit/tunnel-control/tunnels.test.ts`    | H1-H12       | MEDIO     | 6           |
| K9  | Configurar Playwright para E2E              | `tests/e2e/playwright.config.ts`               | Todos los F  | ALTO      | 6           |
| K10 | Crear tests E2E para flujo de autenticación | `tests/e2e/auth.spec.ts`                       | F1-F26       | ALTO      | 6           |
| K11 | Crear tests E2E para gestión de containers  | `tests/e2e/containers.spec.ts`                 | F1-F7        | ALTO      | 7           |
| K12 | Crear tests E2E para gestión de images      | `tests/e2e/images.spec.ts`                     | F8-F11       | MEDIO     | 6           |
| K13 | Crear tests de integración para WebSocket   | `tests/integration/websocket.test.ts`          | B1-B8        | ALTO      | 7           |
| K14 | Configurar cobertura de código              | `vitest.config.ts`                             | K1-K13       | MEDIO     | 4           |
| K15 | Crear mock server para tests                | `tests/mocks/`                                 | K1-K14       | MEDIO     | 6           |

---

## 📋 MATRIZ DE DEPENDENCIAS ENTRE GRUPOS

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    DOCKPILOT PROJECT                         │
                    └─────────────────────────────────────────────────────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               ▼
    ┌───────────┐                   ┌───────────┐                   ┌───────────┐
    │ GRUPO A   │                   │ GRUPO B   │                   │ GRUPO C   │
    │ Infra     │                   │ WebSocket │                   │ Security  │
    │ (Inicio)  │                   │ (Inicio)  │                   │ (Inicio)  │
    └─────┬─────┘                   └─────┬─────┘                   └─────┬─────┘
          │                               │                               │
          │         ┌─────────────────────┴─────────────────────┐         │
          │         │                                           │         │
          ▼         ▼                                           ▼         ▼
    ┌───────────┐ ┌───────────┐                           ┌───────────┐ ┌───────────┐
    │ GRUPO I   │ │ GRUPO D   │                           │ GRUPO E   │ │ GRUPO H   │
    │ Installer │ │ UI Comp   │                           │ API/Hooks │ │ Tunnel    │
    │           │ │           │                           │           │ │           │
    └───────────┘ └─────┬─────┘                           └─────┬─────┘ └─────┬─────┘
                        │                                       │             │
                        └───────────────────┬───────────────────┘             │
                                            │                                 │
                                            ▼                                 ▼
                                      ┌───────────┐                     ┌───────────┐
                                      │ GRUPO F   │                     │ GRUPO G   │
                                      │ Pages     │                     │ React Sys │
                                      │           │                     │           │
                                      └─────┬─────┘                     └───────────┘
                                            │
                                            ▼
                                      ┌───────────┐
                                      │ GRUPO K   │
                                      │ Tests     │
                                      │ (Final)   │
                                      └───────────┘
                                            │
                                            ▼
                                      ┌───────────┐
                                      │ GRUPO J   │
                                      │ Docs      │
                                      │ (Final)   │
                                      └───────────┘
```

---

## 🎯 ORDEN DE EJECUCIÓN RECOMENDADO

### FASE 1: Fundamentos (Semana 1)

- **PARALELO:**
  - GRUPO A (Infra): A1-A5, A6-A8
  - GRUPO B (WebSocket): B1-B4
  - GRUPO D (UI): D1-D10
  - GRUPO E (API): E1-E18

### FASE 2: Backend Features (Semana 1-2)

- **PARALELO:**
  - GRUPO B (WebSocket): B5-B8 (continuación)
  - GRUPO C (Security): C1-C8
  - GRUPO H (Tunnel): H1-H7

### FASE 3: Frontend Pages (Semana 2)

- **PARALELO (3 agentes):**
  - Agente 1: F1-F7 (Containers)
  - Agente 2: F8-F15 (Images + Volumes)
  - Agente 3: F16-F26 (Networks + Builds + Compose)

### FASE 4: Integración (Semana 3)

- **PARALELO:**
  - GRUPO G (React System): G1-G9
  - GRUPO H (Tunnel Frontend): H8-H12
  - GRUPO I (Installer): I1-I12

### FASE 5: Testing y Documentación (Semana 3-4)

- **SECUENCIAL:**
  - GRUPO K (Tests): Después de que Fase 3 esté lista
  - GRUPO J (Docs): Después de todas las implementaciones

---

## 🔢 RESUMEN DE TAREAS

| Grupo     | Tareas  | Prioridad Crítica | Prioridad Alta | Prioridad Media | Prioridad Baja | Total Complejidad |
| --------- | ------- | ----------------- | -------------- | --------------- | -------------- | ----------------- |
| A         | 10      | 3                 | 5              | 1               | 1              | 43                |
| B         | 8       | 3                 | 2              | 2               | 1              | 53                |
| C         | 8       | 1                 | 3              | 4               | 0              | 44                |
| D         | 10      | 5                 | 3              | 2               | 0              | 43                |
| E         | 18      | 8                 | 6              | 4               | 0              | 94                |
| F         | 26      | 11                | 11             | 4               | 0              | 175               |
| G         | 9       | 0                 | 4              | 3               | 2              | 44                |
| H         | 12      | 1                 | 6              | 5               | 0              | 73                |
| I         | 12      | 3                 | 4              | 4               | 1              | 66                |
| J         | 12      | 4                 | 3              | 4               | 1              | 61                |
| K         | 15      | 2                 | 6              | 6               | 1              | 86                |
| **TOTAL** | **140** | **41**            | **54**         | **39**          | **6**          | **782**           |

---

## ⚠️ NOTAS IMPORTANTES

1. **Tareas que BLOQUEAN otras:**
   - A1-A5 (Docker Compose) bloquean I1-I12
   - B1-B4 (WebSocket base) bloquean B5-B8 y F4, F5, F22
   - D1-D10 (UI base) bloquean F1-F26
   - E1-E18 (API clients) bloquean F1-F26

2. **Tareas INDEPENDIENTES (ejecutar primero):**
   - Todos los D (Componentes UI)
   - Todos los E (API clients/hooks) excepto E18
   - A1-A5 (Docker Compose básico)
   - B1-B4 (WebSocket base)
   - C1 (Crear containers)

3. **Tareas que requieren TESTING intensivo:**
   - B1-B8 (WebSocket - probar conexiones, reconexión, etc.)
   - F4, F5 (Logs y Exec - probar con containers reales)
   - H1-H12 (Tunnels - requiere cuenta Cloudflare)
   - I1-I12 (Installer - probar en múltiples distros)

4. **Tareas de BAJA PRIORIDAD (pueden posponerse):**
   - C7, C8 (Backup, Métricas)
   - G8 (PWA)
   - I10 (Migración)
   - I11 (Modo CI/CD)
   - K14, K15 (Cobertura completa, Mock server)

---

## 🚀 COMANDOS ÚTILES PARA AGENTES

```bash
# Instalación inicial
pnpm install

# Desarrollo
pnpm dev                    # Iniciar todos los servicios en dev
pnpm docker:dev            # Iniciar con Docker Compose dev

# Build
pnpm build                 # Build de todo el proyecto
pnpm lint                  # Ejecutar linter
pnpm format               # Formatear código

# Tests
pnpm test                 # Ejecutar tests unitarios
pnpm test:e2e            # Ejecutar tests E2E

# Docker
pnpm docker:prod         # Iniciar en producción
```

---

## 📞 COORDINACIÓN ENTRE AGENTES

### Canales de Comunicación Recomendados:

1. **#dockpilot-backend**: GRUPOS B, C, H
2. **#dockpilot-frontend**: GRUPOS D, E, F, G
3. **#dockpilot-infra**: GRUPOS A, I
4. **#dockpilot-qa**: GRUPOS J, K

### Convenciones de Commit:

- `feat(A1):` - Nueva feature
- `fix(B3):` - Corrección de bug
- `docs(J5):` - Documentación
- `test(K7):` - Tests
- `refactor(D2):` - Refactorización

### Pull Requests:

- Un PR por tarea (ID único)
- Título: `[GRUPO-ID] Descripción breve`
- Requiere review de otro agente del mismo grupo

---

**Plan generado para ejecución paralela con múltiples agentes**  
**Total de tareas: 140**  
**Complejidad total estimada: 782 puntos**  
**Tiempo estimado: 3-4 semanas con 5-8 agentes trabajando en paralelo**
