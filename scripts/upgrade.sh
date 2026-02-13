#!/bin/bash
#
# DockPilot Upgrade Script
#
# Downloads latest compose files, merges .env, pulls images, and restarts services.
# Called by install.sh and can be run manually for updates.
#
# Usage:
#   ./upgrade.sh [VERSION] [REGISTRY_URL]
#
# Example:
#   ./upgrade.sh 1.0.0
#   ./upgrade.sh latest ghcr.io

set -e

CDN="${CDN:-https://raw.githubusercontent.com/marweb/DockerPilot/master/scripts}"
SOURCE_DIR="${SOURCE_DIR:-/data/dockpilot/source}"
VERSION="${1:-latest}"
REGISTRY_URL="${2:-ghcr.io}"
STATUS_FILE="${SOURCE_DIR}/.upgrade-status"
COMPOSE_FILE="${SOURCE_DIR}/docker-compose.yml"
COMPOSE_PROD="${SOURCE_DIR}/docker-compose.prod.yml"
ENV_FILE="${SOURCE_DIR}/.env"

write_status() {
  local step="$1"
  local message="$2"
  echo "${step}|${message}|$(date -Iseconds)" > "$STATUS_FILE"
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Ensure source dir exists
mkdir -p "$SOURCE_DIR"
cd "$SOURCE_DIR"

write_status "1" "Starting upgrade to ${VERSION}"

# Step 1: Download docker-compose files
log "Downloading docker-compose.yml..."
curl -fsSL "${CDN}/docker-compose.yml" -o "${COMPOSE_FILE}"
log "Downloading docker-compose.prod.yml..."
curl -fsSL "${CDN}/docker-compose.prod.yml" -o "${COMPOSE_PROD}"
write_status "2" "Compose files downloaded"

# Step 2: Merge .env
log "Updating .env..."
if [ -f "$ENV_FILE" ]; then
  # Preserve JWT_SECRET (critical - must not change on upgrade)
  OLD_JWT=""
  if grep -q "^JWT_SECRET=..*" "$ENV_FILE" 2>/dev/null; then
    OLD_JWT=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
  fi
fi

# Download new template (overwrites)
curl -fsSL "${CDN}/.env.production" -o "$ENV_FILE"

# Restore JWT_SECRET if we had one
if [ -n "$OLD_JWT" ]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${OLD_JWT}|" "$ENV_FILE"
  else
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${OLD_JWT}|" "$ENV_FILE"
  fi
elif ! grep -q "^JWT_SECRET=..*" "$ENV_FILE" 2>/dev/null; then
  # Generate new JWT_SECRET for first install
  NEW_JWT=$(openssl rand -hex 32)
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|" "$ENV_FILE"
  else
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|" "$ENV_FILE"
  fi
fi

# Set version
if grep -q "^DOCKPILOT_VERSION=" "$ENV_FILE"; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^DOCKPILOT_VERSION=.*|DOCKPILOT_VERSION=${VERSION}|" "$ENV_FILE"
  else
    sed -i "s|^DOCKPILOT_VERSION=.*|DOCKPILOT_VERSION=${VERSION}|" "$ENV_FILE"
  fi
else
  echo "DOCKPILOT_VERSION=${VERSION}" >> "$ENV_FILE"
fi

write_status "3" "Environment updated"

# Step 3: Pull images
log "Pulling Docker images..."
export DOCKPILOT_VERSION="$VERSION"
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD" pull
write_status "4" "Images pulled"

# Step 4: Recreate containers
log "Recreating containers..."
docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_PROD" up -d --remove-orphans --force-recreate
write_status "5" "Containers recreated"

# Step 5: Cleanup old images
log "Cleaning up old images..."
docker image prune -f 2>/dev/null || true
write_status "6" "Upgrade complete"

log "DockPilot upgraded to ${VERSION} successfully."

# Remove status file after a delay (for install.sh polling)
(sleep 10 && rm -f "$STATUS_FILE") &
