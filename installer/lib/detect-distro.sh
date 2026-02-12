#!/usr/bin/env bash
#
# DockPilot Installer - Distribution Detection
# =============================================
# Detecta la distribución Linux, versión y gestor de paquetes
#

set -euo pipefail

# Cargar librería común
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

# ==============================================================================
# VARIABLES GLOBALES
# ==============================================================================

DISTRO=""
DISTRO_VERSION=""
DISTRO_ID=""
DISTRO_LIKE=""
PKG_MANAGER=""
PKG_INSTALL=""
PKG_UPDATE=""
PKG_REMOVE=""

# ==============================================================================
# DETECCIÓN DE DISTRIBUCIÓN
# ==============================================================================

detect_distro() {
    log_info "Detectando distribución Linux..."
    
    # Intentar usar /etc/os-release (estándar moderno)
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        DISTRO="${NAME:-Unknown}"
        DISTRO_VERSION="${VERSION_ID:-Unknown}"
        DISTRO_ID="${ID:-unknown}"
        DISTRO_LIKE="${ID_LIKE:-}"
    # Fallback para sistemas antiguos
    elif [[ -f /etc/lsb-release ]]; then
        source /etc/lsb-release
        DISTRO="${DISTRIB_ID:-Unknown}"
        DISTRO_VERSION="${DISTRIB_RELEASE:-Unknown}"
        DISTRO_ID=$(echo "$DISTRO" | tr '[:upper:]' '[:lower:]')
    elif [[ -f /etc/debian_version ]]; then
        DISTRO="Debian"
        DISTRO_VERSION=$(cat /etc/debian_version)
        DISTRO_ID="debian"
    elif [[ -f /etc/redhat-release ]]; then
        DISTRO=$(cat /etc/redhat-release | cut -d' ' -f1)
        DISTRO_VERSION=$(cat /etc/redhat-release | grep -oE '[0-9]+\.[0-9]+' | head -1)
        DISTRO_ID=$(echo "$DISTRO" | tr '[:upper:]' '[:lower:]')
    elif [[ -f /etc/alpine-release ]]; then
        DISTRO="Alpine Linux"
        DISTRO_VERSION=$(cat /etc/alpine-release)
        DISTRO_ID="alpine"
    elif [[ -f /etc/arch-release ]]; then
        DISTRO="Arch Linux"
        DISTRO_VERSION="rolling"
        DISTRO_ID="arch"
    else
        DISTRO="Unknown"
        DISTRO_VERSION="Unknown"
        DISTRO_ID="unknown"
    fi
    
    log_info "Distribución detectada: $DISTRO $DISTRO_VERSION"
}

# ==============================================================================
# DETECCIÓN DE GESTOR DE PAQUETES
# ==============================================================================

detect_pkg_manager() {
    log_info "Detectando gestor de paquetes..."
    
    # Determinar gestor de paquetes basado en la distro
    case "$DISTRO_ID" in
        ubuntu|debian|linuxmint|pop|elementary|zorin|kali|parrot|devuan|mx|antix)
            PKG_MANAGER="apt"
            PKG_UPDATE="apt-get update"
            PKG_INSTALL="apt-get install -y"
            PKG_REMOVE="apt-get remove -y"
            ;;
        
        fedora|centos|rhel|rocky|almalinux|oracle|amazon|scientific)
            if check_command dnf; then
                PKG_MANAGER="dnf"
                PKG_UPDATE="dnf check-update || true"
                PKG_INSTALL="dnf install -y"
                PKG_REMOVE="dnf remove -y"
            else
                PKG_MANAGER="yum"
                PKG_UPDATE="yum check-update || true"
                PKG_INSTALL="yum install -y"
                PKG_REMOVE="yum remove -y"
            fi
            ;;
        
        alpine)
            PKG_MANAGER="apk"
            PKG_UPDATE="apk update"
            PKG_INSTALL="apk add --no-cache"
            PKG_REMOVE="apk del"
            ;;
        
        arch|manjaro|endeavouros|garuda|artix|cachyos)
            PKG_MANAGER="pacman"
            PKG_UPDATE="pacman -Sy"
            PKG_INSTALL="pacman -S --noconfirm"
            PKG_REMOVE="pacman -R --noconfirm"
            ;;
        
        opensuse*|suse*)
            if check_command zypper; then
                PKG_MANAGER="zypper"
                PKG_UPDATE="zypper refresh"
                PKG_INSTALL="zypper install -y"
                PKG_REMOVE="zypper remove -y"
            else
                PKG_MANAGER="unknown"
            fi
            ;;
        
        gentoo|calculate|sabayon|funtoo)
            PKG_MANAGER="emerge"
            PKG_UPDATE="emerge --sync"
            PKG_INSTALL="emerge -av"
            PKG_REMOVE="emerge --unmerge"
            ;;
        
        void)
            PKG_MANAGER="xbps"
            PKG_UPDATE="xbps-install -S"
            PKG_INSTALL="xbps-install -y"
            PKG_REMOVE="xbps-remove -y"
            ;;
        
        nixos)
            PKG_MANAGER="nix"
            PKG_UPDATE="nix-channel --update"
            PKG_INSTALL="nix-env -iA"
            PKG_REMOVE="nix-env -e"
            ;;
        
        *)
            # Intentar detectar por comandos disponibles
            if check_command apt-get; then
                PKG_MANAGER="apt"
                PKG_UPDATE="apt-get update"
                PKG_INSTALL="apt-get install -y"
                PKG_REMOVE="apt-get remove -y"
            elif check_command dnf; then
                PKG_MANAGER="dnf"
                PKG_UPDATE="dnf check-update || true"
                PKG_INSTALL="dnf install -y"
                PKG_REMOVE="dnf remove -y"
            elif check_command yum; then
                PKG_MANAGER="yum"
                PKG_UPDATE="yum check-update || true"
                PKG_INSTALL="yum install -y"
                PKG_REMOVE="yum remove -y"
            elif check_command pacman; then
                PKG_MANAGER="pacman"
                PKG_UPDATE="pacman -Sy"
                PKG_INSTALL="pacman -S --noconfirm"
                PKG_REMOVE="pacman -R --noconfirm"
            elif check_command apk; then
                PKG_MANAGER="apk"
                PKG_UPDATE="apk update"
                PKG_INSTALL="apk add --no-cache"
                PKG_REMOVE="apk del"
            elif check_command zypper; then
                PKG_MANAGER="zypper"
                PKG_UPDATE="zypper refresh"
                PKG_INSTALL="zypper install -y"
                PKG_REMOVE="zypper remove -y"
            else
                PKG_MANAGER="unknown"
                log_warn "No se pudo detectar el gestor de paquetes"
            fi
            ;;
    esac
    
    # Verificar comandos de ejecución con sudo
    if [[ $EUID -ne 0 ]]; then
        PKG_UPDATE="sudo $PKG_UPDATE"
        PKG_INSTALL="sudo $PKG_INSTALL"
        PKG_REMOVE="sudo $PKG_REMOVE"
    fi
    
    log_info "Gestor de paquetes: $PKG_MANAGER"
}

