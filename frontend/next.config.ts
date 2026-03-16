import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    'https://*.vusercontent.net',
  ],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8000/:path*' }
    ]
  },
}

export default nextConfig
