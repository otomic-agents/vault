#!/bin/bash

# ListAddress command: List published addresses
cmd_list_address() {
    # Ensure asdf is loaded before using npx
    ensure_asdf_loaded
    
    local network="mainnet"  # Default to mainnet

    # Parse optional network argument
    if [ "$1" = "--network" ] && [ -n "$2" ]; then
        network="$2"
        shift 2
    elif [ "$1" = "-n" ] && [ -n "$2" ]; then
        network="$2"
        shift 2
    fi

    log_info "Listing published addresses on $network network..."

    if ! check_keys_file; then
        return 1
    fi

    if ! check_olares_cli; then
        return 1
    fi

    local olares_id=$(get_toml_value "keys.toml" "owner" "olares_id")
    if [ -z "$olares_id" ]; then
        log_error "owner.olares_id not set in keys.toml"
        return 1
    fi
    
    # Normalize olares_id: trim spaces and replace @ with .
    olares_id=$(echo "$olares_id" | xargs | tr '@' '.')

    log_info "Querying published addresses from chain..."

    # List EVM wallet addresses
    log_info "EVM wallet addresses:"
    NODE_NO_WARNINGS=1 npx did-cli wallet evm list "$olares_id" --network "$network" || log_warn "Failed to get EVM wallet list"

    # List Solana wallet addresses
    log_info "Solana wallet addresses:"
    NODE_NO_WARNINGS=1 npx did-cli wallet solana list "$olares_id" --network "$network" || log_warn "Failed to get Solana wallet list"
}

