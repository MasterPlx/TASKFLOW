import { AuthProvider } from '@/lib/auth';
import { AuthGate } from '@/components/admin/AuthGate';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
