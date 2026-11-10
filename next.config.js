const { withGTConfig } = require("gt-next/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the compiler on in dev too: the game components rely on its memoisation. Without it every
  // pointer move re-renders the whole HUD and redraws the map canvas, and the page hangs.
  reactCompiler: true,
};

module.exports = withGTConfig(nextConfig);