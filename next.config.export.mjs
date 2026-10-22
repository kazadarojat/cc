/**
 * Static export for GitHub Pages (project site: https://kazadarojat.github.io/cc/).
 * Used by `npm run build:static`; the normal `npm run build` keeps the server build.
 *
 * Prisma runs at build time only: every route is prerendered from prisma/dev.db,
 * and the browser receives plain HTML + client components.
 */
import path from "node:path";

const basePath = "/cc";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  output: "export",
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_STATIC_EXPORT: "1",
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
