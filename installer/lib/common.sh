#!/usr/bin/env bash
#
# DockPilot Installer - Common Functions Library
# ===============================================
# Funciones comunes utilizadas por todos los scripts del instalador
#

set -euo pipefail

# ==============================================================================
# CONFIGURACIÓN GLOBAL
# ==============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly INSTALLER_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly DOCKPILOT_VERSION="${DOCKPILOT_VERSION:-latest}"
readonly DOCKPILOT_HOME="${DOCKPILOT_HOME:-/opt/dockpilot}"
readonly DOCKPILOT_DATA="${DOCKPILOT_DATA:-/var/lib/dockpilot}"
readonly DOCKPILOT_LOGS="${DOCKPILOT_LOGS:-/var/log/dockpilot}"

# Colores para terminal
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly NC='\033[0m' # No Color
readonly BOLD='\033[1m'

# Niveles de log
readonly LOG_LEVEL_ERROR=0
readonly LOG_LEVEL_WARN=1
readonly LOG_LEVEL_INFO=2
readonly LOG_LEVEL_DEBUG=3
LOG_LEVEL="${LOG_LEVEL:-2}"

# ==============================================================================
# FUNCIONES DE LOGGING
# ==============================================================================

log_error() {
    if [[ $LOG_LEVEL -ge $LOG_LEVEL_ERROR ]]; then
        echo -e "${RED}[ERROR]${NC} $*" >&2
    fi
}

log_warn() {
    if [[ $LOG_LEVEL -ge $LOG_LEVEL_WARN ]]; then
        echo -e "${YELLOW}[WARN]${NC} $*" >&2
    fi
}

log_info() {
    if [[ $LOG_LEVEL -ge $LOG_LEVEL_INFO ]]; then
        echo -e "${GREEN}[INFO]${NC} $*"
    fi
}

