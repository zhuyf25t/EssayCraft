import type { NextConfig } from "next";

const configuredDistDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(configuredDistDir ? { distDir: configuredDistDir } : {})
};

export default nextConfig;