# ==============================================================================
# FUNCIONES DE INFORMACIÓN
# ==============================================================================

# Verificar si la distribución es compatible
is_distro_supported() {
    case "$DISTRO_ID" in
        ubuntu|debian|linuxmint|pop|fedora|centos|rhel|rocky|almalinux|alpine|arch|manjaro|opensuse*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Obtener información completa del sistema
get_system_info() {
    echo "=============================================="
    echo "     INFORMACIÓN DEL SISTEMA"
    echo "=============================================="
    echo "Distribución:    $DISTRO"
    echo "Versión:         $DISTRO_VERSION"
    echo "ID:              $DISTRO_ID"
    echo "Derivada de:     ${DISTRO_LIKE:-N/A}"
    echo "Gestor de pkg:   $PKG_MANAGER"
    echo "Arquitectura:    $(uname -m)"
    echo "Kernel:          $(uname -r)"
    echo "Hostname:        $(hostname)"
    echo "=============================================="
}

# Verificar requisitos mínimos del sistema
check_system_requirements() {
    local errors=0
    
    log_info "Verificando requisitos del sistema..."
    
    # Verificar arquitectura
    local arch
    arch=$(uname -m)
    if [[ "$arch" != "x86_64" && "$arch" != "aarch64" && "$arch" != "arm64" ]]; then
        log_error "Arquitectura no soportada: $arch"
        ((errors++))
    fi
    
    # Verificar distribución
    if ! is_distro_supported; then
        log_warn "Distribución no oficialmente soportada: $DISTRO"
        log_warn "La instalación puede fallar o requerir pasos manuales"
    fi
    
    # Verificar espacio en disco
    if ! check_disk_space "/" 10; then
        ((errors++))
    fi
    
    # Verificar memoria
    check_memory 2
    
    if [[ $errors -gt 0 ]]; then
        return 1
    fi
    
    log_success "Requisitos del sistema verificados"
    return 0
}

# ==============================================================================
# INSTALACIÓN DE DEPENDENCIAS BÁSICAS
# ==============================================================================

install_base_packages() {
    local packages=("$@")
    
    if [[ ${#packages[@]} -eq 0 ]]; then
        return 0
    fi
    
    log_info "Instalando dependencias: ${packages[*]}"
    
    case "$PKG_MANAGER" in
        apt)
            eval "$PKG_UPDATE" || true
            eval "$PKG_INSTALL ${packages[*]}"
            ;;
        dnf|yum)
            eval "$PKG_INSTALL ${packages[*]}"
            ;;
        apk)
            eval "$PKG_INSTALL ${packages[*]}"
            ;;
        pacman)
            eval "$PKG_UPDATE"
            eval "$PKG_INSTALL ${packages[*]}"
            ;;
        zypper)
            eval "$PKG_UPDATE"
            eval "$PKG_INSTALL ${packages[*]}"
            ;;
        *)
            log_error "No se puede instalar paquetes: gestor no soportado"
            return 1
            ;;
    esac
}

# ==============================================================================
# FUNCIONES AUXILIARES
# ==============================================================================

# Obtener versión mayor de la distro
get_distro_major_version() {
    echo "$DISTRO_VERSION" | cut -d'.' -f1
}

# Comparar versión de distro
is_distro_version_at_least() {
    local required_version="$1"
    [[ "$(printf '%s\n' "$required_version" "$DISTRO_VERSION" | sort -V | head -n1)" == "$required_version" ]]
}

# Verificar si es WSL
is_wsl() {
    [[ -f /proc/version ]] && grep -q "Microsoft" /proc/version
}

# Verificar si es contenedor Docker
is_docker_container() {
    [[ -f /.dockerenv ]] || ( [[ -f /proc/1/cgroup ]] && grep -q docker /proc/1/cgroup )
}

# ==============================================================================
# INICIALIZACIÓN
# ==============================================================================

init_distro_detection() {
    detect_distro
    detect_pkg_manager
}

# Si se ejecuta directamente, mostrar información
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    init_distro_detection
    get_system_info
fi
