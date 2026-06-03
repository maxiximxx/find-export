# Find Export Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension that tracks where a file's exports are used across a project, showing results in a sidebar panel with click-to-navigate and line highlighting.

**Architecture:** Parse target file exports via TS Compiler API, scan project imports with path alias resolution (tsconfig/vite/webpack), trace re-export chains, detect dynamic import() calls. Results displayed in a TreeView sidebar grouped by export name.

**Tech Stack:** TypeScript, VS Code Extension API, TypeScript Compiler API (built-in `ts` module), minimatch for .gitignore patterns

---

## File Structure

```
find-export/
├── package.json                          # Extension manifest + dependencies
├── tsconfig.json                         # TypeScript config for extension
├── .vscodeignore                         # Files to exclude from VSIX
├── src/
│   ├── extension.ts                      # Entry point: activate/deactivate
│   ├── types.ts                          # Shared interfaces
│   ├── parser/
│   │   ├── export-parser.ts              # Parse exports from target file AST
│   │   ├── import-scanner.ts             # Scan project for static imports
│   │   └── dynamic-import-scanner.ts     # Scan project for dynamic import()
│   ├── resolver/
│   │   ├── path-resolver.ts              # Core: resolve import paths + aliases
│   │   ├── tsconfig-reader.ts            # Read tsconfig.json paths
│   │   ├── vite-config-reader.ts         # Read vite.config alias
│   │   ├── webpack-config-reader.ts      # Read webpack config alias (multi-file)
│   │   ├── gitignore-reader.ts           # Read + match .gitignore patterns
│   │   └── alias-merger.ts              # Merge all alias sources with priority
│   ├── tracker/
│   │   ├── usage-tracker.ts              # Orchestrate: exports → usage results
│   │   └── reexport-tracer.ts            # Recursive re-export chain tracing
│   └── ui/
│       ├── sidebar-provider.ts           # TreeDataProvider for sidebar
│       └── highlight.ts                  # Line highlight decoration
└── src/test/
    └── suite/
        ├── index.ts                      # Test runner entry
        ├── export-parser.test.ts         # Unit tests for export parser
        ├── path-resolver.test.ts         # Unit tests for path resolver
        └── gitignore-reader.test.ts      # Unit tests for gitignore
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.vscodeignore`
- Create: `src/extension.ts` (minimal stub)
- Create: `src/types.ts`

- [ ] **Step 1: Initialize npm project**

