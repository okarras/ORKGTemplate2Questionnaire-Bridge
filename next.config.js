const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin tracing to this app when another package-lock.json exists in a parent folder
  // on disk (Next would otherwise infer the wrong workspace root).
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingExcludes: {
    "**/*": ["node_modules/onnxruntime-node/**/*"],
  },
  transpilePackages: ["@orkg/scidquest"],
  serverExternalPackages: ["canvas", "pdfjs-dist"],
  webpack: (config, { isServer }) => {
    const transformersWeb = path.join(
      __dirname,
      "node_modules",
      "@huggingface",
      "transformers",
      "dist",
      "transformers.web.js",
    );

    // ScidQuest loads semantic chunking in the browser; force the web build so
    // Next/webpack does not resolve the package "node" export (onnxruntime-node .node binaries).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@huggingface/transformers": transformersWeb,
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
