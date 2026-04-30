#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TaskFlow — VPS first-time setup script (NON-INVASIVE)
# Tested on Ubuntu 22.04 / 24.04 LTS
#
# This script is designed to coexist with other apps on the same VPS:
#   - Picks an unused host port (default 3030)
#   - ONLY adds a new nginx server block (does not touch existing sites)
#   - Does NOT enable/configure UFW (informs which ports to open if needed)
#   - Skips Docker install if already present
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
ask()  { local prompt="$1"; local default="${2:-}"; local var; if [[ -n "$default" ]]; then read -rp "$prompt [$default]: " var; var="${var:-$default}"; else read -rp "$prompt: " var; fi; echo "$var"; }

# ── Helpers ─────────────────────────────────────────────────────────────────

port_in_use() {
  local port="$1"
  ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}\$"
}

pick_free_port() {
  for p in 3030 3031 3040 3050 3100; do
    if ! port_in_use "$p"; then
      echo "$p"
      return 0
    fi
  done
  echo "3030"
}

# ── 1. Required packages ────────────────────────────────────────────────────
step "Verificando pacotes..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
NEED_INSTALL=()
for pkg in curl ca-certificates gnupg lsb-release git openssl nginx certbot python3-certbot-nginx iproute2; do
  dpkg -s "$pkg" >/dev/null 2>&1 || NEED_INSTALL+=("$pkg")
done
if [[ ${#NEED_INSTALL[@]} -gt 0 ]]; then
  step "Instalando: ${NEED_INSTALL[*]}"
  apt-get install -y -qq "${NEED_INSTALL[@]}" >/dev/null
fi
ok "Pacotes prontos"

# ── 2. Docker (only if missing) ─────────────────────────────────────────────
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

if ! docker compose version >/dev/null 2>&1; then
  warn "Docker Compose plugin não detectado. Instalando..."
  apt-get install -y -qq docker-compose-plugin >/dev/null
fi

# ── 3. Repository ──────────────────────────────────────────────────────────
if [[ ! -d "$APP_DIR" ]]; then
  step "Clonando repositório em $APP_DIR..."
  REPO_URL=$(ask "URL do repositório git" "https://github.com/MasterPlx/TASKFLOW.git")
  mkdir -p /opt
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
ok "Repositório em $APP_DIR"

# ── 4. .env config ─────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  step "Configurando variáveis de ambiente..."
  echo

  SUPA_URL=$(ask "NEXT_PUBLIC_SUPABASE_URL")
  SUPA_KEY=$(ask "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  ADMIN_PWD=$(ask "NEXT_PUBLIC_ADMIN_PASSWORD (senha do painel)")

  # Pick port — avoid conflicts with other apps
  SUGGESTED_PORT=$(pick_free_port)
  if port_in_use 3000; then
    warn "Porta 3000 já está em uso (outro app). Sugerindo $SUGGESTED_PORT."
  fi
  APP_PORT=$(ask "Porta para o app (host)" "$SUGGESTED_PORT")
  if port_in_use "$APP_PORT"; then
    err "Porta $APP_PORT já em uso. Escolha outra."
    exit 1
  fi

  DOMAIN=$(ask "Domínio (ex: xtaskflow.shop) — vazio se for usar só IP" "")

  CRON=$(openssl rand -hex 32)

  cat > .env <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPA_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPA_KEY
NEXT_PUBLIC_ADMIN_PASSWORD=$ADMIN_PWD
CRON_SECRET=$CRON
APP_PORT=$APP_PORT
DOMAIN=$DOMAIN
EOF
  chmod 600 .env
  ok ".env criado (porta $APP_PORT, domínio: ${DOMAIN:-IP only})"
else
  ok ".env já existe — usando valores existentes"
  # shellcheck disable=SC1091
  source <(grep -E '^(APP_PORT|DOMAIN|CRON_SECRET)=' .env)
fi

# ── 5. Build & start ───────────────────────────────────────────────────────
step "Construindo imagem Docker e subindo container..."
docker compose down 2>/dev/null || true
docker compose up -d --build

sleep 10
if ! docker compose ps --status running 2>/dev/null | grep -q taskflow; then
  err "Container não iniciou. Logs:"
  docker compose logs --tail=30 app
  exit 1
fi
ok "Container TaskFlow rodando em :${APP_PORT:-3000}"

# ── 6. Nginx (only adds new site, doesn't touch existing) ─────────────────
SERVER_NAME="${DOMAIN:-_}"
NGINX_CONF="/etc/nginx/sites-available/taskflow"

step "Adicionando bloco Nginx para taskflow..."
cat > "$NGINX_CONF" <<EOF
# TaskFlow site — added by setup-vps.sh
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT:-3000};
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

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/taskflow

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  ok "Nginx recarregado (outros sites preservados)"
else
  err "nginx -t falhou. Removendo config nova pra não quebrar nada:"
  nginx -t || true
  rm /etc/nginx/sites-enabled/taskflow
  exit 1
fi

# ── 7. Cron de lembretes ──────────────────────────────────────────────────
step "Adicionando cron de lembretes..."
CRON_SECRET_VALUE=$(grep -oP '(?<=^CRON_SECRET=).*' "$APP_DIR/.env")
TARGET_HOST="127.0.0.1:${APP_PORT:-3000}"

CRON_LINE="* * * * * curl -fsS -X POST -H \"Authorization: Bearer $CRON_SECRET_VALUE\" http://$TARGET_HOST/api/cron/reminders >/dev/null 2>&1"

# Idempotent: remove old taskflow line and re-add
(crontab -l 2>/dev/null | grep -v "/api/cron/reminders" || true; echo "$CRON_LINE") | crontab -
ok "Cron rodará a cada minuto chamando $TARGET_HOST"

# ── 8. Summary ────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Setup completo!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

IP=$(curl -fsS https://ipv4.icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')
echo "  → Acesso direto:  http://$IP:${APP_PORT:-3000}"
echo "  → Via Nginx:      http://$IP  (responde em $SERVER_NAME)"
[[ -n "${DOMAIN:-}" ]] && echo "  → Domínio:        http://$DOMAIN  (após DNS apontar para $IP)"
echo

echo "Próximos passos:"
n=1
[[ -n "${DOMAIN:-}" ]] && echo "  $n. Aponte $DOMAIN para $IP no painel da Hostinger" && n=$((n+1))
[[ -n "${DOMAIN:-}" ]] && echo "  $n. Habilite SSL: certbot --nginx -d $DOMAIN" && n=$((n+1))
echo "  $n. (Importante) Trocar senha root: passwd"
echo

echo "Comandos úteis:"
echo "  cd $APP_DIR && docker compose logs -f app    # logs"
echo "  cd $APP_DIR && ./scripts/deploy.sh           # atualizar"
echo "  curl -X POST -H \"Authorization: Bearer \$CRON_SECRET\" http://$TARGET_HOST/api/cron/reminders"
echo

echo -e "${YELLOW}⚠ NÃO toquei em UFW nem em outros sites Nginx — você decide se precisa abrir alguma porta a mais.${NC}"
