#!/bin/bash
# dev-tools.sh

set -e

# Install asdf
install_asdf() {
    if [ ! -d "$HOME/.asdf" ]; then
        echo ">>> Installing asdf..."
        git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0

        # Add to shell configuration
        echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
        echo '. "$HOME/.asdf/completions/asdf.bash"' >> ~/.bashrc
        source ~/.bashrc
    fi
}

# Load asdf environment
load_asdf() {
    if [ -f "$HOME/.asdf/asdf.sh" ]; then
        . "$HOME/.asdf/asdf.sh"
    fi
}

# Install Node.js
install_nodejs() {
    echo ">>> Configuring Node.js..."
    asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git 2>/dev/null || true
    asdf install nodejs 22.11.0
    asdf global nodejs 22.11.0
}

# Install Docker
install_docker() {
    echo ">>> Installing Docker..."
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo systemctl enable docker
        sudo systemctl start docker
        sudo usermod -aG docker $USER
        rm get-docker.sh
    fi
}

# Install Docker Compose
install_docker_compose() {
    echo ">>> Installing Docker Compose..."
    COMPOSE_VERSION="2.24.0"
    if ! command -v docker-compose &> /dev/null; then
        sudo curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
}