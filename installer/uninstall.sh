#!/usr/bin/env bash
#
# DockPilot Installer - Uninstall Script
# =======================================
# Desinstalador completo de DockPilot
#

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LIB_DIR="${SCRIPT_DIR}/lib"
readonly DOCKPILOT_HOME="${DOCKPILOT_HOME:-/opt/dockpilot}"
readonly DOCKPILOT_DATA="${DOCKPILOT_DATA:-/var/lib/dockpilot}"
readonly DOCKPILOT_LOGS="${DOCKPILOT_LOGS:-/var/log/dockpilot}"

source "${LIB_DIR}/common.sh"
source "${LIB_DIR}/tui.sh"
source "${LIB_DIR}/setup-systemd.sh"

NON_INTERACTIVE="${NON_INTERACTIVE:-false}"
REMOVE_VOLUMES=false
REMOVE_IMAGES=false
REMOVE_DATA=false
FORCE=false

show_warning() {
    echo
    echo "=============================================="
    echo "     ADVERTENCIA: DESINSTALACIÓN"
    echo "=============================================="
    echo
    echo "Este script eliminará DockPilot del sistema."
    echo
    echo "Se realizarán las siguientes acciones:"
    echo "  - Detener servicios DockPilot"
    echo "  - Eliminar contenedores DockPilot"
    echo "  - Eliminar servicio systemd (si existe)"
    echo
    
    if [[ "$REMOVE_VOLUMES" == "true" ]]; then
        echo "  - ELIMINAR VOLÚMENES DE DATOS (incluyendo BD)"
    fi
    
    if [[ "$REMOVE_IMAGES" == "true" ]]; then
        echo "  - Eliminar imágenes Docker de DockPilot"
    fi
    
    if [[ "$REMOVE_DATA" == "true" ]]; then
        echo "  - ELIMINAR TODOS LOS DATOS: $DOCKPILOT_DATA"
    fi
    
    echo
    echo "=============================================="
    echo
    
    if [[ "$FORCE" != "true" && "$NON_INTERACTIVE" != "true" ]]; then
        if ! show_confirm "¿Está seguro de que desea continuar?" "n"; then
            log_info "Desinstalación cancelada"
            exit 0
        fi
    fi
}

stop_services() {
    log_info "Deteniendo servicios..."
    
    if systemd_is_available && service_exists 2>/dev/null; then
        stop_service 2>/dev/null || true
        disable_service 2>/dev/null || true
        remove_service 2>/dev/null || true
        log_success "Servicio systemd eliminado"
    fi
    
    if [[ -d "$DOCKPILOT_HOME" ]]; then
        cd "$DOCKPILOT_HOME" 2>/dev/null || return 0
        
        if [[ -f "docker-compose.yml" ]]; then
            log_info "Deteniendo contenedores..."
            docker compose down 2>/dev/null || true
            log_success "Contenedores detenidos"
        fi
    fi
}

remove_containers() {
    log_info "Eliminando contenedores..."
    
    local containers
    containers=$(docker ps -aq --filter "name=dockpilot" 2>/dev/null || true)
    
    if [[ -n "$containers" ]]; then
        docker rm -f $containers 2>/dev/null || true
        log_success "Contenedores eliminados"
    else
        log_info "No hay contenedores de DockPilot"
    fi
}

remove_volumes() {
    if [[ "$REMOVE_VOLUMES" != "true" ]]; then
        return 0
    fi
    
    log_warn "Eliminando volúmenes..."
    
    if [[ "$NON_INTERACTIVE" != "true" && "$FORCE" != "true" ]]; then
        if ! show_confirm "¿Eliminar todos los volúmenes de DockPilot? (Esto eliminará TODOS los datos)" "n"; then
            log_info "Volúmenes preservados"
            return 0
        fi
    fi
    
    local volumes
    volumes=$(docker volume ls -q --filter "name=dockpilot" 2>/dev/null || true)
    
    if [[ -n "$volumes" ]]; then
        docker volume rm $volumes 2>/dev/null || true
        log_success "Volúmenes eliminados"
    else
        log_info "No hay volúmenes de DockPilot"
    fi
}

