#!/usr/bin/env bash
# One-time bootstrap for Ubuntu on AWS Lightsail: Docker Engine + Compose plugin.
# Run as a user with sudo: bash scripts/lightsail-install-docker.sh
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as a normal user with sudo access, not as root directly."
  exit 1
fi

sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker "$USER"
echo ""
echo "Docker installed. Log out and back in (or run: newgrp docker) so group 'docker' applies."
echo "Then: git clone <your-repo> && cd POS-1-march- && cp deploy.env.example .env && nano .env && ./scripts/deploy-on-server.sh"
