#!/bin/bash

# Vault Deploy installation script
# Download specified version of vault repository from GitHub source code

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Error: Please provide version number"
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.2.3"
    exit 1
fi

# Remove version prefix 'v' (if exists)
VERSION_CLEAN=${VERSION#v}

# GitHub source code download URL
REPO="otomic-agents/vault"
DOWNLOAD_URL="https://github.com/${REPO}/archive/refs/tags/${VERSION}.tar.gz"
ARCHIVE_FILE="vault-${VERSION}.tar.gz"

echo "Downloading vault ${VERSION}..."
echo "Download URL: ${DOWNLOAD_URL}"

# Download file to current directory
if command -v curl &> /dev/null; then
    curl -L -f -o "${ARCHIVE_FILE}" "${DOWNLOAD_URL}" || {
        echo "Error: Download failed, please check if version number is correct"
        exit 1
    }
elif command -v wget &> /dev/null; then
    wget -O "${ARCHIVE_FILE}" "${DOWNLOAD_URL}" || {
        echo "Error: Download failed, please check if version number is correct"
        exit 1
    }
else
    echo "Error: Need curl or wget to download file"
    exit 1
fi

# Extract file (tar will automatically create directory)
echo "Extracting..."
tar -xzf "${ARCHIVE_FILE}" || {
    echo "Error: Extraction failed"
    rm -f "${ARCHIVE_FILE}"
    exit 1
}

# Remove downloaded archive
rm -f "${ARCHIVE_FILE}"

echo ""
echo "Installation completed!"
echo "Files extracted to: vault-${VERSION_CLEAN}/"
echo ""
echo "Next steps:"
echo "  cd vault-${VERSION_CLEAN}/deploy"
echo "  ./panel.sh generate-config"
