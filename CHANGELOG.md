# Changelog

## 0.1.1

- Fix: remove empty `activationEvents` array that prevented extension activation
- Optimize: reduce VSIX package size from ~100KB to ~31KB by excluding dev files
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