```bash
cd /Users/mxx/Desktop/find-export
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install --save-dev @types/vscode @types/node typescript
npm install minimatch
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": "src",
    "lib": ["ES2020"],
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 4: Update package.json with extension manifest**

Replace the generated `package.json` with:

```json
{
  "name": "find-export",
  "displayName": "Find Export",
  "description": "Find where a file's exports are used across your project",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "findExport.search",
        "title": "Find Export: Search",
        "category": "Find Export"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "findExport.search",
          "when": "resourceLangId == typescript || resourceLangId == javascript || resourceLangId == typescriptreact || resourceLangId == javascriptreact",
          "group": "navigation"
        }
      ]
    },
    "views": {
      "explorer": [
        {
          "id": "findExportResults",
          "name": "Find Export"
        }
      ]
    },
    "configuration": {
      "title": "Find Export",
      "properties": {
        "findExport.aliases": {
          "type": "object",
          "default": {},
          "description": "Manual path alias configuration (overrides auto-detection). Example: { \"@\": \"./src\" }"
        }
      }
    }
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src --ext ts",
    "pretest": "npm run compile",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.80.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "minimatch": "^9.0.0"
  }
}
```

- [ ] **Step 5: Create .vscodeignore**

```
.vscode/**
src/**
node_modules/**
tsconfig.json
.gitignore
```

- [ ] **Step 6: Create src/types.ts**

```typescript
export interface ExportInfo {
  name: string;           // 导出名 (export default 的 name 是变量名)
  kind: 'named' | 'default';
  line: number;           // 行号 (1-based)
  specifier?: string;     // re-export 来源路径
}

export interface ImportInfo {
  file: string;           // 文件绝对路径
  imports: string[];      // import 了哪些导出名
  line: number;           // import 语句行号
  isReExport: boolean;    // 是否是 re-export
  reExportFrom?: string;  // re-export 的来源路径
}

export interface UsageResult {
  exportName: string;     // 导出名
  file: string;           // 使用文件绝对路径
  line: number;           // 使用行号
  context?: string;       // 该行代码内容 (用于预览)
  isReExport: boolean;    // 是否是 re-export 引用
  depth: number;          // re-export 链深度 (0 = 直接引用)
}

export interface AliasConfig {
  [alias: string]: string; // '@' → '/project/src'
}

export interface DynamicImportInfo {
  file: string;   // 发起动态 import 的文件绝对路径
  line: number;   // import() 调用所在行号
}
```

- [ ] **Step 7: Create minimal src/extension.ts stub**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Find Export extension activated');
}

export function deactivate() {}
```

- [ ] **Step 8: Verify compilation**

```bash
npm run compile
```

Expected: Compiles without errors, `out/` directory created with `.js` files.

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold find-export extension project"
```

---

## Task 2: Export Parser

**Files:**
- Create: `src/parser/export-parser.ts`

Parse a target file's AST to extract all export declarations.

- [ ] **Step 1: Create src/parser/export-parser.ts**

```typescript
import * as ts from 'typescript';
import * as fs from 'fs';
import { ExportInfo } from '../types';

function getLine(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function hasExportModifier(node: ts.Node): boolean {
  const tsNode = node as ts.DeclarationStatement;
  return (
    tsNode.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword
    ) ?? false
  );
}

export function parseExports(filePath: string): ExportInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const exports: ExportInfo[] = [];

  ts.forEachChild(source, (node) => {
    // export { A, B as C }
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push({
            name: element.name.text,
            kind: 'named',
            line: getLine(source, node),
          });
        }
      }
    }

    // export default xxx
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      if (ts.isIdentifier(node.expression)) {
        exports.push({
          name: node.expression.text,
          kind: 'default',
          line: getLine(source, node),
        });
      } else {
        // export default function() {} or export default class {}
        // Try to extract name from function/class declaration
        const text = node.expression.getText(source);
        exports.push({
          name: text.split('(')[0].split('{')[0].trim() || 'default',
          kind: 'default',
          line: getLine(source, node),
        });
      }
    }

    // export const A = ... / export function B() {} / export class C {}
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          exports.push({
            name: decl.name.text,
            kind: 'named',
            line: getLine(source, node),
          });
        }
      }
    }

    // export function B() {}
    if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
      if (node.name) {
        exports.push({
          name: node.name.text,
          kind: 'named',
          line: getLine(source, node),
        });
      }
    }

    // export class C {}
    if (ts.isClassDeclaration(node) && hasExportModifier(node)) {
      if (node.name) {
        exports.push({
          name: node.name.text,
          kind: 'named',
          line: getLine(source, node),
        });
      }
    }

    // export { A } from './other' (re-export)
    // export { A as B } from './other'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const from = node.moduleSpecifier.getText(source).replace(/['"]/g, '');
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push({
            name: element.name.text,
            kind: 'named',
            line: getLine(source, node),
            specifier: from,
          });
        }
      }
    }
  });

  return exports;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/parser/export-parser.ts
git commit -m "feat: add export parser for AST-based export extraction"
```

---

## Task 3: Gitignore Reader

**Files:**
- Create: `src/resolver/gitignore-reader.ts`

Read `.gitignore` and provide a filter function for file paths.

- [ ] **Step 1: Create src/resolver/gitignore-reader.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export function readGitignorePatterns(projectRoot: string): string[] {
  const patterns: string[] = [];
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    return patterns;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed);
    }
  }

  return patterns;
}

export function isIgnored(
  filePath: string,
  patterns: string[],
  projectRoot: string
): boolean {
  const relativePath = path.relative(projectRoot, filePath);

  return patterns.some((pattern) => {
    // Handle negation patterns (e.g., !important.log)
    if (pattern.startsWith('!')) {
      return false; // Simplified: skip negation for now
    }

    // Match directory patterns (ending with /)
    if (pattern.endsWith('/')) {
      const dirPattern = pattern.slice(0, -1);
      return minimatch(relativePath, `**/${dirPattern}/**`) ||
             minimatch(relativePath, `**/${dirPattern}`);
    }

    // Match file patterns
    return minimatch(relativePath, pattern) ||
           minimatch(relativePath, `**/${pattern}`);
  });
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/resolver/gitignore-reader.ts
git commit -m "feat: add gitignore reader with minimatch filtering"
```

---

## Task 4: Path Resolver + Alias Readers

**Files:**
- Create: `src/resolver/path-resolver.ts`
- Create: `src/resolver/tsconfig-reader.ts`
- Create: `src/resolver/vite-config-reader.ts`
- Create: `src/resolver/webpack-config-reader.ts`
- Create: `src/resolver/alias-merger.ts`

This is the most complex subsystem. It resolves import paths including alias support from tsconfig, vite, and webpack configs.

- [ ] **Step 1: Create src/resolver/path-resolver.ts**

```typescript
import * as path from 'path';
import { AliasConfig } from '../types';

export function resolveAlias(
  fromPath: string,
  currentFile: string,
  aliasConfig: AliasConfig,
  projectRoot: string
): string {
  // Relative path: resolve directly
  if (fromPath.startsWith('.')) {
    const dir = path.dirname(currentFile);
    const resolved = path.resolve(dir, fromPath);
    return addExtensionIfNeeded(resolved);
  }

  // Try matching aliases (longest match wins)
  const sortedAliases = Object.entries(aliasConfig).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [alias, target] of sortedAliases) {
    const aliasNoStar = alias.replace(/\*$/, '');
    if (fromPath === aliasNoStar || fromPath.startsWith(aliasNoStar)) {
      const rest = fromPath.slice(aliasNoStar.length);
      const targetNoStar = target.replace(/\*$/, '');
      const resolved = path.resolve(projectRoot, targetNoStar + rest);
      return addExtensionIfNeeded(resolved);
    }
  }

  // Cannot resolve (node_modules, etc.)
  return fromPath;
}

function addExtensionIfNeeded(filePath: string): string {
  // If already has extension, return as-is
  const ext = path.extname(filePath);
  if (ext) {
    return filePath;
  }

  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const e of extensions) {
    const withExt = filePath + e;
    try {
      const fs = require('fs');
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    } catch {
      // ignore
    }
  }

  // Try index files
  for (const e of extensions) {
    const indexPath = path.join(filePath, `index${e}`);
    try {
      const fs = require('fs');
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    } catch {
      // ignore
    }
  }

  return filePath;
}
```

