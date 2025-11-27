#!/bin/bash

# PublishAddress command: publish addresses
cmd_publish_address() {
    log_info "Publishing addresses..."

    if ! check_keys_file; then
        return 1
    fi

    if ! check_olares_cli; then
        return 1
    fi

    # Source the check-config.sh to get validate_mnemonic function
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../" && pwd)"
    source "${SCRIPT_DIR}/scripts/commands/check-config.sh"

    # Check owner mnemonic (must be 12 words)
    local owner_mnemonic=$(get_toml_value "keys.toml" "owner" "mnemonic")
    if [ -z "$owner_mnemonic" ]; then
        log_error "owner.mnemonic not set in keys.toml"
        return 1
    fi

    # Validate mnemonic format using existing validation function
    if ! validate_mnemonic "$owner_mnemonic"; then
        log_error "owner.mnemonic validation failed"
        return 1
    fi

    local olares_id=$(get_toml_value "keys.toml" "owner" "olares_id")
    if [ -z "$olares_id" ]; then
        log_error "owner.olares_id not set in keys.toml"
        return 1
    fi
    
    # Normalize olares_id: trim spaces and replace @ with .
    olares_id=$(echo "$olares_id" | xargs | tr '@' '.')

    # Check owner gas balance on Optimism chain
    log_info "Checking owner gas balance..."
    npx ts-node lib/auth-address/check-owner-balance.ts 2>/dev/null || log_warn "Owner balance check failed, continuing anyway..."

    # Extract addresses from keys.toml for each chain
    # Simplified processing here, actually need to parse private keys and calculate addresses
    # Or require users to provide address list

    npx ts-node lib/auth-address/address-manager.ts 2>/dev/null
    
}

