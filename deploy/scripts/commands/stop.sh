#!/bin/bash

# Stop command: stop services
cmd_stop() {
    log_info "Stopping vault services..."

    if ! check_docker_compose_file; then
        return 0
    fi

    docker-compose down || {
        log_error "Failed to stop services"
        return 1
    }

    log_info "Services stopped"
}