- [ ] **Step 2: Create src/resolver/tsconfig-reader.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { AliasConfig } from '../types';

export function readTsconfigPaths(projectRoot: string): AliasConfig {
  const aliases: AliasConfig = {};

  // Find tsconfig.json or jsconfig.json
  const configFiles = ['tsconfig.json', 'jsconfig.json'];
  let configPath: string | undefined;

  for (const cf of configFiles) {
    const p = path.join(projectRoot, cf);
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    return aliases;
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error || !configFile.config) {
    return aliases;
  }

  const compilerOptions = configFile.config.compilerOptions;
  if (!compilerOptions?.paths) {
    return aliases;
  }

  const baseUrl = compilerOptions.baseUrl
    ? path.resolve(projectRoot, compilerOptions.baseUrl)
    : projectRoot;

  for (const [alias, mappings] of Object.entries(compilerOptions.paths)) {
    // paths: { "@/*": ["./src/*"] }
    // Take the first mapping
    const mapping = Array.isArray(mappings) ? mappings[0] : mappings;
    if (typeof mapping === 'string') {
      // Store relative to projectRoot for consistency
      const resolved = path.relative(projectRoot, path.resolve(baseUrl, mapping));
      aliases[alias] = resolved;
    }
  }

  return aliases;
}
```

- [ ] **Step 3: Create src/resolver/vite-config-reader.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { AliasConfig } from '../types';

export function readViteConfig(projectRoot: string): AliasConfig {
  const aliases: AliasConfig = {};

  const configFiles = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.mts',
  ];

  let configPath: string | undefined;
  for (const cf of configFiles) {
    const p = path.join(projectRoot, cf);
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    return aliases;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const source = ts.createSourceFile(
    configPath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  // Walk AST to find resolve.alias object
  // Pattern: resolve: { alias: { '@': './src', ... } }
  extractAliasFromAST(source, aliases, projectRoot);

  return aliases;
}

function extractAliasFromAST(
  source: ts.SourceFile,
  aliases: AliasConfig,
  projectRoot: string
): void {
  function visit(node: ts.Node) {
    // Look for property assignment with name "alias"
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source);
      if (name === 'alias' && ts.isObjectLiteralExpression(node.initializer)) {
        for (const prop of node.initializer.properties) {
          if (ts.isPropertyAssignment(prop)) {
            const key = prop.name.getText(source).replace(/['"]/g, '');
            const value = extractStringValue(prop.initializer, source);
            if (value) {
              aliases[key] = value;
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

function extractStringValue(
  node: ts.Node,
  source: ts.SourceFile
): string | undefined {
  // String literal: '@': './src'
  if (ts.isStringLiteral(node)) {
    return node.text;
  }

  // path.resolve(__dirname, './src')
  if (ts.isCallExpression(node)) {
    const expr = node.expression.getText(source);
    if (expr === 'path.resolve' || expr === 'path.join') {
      // Try to statically evaluate
      const args = node.arguments.map((arg) => {
        if (ts.isStringLiteral(arg)) return arg.text;
        if (arg.getText(source) === '__dirname') return '__dirname';
        return undefined;
      });

      if (args.every((a) => a !== undefined)) {
        const resolved = args.map((a) =>
          a === '__dirname' ? path.dirname(source.fileName) : a
        );
        return path.resolve(...(resolved as string[]));
      }
    }
  }

  return undefined;
}
```

- [ ] **Step 4: Create src/resolver/webpack-config-reader.ts**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { AliasConfig } from '../types';

export function readWebpackConfig(projectRoot: string): AliasConfig {
  const aliases: AliasConfig = {};

  const configPaths = findWebpackConfigPaths(projectRoot);

  for (const configPath of configPaths) {
    const extracted = extractAliasFromConfig(configPath, projectRoot);
    Object.assign(aliases, extracted);
  }

  return aliases;
}

