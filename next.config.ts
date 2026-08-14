import path from 'path';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingRoot: path.join(process.cwd()),
  // ESLint en build: el adapter de App Hosting ejecuta `next build`; la deuda de lint no debe bloquear el deploy.
  eslint: { ignoreDuringBuilds: true },
  // @google-cloud/tasks usa JSON imports ESM que webpack no puede bundlear — se resuelve en runtime.
  serverExternalPackages: ['@google-cloud/tasks'],
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
