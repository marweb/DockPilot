#!/usr/bin/env bash
#
# DockPilot Installer - TUI Components
# =====================================
# Componentes de interfaz de usuario en terminal
# Soporta: gum, dialog, whiptail, o fallback a comandos básicos
#

set -euo pipefail

# Cargar librería común
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

# ==============================================================================
# DETECCIÓN DE TUI
# ==============================================================================

TUI_MODE=""
TUI_AVAILABLE=false

# Detectar qué herramienta TUI está disponible
detect_tui() {
    if check_command gum; then
        TUI_MODE="gum"
        TUI_AVAILABLE=true
        log_debug "Usando gum para TUI"
    elif check_command dialog; then
        TUI_MODE="dialog"
        TUI_AVAILABLE=true
        log_debug "Usando dialog para TUI"
    elif check_command whiptail; then
        TUI_MODE="whiptail"
        TUI_AVAILABLE=true
        log_debug "Usando whiptail para TUI"
    else
        TUI_MODE="basic"
        TUI_AVAILABLE=false
        log_debug "Usando comandos básicos (sin TUI)"
    fi
}

# Verificar si se debe usar TUI
should_use_tui() {
    [[ "$TUI_AVAILABLE" == "true" && "${NON_INTERACTIVE:-false}" != "true" ]]
}

# ==============================================================================
# COMPONENTES TUI - GUM
# ==============================================================================

_gum_style() {
    gum style --foreground="#00D9FF" "$@"
}

_gum_error() {
    gum style --foreground="#FF0000" "$@"
}

_gum_success() {
    gum style --foreground="#00FF00" "$@"
}

show_welcome_gum() {
    local title="${1:-DockPilot Installer}"
    local subtitle="${2:-Docker Management Platform}"
    
    clear
    echo
    gum style \
        --foreground="#00D9FF" \
        --border-foreground="#00D9FF" \
        --border double \
        --align center \
        --width 60 \
        --margin "1 2" \
        --padding "2 4" \
        "$title" "" "$subtitle"
}

