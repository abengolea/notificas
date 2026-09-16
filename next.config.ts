import path from 'path';
import type {NextConfig} from 'next';
import {
  legacyArchivoHeaders,
  legacyArchivoRewrites,
} from './src/lib/legacy-archivo';

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(process.cwd()),
  async rewrites() {
    const archivo = legacyArchivoRewrites();
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "^notificas\\.com$" }],
          destination: "/intl",
        },
      ],
      afterFiles: archivo.afterFiles,
      fallback: archivo.fallback,
    };
  },
  async redirects() {
    // Backup: App Hosting a menudo reescribe Host, así que el 301 canónico
    // real vive en middleware (resolveInternationalGate).
    return [
      {
        source: "/",
        has: [{ type: "host", value: "www\\.notificas\\.com" }],
        destination: "https://notificas.com/",
        statusCode: 301,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www\\.notificas\\.com" }],
        destination: "https://notificas.com/:path*",
        statusCode: 301,
      },
      {
        source: "/",
        has: [{ type: "host", value: "www\\.notificas\\.com\\.ar" }],
        destination: "https://notificas.com.ar/",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www\\.notificas\\.com\\.ar" }],
        destination: "https://notificas.com.ar/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sdk/v1/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      ...legacyArchivoHeaders(),
    ];
  },
  // ESLint en build: el adapter de App Hosting ejecuta `next build`; la deuda de lint no debe bloquear el deploy.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // allowedDevOrigins is deprecated in Next.js 15
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
