import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { MetaMaskErrorHandler } from "@/components/metamask-error-handler"
import { AiReferralTracker } from "@/components/ai-referral-tracker"
import { IBM_Plex_Mono, Inter, Sora } from 'next/font/google'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-headline',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'legaltech',
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    other: {
      'msvalidate.01': '99A58204BDAF981B678193D8C9643E21',
    },
  },
  alternates: {
    canonical: '/',
    languages: {
      'es-AR': '/',
      es: '/',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/notificasLogo.jpg', type: 'image/jpeg' }],
    apple: '/notificasLogo.jpg',
    shortcut: '/notificasLogo.jpg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

// Inline script que debe ejecutarse ANTES que cualquier otro. Notificas NO usa MetaMask.
// Suprime errores de wallets de browser (MetaMask, etc.) que no son relevantes para esta app.
const INLINE_SUPPRESS = `(function(){var m=["eth_requestAccounts","wallet_requestPermissions","eth_accounts"];function w(e){if(!e||e._n)return;if(e.request){var o=e.request.bind(e);e.request=function(a){if(a&&m.indexOf(a.method)>=0)return Promise.resolve([]);return o(a)};}if(typeof e.connect==="function")e.connect=function(){return Promise.resolve([])};e._n=1}try{if(typeof window!=="undefined"&&window.ethereum)w(window.ethereum)}catch(e){}window.addEventListener("unhandledrejection",function(e){var x=(e.reason&&e.reason.message)||"";if(typeof x==="string"&&(/metamask|ethereum|failed.*connect/i).test(x)){e.preventDefault();e.stopPropagation()}},true)})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale =
    (await headers()).get("x-notificas-locale") === "pt-BR" ? "pt-BR" : "es-AR";
  const isBrazil = locale === "pt-BR";

  return (
    <html
      lang={locale}
      translate={isBrazil ? "no" : undefined}
      className={`${inter.variable} ${sora.variable} ${plexMono.variable}${isBrazil ? " notranslate" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INLINE_SUPPRESS }} suppressHydrationWarning />
        {isBrazil ? <meta name="google" content="notranslate" /> : null}
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
          <MetaMaskErrorHandler />
          <AiReferralTracker />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
