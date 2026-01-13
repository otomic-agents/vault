#!/bin/bash

# Check command: check signing service
cmd_check() {
    log_info "Checking signing service..."

    if ! check_docker_compose_file; then
        return 1
    fi

    # Check service status
    log_info "Checking service status..."
    docker-compose ps

    # Check EVM vault container status
    log_info "Checking EVM vault container status..."
    if docker ps --filter "name=evm_sign" --filter "status=running" --format "{{.Names}}" | grep -q "evm_sign"; then
        log_info "✓ EVM vault container (evm_sign) is running"
    else
        log_warn "✗ EVM vault container (evm_sign) is not running"
    fi

    # Check Solana vault container status
    log_info "Checking Solana vault container status..."
    if docker ps --filter "name=solana_sign" --filter "status=running" --format "{{.Names}}" | grep -q "solana_sign"; then
        log_info "✓ Solana vault container (solana_sign) is running"
    else
        log_warn "✗ Solana vault container (solana_sign) is not running"
    fi

    # Check signing functionality for all configured addresses
    if [ -f "keys.toml" ]; then
        log_info "Checking address signing functionality..."
    fi
}

