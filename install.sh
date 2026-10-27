#!/usr/bin/env bash
# ========================================================
# HostPanel - Automated 1-Click Installer for Linux VPS
# ========================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "          HostPanel - VPS Hosting Panel Installer         "
echo "   File Manager • Web Terminal • Node.js & Python PM      "
echo "=========================================================="
echo -e "${NC}"

# 1. Check Root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this script as root (sudo ./install.sh)${NC}"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=${PORT:-20062}

echo -e "${GREEN}[*] Installation directory: ${INSTALL_DIR}${NC}"

# 2. Detect OS & install prerequisites
echo -e "${CYAN}[1/6] Checking system dependencies (curl, git, python3, nginx, certbot, mariadb, build tools)...${NC}"
if [ -f /etc/debian_version ]; then
    apt-get update -y
    apt-get install -y curl git python3 python3-pip python3-venv build-essential ufw nginx certbot python3-certbot-nginx mariadb-server mariadb-client
    systemctl enable nginx || true
    systemctl start nginx || true
    systemctl enable mariadb || true
    systemctl start mariadb || true
elif [ -f /etc/redhat-release ]; then
    yum install -y curl git python3 python3-pip gcc-c++ make nginx certbot python3-certbot-nginx mariadb-server mariadb
    systemctl enable nginx || true
    systemctl start nginx || true
    systemctl enable mariadb || true
    systemctl start mariadb || true
fi

# 3. Check or Install Node.js (Node 20+ LTS recommended)
echo -e "${CYAN}[2/6] Checking Node.js runtime...${NC}"
NODE_OK=false
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}[✓] Node.js $(node -v) is already installed.${NC}"
        NODE_OK=true
    fi
fi

if [ "$NODE_OK" = false ]; then
    echo -e "${YELLOW}[!] Node.js not found or version < 18. Installing Node.js LTS via NodeSource...${NC}"
    if [ -f /etc/debian_version ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif [ -f /etc/redhat-release ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    fi
    echo -e "${GREEN}[✓] Installed Node.js $(node -v)${NC}"
fi

# 4. Install npm dependencies
echo -e "${CYAN}[3/6] Installing backend dependencies...${NC}"
cd "$INSTALL_DIR"
npm install --production

# Check if dist exists, if not build client
if [ ! -d "$INSTALL_DIR/dist" ]; then
    echo -e "${YELLOW}[*] Building frontend assets...${NC}"
    cd "$INSTALL_DIR/client"
    npm install
    npm run build
    cd "$INSTALL_DIR"
fi

# 5. Setup Environment & Data Directory
echo -e "${CYAN}[4/6] Configuring environment & security...${NC}"
mkdir -p "$INSTALL_DIR/data"
mkdir -p "$INSTALL_DIR/data/logs"

if [ ! -f "$INSTALL_DIR/.env" ]; then
    RANDOM_SECRET=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 48 ; echo '')
    cat <<EOF > "$INSTALL_DIR/.env"
PORT=${PORT}
NODE_ENV=production
PANEL_ROOT=/
JWT_SECRET=${RANDOM_SECRET}
DATA_DIR=${INSTALL_DIR}/data
EOF
    echo -e "${GREEN}[✓] Created .env with random secure JWT_SECRET${NC}"
fi

# 6. Setup Systemd Service
echo -e "${CYAN}[5/6] Creating systemd service (panel.service)...${NC}"
NODE_BIN=$(which node)

cat <<EOF > /etc/systemd/system/panel.service
[Unit]
Description=HostPanel - VPS Hosting Web Control Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_BIN} ${INSTALL_DIR}/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable panel.service
systemctl restart panel.service

# 7. Configure Firewall (if ufw exists)
echo -e "${CYAN}[6/6] Checking firewall ports (80, 443, ${PORT})...${NC}"
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        ufw allow 80/tcp >/dev/null 2>&1 || true
        ufw allow 443/tcp >/dev/null 2>&1 || true
        ufw allow ${PORT}/tcp >/dev/null 2>&1 || true
        echo -e "${GREEN}[✓] Ports 80, 443, and ${PORT} allowed in ufw firewall.${NC}"
    fi
fi

# Get Public IP
PUBLIC_IP=$(curl -s -m 4 https://ifconfig.me || curl -s -m 4 https://api.ipify.org || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}${BOLD}==========================================================${NC}"
echo -e "${GREEN}${BOLD}   HostPanel Successfully Installed & Running!           ${NC}"
echo -e "${GREEN}${BOLD}==========================================================${NC}"
echo -e "${BOLD}Dashboard URL :${NC} ${CYAN}http://${PUBLIC_IP}:${PORT}${NC}"
echo -e "${BOLD}Username      :${NC} admin"
echo -e "${BOLD}Password      :${NC} admin123"
echo ""
echo -e "${YELLOW}Catatan Keamanan:${NC}"
echo "Segera ganti password default di menu Settings setelah login!"
echo ""
echo -e "${BOLD}Perintah Pengelolaan Panel:${NC}"
echo "  systemctl status panel    # Cek status panel"
echo "  systemctl restart panel   # Restart panel"
echo "  systemctl stop panel      # Hentikan panel"
echo "  journalctl -u panel -f    # Lihat log panel"
echo "=========================================================="
