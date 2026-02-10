import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable to prevent double-mounting with WebGL Canvas
};

export default nextConfig;
