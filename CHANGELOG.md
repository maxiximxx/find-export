# Changelog

## 0.1.1

- Fix: bundle `typescript` and `minimatch` into VSIX so the extension activates correctly
- Optimize: switch to esbuild bundling, reduce VSIX size from 3.78MB to 1.58MB
- Translate README to English

## 0.1.0

- Initial release
- Find all usages of a file's exports across the project
- Support static imports, re-exports, and dynamic imports
- Re-export chain tracing
- Path alias resolution (tsconfig, vite, webpack)
- Click to jump and highlight import + usage lines
- Sidebar panel with grouped results
- Support TypeScript, JavaScript, TSX, JSX
