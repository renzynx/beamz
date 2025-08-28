import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      },
      {
        protocol: "http",
        hostname: "*",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return process.env.NODE_ENV !== "production"
      ? [
          {
            source: "/api/:path*",
            destination: `http://localhost:${process.env.API_PORT || 3333}/api/:path*`,
          },
        ]
      : [];
  },
};

export default nextConfig;
