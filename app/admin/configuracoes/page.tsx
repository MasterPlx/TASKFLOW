'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  Save,
  Sparkles,
  MessageSquare,
  Send,
  Phone,
  ExternalLink,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getAppSettings, updateAppSettings } from '@/lib/supabase';
import type { AppSettings } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { Skeleton } from '@/components/Skeleton';
import { invalidateSettingsCache } from '@/lib/notifications';
import { formatPhoneDisplay, normalizePhone } from '@/lib/utils';

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWa, setTestingWa] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await getAppSettings();
        if (!mounted) return;
        setSettings(s);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      // Normalize phone before saving (auto-prepend 55 if Brazilian without country code)
      const phoneNormalized = settings.admin_phone
        ? normalizePhone(settings.admin_phone).normalized
        : null;
      const saved = await updateAppSettings({
        brand_color: settings.brand_color,
        default_greeting: settings.default_greeting,
        reminder_template: settings.reminder_template,
        task_created_template: settings.task_created_template,
        task_completed_template: settings.task_completed_template,
        admin_phone: phoneNormalized,
        admin_callmebot_key: settings.admin_callmebot_key,
        admin_name: settings.admin_name,
      });
      setSettings(saved);
      invalidateSettingsCache();
      toast('Configurações salvas', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWhatsApp() {
    if (!settings?.admin_phone || !settings.admin_callmebot_key) {
      toast('Preencha telefone e API Key antes', 'error');
      return;
    }
    // Use normalized phone (auto-prepend 55 if needed)
    const phone = normalizePhone(settings.admin_phone).normalized;
    setTestingWa(true);
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone,
          key: settings.admin_callmebot_key,
          message: '🧪 Mensagem de teste do TaskFlow! Se você recebeu isso, está tudo configurado certo. ✅',
          clientId: null,
          taskId: null,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        toast('Mensagem enviada! Verifique seu WhatsApp', 'success');
      } else {
        toast('Falha ao enviar — confira telefone e API key', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Erro de rede', 'error');
    } finally {
      setTestingWa(false);
    }
  }

  // Live phone preview based on the typed value
  const phonePreview = settings?.admin_phone
    ? normalizePhone(settings.admin_phone)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-10 md:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Configurações</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Personalize identidade visual, notificações WhatsApp e templates
        </p>
      </header>

      {loading || !settings ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* WhatsApp do admin */}
          <Section
            icon={<Phone className="h-3.5 w-3.5" />}
            title="Seu WhatsApp"
            subtitle="Para receber lembretes das suas tarefas internas (sem cliente)"
          >
            <div className="rounded-lg border border-accent-amber-200 bg-accent-amber-50 p-3 text-2xs text-accent-amber-700">
              <p className="font-medium">Como pegar a API Key do CallMeBot:</p>
              <ol className="mt-1 list-decimal pl-4 text-accent-amber-700/90">
                <li>Adicione o número <span className="kbd">+34 644 51 95 23</span> nos seus contatos</li>
                <li>Mande pelo WhatsApp: <span className="kbd">I allow callmebot to send me messages</span></li>
                <li>Em segundos você recebe sua API Key — cole abaixo</li>
              </ol>
              <a
                href="https://www.callmebot.com/blog/free-api-whatsapp-messages/"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-medium underline"
              >
                Documentação oficial
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Seu nome</label>
                <input
                  className="input"
                  value={settings.admin_name ?? ''}
                  onChange={(e) =>
                    setSettings({ ...settings, admin_name: e.target.value })
                  }
                  placeholder="Pedro"
                />
              </div>
              <div>
                <label className="label">Seu WhatsApp</label>
                <input
                  className="input"
                  value={settings.admin_phone ?? ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      admin_phone: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  placeholder="14999998888 (DDD + número)"
                  inputMode="numeric"
                />
                {phonePreview && phonePreview.normalized && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-2xs">
                    {phonePreview.valid ? (
                      <>
                        <Check className="h-3 w-3 text-accent-emerald-600" />
                        <span className="text-accent-emerald-700">
                          Será enviado para{' '}
                          <span className="font-semibold tabular">
                            {formatPhoneDisplay(phonePreview.normalized)}
                          </span>
                          {phonePreview.hasAutoCountry && ' (código do Brasil 55 adicionado automaticamente)'}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 text-accent-amber-600" />
                        <span className="text-accent-amber-700">
                          Número incompleto — adicione DDD + número (ex: 14999998888)
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">Sua API Key CallMeBot</label>
              <input
                className="input"
                value={settings.admin_callmebot_key ?? ''}
                onChange={(e) =>
                  setSettings({ ...settings, admin_callmebot_key: e.target.value })
                }
                placeholder="123456"
              />
            </div>
            <button
              type="button"
              onClick={handleTestWhatsApp}
              disabled={testingWa || !settings.admin_phone || !settings.admin_callmebot_key}
              className="btn-secondary"
            >
              {testingWa ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Testar WhatsApp
            </button>
          </Section>

          {/* Brand */}
          <Section
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title="Identidade visual"
            subtitle="Cor padrão usada quando o cliente não tem cor própria definida"
          >
            <div>
              <label className="label">Cor padrão da marca</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded-md border border-border-strong"
                  value={settings.brand_color}
                  onChange={(e) =>
                    setSettings({ ...settings, brand_color: e.target.value })
                  }
                />
                <input
                  className="input flex-1"
                  value={settings.brand_color}
                  onChange={(e) =>
                    setSettings({ ...settings, brand_color: e.target.value })
                  }
                  placeholder="#7C3AED"
                />
              </div>
            </div>

            <div>
              <label className="label">Saudação no Dashboard</label>
              <input
                className="input"
                value={settings.default_greeting}
                onChange={(e) =>
                  setSettings({ ...settings, default_greeting: e.target.value })
                }
                placeholder="Bem-vindo de volta"
              />
            </div>
          </Section>

          {/* WhatsApp templates */}
          <Section
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            title="Templates de WhatsApp"
            subtitle="Use {{name}}, {{title}}, {{count}} como placeholders nos textos"
          >
            <div>
              <label className="label">Lembrete (admin envia para o cliente)</label>
              <textarea
                className="input min-h-[60px] resize-y"
                value={settings.reminder_template}
                onChange={(e) =>
                  setSettings({ ...settings, reminder_template: e.target.value })
                }
              />
              <p className="mt-1 text-2xs text-ink-faint">
                A lista de tarefas é adicionada automaticamente abaixo do template
              </p>
            </div>
            <div>
              <label className="label">Tarefa criada (notificação ao cliente)</label>
              <input
                className="input"
                value={settings.task_created_template}
                onChange={(e) =>
                  setSettings({ ...settings, task_created_template: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Tarefa concluída (notificação ao cliente)</label>
              <input
                className="input"
                value={settings.task_completed_template}
                onChange={(e) =>
                  setSettings({ ...settings, task_completed_template: e.target.value })
                }
              />
            </div>
          </Section>

          <div className="sticky bottom-0 -mx-5 flex justify-end border-t border-border bg-surface/90 px-5 py-3 backdrop-blur md:-mx-10 md:px-10">
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
