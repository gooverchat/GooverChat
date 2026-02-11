/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gooverchat/shared'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'argon2'],
  },
};

module.exports = nextConfig;
