#!/bin/bash

# Vault Deploy Management Script
# Provides commands like generate-config, start, stop, status to manage vault services

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load common functions
source "${SCRIPT_DIR}/scripts/utils/common.sh"

# Main function
main() {
    case "${1:-}" in
        generate-config)
            source "${SCRIPT_DIR}/scripts/commands/setup.sh"
            cmd_setup
            ;;
        check-config)
            source "${SCRIPT_DIR}/scripts/commands/check-config.sh"
            cmd_check_config
            ;;
        start)
            source "${SCRIPT_DIR}/scripts/commands/start.sh"
            cmd_start
            ;;
        stop)
            source "${SCRIPT_DIR}/scripts/commands/stop.sh"
            cmd_stop
            ;;
        status)
            source "${SCRIPT_DIR}/scripts/commands/status.sh"
            cmd_check
            ;;
        auth-address)
            case "${2:-}" in
                list)
                    source "${SCRIPT_DIR}/scripts/auth-address/list.sh"
                    cmd_list_address
                    ;;
                publish)
                    source "${SCRIPT_DIR}/scripts/auth-address/publish.sh"
                    cmd_publish_address
                    ;;
                *)
                    echo "Usage: $0 auth-address {list|publish} [options]"
                    echo ""
                    echo "Commands:"
                    echo "  list     - List all authorized addresses"
                    echo "  publish  - Publish authorized addresses to chain"
                    echo ""
                    echo "Options for list:"
                    echo "  --network <network>  Network to use (sepolia|mainnet) [default: mainnet]"
                    echo "  -n <network>         Same as --network"
                    exit 1
                    ;;
            esac
            ;;
        *)
            echo "Usage: $0 {generate-config|check-config|start|stop|status|auth-address}"
            echo ""
            echo "Core Operations:"
            echo "  generate-config         - Generate configuration templates"
            echo "  start                   - Start services"
            echo "  stop                    - Stop services"
            echo "  status                  - Check service status"
            echo ""
            echo "Configuration:"
            echo "  check-config            - Check configuration files"
            echo ""
            echo "Address Management:"
            echo "  auth-address list       - List all authorized addresses"
            echo "  auth-address publish    - Publish authorized addresses to chain"
            echo "    Use: --network <sepolia|mainnet> to specify network"
            exit 1
            ;;
    esac
}

main "$@"

