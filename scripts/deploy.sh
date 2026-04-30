#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# TaskFlow — deploy script para a VPS
# Uso: ./scripts/deploy.sh
# Pré-requisitos: docker + docker compose + git instalados, .env configurado
# ─────────────────────────────────────────────────────────────────────────────

cd "$(dirname "$0")/.."

echo "▶ Pulling latest changes from git..."
git pull --ff-only

echo "▶ Rebuilding Docker image and restarting container..."
docker compose up -d --build

echo "▶ Aguardando container ficar saudável..."
sleep 5

echo "▶ Logs dos últimos 30 segundos:"
docker compose logs --since 30s app || true

echo "▶ Status:"
docker compose ps

echo "✓ Deploy concluído"
