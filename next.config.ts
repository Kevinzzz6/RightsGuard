import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tauri静态导出配置
  output: 'export',
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true
  }
};

export default nextConfig;