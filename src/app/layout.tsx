import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { MetaMaskErrorHandler } from "@/components/metamask-error-handler"
import { Plus_Jakarta_Sans } from 'next/font/google'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Notificas',
  description: 'Notificaciones fehacientes digitales con respaldo en la red Polygon. Certificá el envío, recepción y lectura de tus comunicaciones.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Inline script que debe ejecutarse ANTES que cualquier otro. Notificas NO usa MetaMask.
// Suprime errores de wallets de browser (MetaMask, etc.) que no son relevantes para esta app.
const INLINE_SUPPRESS = `(function(){var m=["eth_requestAccounts","wallet_requestPermissions","eth_accounts"];function w(e){if(!e||e._n)return;if(e.request){var o=e.request.bind(e);e.request=function(a){if(a&&m.indexOf(a.method)>=0)return Promise.resolve([]);return o(a)};}if(typeof e.connect==="function")e.connect=function(){return Promise.resolve([])};e._n=1}try{if(typeof window!=="undefined"&&window.ethereum)w(window.ethereum)}catch(e){}window.addEventListener("unhandledrejection",function(e){var x=(e.reason&&e.reason.message)||"";if(typeof x==="string"&&(/metamask|ethereum|failed.*connect/i).test(x)){e.preventDefault();e.stopPropagation()}},true)})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${plusJakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INLINE_SUPPRESS }} suppressHydrationWarning />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
          <MetaMaskErrorHandler />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
