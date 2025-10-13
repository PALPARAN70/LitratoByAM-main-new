/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/assets/**', // serves /assets/Packages/...
      },
      // optional if you might use 127.0.0.1
      // { protocol: 'http', hostname: '127.0.0.1', port: '5000', pathname: '/assets/**' },
    ],
  },
}

module.exports = nextConfig
