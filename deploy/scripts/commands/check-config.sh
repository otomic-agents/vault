#!/bin/bash

# Check-config command: Check configuration files

# Mask sensitive part of private key, show only first 6 and last 4 characters
mask_private_key() {
    local key="$1"
    if [ -z "$key" ] || [ "$key" = "0x" ]; then
        echo "Not set"
    elif [ ${#key} -lt 10 ]; then
        echo "Not set"
    else
        echo "${key:0:6}...${key: -4}"
    fi
}

# Get all [section] names from keys.toml file
get_all_sections() {
    if [ ! -f "keys.toml" ]; then
        echo ""
        return
    fi

    # Use grep to get all [section] lines, then extract section names
    grep -E '^\[.*\]$' keys.toml | sed 's/^\[\(.*\)\]$/\1/' | grep -v '^global$'
}

# Check network configuration (IP and port)
check_network_config() {
    log_info "=== Network Configuration ==="

    # Check config.toml exists
    if [ ! -f "config.toml" ]; then
        log_error "config.toml does not exist, please run ./panel.sh generate-config first"
        return 1
    fi

    local has_error=0

    # Check lp_node_ip
    local lp_ip=$(get_toml_value "config.toml" "security" "lp_node_ip")
    if [ -z "$lp_ip" ] || [ "$lp_ip" = "" ]; then
        log_warn "lp_node_ip not set in config.toml"
        has_error=1
    else
        log_info "lp_node_ip: $lp_ip"
    fi

    # Check port
    local port=$(get_toml_value "config.toml" "server" "port")
    if [ -z "$port" ]; then
        log_warn "port not set in config.toml, will use default value 19000"
    else
        log_info "port: $port"
    fi

    return $has_error
}

# Validate mnemonic phrase format
validate_mnemonic() {
    local mnemonic="$1"

    # Step 1: Basic check
    if [ -z "$mnemonic" ]; then
        log_error "Mnemonic is empty"
        return 1
    fi

    # Step 2: Remove quotes and normalize spaces
    local clean_mnemonic=$(echo "$mnemonic" | sed 's/"//g' | sed "s/'//g" | tr -s ' ' | xargs)

    # Step 3: Count words
    local word_count=$(echo "$clean_mnemonic" | wc -w)

    # Step 4: Validate word count (only accept 12 words)
    if [ "$word_count" -ne 12 ]; then
        log_error "Invalid mnemonic length: $word_count words (expected 12 words)"
        return 1
    fi

    # Step 5: Check word format
    local words=($clean_mnemonic)
    for i in "${!words[@]}"; do
        local word="${words[$i]}"

        # Check if contains only lowercase letters
        if ! [[ "$word" =~ ^[a-z]+$ ]]; then
            log_error "Word #$((i+1)) '$word' contains invalid characters (must be lowercase letters only)"
            return 1
        fi

        # Check word length (BIP39 words are 3-8 characters)
        local len=${#word}
        if [ $len -lt 3 ] || [ $len -gt 8 ]; then
            log_error "Word #$((i+1)) '$word' has invalid length: $len (expected 3-8 characters)"
            return 1
        fi
    done

    return 0
}

# Check owner configuration (mnemonic and olares_id)
check_owner_config() {
    log_info "=== Owner Configuration ==="

    if [ ! -f "keys.toml" ]; then
        log_warn "keys.toml does not exist (optional, used for address publishing)"
        return 0
    fi

    # Check owner mnemonic (must be 12 words)
    local owner_mnemonic=$(get_toml_value "keys.toml" "owner" "mnemonic")
    if [ -z "$owner_mnemonic" ]; then
        log_warn "owner.mnemonic not set in keys.toml"
    else
        # Validate mnemonic format
        if validate_mnemonic "$owner_mnemonic"; then
            log_info "owner.mnemonic: ✅ Valid 12-word mnemonic configured"
        else
            log_warn "owner.mnemonic: Invalid format"
        fi
    fi

    # Check owner olares_id
    local olares_id=$(get_toml_value "keys.toml" "owner" "olares_id")
    if [ -z "$olares_id" ]; then
        log_warn "owner.olares_id not set in keys.toml"
    else
        log_info "owner.olares_id: $olares_id"
    fi

    return 0
}

# Check specific chain's private key configuration
check_chain_keys() {
    local chain="$1"
    local has_key=0

    # Get all private_key configurations for this chain
    local section_content=$(sed -n "/^\[$chain\]/,/^\[/p" keys.toml | grep -v "^\[")

    # Extract all private_key_ lines
    local key_lines=$(echo "$section_content" | grep -E "^private_key_[0-9]+")

    if [ -z "$key_lines" ]; then
        log_warn "No private key configuration found for $chain chain"
        return 1
    fi

    log_info "$chain chain private key configuration:"
    # Process each private key line
    while IFS= read -r line; do
        # Use get_toml_value function to extract private key value
        local key_name=$(echo "$line" | cut -d'=' -f1)
        local key=$(get_toml_value "keys.toml" "$chain" "$key_name")
        if [ -n "$key" ] && [ "$key" != "0x" ]; then
            local masked_key=$(mask_private_key "$key")
            log_info "  $key_name: $masked_key"
            has_key=1
        elif [ "$key" = "0x" ]; then
            log_info "  $key_name: Not set"
        fi
    done <<< "$key_lines"

    if [ $has_key -eq 0 ]; then
        log_warn "No valid private key configuration for $chain chain"
        return 1
    fi

    return 0
}

# Check all chain configurations
check_chains_config() {
    log_info "=== Chain Configuration ==="

    if [ ! -f "keys.toml" ]; then
        log_warn "keys.toml does not exist (optional, used for address publishing)"
        return 0
    fi

    # Get all chain names
    local sections=$(get_all_sections)

    # Check private keys for all chains except owner
    for section in $sections; do
        if [ "$section" != "owner" ]; then
            check_chain_keys "$section" || true  # Use || true to ensure loop continues even if function returns 1
        fi
    done

    # Summarize configuration status of all chains
    log_info "=== Chain Configuration Summary ==="
    for section in $sections; do
        if [ "$section" != "owner" ]; then
            # Check if this chain has valid private keys
            local section_content=$(sed -n "/^\[$section\]/,/^\[/p" keys.toml | grep -v "^\[")
            local key_lines=$(echo "$section_content" | grep -E "^private_key_[0-9]+")

            if [ -n "$key_lines" ]; then
                local has_valid_key=0
                while IFS= read -r line; do
                    local key_name=$(echo "$line" | cut -d'=' -f1)
                    local key=$(get_toml_value "keys.toml" "$section" "$key_name")
                    if [ -n "$key" ] && [ "$key" != "0x" ]; then
                        has_valid_key=1
                        break
                    fi
                done <<< "$key_lines"

                if [ $has_valid_key -eq 1 ]; then
                    log_info "$section: Configured"
                else
                    log_info "$section: Not configured"
                fi
            else
                log_info "$section: Not configured"
            fi
        fi
    done

    return 0
}

# Validate private key format
validate_private_key() {
    local key="$1"
    local chain="$2"

    if [ -z "$key" ] || [ "$key" = "0x" ]; then
        return 1
    fi

    # Check Ethereum/EVM private key format (64 hex characters after 0x)
    if [ "$chain" != "solana" ]; then
        if [[ "$key" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
            return 0
        else
            log_error "Invalid EVM private key format for $chain: must be 0x followed by 64 hex characters"
            return 1
        fi
    fi

    # Check Solana private key format (Base58 encoded, typically 88 characters for ed25519)
    if [ "$chain" = "solana" ]; then
        if [[ "$key" =~ ^[1-9A-HJ-NP-Za-km-z]{88}$ ]]; then
            return 0
        else
            log_error "Invalid Solana private key format: must be 88 Base58 characters"
            return 1
        fi
    fi

    return 1
}

# Check owner configuration requirements (strict)
check_owner_requirements() {
    if [ ! -f "keys.toml" ]; then
        log_error "keys.toml is required"
        return 1
    fi

    # Check owner mnemonic (must be 12 words)
    local owner_mnemonic=$(get_toml_value "keys.toml" "owner" "mnemonic")
    if [ -z "$owner_mnemonic" ]; then
        log_error "owner.mnemonic is required"
        return 1
    fi

    # Validate mnemonic format using the improved validation function
    if ! validate_mnemonic "$owner_mnemonic"; then
        log_error "owner.mnemonic validation failed"
        return 1
    fi

    # Check owner olares_id
    local olares_id=$(get_toml_value "keys.toml" "owner" "olares_id")
    if [ -z "$olares_id" ]; then
        log_error "owner.olares_id is required"
        return 1
    fi

    return 0
}

# Check if at least one chain has valid private key configuration
check_chain_requirements() {
    if [ ! -f "keys.toml" ]; then
        log_error "keys.toml is required"
        return 1
    fi

    # Get all sections
    local sections=$(get_all_sections)
    local valid_chains=0

    for section in $sections; do
        if [ "$section" != "owner" ]; then
            # Get all private_key configurations for this chain
            local section_content=$(sed -n "/^\[$section\]/,/^\[/p" keys.toml | grep -v "^\[")
            local key_lines=$(echo "$section_content" | grep -E "^private_key_[0-9]+")

            if [ -n "$key_lines" ]; then
                while IFS= read -r line; do
                    local key_name=$(echo "$line" | cut -d'=' -f1)
                    local key=$(get_toml_value "keys.toml" "$section" "$key_name")

                    if [ -n "$key" ] && [ "$key" != "0x" ]; then
                        # Validate private key format
                        if validate_private_key "$key" "$section"; then
                            valid_chains=$((valid_chains + 1))
                            break  # One valid key per chain is enough
                        fi
                    fi
                done <<< "$key_lines"
            fi
        fi
    done

    if [ $valid_chains -eq 0 ]; then
        log_error "At least one chain must have valid private key configuration"
        return 1
    fi

    log_info "Found $valid_chains chain(s) with valid configuration"
    return 0
}

cmd_check_config() {
    log_info "Checking configuration files..."

    local has_error=0

    # Check network configuration (IP and port)
    check_network_config || has_error=1

    echo ""  # Add blank line for better readability

    # Check owner configuration (display info)
    check_owner_config || has_error=1

    echo ""  # Add blank line for better readability

    # Check chain configurations (display info)
    check_chains_config

    # Check strict requirements for startup
    log_info "=== Startup Requirements Check ==="
    check_owner_requirements || has_error=1
    check_chain_requirements || has_error=1

    if [ $has_error -eq 1 ]; then
        log_error "Configuration check failed, please fix the above issues"
        return 1
    else
        log_info "Configuration check passed"
        return 0
    fi
}
