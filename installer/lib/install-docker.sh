#!/usr/bin/env bash
#
# DockPilot Installer - Docker Installation
# ==========================================
# Instala Docker y Docker Compose según la distribución
#

set -euo pipefail

# Cargar librerías
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"
source "${SCRIPT_DIR}/detect-distro.sh"

# ==============================================================================
# CONFIGURACIÓN
# ==============================================================================

readonly DOCKER_VERSION_MIN="20.10.0"
readonly COMPOSE_VERSION_MIN="2.0.0"
readonly DOCKER_REPO_URL="https://download.docker.com"

# ==============================================================================
# VERIFICACIÓN
# ==============================================================================

# Verificar si Docker está instalado
docker_is_installed() {
    check_command docker
}

# Verificar si Docker Compose v2 está instalado
compose_is_installed() {
    docker compose version &>/dev/null
}

# Verificar versión de Docker
docker_check_version() {
    local current_version
    current_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    
    if [[ "$(printf '%s\n' "$DOCKER_VERSION_MIN" "$current_version" | sort -V | head -n1)" != "$DOCKER_VERSION_MIN" ]]; then
        log_warn "Versión de Docker ($current_version) es menor a la recomendada ($DOCKER_VERSION_MIN)"
        return 1
    fi
    
    log_info "Versión de Docker: $current_version"
    return 0
}

# Verificar versión de Docker Compose
compose_check_version() {
    local current_version
    current_version=$(docker compose version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    
    if [[ "$(printf '%s\n' "$COMPOSE_VERSION_MIN" "$current_version" | sort -V | head -n1)" != "$COMPOSE_VERSION_MIN" ]]; then
        log_warn "Versión de Docker Compose ($current_version) es menor a la recomendada ($COMPOSE_VERSION_MIN)"
        return 1
    fi
    
    log_info "Versión de Docker Compose: $current_version"
    return 0
}

# Verificar si Docker está corriendo
docker_is_running() {
    docker info &>/dev/null 2>&1
}

# Verificar si el usuario está en el grupo docker
user_in_docker_group() {
    local user="${1:-$USER}"
    groups "$user" 2>/dev/null | grep -q docker
}

# ==============================================================================
# INSTALACIÓN PARA DEBIAN/UBUNTU
# ==============================================================================

install_docker_debian() {
    log_info "Instalando Docker para Debian/Ubuntu..."
    
    # Actualizar repositorios
    eval "$PKG_UPDATE"
    
    # Instalar dependencias
    eval "$PKG_INSTALL" \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Agregar clave GPG oficial de Docker
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "${DOCKER_REPO_URL}/linux/${DISTRO_ID}/gpg" | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Configurar repositorio
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        ${DOCKER_REPO_URL}/linux/${DISTRO_ID} \
        $(lsb_release -cs) stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Actualizar repositorios nuevamente
    eval "$PKG_UPDATE"
    
    # Instalar Docker
    eval "$PKG_INSTALL" \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin
    
    log_success "Docker instalado correctamente"
}

# ==============================================================================
# INSTALACIÓN PARA RHEL/CENTOS/FEDORA
# ==============================================================================

install_docker_rhel() {
    log_info "Instalando Docker para RHEL/CentOS/Fedora..."
    
    # Instalar utilidades
    eval "$PKG_INSTALL" yum-utils
    
    # Configurar repositorio
    local repo_url="${DOCKER_REPO_URL}/linux/${DISTRO_ID}/docker-ce.repo"
    
    if [[ "$DISTRO_ID" == "fedora" ]]; then
        dnf config-manager --add-repo "$repo_url"
    else
        yum-config-manager --add-repo "$repo_url"
    fi
    
    # Instalar Docker
    eval "$PKG_INSTALL" \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin
    
    log_success "Docker instalado correctamente"
}

# ==============================================================================
# INSTALACIÓN PARA ALPINE
# ==============================================================================

install_docker_alpine() {
    log_info "Instalando Docker para Alpine Linux..."
    
    eval "$PKG_UPDATE"
    eval "$PKG_INSTALL" docker docker-compose
    
    # Iniciar servicio
    rc-update add docker boot
    service docker start
    
    log_success "Docker instalado correctamente"
}

# ==============================================================================
# INSTALACIÓN PARA ARCH
# ==============================================================================

install_docker_arch() {
    log_info "Instalando Docker para Arch Linux..."
    
    eval "$PKG_UPDATE"
    eval "$PKG_INSTALL" docker docker-compose
    
    log_success "Docker instalado correctamente"
}

# ==============================================================================
# INSTALACIÓN PARA OPENSUSE
# ==============================================================================

install_docker_opensuse() {
    log_info "Instalando Docker para openSUSE..."
    
    eval "$PKG_UPDATE"
    eval "$PKG_INSTALL" docker docker-compose
    
    # Iniciar servicio
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker instalado correctamente"
}

# ==============================================================================
# INSTALACIÓN GENÉRICA
# ==============================================================================

install_docker_generic() {
    log_warn "Usando método de instalación genérico..."
    log_warn "Esto puede no funcionar correctamente en todas las distribuciones"
    
    # Intentar con el script de conveniencia de Docker
    if check_command curl; then
        curl -fsSL https://get.docker.com | sh
    elif check_command wget; then
        wget -qO- https://get.docker.com | sh
    else
        log_error "No se puede descargar el script de instalación"
        return 1
    fi
}

# ==============================================================================
# INSTALACIÓN PRINCIPAL
# ==============================================================================

install_docker() {
    log_info "Iniciando instalación de Docker..."
    
    require_root || {
        log_error "Se requieren privilegios de root para instalar Docker"
        return 1
    }
    
    # Detectar distribución si no está inicializada
    if [[ -z "$DISTRO_ID" ]]; then
        init_distro_detection
    fi
    
    # Verificar si ya está instalado
    if docker_is_installed; then
        log_info "Docker ya está instalado"
        if docker_check_version; then
            log_info "Versión actual es suficiente"
            return 0
        else
            log_info "Actualizando Docker..."
        fi
    fi
    
    # Instalar según distribución
    case "$DISTRO_ID" in
        ubuntu|debian|linuxmint|pop|elementary|zorin|kali|parrot)
            install_docker_debian
            ;;
        fedora|centos|rhel|rocky|almalinux|oracle|amazon)
            install_docker_rhel
            ;;
        alpine)
            install_docker_alpine
            ;;
        arch|manjaro|endeavouros|garuda)
            install_docker_arch
            ;;
        opensuse*|suse*)
            install_docker_opensuse
            ;;
        *)
            log_warn "Distribución no soportada oficialmente: $DISTRO"
            if confirm "¿Intentar instalación genérica?" "n"; then
                install_docker_generic
            else
                log_error "Instalación cancelada"
                return 1
            fi
            ;;
    esac
    
    # Iniciar y habilitar servicio
    start_docker_service
    
    # Verificar instalación
    verify_docker_installation
}

