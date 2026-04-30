import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { ConfettiHost } from '@/components/Confetti';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Gestão de tarefas para sua agência e clientes',
};

// Inline script that runs before React hydrates so the correct
// theme class is on <html> from the first paint (no white flash).
const NO_FLASH = `(function(){try{var t=localStorage.getItem('tf_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <Script id="tf-no-flash" strategy="beforeInteractive">{NO_FLASH}</Script>
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
          <ConfettiHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
