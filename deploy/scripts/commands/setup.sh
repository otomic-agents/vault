#!/bin/bash

# Setup command: generate configuration file templates
cmd_setup() {
    log_info "Generating configuration file templates..."

    if [ -f "keys.toml" ]; then
        log_warn "keys.toml already exists, skipping generation. To regenerate, please delete the file first."
    else
        if [ -f "templates/keys.toml.template" ]; then
            cp templates/keys.toml.template keys.toml
            log_info "Generated keys.toml, please edit this file to fill in wallet information"
        else
            log_error "templates/keys.toml.template does not exist"
            return 1
        fi
    fi

    if [ -f "config.toml" ]; then
        log_warn "config.toml already exists, skipping generation. To regenerate, please delete the file first."
    else
        if [ -f "templates/config.toml.template" ]; then
            cp templates/config.toml.template config.toml
            log_info "Generated config.toml, please edit this file to fill in configuration information (especially lp_node_ip)"
        else
            log_error "templates/config.toml.template does not exist"
            return 1
        fi
    fi

    log_info "Configuration file generation completed!"
    log_info "Please run: vi keys.toml and vi config.toml to edit configuration"
}
