const path = require("path");

const scidQuestPath = path.resolve(__dirname, "../../ScidQuest");

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "dist",
  transpilePackages: ["scidquest"],
  experimental: {
    serverExternalPackages: ["canvas", "pdfjs-dist"],
  },
  webpack: (config, { isServer }) => {
    // Resolve React and ReactDOM to the main Next.js project's versions strictly
    // to avoid the ReactCurrentDispatcher dual-instance issue during SSR or client rendering.
    config.resolve.alias = {
      ...config.resolve.alias,
      "react$": path.join(__dirname, "node_modules", "react"),
      "react-dom$": path.join(__dirname, "node_modules", "react-dom"),
    };

    if (isServer) {
      config.externals = [...(config.externals || []), "canvas"];
    }

    return config;
  },
};

module.exports = nextConfig;
