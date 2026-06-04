const esbuild = require("esbuild");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  target: "node18",
  platform: "node",
  sourcemap: false,
  minify: false,
};

esbuild.build(options).catch(() => process.exit(1));
