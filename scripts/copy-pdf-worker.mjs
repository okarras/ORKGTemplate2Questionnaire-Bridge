import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function resolvePdfWorkerSource(relativePath) {
  const candidates = [
    relativePath,
    `react-pdf/node_modules/pdfjs-dist/${relativePath}`,
    `pdfjs-dist/${relativePath}`,
  ];

  for (const candidate of candidates) {
    try {
      return require.resolve(candidate);
    } catch {
      // try next candidate
    }
  }

  throw new Error(`Could not locate ${relativePath}`);
}

const copies = [
  {
    source: resolvePdfWorkerSource("build/pdf.worker.min.mjs"),
    dest: path.resolve("public/assets/pdf.worker.min.mjs"),
  },
  {
    source: resolvePdfWorkerSource("legacy/build/pdf.worker.min.mjs"),
    dest: path.resolve("public/assets/pdf.worker.legacy.min.mjs"),
  },
];

for (const { source, dest } of copies) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(source, dest);
}
