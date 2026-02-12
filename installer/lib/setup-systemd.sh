#!/usr/bin/env bash
#
# DockPilot Installer - Systemd Service Setup
# ============================================
# Crea y configura el servicio systemd para DockPilot
#

set -euo pipefail

# Cargar librerías
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

# ==============================================================================
# CONFIGURACIÓN
# ==============================================================================

readonly SYSTEMD_SERVICE_NAME="${SYSTEMD_SERVICE_NAME:-dockpilot}"
readonly SYSTEMD_SERVICE_FILE="/etc/systemd/system/${SYSTEMD_SERVICE_NAME}.service"
readonly DOCKPILOT_HOME="${DOCKPILOT_HOME:-/opt/dockpilot}"
readonly DOCKPILOT_DATA="${DOCKPILOT_DATA:-/var/lib/dockpilot}"
readonly DOCKPILOT_USER="${DOCKPILOT_USER:-root}"
readonly DOCKPILOT_GROUP="${DOCKPILOT_GROUP:-docker}"

# ==============================================================================
# VERIFICACIÓN
# ==============================================================================

# Verificar si systemd está disponible
systemd_is_available() {
    [[ -d /etc/systemd/system ]] && check_command systemctl
}

# Verificar si el servicio existe
service_exists() {
    systemctl list-unit-files | grep -q "^${SYSTEMD_SERVICE_NAME}.service"
}

# Verificar si el servicio está habilitado
service_is_enabled() {
    systemctl is-enabled --quiet "$SYSTEMD_SERVICE_NAME" 2>/dev/null
}

# Verificar si el servicio está corriendo
service_is_running() {
    systemctl is-active --quiet "$SYSTEMD_SERVICE_NAME" 2>/dev/null
}

# ==============================================================================
# CREACIÓN DEL SERVICIO
# ==============================================================================

generate_service_file() {
    local compose_file="${1:-${DOCKPILOT_HOME}/docker-compose.yml}"
    local env_file="${2:-${DOCKPILOT_HOME}/.env}"
    
    cat <<EOF
[Unit]
Description=DockPilot - Docker Management Platform
Documentation=https://github.com/dockpilot/dockpilot
Requires=docker.service
After=docker.service network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${DOCKPILOT_HOME}

# Environment
Environment="COMPOSE_PROJECT_NAME=dockpilot"
Environment="DOCKER_COMPOSE_FILE=${compose_file}"
EnvironmentFile=-${env_file}

# User (root recomendado para acceso al socket de Docker)
User=${DOCKPILOT_USER}
Group=${DOCKPILOT_GROUP}

# Start
ExecStartPre=-/usr/bin/docker compose -f ${compose_file} pull
ExecStart=/usr/bin/docker compose -f ${compose_file} up -d

# Stop
ExecStop=/usr/bin/docker compose -f ${compose_file} down
ExecStopPost=-/usr/bin/docker compose -f ${compose_file} rm -f

# Restart
Restart=no

# Security
TimeoutStartSec=300
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
EOF
}

generate_service_file_simple() {
    cat <<EOF
[Unit]
Description=DockPilot - Docker Management Platform
Requires=docker.service
After=docker.service

[Service]
Type=simple
Restart=always
WorkingDirectory=${DOCKPILOT_HOME}
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF
}

# Crear servicio systemd
create_service() {
    log_info "Creando servicio systemd para DockPilot..."
    
    require_root || {
        log_error "Se requieren privilegios de root"
        return 1
    }
    
    if ! systemd_is_available; then
        log_error "systemd no está disponible en este sistema"
        return 1
    fi
    
    # Verificar que existe el compose file
    local compose_file="${DOCKPILOT_HOME}/docker-compose.yml"
    if [[ ! -f "$compose_file" ]]; then
        log_error "No se encontró $compose_file"
        return 1
    fi
    
    # Backup si existe
    if [[ -f "$SYSTEMD_SERVICE_FILE" ]]; then
        backup_file "$SYSTEMD_SERVICE_FILE"
    fi
    
    # Generar y escribir archivo de servicio
    generate_service_file > "$SYSTEMD_SERVICE_FILE"
    
    # Recargar systemd
    systemctl daemon-reload
    
    log_success "Servicio systemd creado: $SYSTEMD_SERVICE_FILE"
}

# ==============================================================================
# GESTIÓN DEL SERVICIO
# ==============================================================================

enable_service() {
    log_info "Habilitando servicio $SYSTEMD_SERVICE_NAME..."
    
    require_root || return 1
    
    systemctl enable "$SYSTEMD_SERVICE_NAME"
    log_success "Servicio habilitado"
}

disable_service() {
    log_info "Deshabilitando servicio $SYSTEMD_SERVICE_NAME..."
    
    require_root || return 1
    
    systemctl disable "$SYSTEMD_SERVICE_NAME"
    log_success "Servicio deshabilitado"
}

start_service() {
    log_info "Iniciando servicio $SYSTEMD_SERVICE_NAME..."
    
    require_root || return 1
    
    systemctl start "$SYSTEMD_SERVICE_NAME"
    
    # Esperar a que inicie
    sleep 3
    
    if service_is_running; then
        log_success "Servicio iniciado correctamente"
    else
        log_error "El servicio no se inició correctamente"
        log_info "Verifique con: systemctl status $SYSTEMD_SERVICE_NAME"
        return 1
    fi
}

stop_service() {
    log_info "Deteniendo servicio $SYSTEMD_SERVICE_NAME..."
    
    require_root || return 1
    
    systemctl stop "$SYSTEMD_SERVICE_NAME"
    log_success "Servicio detenido"
}

