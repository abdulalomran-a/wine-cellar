import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.openfoodfacts.org' },
      { protocol: 'https', hostname: 'static.openfoodfacts.org' },
      { protocol: 'https', hostname: '**.openfoodfacts.org' },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
