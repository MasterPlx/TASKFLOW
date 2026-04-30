'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X, Image as ImageIcon, Check, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { createClientRecord, getAppSettings, uploadClientLogo } from '@/lib/supabase';
import type { Client } from '@/lib/types';
import { initials, normalizePhone, formatPhoneDisplay } from '@/lib/utils';

export function ClientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Client) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [callmebotKey, setCallmebotKey] = useState('');
  const [brandName, setBrandName] = useState('');
  const [brandColor, setBrandColor] = useState('#7C3AED');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPhone('');
    setCallmebotKey('');
    setBrandName('');
    setLogoUrl(null);
    // Default brand color from global settings (fallback to violet)
    (async () => {
      try {
        const s = await getAppSettings();
        setBrandColor(s?.brand_color || '#7C3AED');
      } catch {
        setBrandColor('#7C3AED');
      }
    })();
  }, [open]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Selecione uma imagem', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Imagem muito grande (máx 2 MB)', 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadClientLogo(file);
      setLogoUrl(url);
      toast('Logo enviado', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao enviar logo', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Normalize phone (auto-prepend 55 if Brazilian without country code)
      const phoneClean = phone.trim()
        ? normalizePhone(phone.trim()).normalized
        : null;
      const c = await createClientRecord({
        name: name.trim(),
        phone: phoneClean,
        callmebot_key: callmebotKey.trim() || null,
        brand_name: brandName.trim() || null,
        brand_color: brandColor,
        brand_logo_url: logoUrl,
      });
      onCreated(c);
      toast('Cliente criado', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      toast('Erro ao criar cliente', 'error');
    } finally {
      setSaving(false);
    }
  }

  const displayName = brandName.trim() || name.trim() || 'Cliente';

  return (
    <Modal open={open} onClose={onClose} title="Novo cliente" width="md">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Logo + name preview */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-sunken/50 p-3">
          <div className="relative">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="h-14 w-14 rounded-xl object-cover shadow-elevated"
              />
            ) : (
              <span
                className="flex h-14 w-14 items-center justify-center rounded-xl text-base font-semibold text-white shadow-elevated"
                style={{ backgroundColor: brandColor }}
              >
                {initials(displayName)}
              </span>
            )}
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl(null)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-raised text-ink-faint shadow-elevated hover:text-ink"
                aria-label="Remover logo"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs text-ink-subtle">Pré-visualização</p>
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : logoUrl ? (
                <ImageIcon className="h-3 w-3" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              {logoUrl ? 'Trocar logo' : 'Enviar logo (opcional)'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cname">Nome *</label>
          <input
            id="cname"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="João Silva"
            autoFocus
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="cbrand">
            Nome da marca <span className="text-ink-faint">(opcional)</span>
          </label>
          <input
            id="cbrand"
            className="input"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Loja do João"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cphone">WhatsApp</label>
            <input
              id="cphone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="14999998888 (DDD + número)"
              inputMode="numeric"
            />
            {phone && (() => {
              const p = normalizePhone(phone);
              if (!p.normalized) return null;
              return (
                <div className="mt-1.5 flex items-start gap-1.5 text-2xs">
                  {p.valid ? (
                    <>
                      <Check className="mt-0.5 h-3 w-3 flex-none text-accent-emerald-600" />
                      <span className="text-accent-emerald-700">
                        {formatPhoneDisplay(p.normalized)}
                        {p.hasAutoCountry && ' (55 adicionado)'}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mt-0.5 h-3 w-3 flex-none text-accent-amber-600" />
                      <span className="text-accent-amber-700">Adicione DDD + número</span>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          <div>
            <label className="label" htmlFor="ckey">API Key CallMeBot</label>
            <input
              id="ckey"
              className="input"
              value={callmebotKey}
              onChange={(e) => setCallmebotKey(e.target.value)}
              placeholder="123456"
            />
          </div>
        </div>

        <div>
          <label className="label">Cor da marca</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded-md border border-border-strong"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
            />
            <input
              className="input flex-1"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#7C3AED"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