# ==============================================================================
# GESTIÓN DEL SERVICIO
# ==============================================================================

start_docker_service() {
    log_info "Iniciando servicio Docker..."
    
    if check_command systemctl; then
        systemctl enable docker
        systemctl start docker
    elif check_command service; then
        service docker start
    elif check_command rc-service; then
        rc-service docker start
    fi
    
    # Esperar a que Docker esté listo
    local retries=0
    while ! docker_is_running && [[ $retries -lt 30 ]]; do
        sleep 1
        ((retries++))
    done
    
    if docker_is_running; then
        log_success "Servicio Docker iniciado"
    else
        log_error "No se pudo iniciar el servicio Docker"
        return 1
    fi
}

stop_docker_service() {
    log_info "Deteniendo servicio Docker..."
    
    if check_command systemctl; then
        systemctl stop docker
    elif check_command service; then
        service docker stop
    elif check_command rc-service; then
        rc-service docker stop
    fi
}

restart_docker_service() {
    log_info "Reiniciando servicio Docker..."
    
    if check_command systemctl; then
        systemctl restart docker
    elif check_command service; then
        service docker restart
    elif check_command rc-service; then
        rc-service docker restart
    fi
}

# ==============================================================================
# CONFIGURACIÓN DE USUARIO
# ==============================================================================

