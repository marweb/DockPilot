#!/bin/bash
#
# DockPilot Update Script
#
# This script updates the DockPilot stack to the latest version.
# It performs a rolling update with minimal downtime.
#
# Usage:
#   ./update.sh [options]
#
# Options:
#   -b, --backup    Create backup before updating (recommended)
#   -f, --force     Force update without confirmation
#   --dev           Update development environment
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
CREATE_BACKUP=false
FORCE=false
DEV_MODE=false

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
DockPilot Update Script

Usage: $0 [options]

Options:
  -b, --backup    Create backup before updating (recommended)
  -f, --force     Force update without confirmation
  --dev           Update development environment
  -h, --help      Show this help message

This script will:
  1. Pull the latest images/code
  2. Optionally create a backup
  3. Restart services with new version
  4. Verify services are healthy

Examples:
  $0              # Update with confirmation
  $0 -b           # Create backup and update
  $0 -f           # Force update without confirmation
  $0 --dev        # Update development environment
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

# Get compose file based on mode
get_compose_file() {
    if [[ "$DEV_MODE" == true ]]; then
        echo "$INFRA_DIR/docker-compose.dev.yml"
    else
        echo "$INFRA_DIR/docker-compose.yml"
    fi
}

# Check for updates
check_for_updates() {
    log_info "Checking for updates..."
    
    cd "$PROJECT_ROOT"
    
    # Check if this is a git repository
    if [[ -d ".git" ]]; then
        # Fetch latest changes
        git fetch origin &>/dev/null || true
        
        local local_hash
        local remote_hash
        local_hash=$(git rev-parse HEAD)
        remote_hash=$(git rev-parse origin/HEAD 2>/dev/null || echo "$local_hash")
        
        if [[ "$local_hash" != "$remote_hash" ]]; then
            log_info "New version available"
            return 0
        else
            log_info "Already up to date"
            return 1
        fi
    else
        log_warn "Not a git repository, cannot check for updates"
        return 1
    fi
}

# Pull latest code
pull_latest() {
    log_info "Pulling latest code..."
    
    cd "$PROJECT_ROOT"
    
    if [[ -d ".git" ]]; then
        git pull origin HEAD || {
            log_error "Failed to pull latest code"
            exit 1
        }
        log_success "Code updated successfully"
    fi
}

# Create backup
create_backup() {
    if [[ "$CREATE_BACKUP" == true ]]; then
        log_info "Creating backup before update..."
        
        if [[ -x "$SCRIPT_DIR/backup.sh" ]]; then
            "$SCRIPT_DIR/backup.sh" --quiet
            log_success "Backup created"
        else
            log_warn "Backup script not found or not executable"
        fi
    fi
}

# Pull latest images
pull_images() {
    log_info "Pulling latest Docker images..."
    
    cd "$PROJECT_ROOT"
    local compose_file
    compose_file=$(get_compose_file)
    
    export COMPOSE_PROJECT_NAME
    $COMPOSE_CMD -f "$compose_file" pull
    
    log_success "Images updated"
}

# Update services
update_services() {
    log_info "Updating services..."
    
    cd "$PROJECT_ROOT"
    local compose_file
    compose_file=$(get_compose_file)
    
    export COMPOSE_PROJECT_NAME
    
    # Build and recreate containers
    $COMPOSE_CMD -f "$compose_file" up --build -d
    
    log_success "Services updated"
}

# Wait for services to be healthy
wait_for_healthy() {
    local timeout=120
    local interval=5
    local elapsed=0
    
    log_info "Waiting for services to become healthy..."
    
    while [[ $elapsed -lt $timeout ]]; do
        local all_healthy=true
        local compose_file
        compose_file=$(get_compose_file)
        
        # Get list of services
        local services
        services=$($COMPOSE_CMD -f "$compose_file" ps --services 2>/dev/null || echo "")
        
        for service in $services; do
            local container_name="${COMPOSE_PROJECT_NAME}-${service}"
            if [[ "$DEV_MODE" == true ]]; then
                container_name="${container_name}-dev"
            fi
            
            local health_status
            health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "unknown")
            
            if [[ "$health_status" != "healthy" && "$health_status" != "none" ]]; then
                all_healthy=false
                break
            fi
        done
        
        if [[ "$all_healthy" == true ]]; then
            log_success "All services are healthy"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    echo ""
    log_warn "Timeout waiting for services to become healthy"
    return 1
}

# Cleanup old images
cleanup_images() {
    log_info "Cleaning up old images..."
    
    # Remove dangling images
    docker image prune -f &>/dev/null || true
    
    # Remove images from previous versions (keep current)
    local compose_file
    compose_file=$(get_compose_file)
    
    # Get current image IDs
    local current_images
    current_images=$($COMPOSE_CMD -f "$compose_file" images -q 2>/dev/null | sort -u)
    
    # Remove old images that are not in use
    docker images --format "{{.ID}} {{.Repository}}:{{.Tag}}" | while read -r id name; do
        if ! echo "$current_images" | grep -q "^${id}$"; then
            if [[ "$name" == *dockpilot* ]] || [[ "$name" == *dock-pilot* ]]; then
                docker rmi "$id" &>/dev/null || true
            fi
        fi
    done
    
    log_success "Cleanup completed"
}

# Confirmation prompt
confirm() {
    if [[ "$FORCE" == true ]]; then
        return 0
    fi
    
    echo ""
    log_warn "This will update DockPilot to the latest version"
    echo ""
    read -p "Do you want to continue? [y/N] " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    else
        log_info "Update cancelled"
        exit 0
    fi
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -b|--backup)
                CREATE_BACKUP=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            --dev)
                DEV_MODE=true
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
    echo "   DockPilot Update"
    echo "=================================="
    echo ""
    
    check_compose
    confirm
    
    # Pull latest code if in production mode
    if [[ "$DEV_MODE" == false ]]; then
        pull_latest
    fi
    
    create_backup
    pull_images
    update_services
    
    if wait_for_healthy; then
        cleanup_images
        
        echo ""
        log_success "DockPilot has been updated successfully!"
        echo ""
        
        if [[ "$DEV_MODE" == true ]]; then
            echo "Development environment updated"
        else
            log_info "You can view logs with: $SCRIPT_DIR/logs.sh"
        fi
    else
        log_error "Update completed but some services may not be healthy"
        log_info "Check logs with: $SCRIPT_DIR/logs.sh"
        exit 1
    fi
}

# Run main function
main "$@"
