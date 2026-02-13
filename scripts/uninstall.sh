#!/bin/bash
#
# DockPilot Uninstall Script (for curl-installed instances)
#
# Removes DockPilot installed via the one-liner to /data/dockpilot/
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/marweb/DockerPilot/main/scripts/uninstall.sh | sudo bash
#   # Or if already installed:
#   /data/dockpilot/source/uninstall.sh

set -e

DOCKPILOT_HOME="${DOCKPILOT_HOME:-/data/dockpilot}"
SOURCE_DIR="${DOCKPILOT_HOME}/source"

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

echo ""
echo "=============================================="
echo "     DockPilot Uninstall"
echo "=============================================="
echo ""
echo "This will remove DockPilot from ${DOCKPILOT_HOME}"
echo ""

read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

if [ -d "$SOURCE_DIR" ] && [ -f "${SOURCE_DIR}/docker-compose.yml" ]; then
  echo "Stopping containers..."
  cd "$SOURCE_DIR"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true
  echo "Containers stopped."
fi

echo "Removing DockPilot files..."
rm -rf "$DOCKPILOT_HOME"
echo "Done."

echo ""
echo "DockPilot has been uninstalled."
echo "Docker volumes were preserved. To remove them: docker volume prune -f"
echo ""
