import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local development away from the Windows-locked legacy cache.
  distDir: process.env.NODE_ENV === "development" ? ".next-local" : ".next",
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
