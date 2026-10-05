import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/repositories',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/repositories/connect',
        destination: '/dashboard?connect=1',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
