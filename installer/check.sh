#!/usr/bin/env bash
#
# DockPilot Installer - Requirements Check
# =========================================
# Script para verificar requisitos de DockPilot
#

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LIB_DIR="${SCRIPT_DIR}/lib"

source "${LIB_DIR}/common.sh"
source "${LIB_DIR}/detect-distro.sh"
source "${LIB_DIR}/install-docker.sh"

ERRORS=0
WARNINGS=0

check_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

check_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

check_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

check_system() {
    echo "=============================================="
    echo "     VERIFICACIÓN DE REQUISITOS"
    echo "=============================================="
    echo
    
    # Bash version
    local bash_version="${BASH_VERSION%%[^0-9.]*}"
    if [[ "$(printf '%s\n' "4.0" "$bash_version" | sort -V | head -n1)" == "4.0" ]]; then
        check_pass "Bash version >= 4.0 ($bash_version)"
    else
        check_fail "Bash version >= 4.0 requerida (actual: $bash_version)"
    fi
    
    # Root/sudo
    if [[ $EUID -eq 0 ]]; then
        check_pass "Ejecutando como root"
    elif check_command sudo && sudo -n true 2>/dev/null; then
        check_pass "Sudo disponible sin password"
    else
        check_warn "No tiene privilegios root ni sudo configurado"
    fi
    
    # Internet
    if check_internet 2>/dev/null; then
        check_pass "Conectividad a Internet"
    else
        check_fail "Sin conectividad a Internet"
    fi
    
    # Arquitectura
    local arch
    arch=$(uname -m)
    if [[ "$arch" == "x86_64" || "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
        check_pass "Arquitectura soportada ($arch)"
    else
        check_warn "Arquitectura no probada: $arch"
    fi
    
    echo
}

check_distro() {
    echo "=============================================="
    echo "     DISTRIBUCIÓN LINUX"
    echo "=============================================="
    echo
    
    init_distro_detection
    
    check_info "Distribución: $DISTRO $DISTRO_VERSION"
    check_info "ID: $DISTRO_ID"
    check_info "Gestor de paquetes: $PKG_MANAGER"
    
    if is_distro_supported; then
        check_pass "Distribución soportada"
    else
        check_warn "Distribución no oficialmente soportada"
    fi
    
    # Kernel
    check_info "Kernel: $(uname -r)"
    
    # WSL/Container check
    if [[ -f /proc/version ]] && grep -q "Microsoft" /proc/version; then
        check_warn "Ejecutando en WSL"
    fi
    
    if [[ -f /.dockerenv ]]; then
        check_warn "Ejecutando dentro de un contenedor Docker"
    fi
    
    echo
}

check_docker() {
    echo "=============================================="
    echo "     DOCKER"
    echo "=============================================="
    echo
    
    if is_docker_installed; then
        check_pass "Docker instalado"
        check_info "Versión: $(docker --version)"
        
        if is_docker_running; then
            check_pass "Docker está corriendo"
            
            # Info adicional
            check_info "Contenedores: $(docker ps -aq 2>/dev/null | wc -l)"
            check_info "Imágenes: $(docker images -q 2>/dev/null | wc -l)"
        else
            check_fail "Docker está instalado pero no corriendo"
        fi
        
        if is_compose_installed; then
            check_pass "Docker Compose v2 instalado"
            check_info "Versión: $(docker compose version)"
        else
            check_fail "Docker Compose v2 no está instalado"
        fi
    else
        check_fail "Docker no está instalado"
    fi
    
    echo
}

check_resources() {
    echo "=============================================="
    echo "     RECURSOS DEL SISTEMA"
    echo "=============================================="
    echo
    
    # CPU
    local cpu_count
    cpu_count=$(nproc)
    if [[ $cpu_count -ge 2 ]]; then
        check_pass "CPUs: $cpu_count"
    else
        check_warn "CPUs: $cpu_count (recomendado: 2+)"
    fi
    
    # Memoria
    local mem_kb
    mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local mem_gb=$((mem_kb / 1024 / 1024))
    if [[ $mem_gb -ge 4 ]]; then
        check_pass "Memoria RAM: ${mem_gb}GB"
    elif [[ $mem_gb -ge 2 ]]; then
        check_warn "Memoria RAM: ${mem_gb}GB (mínimo recomendado: 4GB)"
    else
        check_fail "Memoria RAM: ${mem_gb}GB (mínimo: 2GB)"
    fi
    
    # Disco
    local disk_kb
    disk_kb=$(df -k / | awk 'NR==2 {print $4}')
    local disk_gb=$((disk_kb / 1024 / 1024))
    if [[ $disk_gb -ge 20 ]]; then
        check_pass "Espacio en disco: ${disk_gb}GB"
    elif [[ $disk_gb -ge 10 ]]; then
        check_warn "Espacio en disco: ${disk_gb}GB (mínimo recomendado: 20GB)"
    else
        check_fail "Espacio en disco: ${disk_gb}GB (mínimo: 10GB)"
    fi
    
    # Puertos comunes
    echo
    check_info "Verificando puertos..."
    
    local ports=(80 443 3000 8080)
    for port in "${ports[@]}"; do
        if is_port_in_use "$port" 2>/dev/null; then
            check_warn "Puerto $port está en uso"
        else
            check_pass "Puerto $port disponible"
        fi
    done
    
    echo
}

check_optional() {
    echo "=============================================="
    echo "     COMPONENTES OPCIONALES"
    echo "=============================================="
    echo
    
    # Git
    if check_command git; then
        check_pass "Git instalado"
    else
        check_info "Git no instalado (opcional)"
    fi
    
    # curl/wget
    if check_command curl; then
        check_pass "curl instalado"
    elif check_command wget; then
        check_pass "wget instalado"
    else
        check_fail "curl o wget requeridos"
    fi
    
    # cloudflared
    if check_command cloudflared; then
        check_pass "cloudflared instalado"
    else
        check_info "cloudflared no instalado (opcional)"
    fi
    
    # TUI tools
    if check_command gum; then
        check_pass "gum instalado (TUI mejorado)"
    elif check_command dialog; then
        check_pass "dialog instalado (TUI)"
    elif check_command whiptail; then
        check_pass "whiptail instalado (TUI)"
    else
        check_info "Sin herramienta TUI (usando modo básico)"
    fi
    
    # systemd
    if [[ -d /etc/systemd/system ]]; then
        check_pass "systemd disponible"
    else
        check_info "systemd no disponible (init system alternativo)"
    fi
    
    echo
}

show_summary() {
    echo "=============================================="
    echo "     RESUMEN"
    echo "=============================================="
    echo
    
    if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}✓ Todos los requisitos cumplidos${NC}"
        echo "El sistema está listo para instalar DockPilot."
        exit 0
    elif [[ $ERRORS -eq 0 ]]; then
        echo -e "${YELLOW}⚠ Requisitos cumplidos con advertencias${NC}"
        echo "Puede instalar DockPilot, pero revise las advertencias."
        exit 0
    else
        echo -e "${RED}✗ Requisitos no cumplidos${NC}"
        echo "Errores: $ERRORS, Advertencias: $WARNINGS"
        echo "Por favor, corrija los errores antes de instalar."
        exit 1
    fi
}

main() {
    check_system
    check_distro
    check_docker
    check_resources
    check_optional
    show_summary
}

main "$@"
