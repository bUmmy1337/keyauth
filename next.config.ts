import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["bcryptjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "70mb",
    },
    // Middleware buffers request bodies; must fit largest DLL upload (50 MB)
    proxyClientMaxBodySize: "70mb",
  },
};

export default nextConfig;