function findWebpackConfigPaths(projectRoot: string): string[] {
  const results: string[] = [];

  // 1. Check package.json scripts for --config
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      for (const script of Object.values(pkg.scripts || {})) {
        const match = (script as string).match(/--config\s+(\S+)/);
        if (match) {
          const configPath = path.resolve(projectRoot, match[1]);
          if (fs.existsSync(configPath) && !results.includes(configPath)) {
            results.push(configPath);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // 2. Scan common locations
  const commonPaths = [
    'webpack.config.js',
    'webpack.config.ts',
    'config/webpack.base.js',
    'config/webpack.common.js',
    'config/webpack.base.config.js',
    'build/webpack.config.js',
    'build/webpack.base.js',
  ];

  for (const p of commonPaths) {
    const full = path.resolve(projectRoot, p);
    if (fs.existsSync(full) && !results.includes(full)) {
      results.push(full);
    }
  }

  // 3. Glob for any webpack*.config*.js in common dirs
  const searchDirs = ['.', 'config', 'build', 'scripts'];
  for (const dir of searchDirs) {
    const dirPath = path.resolve(projectRoot, dir);
    if (!fs.existsSync(dirPath)) continue;
    try {
      const files = fs.readdirSync(dirPath);
      for (const f of files) {
        if (/^webpack.*\.config.*\.[jt]s$/.test(f)) {
          const full = path.join(dirPath, f);
          if (!results.includes(full)) {
            results.push(full);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return results;
}

function extractAliasFromConfig(
  configPath: string,
  projectRoot: string
): AliasConfig {
  const aliases: AliasConfig = {};

  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf-8');
  } catch {
    return aliases;
  }

  const source = ts.createSourceFile(
    configPath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  // Track require() chains to other config files
  const requires: string[] = [];
  ts.forEachChild(source, (node) => {
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          decl.initializer &&
          ts.isCallExpression(decl.initializer) &&
          ts.isIdentifier(decl.initializer.expression) &&
          decl.initializer.expression.text === 'require' &&
          decl.initializer.arguments.length > 0 &&
          ts.isStringLiteral(decl.initializer.arguments[0])
        ) {
          const reqPath = path.resolve(
            path.dirname(configPath),
            decl.initializer.arguments[0].text
          );
          if (fs.existsSync(reqPath)) {
            requires.push(reqPath);
          }
        }
      }
    }
  });

  // Recursively extract from required files
  for (const req of requires) {
    // Avoid infinite loops
    if (req !== configPath) {
      Object.assign(aliases, extractAliasFromConfig(req, projectRoot));
    }
  }

  // Extract alias from current file
  extractWebpackAliasFromAST(source, aliases, configPath, projectRoot);

  return aliases;
}

function extractWebpackAliasFromAST(
  source: ts.SourceFile,
  aliases: AliasConfig,
  configPath: string,
  projectRoot: string
): void {
  function visit(node: ts.Node) {
    // Look for resolve: { alias: { ... } }
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source);
      if (name === 'resolve' && ts.isObjectLiteralExpression(node.initializer)) {
        for (const prop of node.initializer.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            prop.name.getText(source) === 'alias' &&
            ts.isObjectLiteralExpression(prop.initializer)
          ) {
            for (const aliasProp of prop.initializer.properties) {
              if (ts.isPropertyAssignment(aliasProp)) {
                const key = aliasProp.name.getText(source).replace(/['"]/g, '');
                const value = extractWebpackAliasValue(
                  aliasProp.initializer,
                  source,
                  configPath,
                  projectRoot
                );
                if (value) {
                  aliases[key] = value;
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

function extractWebpackAliasValue(
  node: ts.Node,
  source: ts.SourceFile,
  configPath: string,
  projectRoot: string
): string | undefined {
  // String literal: '@': './src'
  if (ts.isStringLiteral(node)) {
    const val = node.text;
    if (path.isAbsolute(val)) return val;
    return path.resolve(projectRoot, val);
  }

  // path.resolve(__dirname, '../src')
  if (ts.isCallExpression(node)) {
    const expr = node.expression.getText(source);
    if (expr === 'path.resolve' || expr === 'path.join') {
      const args: string[] = [];
      for (const arg of node.arguments) {
        if (ts.isStringLiteral(arg)) {
          args.push(arg.text);
        } else if (arg.getText(source) === '__dirname') {
          args.push(path.dirname(configPath));
        } else if (arg.getText(source) === 'process.cwd()') {
          args.push(projectRoot);
        } else {
          return undefined; // Cannot statically evaluate
        }
      }
      return path.resolve(...args);
    }
  }

  return undefined;
}
```

- [ ] **Step 5: Create src/resolver/alias-merger.ts**

```typescript
import * as vscode from 'vscode';
import { AliasConfig } from '../types';
import { readTsconfigPaths } from './tsconfig-reader';
import { readViteConfig } from './vite-config-reader';
import { readWebpackConfig } from './webpack-config-reader';

export function buildAliasConfig(projectRoot: string): AliasConfig {
  const config: AliasConfig = {};

  // Priority: webpack < vite < tsconfig < user config
  // (last write wins for same key, so we write in reverse priority order)

  // 1. Webpack (lowest priority)
  try {
    const webpackAliases = readWebpackConfig(projectRoot);
    for (const [key, val] of Object.entries(webpackAliases)) {
      config[key] = val;
    }
  } catch {
    // Webpack config read failed, skip
  }

  // 2. Vite
  try {
    const viteAliases = readViteConfig(projectRoot);
    for (const [key, val] of Object.entries(viteAliases)) {
      config[key] = val;
    }
  } catch {
    // Vite config read failed, skip
  }

  // 3. tsconfig paths
  try {
    const tsconfigAliases = readTsconfigPaths(projectRoot);
    for (const [key, val] of Object.entries(tsconfigAliases)) {
      config[key] = val;
    }
  } catch {
    // tsconfig read failed, skip
  }

  // 4. User manual config (highest priority)
  const userConfig = vscode.workspace.getConfiguration('findExport');
  const userAliases = userConfig.get<Record<string, string>>('aliases', {});
  for (const [key, val] of Object.entries(userAliases)) {
    config[key] = val;
  }

  return config;
}
```

- [ ] **Step 6: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/resolver/
git commit -m "feat: add path alias resolution (tsconfig, vite, webpack)"
```

---

## Task 5: Static Import Scanner

**Files:**
- Create: `src/parser/import-scanner.ts`

Scan project files for static import/export-from statements that reference the target file.

- [ ] **Step 1: Create src/parser/import-scanner.ts**

```typescript
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { ImportInfo, AliasConfig } from '../types';
import { resolveAlias } from '../resolver/path-resolver';
import { isIgnored } from '../resolver/gitignore-reader';

function getLine(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

export function scanImports(
  projectFiles: string[],
  targetPath: string,
  aliasConfig: AliasConfig,
  gitignorePatterns: string[],
  projectRoot: string
): ImportInfo[] {
  const results: ImportInfo[] = [];
  const resolvedTarget = path.resolve(targetPath);

  for (const file of projectFiles) {
    // Skip ignored files
    if (isIgnored(file, gitignorePatterns, projectRoot)) continue;
    // Skip target file itself
    if (path.resolve(file) === resolvedTarget) continue;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    ts.forEachChild(source, (node) => {
      // import X from './file'
      // import { A, B } from './file'
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        const fromPath = node.moduleSpecifier.getText(source).replace(/['"]/g, '');
        const resolved = resolveAlias(fromPath, file, aliasConfig, projectRoot);

        if (resolved !== resolvedTarget) return;

        const imports: string[] = [];

        if (node.importClause) {
          // import A from './helper' → default import
          if (node.importClause.name) {
            imports.push(node.importClause.name.text);
          }
          // import { A, B } from './helper' → named imports
          if (
            node.importClause.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings)
          ) {
            for (const element of node.importClause.namedBindings.elements) {
              imports.push(element.name.text);
            }
          }
        }

        results.push({
          file: path.resolve(file),
          imports,
          line: getLine(source, node),
          isReExport: false,
        });
      }

      // export { A } from './file' (re-export)
      // export { A as B } from './file'
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const fromPath = node.moduleSpecifier.getText(source).replace(/['"]/g, '');
        const resolved = resolveAlias(fromPath, file, aliasConfig, projectRoot);

        if (resolved !== resolvedTarget) return;

        const imports: string[] = [];

        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            imports.push(element.name.text);
          }
        }

        results.push({
          file: path.resolve(file),
          imports,
          line: getLine(source, node),
          isReExport: true,
          reExportFrom: fromPath,
        });
      }
    });
  }

  return results;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/parser/import-scanner.ts
git commit -m "feat: add static import scanner with alias resolution"
```

---

## Task 6: Dynamic Import Scanner

**Files:**
- Create: `src/parser/dynamic-import-scanner.ts`

Scan project files for dynamic `import()` calls referencing the target file.

- [ ] **Step 1: Create src/parser/dynamic-import-scanner.ts**

```typescript
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { DynamicImportInfo, AliasConfig } from '../types';
import { resolveAlias } from '../resolver/path-resolver';
import { isIgnored } from '../resolver/gitignore-reader';

function getLine(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

export function scanDynamicImports(
  projectFiles: string[],
  targetPath: string,
  aliasConfig: AliasConfig,
  gitignorePatterns: string[],
  projectRoot: string
): DynamicImportInfo[] {
  const results: DynamicImportInfo[] = [];
  const resolvedTarget = path.resolve(targetPath);

  for (const file of projectFiles) {
    if (isIgnored(file, gitignorePatterns, projectRoot)) continue;
    if (path.resolve(file) === resolvedTarget) continue;

    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    ts.forEachChild(source, function visit(node: ts.Node) {
      // import('./helper')
      // import('./helper').then(...)
      // await import('./helper')
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const fromPath = node.arguments[0].text;
        const resolved = resolveAlias(fromPath, file, aliasConfig, projectRoot);

        if (resolved === resolvedTarget) {
          results.push({
            file: path.resolve(file),
            line: getLine(source, node),
          });
        }
      }

      // Recursively visit all children
      ts.forEachChild(node, visit);
    });
  }

  return results;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/parser/dynamic-import-scanner.ts
git commit -m "feat: add dynamic import() scanner"
```

---

## Task 7: Re-export Tracer

**Files:**
- Create: `src/tracker/reexport-tracer.ts`

Recursively trace re-export chains to find final usage points.

- [ ] **Step 1: Create src/tracker/reexport-tracer.ts**

```typescript
import * as path from 'path';
import { ImportInfo, UsageResult, AliasConfig } from '../types';
import { scanImports } from '../parser/import-scanner';

export function traceReExports(
  initialImports: ImportInfo[],
  projectFiles: string[],
  aliasConfig: AliasConfig,
  gitignorePatterns: string[],
  projectRoot: string
): Map<string, UsageResult[]> {
  const results = new Map<string, UsageResult[]>();
  const visited = new Set<string>();

  function trace(file: string, exportNames: string[], depth: number) {
    if (visited.has(file)) return;
    visited.add(file);

    // Scan this file for imports of the re-exported file
    const imports = scanImports(
      projectFiles,
      file,
      aliasConfig,
      gitignorePatterns,
      projectRoot
    );

    for (const imp of imports) {
      const matchedNames = imp.imports.filter((n) => exportNames.includes(n));

      if (matchedNames.length === 0) continue;

      if (imp.isReExport) {
        // Re-export: continue tracing
        trace(imp.file, matchedNames, depth + 1);
      } else {
        // Final usage point: record
        for (const name of matchedNames) {
          if (!results.has(name)) results.set(name, []);
          results.get(name)!.push({
            exportName: name,
            file: imp.file,
            line: imp.line,
            isReExport: false,
            depth,
          });
        }
      }
    }
  }

  // Start tracing from each initial import
  for (const imp of initialImports) {
    if (imp.isReExport) {
      trace(imp.file, imp.imports, 1);
    } else {
      // Direct usage
      for (const name of imp.imports) {
        if (!results.has(name)) results.set(name, []);
        results.get(name)!.push({
          exportName: name,
          file: imp.file,
          line: imp.line,
          isReExport: false,
          depth: 0,
        });
      }
    }
  }

  return results;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tracker/reexport-tracer.ts
git commit -m "feat: add re-export chain tracer"
```

---

## Task 8: Usage Tracker (Orchestrator)

**Files:**
- Create: `src/tracker/usage-tracker.ts`

Orchestrates the full search flow: parse exports → scan imports → trace re-exports → collect dynamic imports.

- [ ] **Step 1: Create src/tracker/usage-tracker.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  ExportInfo,
  ImportInfo,
  UsageResult,
  DynamicImportInfo,
  AliasConfig,
} from '../types';
import { parseExports } from '../parser/export-parser';
import { scanImports } from '../parser/import-scanner';
import { scanDynamicImports } from '../parser/dynamic-import-scanner';
import { readGitignorePatterns } from '../resolver/gitignore-reader';
import { buildAliasConfig } from '../resolver/alias-merger';
import { traceReExports } from './reexport-tracer';

export interface SearchResult {
  targetFile: string;
  exports: ExportInfo[];
  usages: Map<string, UsageResult[]>;  // exportName → usage list
  fileReferences: ImportInfo[];         // static re-export file refs
  dynamicReferences: DynamicImportInfo[]; // dynamic import() refs
  filteredExportName?: string;          // if searching specific export
}

export async function searchUsages(
  targetFile: string,
  filteredExportName?: string
): Promise<SearchResult> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error('No workspace folder open');
  }
  const projectRoot = workspaceFolders[0].uri.fsPath;

  // 1. Read .gitignore patterns
  const gitignorePatterns = readGitignorePatterns(projectRoot);

  // 2. Build alias config
  const aliasConfig = buildAliasConfig(projectRoot);

  // 3. Parse exports from target file
  const allExports = parseExports(targetFile);

  // Filter if specific export requested
  const exports = filteredExportName
    ? allExports.filter((e) => e.name === filteredExportName)
    : allExports;

  // 4. Find all project files
  const projectFiles = await findProjectFiles(projectRoot, gitignorePatterns);

  // 5. Scan for static imports
  const initialImports = scanImports(
    projectFiles,
    targetFile,
    aliasConfig,
    gitignorePatterns,
    projectRoot
  );

  // 6. Separate re-export file references from direct imports
  const fileReferences: ImportInfo[] = [];
  const directImports: ImportInfo[] = [];

  for (const imp of initialImports) {
    if (imp.isReExport) {
      fileReferences.push(imp);
    } else {
      directImports.push(imp);
    }
  }

  // 7. Trace re-export chains
  const reexportUsages = traceReExports(
    fileReferences,
    projectFiles,
    aliasConfig,
    gitignorePatterns,
    projectRoot
  );

  // 8. Merge direct imports and re-export results
  const usages = new Map<string, UsageResult[]>();

  // Add direct usages
  for (const imp of directImports) {
    for (const name of imp.imports) {
      if (!usages.has(name)) usages.set(name, []);
      usages.get(name)!.push({
        exportName: name,
        file: imp.file,
        line: imp.line,
        isReExport: false,
        depth: 0,
      });
    }
  }

  // Add re-export usages
  for (const [name, results] of reexportUsages) {
    if (!usages.has(name)) usages.set(name, []);
    usages.get(name)!.push(...results);
  }

  // 9. Scan for dynamic imports
  const dynamicReferences = scanDynamicImports(
    projectFiles,
    targetFile,
    aliasConfig,
    gitignorePatterns,
    projectRoot
  );

  // 10. Filter usages if specific export requested
  if (filteredExportName) {
    const filtered = new Map<string, UsageResult[]>();
    const entry = usages.get(filteredExportName);
    if (entry) {
      filtered.set(filteredExportName, entry);
    }
    return {
      targetFile,
      exports,
      usages: filtered,
      fileReferences,
      dynamicReferences,
      filteredExportName,
    };
  }

  return {
    targetFile,
    exports,
    usages,
    fileReferences,
    dynamicReferences,
  };
}

async function findProjectFiles(
  projectRoot: string,
  gitignorePatterns: string[]
): Promise<string[]> {
  const files: string[] = [];

  // Use VS Code API to find files
  const uris = await vscode.workspace.findFiles(
    '**/*.{ts,tsx,js,jsx}',
    '**/node_modules/**'
  );

  for (const uri of uris) {
    const filePath = uri.fsPath;
    // Additional gitignore filtering (workspace.findFiles doesn't respect .gitignore fully)
    const { isIgnored } = await import('../resolver/gitignore-reader');
    if (!isIgnored(filePath, gitignorePatterns, projectRoot)) {
      files.push(filePath);
    }
  }

  return files;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/tracker/usage-tracker.ts
git commit -m "feat: add usage tracker orchestrator"
```

---

## Task 9: Sidebar Provider

**Files:**
- Create: `src/ui/sidebar-provider.ts`

TreeDataProvider for the Find Export sidebar panel.

- [ ] **Step 1: Create src/ui/sidebar-provider.ts**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import { UsageResult, ImportInfo, DynamicImportInfo } from '../types';
import { SearchResult } from '../tracker/usage-tracker';

export class ExportTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

export class FindExportProvider implements vscode.TreeDataProvider<ExportTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ExportTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private results: Map<string, UsageResult[]> = new Map();
  private fileReferences: ImportInfo[] = [];
  private dynamicReferences: DynamicImportInfo[] = [];
  private targetFile: string = '';

  refresh(searchResult: SearchResult) {
    this.targetFile = searchResult.targetFile;
    this.results = searchResult.usages;
    this.fileReferences = searchResult.fileReferences;
    this.dynamicReferences = searchResult.dynamicReferences;
    this._onDidChangeTreeData.fire(undefined);
  }

  clear() {
    this.targetFile = '';
    this.results = new Map();
    this.fileReferences = [];
    this.dynamicReferences = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ExportTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExportTreeItem): ExportTreeItem[] {
    if (!element) {
      // Root: show target file name + top-level groups
      const items: ExportTreeItem[] = [];

      // Target file header
      if (this.targetFile) {
        const fileName = path.basename(this.targetFile);
        const header = new ExportTreeItem(
          `📄 ${fileName}`,
          vscode.TreeItemCollapsibleState.None
        );
        header.description = vscode.workspace.asRelativePath(this.targetFile);
        header.contextValue = 'header';
        items.push(header);
      }

      // Static file references (re-exports)
      if (this.fileReferences.length > 0) {
        const refNode = new ExportTreeItem(
          `🌐 被静态引用 (${this.fileReferences.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        refNode.contextValue = 'fileReferences';
        items.push(refNode);
      }

      // Dynamic import() references
      if (this.dynamicReferences.length > 0) {
        const dynNode = new ExportTreeItem(
          `🔄 被动态引用 (${this.dynamicReferences.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        dynNode.contextValue = 'dynamicReferences';
        items.push(dynNode);
      }

      // Export groups
      for (const [name, usages] of this.results) {
        const exportNode = new ExportTreeItem(
          `📦 ${name} (${usages.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        exportNode.contextValue = 'export';
        items.push(exportNode);
      }

      return items;
    }

    // Children of static references
    if (element.contextValue === 'fileReferences') {
      return this.fileReferences.map((ref) => {
        const relPath = vscode.workspace.asRelativePath(ref.file);
        const item = new ExportTreeItem(
          `${relPath}:${ref.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [ref.file, ref.line],
        };
        item.contextValue = 'usage';
        return item;
      });
    }

    // Children of dynamic references
    if (element.contextValue === 'dynamicReferences') {
      return this.dynamicReferences.map((ref) => {
        const relPath = vscode.workspace.asRelativePath(ref.file);
        const item = new ExportTreeItem(
          `${relPath}:${ref.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [ref.file, ref.line],
        };
        item.contextValue = 'usage';
        return item;
      });
    }

    // Children of export groups (usage locations)
    if (element.contextValue === 'export') {
      const name = element.label!.replace(/📦 | \(\d+\)/g, '');
      const usages = this.results.get(name) || [];
      return usages.map((usage) => {
        const relPath = vscode.workspace.asRelativePath(usage.file);
        const item = new ExportTreeItem(
          `${relPath}:${usage.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [usage.file, usage.line],
        };
        item.contextValue = 'usage';
        return item;
      });
    }

    return [];
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/sidebar-provider.ts
git commit -m "feat: add sidebar TreeDataProvider"
```

---

## Task 10: Highlight Decoration

**Files:**
- Create: `src/ui/highlight.ts`

Jump to a file line and highlight it temporarily.

- [ ] **Step 1: Create src/ui/highlight.ts**

```typescript
import * as vscode from 'vscode';

const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.3)',
  isWholeLine: true,
});

let highlightTimeout: NodeJS.Timeout | undefined;

export async function openFileAndHighlight(
  filePath: string,
  line: number
): Promise<void> {
  try {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    // Jump to line (0-based)
    const position = new vscode.Position(line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );

    // Highlight the line
    const range = new vscode.Range(line - 1, 0, line - 1, 0);
    editor.setDecorations(highlightDecoration, [range]);

    // Clear previous timeout
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }

    // Auto-clear highlight after 3 seconds
    highlightTimeout = setTimeout(() => {
      editor.setDecorations(highlightDecoration, []);
    }, 3000);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/highlight.ts
git commit -m "feat: add file open with line highlight"
```

---

## Task 11: Extension Entry Point (Wiring Everything Together)

**Files:**
- Modify: `src/extension.ts`

Wire all components together: register commands, sidebar, and the search flow.

- [ ] **Step 1: Replace src/extension.ts with full implementation**

```typescript
import * as vscode from 'vscode';
import { FindExportProvider, ExportTreeItem } from './ui/sidebar-provider';
import { openFileAndHighlight } from './ui/highlight';
import { searchUsages } from './tracker/usage-tracker';

let sidebarProvider: FindExportProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log('Find Export extension activated');

  // Register sidebar TreeView
  sidebarProvider = new FindExportProvider();
  const treeView = vscode.window.registerTreeDataProvider(
    'findExportResults',
    sidebarProvider
  );
  context.subscriptions.push(treeView);

  // Register search command
  const searchCommand = vscode.commands.registerCommand(
    'findExport.search',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const document = editor.document;
      const languageId = document.languageId;

      // Only support JS/TS files
      const supportedLanguages = [
        'typescript',
        'javascript',
        'typescriptreact',
        'javascriptreact',
      ];
      if (!supportedLanguages.includes(languageId)) {
        vscode.window.showWarningMessage(
          'Find Export only supports TypeScript and JavaScript files'
        );
        return;
      }

      const filePath = document.fileName;

      // Check if there's selected text
      const selection = editor.selection;
      let selectedText: string | undefined;
      if (!selection.isEmpty) {
        selectedText = document.getText(selection).trim();
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Finding exports...',
          cancellable: false,
        },
        async (progress) => {
          try {
            const result = await searchUsages(filePath, selectedText);

            // Check if any results
            const totalUsages = Array.from(result.usages.values()).reduce(
              (sum, arr) => sum + arr.length,
              0
            );
            const totalRefs =
              result.fileReferences.length + result.dynamicReferences.length;

            if (totalUsages === 0 && totalRefs === 0) {
              vscode.window.showInformationMessage(
                selectedText
                  ? `No usages found for export "${selectedText}"`
                  : 'No usages found for this file\'s exports'
              );
              sidebarProvider.clear();
              return;
            }

            // Update sidebar
            sidebarProvider.refresh(result);

            // Focus the sidebar view
            await vscode.commands.executeCommand(
              'workbench.view.explorer'
            );
          } catch (err: any) {
            vscode.window.showErrorMessage(
              `Find Export error: ${err.message}`
            );
          }
        }
      );
    }
  );
  context.subscriptions.push(searchCommand);

  // Register open file command (for sidebar item clicks)
  const openFileCommand = vscode.commands.registerCommand(
    'findExport.openFile',
    async (filePath: string, line: number) => {
      await openFileAndHighlight(filePath, line);
    }
  );
  context.subscriptions.push(openFileCommand);
}

export function deactivate() {}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run compile
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire extension entry point with commands and sidebar"
```

---

## Task 12: Manual Integration Test

Test the extension end-to-end in VS Code.

- [ ] **Step 1: Open the extension project in VS Code**

```bash
code /Users/mxx/Desktop/find-export
```

- [ ] **Step 2: Press F5 to launch Extension Development Host**

This opens a new VS Code window with the extension loaded.

- [ ] **Step 3: Open a test JS/TS project in the Extension Development Host**

Open a real frontend project (e.g., a React app) in the new VS Code window.

- [ ] **Step 4: Open a file with exports (e.g., `src/utils/helper.ts`)**

Make sure the file has some exports like:
```typescript
export const formatDate = (d: Date) => d.toISOString();
export const parseJSON = (s: string) => JSON.parse(s);
export default function helper() {}
```

- [ ] **Step 5: Right-click in the editor → "Find Export: Search"**

Expected:
- Progress notification appears
- Sidebar "Find Export" view shows results grouped by export name
- Each usage shows file path and line number

- [ ] **Step 6: Click a result in the sidebar**

Expected:
- Editor jumps to the file and line
- The line is highlighted with yellow background
- Highlight disappears after 3 seconds

- [ ] **Step 7: Select an export name in the editor, then trigger "Find Export: Search"**

Expected:
- Only that specific export's usages are shown in the sidebar

- [ ] **Step 8: Test command palette**

Press `Ctrl+Shift+P` (or `Cmd+Shift+P`), type "Find Export: Search", press Enter.

Expected: Same behavior as right-click menu.

- [ ] **Step 9: Fix any issues found during testing**

Debug and fix issues. Recompile and retest.

- [ ] **Step 10: Commit final state**

```bash
git add -A
git commit -m "feat: complete find-export extension with integration testing"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| AC1: Import-based tracking (not text search) | Task 5, 6 |
| AC1: No false matches for same-name locals | Task 5 (path-based matching) |
| AC1: Direct re-export support | Task 5, 7 |
| AC1: Renamed re-export support | Task 5, 7 |
| AC1: Dynamic import() detection | Task 6 |
| AC2: tsconfig paths | Task 4 (tsconfig-reader) |
| AC2: vite.config alias | Task 4 (vite-config-reader) |
| AC2: webpack config alias | Task 4 (webpack-config-reader) |
| AC2: User manual config | Task 4 (alias-merger) |
| AC2: Priority order | Task 4 (alias-merger) |
| AC2: Parse failure fallback | Task 4 (alias-merger try/catch) |
| AC3: .gitignore filtering | Task 3 |
| AC4: Sidebar TreeView | Task 9 |
| AC4: Static ref section | Task 9 |
| AC4: Dynamic ref section | Task 9 |
| AC4: Export grouping | Task 9 |
| AC4: File path + line display | Task 9 |
| AC4: Click to navigate | Task 10 |
| AC4: Line highlight (3s) | Task 10 |
| AC5: Right-click menu | Task 11 (package.json menus) |
| AC5: Command palette | Task 11 (package.json commands) |
| AC5: JS/TS support | Task 11 (language check) |
| onCommand activation | Task 1 (package.json) |
