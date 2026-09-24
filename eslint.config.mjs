import nextConfig from "eslint-config-next";

const config = [
  // Local agent worktrees and tool state are not part of the project.
  { ignores: [".claude/**"] },
  ...nextConfig,
];

export default config;