show_menu_gum() {
    local title="$1"
    shift
    
    local options=()
    while [[ $# -gt 0 ]]; do
        options+=("$1")
        shift
    done
    
    echo "$title" >&2
    gum choose "${options[@]}"
}

show_input_gum() {
    local prompt="$1"
    local placeholder="${2:-}"
    local default="${3:-}"
    
    local args=(--placeholder "$placeholder")
    [[ -n "$default" ]] && args+=(--value "$default")
    
    gum input --prompt "$prompt: " "${args[@]}"
}

show_password_gum() {
    local prompt="$1"
    gum input --password --prompt "$prompt: "
}

show_confirm_gum() {
    local prompt="$1"
    local default="${2:-false}"
    
    if [[ "$default" == "true" ]]; then
        gum confirm --default "$prompt"
    else
        gum confirm "$prompt"
    fi
}

show_progress_gum() {
    local message="$1"
    
    gum spin --spinner dot --title "$message" -- bash -c "while true; do sleep 1; done"
}

show_success_gum() {
    local message="$1"
    gum style --foreground="#00FF00" "✓ $message"
}

show_error_gum() {
    local message="$1"
    gum style --foreground="#FF0000" "✗ $message"
}

# ==============================================================================
# COMPONENTES TUI - DIALOG
# ==============================================================================

show_welcome_dialog() {
    local title="${1:-DockPilot Installer}"
    local subtitle="${2:-Docker Management Platform}"
    
    dialog --clear --backtitle "$title" \
        --title "Bienvenido" \
        --msgbox "$subtitle\n\nPresione OK para continuar" 10 60
}

show_menu_dialog() {
    local title="$1"
    shift
    
    local items=()
    local i=1
    while [[ $# -gt 0 ]]; do
        items+=($i "$1")
        shift
        ((i++))
    done
    
    local temp_file
    temp_file=$(mktemp)
    
    dialog --clear --backtitle "DockPilot Installer" \
        --title "$title" \
        --menu "Seleccione una opción:" 20 60 10 \
        "${items[@]}" 2>"$temp_file"
    
    local result
    result=$(cat "$temp_file")
    rm -f "$temp_file"
    
    echo "$result"
}

show_input_dialog() {
    local title="$1"
    local prompt="$2"
    local default="${3:-}"
    
    local temp_file
    temp_file=$(mktemp)
    
    dialog --clear --backtitle "DockPilot Installer" \
        --title "$title" \
        --inputbox "$prompt" 10 60 "$default" 2>"$temp_file"
    
    local result
    result=$(cat "$temp_file")
    rm -f "$temp_file"
    
    echo "$result"
}

show_password_dialog() {
    local title="$1"
    local prompt="$2"
    
    local temp_file
    temp_file=$(mktemp)
    
    dialog --clear --backtitle "DockPilot Installer" \
        --title "$title" \
        --passwordbox "$prompt" 10 60 2>"$temp_file"
    
    local result
    result=$(cat "$temp_file")
    rm -f "$temp_file"
    
    echo "$result"
}

show_confirm_dialog() {
    local title="$1"
    local prompt="$2"
    
    dialog --clear --backtitle "DockPilot Installer" \
        --title "$title" \
        --yesno "$prompt" 10 60
    
    return $?
}

show_progress_dialog() {
    local title="$1"
    local percent="$2"
    local message="${3:-Procesando...}"
    
    echo "$percent" | dialog --clear --backtitle "DockPilot Installer" \
        --title "$title" \
        --gauge "$message" 10 60 0
}

# ==============================================================================
# COMPONENTES TUI - WHIPTAIL
# ==============================================================================

show_welcome_whiptail() {
    local title="${1:-DockPilot Installer}"
    local subtitle="${2:-Docker Management Platform}"
    
    whiptail --backtitle "$title" \
        --title "Bienvenido" \
        --msgbox "$subtitle\n\nPresione OK para continuar" 10 60
}

show_menu_whiptail() {
    local title="$1"
    shift
    
    local items=()
    local tag
    while [[ $# -gt 0 ]]; do
        tag=$(echo "$1" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
        items+=("$tag" "$1" "OFF")
        shift
    done
    
    local temp_file
    temp_file=$(mktemp)
    
    whiptail --backtitle "DockPilot Installer" \
        --title "$title" \
        --radiolist "Seleccione una opción:" 20 60 10 \
        "${items[@]}" 2>"$temp_file"
    
    local result
    result=$(cat "$temp_file")
    rm -f "$temp_file"
    
    echo "$result"
}

show_input_whiptail() {
    local title="$1"
    local prompt="$2"
    local default="${3:-}"
    
    local temp_file
    temp_file=$(mktemp)
    
    whiptail --backtitle "DockPilot Installer" \
        --title "$title" \
        --inputbox "$prompt" 10 60 "$default" 2>"$temp_file"
    
    local result
    result=$(cat "$temp_file")
    rm -f "$temp_file"
    
    echo "$result"
}

show_password_whiptail() {
    local title="$1"
    local prompt="$2"
    
    local temp_file
    temp_file=$(mktemp)
    
    whiptail --backtitle "DockPilot Installer" \
        --title "$title" \
        --passwordbox "$prompt" 10 60 2>"$temp_file"
    
    local result
    result=$(cat "$temp_file")
    rm -f "$temp_file"
    
    echo "$result"
}

show_confirm_whiptail() {
    local title="$1"
    local prompt="$2"
    
    whiptail --backtitle "DockPilot Installer" \
        --title "$title" \
        --yesno "$prompt" 10 60
    
    return $?
}

# ==============================================================================
# COMPONENTES TUI - FALLBACK BÁSICO
# ==============================================================================

show_welcome_basic() {
    local title="${1:-DockPilot Installer}"
    local subtitle="${2:-Docker Management Platform}"
    
    clear
    echo
    echo "=============================================="
    echo "  $title"
    echo "=============================================="
    echo "  $subtitle"
    echo "=============================================="
    echo
}

show_menu_basic() {
    local title="$1"
    shift
    
    echo
    echo "=== $title ==="
    echo
    
    local i=1
    local options=()
    while [[ $# -gt 0 ]]; do
        echo "  $i. $1"
        options+=("$1")
        shift
        ((i++))
    done
    
    echo
    local choice
    read -r -p "Seleccione una opción (1-$((i-1))): " choice
    
    if [[ "$choice" =~ ^[0-9]+$ ]] && [[ $choice -ge 1 && $choice -lt $i ]]; then
        echo "${options[$((choice-1))]}"
    else
        echo ""
    fi
}

show_input_basic() {
    local prompt="$1"
    local default="${2:-}"
    
    local input
    if [[ -n "$default" ]]; then
        read -r -p "$prompt [$default]: " input
        input="${input:-$default}"
    else
        read -r -p "$prompt: " input
    fi
    
    echo "$input"
}

show_password_basic() {
    local prompt="$1"
    
    local input
    read -r -s -p "$prompt: " input
    echo >&2
    
    echo "$input"
}

show_confirm_basic() {
    local prompt="$1"
    local default="${2:-n}"
    
    local input
    read -r -p "$prompt [${default}]: " input
    input="${input:-$default}"
    
    [[ "$input" =~ ^[Yy]$ ]]
}

show_progress_basic() {
    local message="$1"
    
    echo -n "$message..."
}

show_success_basic() {
    local message="$1"
    echo "[OK] $message"
}

show_error_basic() {
    local message="$1"
    echo "[ERROR] $message" >&2
}

# ==============================================================================
# WRAPPERS UNIFICADOS
# ==============================================================================

show_welcome() {
    detect_tui
    "show_welcome_${TUI_MODE}" "$@"
}

show_menu() {
    if should_use_tui; then
        "show_menu_${TUI_MODE}" "$@"
    else
        show_menu_basic "$@"
    fi
}

show_input() {
    if should_use_tui; then
        "show_input_${TUI_MODE}" "$@"
    else
        show_input_basic "$@"
    fi
}

show_password() {
    if should_use_tui; then
        "show_password_${TUI_MODE}" "$@"
    else
        show_password_basic "$@"
    fi
}

show_confirm() {
    if should_use_tui; then
        "show_confirm_${TUI_MODE}" "$@"
    else
        show_confirm_basic "$@"
    fi
}

show_progress() {
    local message="$1"
    
    if should_use_tui; then
        case "$TUI_MODE" in
            gum)
                show_progress_gum "$message" &
                echo $!
                ;;
            dialog)
                # Dialog requiere manejo especial
                echo ""
                ;;
            *)
                show_progress_basic "$message"
                ;;
        esac
    else
        show_progress_basic "$message"
    fi
}

show_success() {
    if should_use_tui; then
        "show_success_${TUI_MODE}" "$@"
    else
        show_success_basic "$@"
    fi
}

show_error() {
    if should_use_tui; then
        "show_error_${TUI_MODE}" "$@"
    else
        show_error_basic "$@"
    fi
}

# ==============================================================================
# COMPONENTES ADICIONALES
# ==============================================================================

# Mostrar lista de tareas con checkboxes
show_checklist() {
    local title="$1"
    shift
    
    if [[ "$TUI_MODE" == "dialog" ]]; then
        local items=()
        local i=1
        while [[ $# -gt 0 ]]; do
            items+=($i "$1" "on")
            shift
        done
        
        local temp_file
        temp_file=$(mktemp)
        
        dialog --clear --backtitle "DockPilot Installer" \
            --title "$title" \
            --checklist "Seleccione las opciones:" 20 60 10 \
            "${items[@]}" 2>"$temp_file"
        
        cat "$temp_file"
        rm -f "$temp_file"
    elif [[ "$TUI_MODE" == "whiptail" ]]; then
        local items=()
        while [[ $# -gt 0 ]]; do
            items+=("$1" "" "ON")
            shift
        done
        
        local temp_file
        temp_file=$(mktemp)
        
        whiptail --backtitle "DockPilot Installer" \
            --title "$title" \
            --checklist "Seleccione las opciones:" 20 60 10 \
            "${items[@]}" 2>"$temp_file"
        
        cat "$temp_file"
        rm -f "$temp_file"
    else
        # Fallback básico
        echo
        echo "=== $title ==="
        local i=1
        while [[ $# -gt 0 ]]; do
            echo "  [$i] $1"
            shift
            ((i++))
        done
        echo
        read -r -p "Ingrese los números separados por espacio: " selection
        echo "$selection"
    fi
}

# Mostrar texto largo (licencia, README, etc.)
show_text() {
    local title="$1"
    local text="$2"
    
    if [[ "$TUI_MODE" == "dialog" ]]; then
        echo "$text" | dialog --clear --backtitle "DockPilot Installer" \
            --title "$title" \
            --textbox - 20 70
    elif [[ "$TUI_MODE" == "whiptail" ]]; then
        whiptail --backtitle "DockPilot Installer" \
            --title "$title" \
            --scrolltext \
            --msgbox "$text" 20 70
    else
        echo
        echo "=== $title ==="
        echo "$text"
        echo
        read -r -p "Presione Enter para continuar..."
    fi
}

# Mostrar barra de progreso con porcentaje
show_progress_bar() {
    local percent="$1"
    local message="${2:-}"
    
    if [[ "$TUI_MODE" == "dialog" ]]; then
        echo "$percent" | dialog --gauge "$message" 8 50 0
    elif [[ "$TUI_MODE" == "gum" ]]; then
        # Gum no tiene gauge nativo, usar spinner
        echo "[$percent%] $message"
    else
        local width=50
        local filled=$((percent * width / 100))
        local empty=$((width - filled))
        
        printf "\r[" >&2
        printf "%${filled}s" | tr ' ' '=' >&2
        printf "%${empty}s" | tr ' ' ' ' >&2
        printf "] %3d%% %s" "$percent" "$message" >&2
        
        if [[ $percent -eq 100 ]]; then
            echo "" >&2
        fi
    fi
}

# ==============================================================================
# INICIALIZACIÓN
# ==============================================================================

init_tui() {
    detect_tui
}

# Si se ejecuta directamente, probar los componentes
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    init_tui
    
    show_welcome "DockPilot Test" "Probando componentes TUI"
    
    log_info "Modo TUI: $TUI_MODE"
    log_info "TUI Disponible: $TUI_AVAILABLE"
    
    local choice
    choice=$(show_menu "Menú de prueba" "Opción 1" "Opción 2" "Opción 3")
    log_info "Seleccionado: $choice"
    
    local input
    input=$(show_input "Ingrese texto" "placeholder" "default")
    log_info "Ingresado: $input"
    
    if show_confirm "¿Está de acuerdo?"; then
        log_info "Confirmado"
    else
        log_info "Cancelado"
    fi
    
    show_success "Prueba completada"
fi
