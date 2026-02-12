#!/usr/bin/env bash
#
# DockPilot Installer - Main Installation Script
# ===============================================
# Instalador TUI completo para DockPilot
#

set -euo pipefail

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LIB_DIR="${SCRIPT_DIR}/lib"
readonly DOCKPILOT_HOME="${DOCKPILOT_HOME:-/opt/dockpilot}"
readonly DOCKPILOT_DATA="${DOCKPILOT_DATA:-/var/lib/dockpilot}"
readonly DOCKPILOT_LOGS="${DOCKPILOT_LOGS:-/var/log/dockpilot}"

source "${LIB_DIR}/common.sh"
source "${LIB_DIR}/tui.sh"
source "${LIB_DIR}/detect-distro.sh"
source "${LIB_DIR}/install-docker.sh"
source "${LIB_DIR}/install-cloudflared.sh"
source "${LIB_DIR}/setup-systemd.sh"

# Variables de instalación
INSTALL_DOCKER="auto"
INSTALL_CLOUDFLARED="ask"
SETUP_SYSTEMD="ask"
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"

step_welcome() {
    show_welcome "DockPilot Installer" "Docker Management Platform"
    echo
    log_info "Versión del instalador: $SCRIPT_VERSION"
    echo
    
    if [[ "$NON_INTERACTIVE" != "true" ]]; then
        if ! show_confirm "¿Desea continuar con la instalación?" "y"; then
            log_info "Instalación cancelada"
            exit 0
        fi
    fi
}

step_requirements() {
    log_info "Paso 1: Verificando requisitos..."
    check_bash_version "4.0" || exit 1
    check_sudo || { log_error "Se requieren privilegios root"; exit 1; }
    check_internet || { log_error "Se requiere Internet"; exit 1; }
    check_disk_space "/" 10 || exit 1
    check_memory 2
    log_success "Requisitos verificados"
}

step_detect_distro() {
    log_info "Paso 2: Detectando distribución..."
    init_distro_detection
    get_system_info
    
    if ! is_distro_supported; then
        log_warn "Distribución no soportada: $DISTRO"
        if [[ "$NON_INTERACTIVE" != "true" ]]; then
            show_confirm "¿Continuar de todos modos?" "n" || exit 1
        else
            exit 1
        fi
    fi
    log_success "Distribución: $DISTRO $DISTRO_VERSION"
}

step_install_docker() {
    log_info "Paso 3: Verificando Docker..."
    
    if docker_is_installed; then
        log_info "Docker ya está instalado"
        if ! docker_is_running; then
            start_docker_service
        fi
    else
        log_warn "Docker no está instalado"
        if [[ "$NON_INTERACTIVE" != "true" && "$INSTALL_DOCKER" == "ask" ]]; then
            show_confirm "¿Instalar Docker?" "y" && INSTALL_DOCKER="yes"
        fi
        
        if [[ "$INSTALL_DOCKER" == "yes" || "$INSTALL_DOCKER" == "auto" ]]; then
            install_docker || {
                log_error "No se pudo instalar Docker"
                exit 1
            }
        else
            log_error "Docker es requerido"
            exit 1
        fi
    fi
    log_success "Docker listo"
}

step_install_cloudflared() {
    log_info "Paso 4: Verificando cloudflared..."
    
    if cloudflared_is_installed; then
        log_info "cloudflared ya está instalado"
    else
        if [[ "$NON_INTERACTIVE" != "true" && "$INSTALL_CLOUDFLARED" == "ask" ]]; then
            show_confirm "¿Instalar cloudflared (para túneles)?" "n" && INSTALL_CLOUDFLARED="yes"
        fi
        
        if [[ "$INSTALL_CLOUDFLARED" == "yes" ]]; then
            install_cloudflared
        else
            log_info "cloudflared omitido (opcional)"
        fi
    fi
}

step_create_directories() {
    log_info "Paso 5: Creando directorios..."
    
    require_root
    
    ensure_dir "$DOCKPILOT_HOME" "755"
    ensure_dir "$DOCKPILOT_DATA" "755"
    ensure_dir "$DOCKPILOT_LOGS" "755"
    ensure_dir "${DOCKPILOT_DATA}/postgres" "700"
    ensure_dir "${DOCKPILOT_DATA}/redis" "700"
    ensure_dir "${DOCKPILOT_DATA}/certs" "700"
    
    log_success "Directorios creados"
}

step_download_images() {
    log_info "Paso 6: Descargando imágenes de DockPilot..."
    
    cd "$DOCKPILOT_HOME"
    
    if [[ -f "docker-compose.yml" ]]; then
        log_info "Descargando imágenes Docker..."
        docker compose pull || {
            log_warn "No se pudieron descargar todas las imágenes"
        }
    else
        log_warn "No se encontró docker-compose.yml"
    fi
    
    log_success "Imágenes listas"
}