log_debug() {
    if [[ $LOG_LEVEL -ge $LOG_LEVEL_DEBUG ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $*"
    fi
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_failure() {
    echo -e "${RED}✗${NC} $*"
}

# ==============================================================================
# FUNCIONES DE UTILIDAD
# ==============================================================================

# Verificar si un comando existe
check_command() {
    command -v "$1" &>/dev/null
}

# Verificar si se está ejecutando como root
require_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Este script debe ejecutarse como root o con sudo"
        return 1
    fi
}

# Verificar si el usuario tiene permisos sudo
check_sudo() {
    if [[ $EUID -eq 0 ]]; then
        return 0
    fi
    if check_command sudo && sudo -n true 2>/dev/null; then
        return 0
    fi
    return 1
}

# Ejecutar comando con sudo si es necesario
run_with_sudo() {
    if [[ $EUID -eq 0 ]]; then
        "$@"
    else
        sudo "$@"
    fi
}

# Crear backup de un archivo antes de modificarlo
backup_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup"
        log_info "Backup creado: $backup"
        echo "$backup"
    fi
}

# Confirmación del usuario
confirm() {
    local message="${1:-¿Continuar?}"
    local default="${2:-n}"
    
    if [[ "${NON_INTERACTIVE:-false}" == "true" ]]; then
        return 0
    fi
    
    local prompt
    if [[ "$default" == "y" ]]; then
        prompt="$message [Y/n]: "
    else
        prompt="$message [y/N]: "
    fi
    
    read -r -p "$prompt" response
    
    if [[ -z "$response" ]]; then
        response="$default"
    fi
    
    [[ "$response" =~ ^[Yy]$ ]]
}

# Solicitar input del usuario
prompt_input() {
    local prompt="$1"
    local default="${2:-}"
    local var_name="$3"
    
    if [[ -n "$default" ]]; then
        read -r -p "$prompt [$default]: " input
        input="${input:-$default}"
    else
        read -r -p "$prompt: " input
    fi
    
    eval "$var_name='$input'"
}

# Solicitar password del usuario (oculto)
prompt_password() {
    local prompt="$1"
    local var_name="$2"
    
    read -r -s -p "$prompt: " password
    echo >&2
    eval "$var_name='$password'"
}

# Spinner de progreso
spinner() {
    local pid=$1
    local message="${2:-Procesando...}"
    local delay=0.1
    local spinstr='|/-\'
    
    echo -n "$message "
    while ps -p $pid > /dev/null 2>&1; do
        local temp=${spinstr#?}
        printf "[%c]" "$spinstr"
        local spinstr=$temp${spinstr%%$temp}
        sleep $delay
        printf "\b\b\b"
    done
    echo ""
}

# Ejecutar comando con spinner
run_with_spinner() {
    local message="$1"
    shift
    
    "$@" &
    local pid=$!
    spinner $pid "$message"
    wait $pid
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "$message completado"
    else
        log_failure "$message falló"
    fi
    
    return $exit_code
}

# Mostrar barra de progreso simple
show_progress() {
    local current=$1
    local total=$2
    local width=50
    
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r[" >&2
    printf "%${filled}s" | tr ' ' '=' >&2
    printf "%${empty}s" | tr ' ' ' ' >&2
    printf "] %3d%%" "$percentage" >&2
    
    if [[ $current -eq $total ]]; then
        echo "" >&2
    fi
}

# ==============================================================================
# FUNCIONES DE VERIFICACIÓN
# ==============================================================================

# Verificar versión mínima de bash
check_bash_version() {
    local required_version="${1:-4.0}"
    local current_version="${BASH_VERSION%%[^0-9.]*}"
    
    if [[ "$(printf '%s\n' "$required_version" "$current_version" | sort -V | head -n1)" != "$required_version" ]]; then
        log_error "Se requiere Bash $required_version o superior. Versión actual: $current_version"
        return 1
    fi
}

# Verificar conectividad a internet
check_internet() {
    local test_hosts=("google.com" "cloudflare.com" "github.com")
    
    for host in "${test_hosts[@]}"; do
        if ping -c 1 -W 3 "$host" &>/dev/null; then
            return 0
        fi
    done
    
    log_error "No hay conectividad a Internet"
    return 1
}

# Verificar si un puerto está en uso
is_port_in_use() {
    local port=$1
    if check_command ss; then
        ss -tuln | grep -q ":$port "
    elif check_command netstat; then
        netstat -tuln 2>/dev/null | grep -q ":$port "
    else
        return 1
    fi
}

# Verificar espacio en disco
check_disk_space() {
    local path="${1:-/}"
    local required_gb="${2:-10}"
    
    local available_kb
    available_kb=$(df -k "$path" | awk 'NR==2 {print $4}')
    local available_gb=$((available_kb / 1024 / 1024))
    
    if [[ $available_gb -lt $required_gb ]]; then
        log_error "Espacio insuficiente. Requerido: ${required_gb}GB, Disponible: ${available_gb}GB"
        return 1
    fi
    
    log_info "Espacio disponible: ${available_gb}GB"
}

# Verificar memoria RAM
check_memory() {
    local required_gb="${1:-2}"
    
    local total_kb
    total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local total_gb=$((total_kb / 1024 / 1024))
    
    if [[ $total_gb -lt $required_gb ]]; then
        log_warn "Memoria RAM baja. Recomendado: ${required_gb}GB, Disponible: ${total_gb}GB"
        return 1
    fi
    
    log_info "Memoria RAM: ${total_gb}GB"
}

# ==============================================================================
# FUNCIONES DE ARCHIVOS Y DIRECTORIOS
# ==============================================================================

# Crear directorio si no existe
ensure_dir() {
    local dir="$1"
    local mode="${2:-755}"
    
    if [[ ! -d "$dir" ]]; then
        run_with_sudo mkdir -p "$dir"
        run_with_sudo chmod "$mode" "$dir"
        log_debug "Directorio creado: $dir"
    fi
}

# Verificar si un archivo existe
file_exists() {
    [[ -f "$1" ]]
}

# Verificar si un directorio existe
dir_exists() {
    [[ -d "$1" ]]
}

# Limpiar archivos temporales
cleanup_temp() {
    local temp_dir="${1:-/tmp/dockpilot-install}"
    if [[ -d "$temp_dir" ]]; then
        rm -rf "$temp_dir"
        log_debug "Directorio temporal eliminado: $temp_dir"
    fi
}

# ==============================================================================
# FUNCIONES DE RED
# ==============================================================================

# Descargar archivo con curl o wget
download_file() {
    local url="$1"
    local output="$2"
    
    if check_command curl; then
        curl -fsSL -o "$output" "$url"
    elif check_command wget; then
        wget -q -O "$output" "$url"
    else
        log_error "Se requiere curl o wget para descargar archivos"
        return 1
    fi
}

# Obtener IP pública
get_public_ip() {
    local ip_services=(
        "https://ipinfo.io/ip"
        "https://api.ipify.org"
        "https://icanhazip.com"
    )
    
    for service in "${ip_services[@]}"; do
        local ip
        ip=$(curl -fsSL "$service" 2>/dev/null || wget -qO- "$service" 2>/dev/null)
        if [[ -n "$ip" ]]; then
            echo "$ip"
            return 0
        fi
    done
    
    return 1
}

# ==============================================================================
# FUNCIONES DE DOCKER
# ==============================================================================

# Verificar si Docker está instalado
is_docker_installed() {
    check_command docker
}

# Verificar si Docker Compose está instalado
is_compose_installed() {
    docker compose version &>/dev/null || docker-compose version &>/dev/null
}

# Verificar si Docker está corriendo
is_docker_running() {
    docker info &>/dev/null
}

# Obtener versión de Docker
docker_version() {
    docker --version 2>/dev/null | awk '{print $3}' | tr -d ','
}

# ==============================================================================
# MANEJO DE ERRORES
# ==============================================================================

# Handler de errores
error_handler() {
    local line=$1
    local script=$2
    local code=$3
    
    log_error "Error en $script:$line (código: $code)"
    
    if [[ "${CLEANUP_ON_ERROR:-true}" == "true" ]]; then
        cleanup_temp
    fi
}

# Configurar trap para errores
trap 'error_handler ${LINENO} "${BASH_SOURCE[0]}" $?' ERR

# Limpiar al salir
trap 'cleanup_temp' EXIT

# ==============================================================================
# FUNCIONES DE VALIDACIÓN
# ==============================================================================

# Validar email
is_valid_email() {
    local email="$1"
    [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]
}

# Validar puerto
is_valid_port() {
    local port="$1"
    [[ "$port" =~ ^[0-9]+$ ]] && [[ $port -ge 1 ]] && [[ $port -le 65535 ]]
}

# Validar URL
is_valid_url() {
    local url="$1"
    [[ "$url" =~ ^https?:// ]]
}

# Validar versión semver
is_valid_version() {
    local version="$1"
    [[ "$version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]
}

# ==============================================================================
# EXPORTAR FUNCIONES
# ==============================================================================

export -f log_error log_warn log_info log_debug log_success log_failure
export -f check_command require_root check_sudo run_with_sudo
export -f backup_file confirm prompt_input prompt_password
export -f spinner run_with_spinner show_progress
export -f check_bash_version check_internet is_port_in_use
export -f check_disk_space check_memory
export -f ensure_dir file_exists dir_exists cleanup_temp
export -f download_file get_public_ip
export -f is_docker_installed is_compose_installed is_docker_running docker_version
export -f is_valid_email is_valid_port is_valid_url is_valid_version
