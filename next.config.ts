import type { NextConfig } from "next";

// Define the CSP policy directives
const cspHeader = `
  default-src 'self';
  connect-src 'self' https://vercel.com https://*.private.blob.vercel-storage.com https://*.public.blob.vercel-storage.com;
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
`.replace(/\s{2,}/g, ' ').trim(); // Clean up whitespace for valid header format

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
  
  // Add the custom headers method here
  async headers() {
    return [
      {
        source: '/(.*)', // Applies the header to all routes in your application
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;