add_user_to_docker_group() {
    local username="${1:-$SUDO_USER}"
    
    if [[ -z "$username" ]]; then
        log_warn "No se especificó usuario para agregar al grupo docker"
        return 1
    fi
    
    if user_in_docker_group "$username"; then
        log_info "Usuario $username ya está en el grupo docker"
        return 0
    fi
    
    log_info "Agregando usuario $username al grupo docker..."
    usermod -aG docker "$username"
    
    log_success "Usuario agregado al grupo docker"
    log_warn "Debe cerrar sesión y volver a iniciar para aplicar los cambios"
}

# ==============================================================================
# VERIFICACIÓN
# ==============================================================================

verify_docker_installation() {
    log_info "Verificando instalación de Docker..."
    
    if ! docker_is_installed; then
        log_error "Docker no está instalado"
        return 1
    fi
    
    if ! docker_is_running; then
        log_error "El servicio Docker no está corriendo"
        return 1
    fi
    
    # Probar Docker con hello-world
    log_info "Ejecutando contenedor de prueba..."
    if docker run --rm hello-world > /dev/null 2>&1; then
        log_success "Docker funciona correctamente"
    else
        log_error "No se pudo ejecutar el contenedor de prueba"
        return 1
    fi
    
    # Verificar Docker Compose
    if compose_is_installed; then
        log_success "Docker Compose v2 está instalado"
    else
        log_warn "Docker Compose v2 no está instalado"
    fi
    
    return 0
}

# ==============================================================================
# DESINSTALACIÓN
# ==============================================================================

uninstall_docker() {
    log_warn "Desinstalando Docker..."
    
    require_root || return 1
    
    # Detener servicio
    stop_docker_service
    
    case "$DISTRO_ID" in
        ubuntu|debian|linuxmint|pop)
            apt-get purge -y docker-ce docker-ce-cli containerd.io \
                docker-buildx-plugin docker-compose-plugin \
                docker-ce-rootless-extras
            apt-get autoremove -y
            ;;
        fedora|centos|rhel|rocky|almalinux)
            eval "$PKG_REMOVE" docker-ce docker-ce-cli containerd.io \
                docker-buildx-plugin docker-compose-plugin
            ;;
        alpine)
            eval "$PKG_REMOVE" docker docker-compose
            ;;
        arch|manjaro)
            eval "$PKG_REMOVE" docker docker-compose
            ;;
    esac
    
    # Eliminar datos (opcional)
    if confirm "¿Eliminar todos los datos de Docker (imágenes, contenedores, volúmenes)?"; then
        rm -rf /var/lib/docker
        rm -rf /var/lib/containerd
    fi
    
    log_success "Docker desinstalado"
}

# ==============================================================================
# INFORMACIÓN
# ==============================================================================

get_docker_info() {
    echo "=============================================="
    echo "     INFORMACIÓN DE DOCKER"
    echo "=============================================="
    
    if docker_is_installed; then
        echo "Versión:         $(docker --version)"
        echo "API Version:     $(docker version --format '{{.Server.APIVersion}}' 2>/dev/null || echo 'N/A')"
        
        if docker_is_running; then
            echo "Estado:          ${GREEN}Corriendo${NC}"
            echo "Contenedores:    $(docker ps -aq 2>/dev/null | wc -l)"
            echo "Imágenes:        $(docker images -q 2>/dev/null | wc -l)"
            echo "Volúmenes:       $(docker volume ls -q 2>/dev/null | wc -l)"
            echo "Redes:           $(docker network ls -q 2>/dev/null | wc -l)"
        else
            echo "Estado:          ${RED}Detenido${NC}"
        fi
        
        if compose_is_installed; then
            echo "Compose:         $(docker compose version)"
        else
            echo "Compose:         ${YELLOW}No instalado${NC}"
        fi
    else
        echo "Estado:          ${RED}No instalado${NC}"
    fi
    
    echo "=============================================="
}

# ==============================================================================
# MAIN
# ==============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-install}" in
        install)
            install_docker
            ;;
        uninstall)
            uninstall_docker
            ;;
        verify)
            verify_docker_installation
            ;;
        info)
            get_docker_info
            ;;
        start)
            start_docker_service
            ;;
        stop)
            stop_docker_service
            ;;
        restart)
            restart_docker_service
            ;;
        add-user)
            add_user_to_docker_group "${2:-}"
            ;;
        *)
            echo "Uso: $0 {install|uninstall|verify|info|start|stop|restart|add-user [usuario]}"
            exit 1
            ;;
    esac
fi
