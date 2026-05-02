#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/checkin-app"
APP_PORT="3100"
APP_USER="checkin"
APP_GROUP="checkin"
SERVICE_NAME="checkin-app"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root"
  exit 1
fi

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    echo "Node already installed: $(node -v)"
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y curl ca-certificates gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update
    apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nodejs npm
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nodejs npm
  else
    echo "Unsupported package manager. Install Node.js 20+ manually."
    exit 1
  fi
}

ensure_user() {
  if ! getent group "${APP_GROUP}" >/dev/null; then
    groupadd --system "${APP_GROUP}"
  fi
  if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --gid "${APP_GROUP}" --create-home --home-dir /home/${APP_USER} --shell /usr/sbin/nologin "${APP_USER}"
  fi
}

setup_dirs() {
  mkdir -p "${APP_DIR}"
  mkdir -p "${APP_DIR}/uploads"
  chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
}

install_deps() {
  cd "${APP_DIR}"
  npm install --omit=dev
}

write_systemd() {
  cat >/etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Independent Checkin App
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ${APP_DIR}/src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable ${SERVICE_NAME}
  systemctl restart ${SERVICE_NAME}
}

print_next_steps() {
  echo ""
  echo "Done. Service status:"
  systemctl --no-pager --full status ${SERVICE_NAME} || true
  echo ""
  echo "Remember to configure ${APP_DIR}/.env first."
  echo "Health check after env/db ready: curl http://127.0.0.1:${APP_PORT}/api/health"
}

ensure_node
ensure_user
setup_dirs
install_deps
write_systemd
print_next_steps
