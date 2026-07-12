import type { NextConfig } from 'next';

// In Docker the backend is reachable by service name. Running the frontend directly on
// the host, it is not — point BACKEND_URL at wherever uvicorn is listening instead.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:8000';

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
