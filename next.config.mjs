import staticConfig from "./next.config.export.mjs";

const isStatic = process.env.BUILD_TARGET === "static";

/** @type {import('next').NextConfig} */
const nextConfig = isStatic
  ? staticConfig
  : {
      reactStrictMode: true,
      eslint: { ignoreDuringBuilds: true },
      typescript: { ignoreBuildErrors: false },
    };

export default nextConfig;
