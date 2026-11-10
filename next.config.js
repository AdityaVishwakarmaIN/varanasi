const { withGTConfig } = require("gt-next/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // React Compiler is slow on the huge procedural sprite files; only use it for production builds.
  reactCompiler: process.env.NODE_ENV === 'production',
};

module.exports = withGTConfig(nextConfig);