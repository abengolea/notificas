import path from 'path';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(process.cwd()),
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "www.notificas.com.ar" }],
        destination: "https://notificas.com.ar/",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.notificas.com.ar" }],
        destination: "https://notificas.com.ar/:path*",
        permanent: true,
      },
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