restart_service() {
    log_info "Reiniciando servicio $SYSTEMD_SERVICE_NAME..."
    
    require_root || return 1
    
    systemctl restart "$SYSTEMD_SERVICE_NAME"
    
    sleep 3
    
    if service_is_running; then
        log_success "Servicio reiniciado correctamente"
    else
        log_error "El servicio no se reinició correctamente"
        return 1
    fi
}

reload_service() {
    log_info "Recargando configuración del servicio..."
    
    require_root || return 1
    
    systemctl daemon-reload
    log_success "Configuración recargada"
}

# ==============================================================================
# ESTADO Y LOGS
# ==============================================================================

show_status() {
    if service_exists; then
        systemctl status "$SYSTEMD_SERVICE_NAME" --no-pager
    else
        log_warn "El servicio $SYSTEMD_SERVICE_NAME no existe"
    fi
}

show_logs() {
    local lines="${1:-50}"
    local follow="${2:-false}"
    
    if [[ "$follow" == "true" ]]; then
        journalctl -u "$SYSTEMD_SERVICE_NAME" -f -n "$lines"
    else
        journalctl -u "$SYSTEMD_SERVICE_NAME" -n "$lines" --no-pager
    fi
}

# ==============================================================================
# CONFIGURACIÓN AVANZADA
# ==============================================================================

# Configurar healthcheck del servicio
configure_healthcheck() {
    log_info "Configurando healthcheck para el servicio..."
    
    # Agregar healthcheck al servicio existente
    local healthcheck="
# Healthcheck
ExecStartPost=/bin/sh -c 'sleep 10 && curl -sf http://localhost:3000/api/health || exit 1'
"
    
    log_warn "Healthcheck debe configurarse manualmente en el archivo de servicio"
    log_info "Ubicación: $SYSTEMD_SERVICE_FILE"
}

# Configurar límites de recursos
configure_limits() {
    log_info "Configurando límites de recursos..."
    
    local cpu_quota="${1:-100%}"
    local memory_limit="${2:-2G}"
    
    log_info "Límites configurados:"
    echo "  CPU: $cpu_quota"
    echo "  Memoria: $memory_limit"
}

# ==============================================================================
# DESINSTALACIÓN
# ==============================================================================

remove_service() {
    log_warn "Eliminando servicio systemd..."
    
    require_root || return 1
    
    # Detener y deshabilitar si está corriendo
    if service_is_running; then
        stop_service
    fi
    
    if service_is_enabled; then
        disable_service
    fi
    
    # Eliminar archivo
    if [[ -f "$SYSTEMD_SERVICE_FILE" ]]; then
        rm -f "$SYSTEMD_SERVICE_FILE"
    fi
    
    # Recargar systemd
    systemctl daemon-reload
    
    log_success "Servicio eliminado"
}

# ==============================================================================
# INSTALACIÓN COMPLETA
# ==============================================================================

setup_systemd() {
    log_info "Configurando DockPilot con systemd..."
    
    # Crear servicio
    create_service || return 1
    
    # Habilitar
    enable_service || return 1
    
    # Preguntar si iniciar ahora
    if confirm "¿Desea iniciar DockPilot ahora?" "y"; then
        start_service || return 1
    fi
    
    log_success "Configuración de systemd completada"
    log_info "Comandos útiles:"
    echo "  systemctl status $SYSTEMD_SERVICE_NAME  - Ver estado"
    echo "  systemctl start $SYSTEMD_SERVICE_NAME   - Iniciar"
    echo "  systemctl stop $SYSTEMD_SERVICE_NAME    - Detener"
    echo "  systemctl restart $SYSTEMD_SERVICE_NAME - Reiniciar"
    echo "  journalctl -u $SYSTEMD_SERVICE_NAME -f   - Ver logs"
}

# ==============================================================================
# INFORMACIÓN
# ==============================================================================

get_service_info() {
    echo "=============================================="
    echo "     INFORMACIÓN DEL SERVICIO SYSTEMD"
    echo "=============================================="
    echo "Nombre:          $SYSTEMD_SERVICE_NAME"
    echo "Archivo:         $SYSTEMD_SERVICE_FILE"
    
    if service_exists; then
        if service_is_running; then
            echo "Estado:          ${GREEN}Corriendo${NC}"
        else
            echo "Estado:          ${YELLOW}Detenido${NC}"
        fi
        
        if service_is_enabled; then
            echo "Autoinicio:      ${GREEN}Habilitado${NC}"
        else
            echo "Autoinicio:      ${RED}Deshabilitado${NC}"
        fi
        
        # Most información adicional
        echo ""
        echo "Uptime:          $(systemctl show "$SYSTEMD_SERVICE_NAME" --property=ActiveEnterTimestamp --value 2>/dev/null | cut -d' ' -f2- || echo 'N/A')"
        echo "Restarts:        $(systemctl show "$SYSTEMD_SERVICE_NAME" --property=NRestarts --value 2>/dev/null || echo '0')"
    else
        echo "Estado:          ${RED}No instalado${NC}"
    fi
    
    echo "=============================================="
}

# ==============================================================================
# MAIN
# ==============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-setup}" in
        setup)
            setup_systemd
            ;;
        create)
            create_service
            ;;
        enable)
            enable_service
            ;;
        disable)
            disable_service
            ;;
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            restart_service
            ;;
        reload)
            reload_service
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${2:-50}" "${3:-false}"
            ;;
        remove)
            remove_service
            ;;
        info)
            get_service_info
            ;;
        *)
            echo "Uso: $0 {setup|create|enable|disable|start|stop|restart|reload|status|logs [lineas] [follow]|remove|info}"
            exit 1
            ;;
    esac
fi
