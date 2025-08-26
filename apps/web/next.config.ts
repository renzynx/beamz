import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	output: "standalone",
	outputFileTracingRoot: path.join(__dirname, "../../"),
	async redirects() {
		return [
			{
				source: "/",
				destination: "/dashboard",
				permanent: true,
			},
			{
				source: "/f/:slug*",
				destination: "/api/f/:slug*",
				permanent: true,
			},
		];
	},
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `http://localhost:${process.env.API_PORT || 3333}/api/:path*`,
			},
		];
	},
};

export default nextConfig;
