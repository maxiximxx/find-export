# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Find Export" is a VS Code extension that tracks where a file's exports are used across a TypeScript/JavaScript project. It uses AST-based analysis (TypeScript Compiler API) rather than text search, and displays results in a sidebar panel with click-to-navigate and line highlighting.

## Build & Development Commands

```bash
npm run compile    # Compile TypeScript to out/
npm run watch      # Watch mode compilation
npm run package    # Create .vsix package
npm run publish    # Publish to VS Code Marketplace
```

**Run/Debug:** Open in VS Code, press F5 (launches Extension Development Host with pre-compile task).

**Note:** `npm test` and `npm run lint` are non-functional — no test files or ESLint config exist.

## Architecture

Four-layer design under `src/`:

- **`extension.ts`** — Entry point. Registers commands (`findExport.search`, `findExport.openFile`), creates sidebar TreeView, validates editor state.
- **`parser/`** — AST-based export/import extraction using the TypeScript Compiler API.
  - `export-parser.ts` — Extracts all export types from target file
  - `import-scanner.ts` — Scans project files for static imports resolving to target
  - `dynamic-import-scanner.ts` — Scans for `import()` calls (file-level only)
- **`resolver/`** — Path resolution and alias handling.
  - `path-resolver.ts` — Core resolution (relative paths, alias matching with longest-match-wins, auto-extension)
  - `alias-merger.ts` — Merges aliases with priority: webpack < vite < tsconfig < user VS Code settings
  - Config readers for tsconfig, vite, webpack, and .gitignore
- **`tracker/`** — Orchestration layer.
  - `usage-tracker.ts` — Runs the full search pipeline (gitignore → aliases → exports → scan → trace re-exports → merge)
  - `reexport-tracer.ts` — Recursive re-export chain tracing with cycle detection
- **`ui/`** — Sidebar TreeDataProvider and line highlight decorations.

## Key Design Decisions

- No incremental indexing — full project scan on every invocation
- TypeScript Compiler API (`typescript` package) used at runtime for AST parsing (VS Code bundles TS, so it works as devDependency)
- `.gitignore` negation patterns (`!`) are skipped
- Monorepo and `export *` namespace re-exports are out of scope
- Supported file types: `.ts`, `.tsx`, `.js`, `.jsx`
- Extension activates on command (`onCommand`), not on startup
