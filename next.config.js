/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/demo',
  assetPrefix: '/demo/',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