step_setup_environment() {
    log_info "Paso 7: Configurando variables de entorno..."
    
    local env_file="${DOCKPILOT_HOME}/.env"
    
    if [[ ! -f "$env_file" ]]; then
        if [[ -f "${DOCKPILOT_HOME}/.env.example" ]]; then
            cp "${DOCKPILOT_HOME}/.env.example" "$env_file"
        else
            cat > "$env_file" <<EOF
# DockPilot Environment Configuration
NODE_ENV=production
API_PORT=3000

# Database
DATABASE_URL=postgresql://dockpilot:dockpilot@postgres:5432/dockpilot

# JWT
JWT_SECRET=$(openssl rand -hex 32)

# Data directories
DATA_DIR=${DOCKPILOT_DATA}
LOGS_DIR=${DOCKPILOT_LOGS}
EOF
        fi
        log_success "Archivo .env creado"
    else
        log_info ".env ya existe"
    fi
}

step_setup_systemd() {
    log_info "Paso 8: Configurando systemd..."
    
    if ! systemd_is_available; then
        log_warn "systemd no disponible"
        return 0
    fi
    
    if [[ "$NON_INTERACTIVE" != "true" && "$SETUP_SYSTEMD" == "ask" ]]; then
        show_confirm "¿Configurar servicio systemd?" "y" && SETUP_SYSTEMD="yes"
    fi
    
    if [[ "$SETUP_SYSTEMD" == "yes" ]]; then
        create_service
        enable_service
        
        if show_confirm "¿Iniciar DockPilot ahora?" "y"; then
            start_service
        fi
        
        log_success "Servicio systemd configurado"
    fi
}

step_summary() {
    log_info "Paso 9: Resumen de la instalación"
    echo
    echo "=============================================="
    echo "     DOCKPILOT INSTALADO CORRECTAMENTE"
    echo "=============================================="
    echo
    echo "Directorio de instalación: $DOCKPILOT_HOME"
    echo "Datos:                     $DOCKPILOT_DATA"
    echo "Logs:                      $DOCKPILOT_LOGS"
    echo
    
    if systemd_is_available && service_exists; then
        echo "Servicio systemd:          $SYSTEMD_SERVICE_NAME"
        echo "Estado:                    $(service_is_running && echo "Corriendo" || echo "Detenido")"
        echo
        echo "Comandos útiles:"
        echo "  systemctl status $SYSTEMD_SERVICE_NAME"
        echo "  systemctl start $SYSTEMD_SERVICE_NAME"
        echo "  systemctl stop $SYSTEMD_SERVICE_NAME"
        echo "  journalctl -u $SYSTEMD_SERVICE_NAME -f"
    else
        echo "Para iniciar DockPilot manualmente:"
        echo "  cd $DOCKPILOT_HOME && docker compose up -d"
    fi
    echo
    echo "=============================================="
}

main() {
    init_tui
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --non-interactive)
                NON_INTERACTIVE="true"
                shift
                ;;
            --install-docker)
                INSTALL_DOCKER="yes"
                shift
                ;;
            --no-docker)
                INSTALL_DOCKER="no"
                shift
                ;;
            --install-cloudflared)
                INSTALL_CLOUDFLARED="yes"
                shift
                ;;
            --with-systemd)
                SETUP_SYSTEMD="yes"
                shift
                ;;
            --no-systemd)
                SETUP_SYSTEMD="no"
                shift
                ;;
            --version)
                DOCKPILOT_VERSION="$2"
                shift 2
                ;;
            -h|--help)
                echo "Uso: $0 [OPCIONES]"
                echo ""
                echo "Opciones:"
                echo "  --non-interactive      Modo no interactivo"
                echo "  --install-docker       Instalar Docker automáticamente"
                echo "  --no-docker            No instalar Docker"
                echo "  --install-cloudflared  Instalar cloudflared"
                echo "  --with-systemd         Configurar servicio systemd"
                echo "  --no-systemd           No configurar systemd"
                echo "  --version VERSION      Versión de DockPilot a instalar"
                echo "  -h, --help             Mostrar ayuda"
                exit 0
                ;;
            *)
                log_error "Opción desconocida: $1"
                exit 1
                ;;
        esac
    done
    
    step_welcome
    step_requirements
    step_detect_distro
    step_install_docker
    step_install_cloudflared
    step_create_directories
    step_download_images
    step_setup_environment
    step_setup_systemd
    step_summary
    
    log_success "Instalación completada exitosamente!"
}

main "$@"
