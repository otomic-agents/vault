#!/bin/bash

# Vault Deploy Common Functions Library

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$SCRIPT_DIR"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Utility functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed, please install $1 first"
        return 1
    fi
    return 0
}

# Ensure asdf environment is loaded
ensure_asdf_loaded() {
    # Check if asdf is already loaded by checking if asdf command exists
    if ! command -v asdf &> /dev/null; then
        # Try to load asdf if it exists
        if [ -f "$HOME/.asdf/asdf.sh" ]; then
            . "$HOME/.asdf/asdf.sh"
        else
            # If asdf is not installed, try to source from dev-tools
            if [ -f "${SCRIPT_DIR}/scripts/utils/dev-tools.sh" ]; then
                source "${SCRIPT_DIR}/scripts/utils/dev-tools.sh"
                load_asdf
            fi
        fi
    fi
}

# Parse value from TOML file
get_toml_value() {
    local file=$1
    local section=$2
    local key=$3
    sed -n "/^\[${section}\]/,/^\[/p" "$file" | \
        grep "^${key}" | \
        head -1 | \
        cut -d'=' -f2- | \
        sed 's/^[[:space:]]*//' | \
        sed 's/[[:space:]]*$//' | \
        sed 's/^["'\'']//' | \
        sed 's/["'\'']$//'
}

# Check if config file exists
check_config_files() {
    if [ ! -f "config.toml" ]; then
        log_error "config.toml does not exist, please run ./panel.sh setup first"
        return 1
    fi
    return 0
}

# Check if keys.toml exists
check_keys_file() {
    if [ ! -f "keys.toml" ]; then
        log_error "keys.toml does not exist, please run ./panel.sh setup first"
        return 1
    fi
    return 0
}

# Check if docker-compose.yml exists
check_docker_compose_file() {
    if [ ! -f "docker-compose.yml" ]; then
        log_error "docker-compose.yml does not exist, service may not be started"
        return 1
    fi
    return 0
}

# Check if did-cli is available
check_olares_cli() {
    # Ensure asdf is loaded before using npx
    ensure_asdf_loaded
    
    if ! NODE_NO_WARNINGS=1 npx did-cli --version &> /dev/null; then
        log_error "did-cli is not available, please ensure @olares/did-cli is installed"
        return 1
    fi
    return 0
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    # Install asdf and related dependencies first
    source "scripts/utils/dev-tools.sh"
    install_asdf
    load_asdf
    install_nodejs
    install_docker
    install_docker_compose

    # Reload environment
    if [ -f "$HOME/.asdf/asdf.sh" ]; then
        . "$HOME/.asdf/asdf.sh"
    fi

    # Verify if dependencies are installed successfully
    if ! check_command "docker"; then
        log_error "Docker installation failed"
        return 1
    fi
    if ! check_command "docker-compose"; then
        log_error "Docker Compose installation failed"
        return 1
    fi
    if ! check_command "node"; then
        log_error "Node.js installation failed"
        return 1
    fi

    log_info "Dependencies check passed"
    return 0
}

# Check docker-compose.yml file
check_docker_compose() {
    if [ ! -f "docker-compose.yml" ]; then
        log_error "docker-compose.yml does not exist"
        return 1
    fi
    log_info "docker-compose.yml file check passed"
    return 0
}

# Execute dependency installation (if package.json exists)
run_npm_install() {
    if [ -f "package.json" ]; then
        log_info "Installing dependencies..."

        # Use npm to install dependencies
        log_info "Using npm to install dependencies..."
        npm install || log_warn "npm install failed, continuing startup..."
    fi
}

# Generate and export key environment variables
generate_and_export_keys() {
    # Ensure asdf is loaded before using npx
    ensure_asdf_loaded
    
    log_info "Generating key environment variables..."

    # Check if keys.toml exists
    if ! check_keys_file; then
        log_error "keys.toml does not exist, cannot generate keys"
        return 1
    fi

    # Call TypeScript script to generate key pairs
    local key_pairs_output
    key_pairs_output=$(npx ts-node lib/keys/get-private-key.ts 2>/dev/null)

    if [ $? -ne 0 ]; then
        log_error "Failed to call get_private_key.ts"
        return 1
    fi

    if [ -z "$key_pairs_output" ]; then
        log_warn "No valid key configuration found"
        return 0
    fi

    local key_pairs_array=()
    local export_count=0

    # Process output line by line, format: address=privateKey
    while IFS= read -r line; do
        if [ -n "$line" ] && [[ "$line" == *"="* ]]; then
            # Extract address and private key
            local address="${line%%=*}"
            local private_key="${line#*=}"

            # Add to array
            key_pairs_array+=("$address=$private_key")
            export_count=$((export_count + 1))
        fi
    done <<< "$key_pairs_output"

    # Generate comma-separated key mapping string
    if [ ${#key_pairs_array[@]} -gt 0 ]; then
        local private_key_map=$(IFS=','; echo "${key_pairs_array[*]}")
        export PRIVATE_KEY_MAP="$private_key_map"
        log_info "Generated key mapping environment variable PRIVATE_KEY_MAP"
        log_info "Contains $export_count key pairs"
    else
        log_warn "No valid key pairs found"
        return 1
    fi

    return 0
}

