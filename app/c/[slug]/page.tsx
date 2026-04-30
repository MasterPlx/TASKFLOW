'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getClientBySlug } from '@/lib/supabase';
import type { Client } from '@/lib/types';
import { ClientPortal } from '@/components/portal/ClientPortal';

export default function ClientPortalPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      try {
        const c = await getClientBySlug(slug);
        if (!mounted) return;
        setClient(c);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-sm p-8 text-center">
          <h1 className="text-base font-medium text-gray-900">Portal não encontrado</h1>
          <p className="mt-2 text-sm text-gray-500">
            O link que você acessou não existe ou foi removido.
          </p>
        </div>
      </div>
    );
  }

  return <ClientPortal client={client} />;
}
