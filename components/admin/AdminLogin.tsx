'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAdminAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';

export function AdminLogin() {
  const { login } = useAdminAuth();
  const { toast } = useToast();
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const ok = login(pwd);
      setLoading(false);
      if (ok) {
        toast('Bem-vindo de volta', 'success');
      } else {
        toast('Senha incorreta', 'error');
        setPwd('');
      }
    }, 200);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface px-4">
      {/* Vibrant gradient mesh */}
      <div className="pointer-events-none absolute inset-0 bg-mesh-violet" aria-hidden />

      <div className="relative w-full max-w-sm animate-scale-in">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-floating">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink">TaskFlow</h1>
            <p className="text-xs text-ink-subtle">Painel administrativo</p>
          </div>
        </div>

        <div className="card p-6 shadow-floating">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="pwd">
                Senha de acesso
              </label>
              <input
                id="pwd"
                type="password"
                className="input"
                autoFocus
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="••••"
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading || !pwd}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar →'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">
          Acesso restrito · sessão guardada apenas neste navegador
        </p>
      </div>
    </div>
  );
}
