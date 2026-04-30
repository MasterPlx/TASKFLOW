#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TaskFlow — VPS first-time setup script
# Tested on Ubuntu 22.04 / 24.04 LTS
#
# Run AS ROOT on the VPS:
#   ./scripts/setup-vps.sh
#
# What it does:
#   1. Installs Docker, Docker Compose plugin, Nginx, Certbot, Git
#   2. Asks for env values (Supabase URL/key, admin password, domain)
#   3. Generates CRON_SECRET automatically
#   4. Writes /opt/taskflow/.env
#   5. Builds and starts the Docker container
#   6. Configures Nginx (HTTP only — SSL is a follow-up step with certbot)
#   7. Adds a cron job that fires reminders every minute
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ERRO: rode como root (sudo -i, ou ssh root@...)" >&2
  exit 1
fi

APP_DIR="/opt/taskflow"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

step() { echo -e "${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}! $1${NC}"; }
err()  { echo -e "${RED}✗ $1${NC}" >&2; }

# ── 1. System packages ──────────────────────────────────────────────────────
step "Atualizando pacotes do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release ufw nginx certbot python3-certbot-nginx git openssl >/dev/null

# ── 2. Docker (official repo) ───────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  step "Instalando Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker
  ok "Docker instalado: $(docker --version)"
else
  ok "Docker já instalado: $(docker --version)"
fi

# ── 3. Repo clone ──────────────────────────────────────────────────────────
if [[ ! -d "$APP_DIR" ]]; then
  step "Clonando repositório em $APP_DIR..."
  mkdir -p /opt
  read -rp "URL do repositório git (ex: https://github.com/USUARIO/REPO.git): " REPO_URL
  if [[ "$REPO_URL" =~ ^https://github.com/.+\.git$ ]]; then
    git clone "$REPO_URL" "$APP_DIR"
  else
    err "URL inválida"; exit 1
  fi
fi

cd "$APP_DIR"
ok "Repositório em $APP_DIR"

# ── 4. .env interactive prompts ────────────────────────────────────────────
if [[ ! -f .env ]]; then
  step "Configurando variáveis de ambiente..."
  echo
  read -rp "NEXT_PUBLIC_SUPABASE_URL (https://xxx.supabase.co): " SUPA_URL
  read -rp "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPA_KEY
  read -rp "NEXT_PUBLIC_ADMIN_PASSWORD (senha do painel admin): " ADMIN_PWD
  read -rp "Domínio (ex: xtaskflow.shop) — deixe vazio se for usar só IP: " DOMAIN

  CRON=$(openssl rand -hex 32)

  cat > .env <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPA_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPA_KEY
NEXT_PUBLIC_ADMIN_PASSWORD=$ADMIN_PWD
CRON_SECRET=$CRON
EOF
  chmod 600 .env
  ok ".env criado com permissão 600"
else
  warn ".env já existe — pulando (edite manualmente se precisar)"
  DOMAIN=$(grep -oP '(?<=^DOMAIN=).*' .env 2>/dev/null || echo "")
fi

# ── 5. Build & start Docker ────────────────────────────────────────────────
step "Construindo imagem Docker e subindo container..."
docker compose down 2>/dev/null || true
docker compose up -d --build

# Wait a bit and check health
sleep 8
if docker compose ps | grep -q "healthy\|running"; then
  ok "Container TaskFlow rodando em :3000"
else
  err "Container não iniciou — veja: docker compose logs app"
  exit 1
fi

# ── 6. Firewall ────────────────────────────────────────────────────────────
step "Configurando firewall (UFW)..."
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
echo "y" | ufw enable >/dev/null 2>&1 || true
ok "Firewall ativo (22, 80, 443 abertos)"

# ── 7. Nginx ──────────────────────────────────────────────────────────────
step "Configurando Nginx..."
SERVER_NAME="${DOMAIN:-_}"
cat > /etc/nginx/sites-available/taskflow <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/taskflow
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && systemctl reload nginx
ok "Nginx configurado (HTTP)"

# ── 8. Cron for reminders ─────────────────────────────────────────────────
step "Adicionando cron de lembretes..."
CRON_SECRET_VALUE=$(grep -oP '(?<=^CRON_SECRET=).*' "$APP_DIR/.env")
TARGET_HOST="${DOMAIN:-127.0.0.1}"
[[ -z "$DOMAIN" ]] && TARGET_HOST="127.0.0.1:3000"

CRON_LINE="* * * * * curl -fsS -X POST -H \"Authorization: Bearer $CRON_SECRET_VALUE\" http://$TARGET_HOST/api/cron/reminders >/dev/null 2>&1"

# Remove old taskflow lines and re-add
(crontab -l 2>/dev/null | grep -v "/api/cron/reminders" || true; echo "$CRON_LINE") | crontab -
ok "Cron rodará a cada minuto (alvo: $TARGET_HOST)"

# ── 9. Summary ────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Setup completo!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
IP=$(curl -fsS https://ipv4.icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')
echo "  → Acesse pelo IP:  http://$IP"
[[ -n "$DOMAIN" ]] && echo "  → Acesse pelo domínio: http://$DOMAIN (após DNS apontar pra $IP)"
echo
echo "Próximos passos:"
[[ -n "$DOMAIN" ]] && echo "  1. Aponte o A record de $DOMAIN para $IP no seu registrador"
[[ -n "$DOMAIN" ]] && echo "  2. Habilite SSL: certbot --nginx -d $DOMAIN"
echo "  3. Trocar senha root: passwd"
echo "  4. (Opcional) configurar SSH key e desabilitar login por senha"
echo
echo "Útil:"
echo "  cd $APP_DIR && docker compose logs -f app    (ver logs em tempo real)"
echo "  cd $APP_DIR && ./scripts/deploy.sh           (atualizar após git pull)"
