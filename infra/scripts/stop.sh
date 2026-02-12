#!/bin/bash
#
# DockPilot Stack Shutdown Script
#
# This script stops and optionally removes the DockPilot services.
#
# Usage:
#   ./stop.sh [options]
#
# Options:
#   -v, --volumes   Also remove named volumes (WARNING: deletes all data!)
#   -f, --force     Force stop without confirmation
#   -h, --help      Show this help message

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$INFRA_DIR")"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-dockpilot}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
REMOVE_VOLUMES=false
FORCE=false

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show help
show_help() {
    cat << EOF
DockPilot Stack Shutdown Script

Usage: $0 [options]

Options:
  -v, --volumes   Also remove named volumes (WARNING: deletes all data!)
  -f, --force     Force stop without confirmation
  -h, --help      Show this help message

Examples:
  $0              # Stop services normally
  $0 -v           # Stop services and remove volumes
  $0 --force      # Stop without confirmation
EOF
}

# Check if Docker Compose is available
check_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        log_error "Docker Compose is not installed"
        exit 1
    fi
}

# Stop services
stop_services() {
    local compose_args=""
    
    if [[ "$REMOVE_VOLUMES" == true ]]; then
        compose_args="-v"
    fi
    
    log_info "Stopping DockPilot services..."
    
    cd "$PROJECT_ROOT"
    export COMPOSE_PROJECT_NAME
    
    # Stop both dev and prod configurations
    for compose_file in "$INFRA_DIR/docker-compose.yml" "$INFRA_DIR/docker-compose.dev.yml"; do
        if [[ -f "$compose_file" ]]; then
            $COMPOSE_CMD -f "$compose_file" down $compose_args 2>/dev/null || true
        fi
    done
    
    log_success "Services stopped successfully"
}

# Confirmation prompt
confirm() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi
    
    local message="$1"
    
    echo ""
    log_warn "$message"
    echo ""
    read -p "Are you sure? [y/N] " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        log_info "Operation cancelled"
        exit 0
    fi
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--volumes)
                REMOVE_VOLUMES=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main execution
main() {
    parse_args "$@"
    
    echo "=================================="
    echo "   DockPilot Stack Shutdown"
    echo "=================================="
    echo ""
    
    check_compose
    
    # Confirm if removing volumes
    if [[ "$REMOVE_VOLUMES" == true ]]; then
        confirm "This will stop all DockPilot services and DELETE ALL DATA in volumes!"
    fi
    
    stop_services
    
    echo ""
    log_success "DockPilot has been stopped"
    
    if [[ "$REMOVE_VOLUMES" == true ]]; then
        log_warn "All data volumes have been removed"
    fi
    
    echo ""
    echo "To start again, run: $INFRA_DIR/scripts/start.sh"
}

# Run main function
main "$@"
