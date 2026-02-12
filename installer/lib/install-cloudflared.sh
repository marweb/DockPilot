#!/usr/bin/env bash
#
# DockPilot Installer - Cloudflared Installation
# ===============================================
# Descarga e instala cloudflared para túneles Cloudflare
#

set -euo pipefail

# Cargar librerías
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"
source "${SCRIPT_DIR}/detect-distro.sh"

# Configuración
readonly CLOUDFLARED_VERSION="${CLOUDFLARED_VERSION:-latest}"
readonly CLOUDFLARED_INSTALL_DIR="${CLOUDFLARED_INSTALL_DIR:-/usr/local/bin}"
readonly CLOUDFLARED_BINARY="${CLOUDFLARED_INSTALL_DIR}/cloudflared"
readonly CLOUDFLARED_GITHUB="https://github.com/cloudflare/cloudflared"

# Verificar si cloudflared está instalado
cloudflared_is_installed() {
    check_command cloudflared
}

# Obtener versión instalada
cloudflared_installed_version() {
    if cloudflared_is_installed; then
        cloudflared --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
    fi
}

# Obtener última versión disponible
cloudflared_latest_version() {
    local api_url="https://api.github.com/repos/cloudflare/cloudflared/releases/latest"
    
    if check_command curl; then
        curl -fsSL "$api_url" | grep -o '"tag_name": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' | sed 's/^v//'
    elif check_command wget; then
        wget -qO- "$api_url" | grep -o '"tag_name": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' | sed 's/^v//'
    fi
}

# Descargar e instalar cloudflared
install_cloudflared_binary() {
    log_info "Instalando cloudflared..."
    
    require_root || {
        log_error "Se requieren privilegios de root para instalar cloudflared"
        return 1
    }
    
    local version="$CLOUDFLARED_VERSION"
    if [[ "$version" == "latest" ]]; then
        version=$(cloudflared_latest_version)
        if [[ -z "$version" ]]; then
            version="2024.1.0"
        fi
    fi
    
    # Asegurar prefijo v
    if [[ ! "$version" =~ ^v ]]; then
        version="v${version}"
    fi
    
    log_info "Descargando cloudflared $version..."
    
    # Obtener arquitectura
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64) arch="amd64" ;;
        aarch64|arm64) arch="arm64" ;;
        armv7l) arch="arm" ;;
        *) log_error "Arquitectura no soportada: $arch"; return 1 ;;
    esac
    
    local download_url="${CLOUDFLARED_GITHUB}/releases/download/${version}/cloudflared-linux-${arch}"
    local temp_dir
    temp_dir=$(mktemp -d)
    local temp_binary="${temp_dir}/cloudflared"
    
    # Descargar binario
    if ! download_file "$download_url" "$temp_binary"; then
        log_error "No se pudo descargar cloudflared"
        rm -rf "$temp_dir"
        return 1
    fi
    
    chmod +x "$temp_binary"
    
    # Verificar que es válido
    if ! "$temp_binary" --version &>/dev/null; then
        log_error "El binario descargado no es válido"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Crear directorio si no existe
    ensure_dir "$CLOUDFLARED_INSTALL_DIR"
    
    # Backup si existe
    if [[ -f "$CLOUDFLARED_BINARY" ]]; then
        backup_file "$CLOUDFLARED_BINARY"
    fi
    
    mv "$temp_binary" "$CLOUDFLARED_BINARY"
    rm -rf "$temp_dir"
    
    log_success "cloudflared instalado en $CLOUDFLARED_BINARY"
    verify_cloudflared_installation
}

# Instalación principal
install_cloudflared() {
    log_info "Iniciando instalación de cloudflared..."
    
    if [[ -z "$DISTRO_ID" ]]; then
        init_distro_detection
    fi
    
    if cloudflared_is_installed; then
        local installed_version
        installed_version=$(cloudflared_installed_version)
        log_info "cloudflared ya está instalado (versión $installed_version)"
        return 0
    fi
    
    install_cloudflared_binary
}

# Desinstalar
uninstall_cloudflared() {
    log_warn "Desinstalando cloudflared..."
    require_root || return 1
    
    if [[ -f "$CLOUDFLARED_BINARY" ]]; then
        rm -f "$CLOUDFLARED_BINARY"
        log_success "cloudflared desinstalado"
    fi
}

# Verificar instalación
verify_cloudflared_installation() {
    if ! cloudflared_is_installed; then
        log_error "cloudflared no está instalado"
        return 1
    fi
    
    local version
    version=$(cloudflared_installed_version)
    log_success "cloudflared verificado (versión $version)"
}

# Información
get_cloudflared_info() {
    echo "=============================================="
    echo "     INFORMACIÓN DE CLOUDFLARED"
    echo "=============================================="
    if cloudflared_is_installed; then
        echo "Versión:         $(cloudflared --version 2>/dev/null)"
        echo "Ubicación:       $(which cloudflared)"
    else
        echo "Estado:          No instalado"
    fi
    echo "=============================================="
}

# Main
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-install}" in
        install)
            install_cloudflared
            ;;
        uninstall)
            uninstall_cloudflared
            ;;
        verify)
            verify_cloudflared_installation
            ;;
        info)
            get_cloudflared_info
            ;;
        *)
            echo "Uso: $0 {install|uninstall|verify|info}"
            exit 1
            ;;
    esac
fi
