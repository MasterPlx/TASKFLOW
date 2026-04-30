# TaskFlow

SaaS de gestão de tarefas com painel admin e portal white-label para clientes, com notificações WhatsApp via CallMeBot.

## Stack

- Next.js 14 (App Router, TypeScript, output standalone)
- Supabase (Postgres + Storage)
- Tailwind CSS
- Lucide React (ícones)

## Funcionalidades

- 🔒 Painel `/admin` com login por senha (sessionStorage)
- 📊 Dashboard com métricas e progresso por cliente
- 📋 Lista + Kanban (drag & drop nativo) com filtro de busca
- 📝 Painel lateral com comentários e anexos (URL ou upload)
- 👥 CRUD de clientes com cor da marca, nome da marca e link único
- 🌈 Portal `/c/[slug]` white-label com cor + nome do cliente
- 💬 WhatsApp automático via rota server-side `/api/whatsapp`
- 🔁 Tarefas recorrentes (diária / semanal / mensal) com toast de reagendamento
- 🔔 Central de notificações com filtros e indicadores

---

## Desenvolvimento local

```bash
cp .env.example .env.local
# edite .env.local com suas credenciais Supabase

npm install
npm run dev
# abrir http://localhost:3000
```

---

## Deploy na VPS (Docker + Nginx + Certbot)

### 1. Pré-requisitos na VPS

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # logout/login depois
```

### 2. Clonar o projeto

```bash
git clone https://github.com/SEU-USUARIO/SEU-REPO.git /opt/taskflow
cd /opt/taskflow
```

### 3. Criar `.env`

```bash
# Generate a strong cron secret first
CRON=$(openssl rand -hex 32)

cat > .env <<EOF
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_ADMIN_PASSWORD=trocar-essa-senha
CRON_SECRET=$CRON
EOF
chmod 600 .env
```

### 4. Subir o container

```bash
docker compose up -d --build
docker compose ps              # verificar healthy
docker compose logs -f app     # acompanhar logs
```

App responde em `http://VPS_IP:3000`.

### 5. Configurar Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/taskflow
sudo sed -i 's/seudominio.com/SEU-DOMINIO-REAL.com/g' /etc/nginx/sites-available/taskflow
sudo ln -s /etc/nginx/sites-available/taskflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. SSL com Certbot

```bash
sudo certbot --nginx -d seudominio.com -d www.seudominio.com
# Certbot edita o nginx.conf automaticamente e configura renovação via systemd timer
```

### 7. Configurar o cron de lembretes (CRÍTICO!)

Lembretes de tarefas são disparados por uma rota `POST /api/cron/reminders` que precisa ser
chamada periodicamente. Use o `crontab` do sistema:

```bash
# Edite o crontab do usuário
crontab -e

# Adicione esta linha (substitua SEU-DOMINIO e SEU-CRON-SECRET pelos valores reais)
* * * * * curl -fsS -X POST -H "Authorization: Bearer SEU-CRON-SECRET" https://SEU-DOMINIO.com/api/cron/reminders >/dev/null 2>&1
```

Pegue o `SEU-CRON-SECRET` do arquivo `.env` (`grep CRON_SECRET .env`).

Para testar manualmente:

```bash
curl -X POST -H "Authorization: Bearer SEU-CRON-SECRET" \
  https://SEU-DOMINIO.com/api/cron/reminders
# Resposta esperada: {"ok":true,"processed":0,"sent":0}
```

### 8. Atualizar o app

```bash
cd /opt/taskflow
./scripts/deploy.sh
```

Ou manualmente:

```bash
git pull && docker compose up -d --build
```

---

## Comandos úteis

```bash
docker compose logs -f app       # logs em tempo real
docker compose restart app       # reiniciar sem rebuild
docker compose down              # parar e remover container
docker compose up -d --build     # rebuild + start (após git pull)
docker compose ps                # status (deve mostrar "healthy")

# Inspecionar a imagem
docker images | grep taskflow

# Limpar imagens antigas após muitos deploys
docker image prune -f
```

---

## Estrutura do projeto

```
app/
├── admin/               # área administrativa (gated por senha)
│   ├── layout.tsx       # AuthGate + Sidebar
│   ├── page.tsx         # dashboard
│   ├── tarefas/         # tarefas próprias do admin
│   ├── clientes/        # CRUD + tarefas por cliente
│   └── notificacoes/    # central de notificações
├── api/whatsapp/        # rota server-side que dispara CallMeBot
├── c/[slug]/            # portal white-label do cliente
├── globals.css
├── layout.tsx
└── page.tsx             # → redirect /admin
components/
├── admin/               # AuthGate, Sidebar, AdminLogin
├── clients/             # ClientModal, ClientCard
├── portal/              # ClientPortal (white-label view)
├── tasks/               # TaskList, KanbanBoard, TaskModal, TaskDetail, TasksView
├── Badges.tsx
├── Modal.tsx
└── Toast.tsx
lib/
├── auth.ts              # useAdminAuth (sessionStorage)
├── notifications.ts     # camada de mensagens WhatsApp
├── recurrence.ts        # maybeReschedule()
├── supabase.ts          # cliente + CRUD por entidade
├── types.ts
└── utils.ts
scripts/
└── deploy.sh
Dockerfile
docker-compose.yml
nginx.conf
```

---

## Banco de dados

Tabelas em `public`: `clients`, `tasks`, `comments`, `attachments`, `notifications`.
Bucket de storage: `attachments` (público).
RLS: políticas permissivas para `anon` (auth é feita no app por senha — para produção endurecida, migrar para `service_role` em rotas `/api/*`).

---

## Segurança e dívidas técnicas

- A senha admin é exposta no bundle JS (`NEXT_PUBLIC_*`). Aceitável para uso interno; para produção, migrar para auth real (Supabase Auth ou rotas `/api`).
- RLS está liberado para `anon`. Mesma observação acima.
- O CallMeBot retorna HTML em respostas — a rota `/api/whatsapp` interpreta texto da resposta para detectar erros, mas não é à prova de mudanças do CallMeBot.

---

## Licença

Privado — uso interno.
