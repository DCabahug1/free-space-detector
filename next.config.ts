import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Dev only: lets phones on the same network load the dev server
  // (npm run dev:lan). Private address ranges and .local names.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  // Camera units moved onto the admin overview. Older QR codes still point
  // here, and the query string (?code=) carries over.
  async redirects() {
    return [{ source: "/admin/camera-units", destination: "/admin", permanent: false }];
  },
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
