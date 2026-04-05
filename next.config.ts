import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export", ← 削除
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;