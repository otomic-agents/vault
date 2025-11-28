#!/bin/bash

# Start command: Start services
cmd_start() {
    # Check dependencies
    if ! check_dependencies; then
        return 1
    fi

    # Execute npm install (if package.json exists)
    run_npm_install

    log_info "Starting vault services..."

    # Check owner configuration before generating keys
    log_info "Checking owner configuration..."
    if ! source "${SCRIPT_DIR}/scripts/commands/check-config.sh" || ! check_owner_requirements; then
        log_error "Owner configuration check failed, please fix keys.toml first"
        return 1
    fi

    # Generate missing keys first
    log_info "Checking and generating missing keys..."
    if ! npx ts-node lib/keys/generate-keys.ts; then
        log_error "Failed to generate missing keys"
        return 1
    fi

    # Check configuration
    if ! source "${SCRIPT_DIR}/scripts/commands/check-config.sh" || ! cmd_check_config; then
        log_error "Configuration check failed, please fix configuration first"
        return 1
    fi

    # Display all account private keys (masked) and addresses
    log_info "=== Account Information ==="
    NODE_NO_WARNINGS=1 npx ts-node lib/auth-address/get-addresses.ts

    # Check lp_node_ip
    local lp_ip=$(get_toml_value "config.toml" "security" "lp_node_ip")
    if [ -z "$lp_ip" ] || [ "$lp_ip" = "" ]; then
        log_error "lp_node_ip is not set, service startup not allowed"
        log_info "Please edit config.toml to set lp_node_ip, or run ./panel.sh wait-lp to get IP"
        return 1
    fi



    # Check docker-compose.yml file
    if ! check_docker_compose; then
        return 1
    fi

    # Export LP_NODE_IP environment variable
    export LP_NODE_IP="$lp_ip"
    log_info "Exported LP_NODE_IP: $lp_ip"

    # Generate key environment variables
    if ! generate_and_export_keys; then
        log_error "Key generation failed, service startup not allowed"
        return 1
    fi

    # Print PRIVATE_KEY_MAP for debugging
    log_info "PRIVATE_KEY_MAP generated"

    # Generate IP whitelist configuration (if needed)
    log_info "Configuring IP whitelist: $lp_ip"

    # Start services
    log_info "Starting EVM vault and Solana vault services..."
    docker-compose up -d || {
        log_error "Failed to start services"
        return 1
    }

    log_info "Services started successfully!"
    log_info "Run ./panel.sh stop to stop services"
}

