#!/usr/bin/env bash
set -euo pipefail

# Run as the SSH administrator on a new Ubuntu host. Does not start app containers.
sudo -n true
. /etc/os-release
if [[ "$ID" != ubuntu ]]; then
  printf 'This installer requires Ubuntu.\n' >&2
  exit 1
fi

sudo apt-get -o DPkg::Lock::Timeout=120 update
sudo env DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=120 install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
  "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)" \
  | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null

sudo apt-get -o DPkg::Lock::Timeout=120 update
sudo env DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=120 install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo docker version --format '{{.Server.Version}}'
sudo docker compose version
sudo docker run --rm hello-world