remove_images() {
    if [[ "$REMOVE_IMAGES" != "true" ]]; then
        return 0
    fi
    
    log_info "Eliminando imágenes..."
    
    local images
    images=$(docker images -q "dockpilot/*" 2>/dev/null || true)
    
    if [[ -n "$images" ]]; then
        docker rmi $images 2>/dev/null || true
        log_success "Imágenes eliminadas"
    else
        log_info "No hay imágenes de DockPilot"
    fi
}

remove_data() {
    if [[ "$REMOVE_DATA" != "true" ]]; then
        return 0
    fi
    
    log_warn "Eliminando datos de DockPilot..."
    
    if [[ "$NON_INTERACTIVE" != "true" && "$FORCE" != "true" ]]; then
        if ! show_confirm "¿Eliminar permanentemente todos los datos en $DOCKPILOT_DATA?" "n"; then
            log_info "Datos preservados"
            return 0
        fi
    fi
    
    if [[ -d "$DOCKPILOT_HOME" ]]; then
        rm -rf "$DOCKPILOT_HOME"
        log_success "Directorio de instalación eliminado: $DOCKPILOT_HOME"
    fi
    
    if [[ -d "$DOCKPILOT_DATA" ]]; then
        rm -rf "$DOCKPILOT_DATA"
        log_success "Datos eliminados: $DOCKPILOT_DATA"
    fi
    
    if [[ -d "$DOCKPILOT_LOGS" ]]; then
        rm -rf "$DOCKPILOT_LOGS"
        log_success "Logs eliminados: $DOCKPILOT_LOGS"
    fi
}

cleanup() {
    log_info "Limpiando residuos..."
    
    # Limpiar redes no utilizadas
    docker network prune -f 2>/dev/null || true
    
    log_success "Limpieza completada"
}

show_summary() {
    echo
    echo "=============================================="
    echo "     DOCKPILOT DESINSTALADO"
    echo "=============================================="
    echo
    echo "DockPilot ha sido removido del sistema."
    echo
    
    if [[ "$REMOVE_DATA" != "true" ]]; then
        echo "Los datos se han preservado en:"
        echo "  $DOCKPILOT_DATA"
        echo
        echo "Para eliminarlos manualmente:"
        echo "  sudo rm -rf $DOCKPILOT_DATA"
    fi
    
    echo
    echo "=============================================="
}

main() {
    init_tui
    
    # Parsear argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --volumes)
                REMOVE_VOLUMES=true
                shift
                ;;
            --images)
                REMOVE_IMAGES=true
                shift
                ;;
            --data)
                REMOVE_DATA=true
                shift
                ;;
            --all)
                REMOVE_VOLUMES=true
                REMOVE_IMAGES=true
                REMOVE_DATA=true
                shift
                ;;
            --force)
                FORCE=true
                NON_INTERACTIVE=true
                shift
                ;;
            --non-interactive)
                NON_INTERACTIVE=true
                shift
                ;;
            -h|--help)
                echo "Uso: $0 [OPCIONES]"
                echo ""
                echo "Opciones:"
                echo "  --volumes         Eliminar volúmenes Docker"
                echo "  --images          Eliminar imágenes Docker"
                echo "  --data            Eliminar todos los datos"
                echo "  --all             Eliminar todo (equivalente a --volumes --images --data)"
                echo "  --force           Forzar desinstalación sin confirmar"
                echo "  --non-interactive Modo no interactivo"
                echo "  -h, --help        Mostrar ayuda"
                echo ""
                echo "Ejemplos:"
                echo "  $0                          # Desinstalar conservando datos"
                echo "  $0 --all --force            # Eliminar todo sin confirmar"
                exit 0
                ;;
            *)
                log_error "Opción desconocida: $1"
                exit 1
                ;;
        esac
    done
    
    require_root || { log_error "Se requieren privilegios root"; exit 1; }
    
    show_warning
    stop_services
    remove_containers
    remove_volumes
    remove_images
    remove_data
    cleanup
    show_summary
    
    log_success "Desinstalación completada"
}

main "$@"
