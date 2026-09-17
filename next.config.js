/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // uploads/ holds runtime-written files (captured photos, AI generation
  // output) — it isn't source code, so it should never trigger a hot-reload,
  // and on Windows leaving it inside the dev watcher's scope makes chokidar
  // and antivirus real-time scanning fight over every file Sharp writes and
  // immediately reads back, sometimes for over a minute (see lib/fs-retry.ts).
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/uploads/**', ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : [])],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
