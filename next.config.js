const path = require("path");
const { webpack } = require("next/dist/compiled/webpack/webpack");

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
  webpack: (config, { dev, isServer }) => {
    const transformersWeb = path.join(
      __dirname,
      "node_modules",
      "@huggingface",
      "transformers",
      "dist",
      "transformers.web.js",
    );

    const pdfjsLegacy = path.join(
      __dirname,
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.mjs",
    );

    // ScidQuest loads semantic chunking in the browser; force the web build so
    // Next/webpack does not resolve the package "node" export (onnxruntime-node .node binaries).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@huggingface/transformers": transformersWeb,
      "react$": path.join(__dirname, "node_modules", "react"),
      "react-dom$": path.join(__dirname, "node_modules", "react-dom"),
      "react-pdf": path.join(__dirname, "node_modules", "react-pdf"),
    };

    // pdfjs-dist/build/pdf.mjs triggers `Object.defineProperty called on non-object`
    // when webpack bundles it (mozilla/pdf.js#20435). Legacy build is safe.
    if (!isServer) {
      config.resolve.alias["pdfjs-dist$"] = pdfjsLegacy;
      config.resolve.alias["pdfjs-dist/build/pdf.mjs"] = pdfjsLegacy;
      config.resolve.alias["pdfjs-dist/legacy/build/pdf.mjs"] = pdfjsLegacy;
    }

    // Next.js dev uses eval-source-map; pdfjs-dist defines its own
    // `__webpack_exports__` which shadows webpack's and crashes at runtime
    // (mozilla/pdf.js#20478, webpack/webpack#20095). Exclude it from eval maps.
    if (dev && !isServer) {
      config.devtool = false;
      config.plugins = config.plugins.filter(
        (plugin) => plugin?.constructor?.name !== "EvalSourceMapDevToolPlugin",
      );
      config.plugins.push(
        new webpack.EvalSourceMapDevToolPlugin({
          exclude: [/pdfjs-dist/],
          columns: false,
        }),
      );
    }

    if (isServer) {
      config.externals = [...(config.externals || []), "canvas"];
    }

    return config;
  },
};

module.exports = nextConfig;
