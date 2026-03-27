const withMDX = require('@next/mdx')();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/articles',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/articles/:slug',
        destination: '/blog/:slug',
        permanent: true,
      },
    ];
  },
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
};

module.exports = withMDX(nextConfig);
