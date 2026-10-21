import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
