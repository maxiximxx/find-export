# Find Export — Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        extension.ts                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Commands  │  │ Sidebar      │  │ Configuration            │  │
│  │ Register  │  │ Register     │  │ (alias reader init)      │  │
│  └─────┬─────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│        │               │                        │               │
│        ▼               ▼                        ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Search Flow                          │   │
│  │                                                         │   │
│  │  targetFile ──► export-parser ──► exports[]             │   │
│  │                      │                                  │   │
│  │  projectFiles ──► import-scanner ──► imports[]          │   │
│  │                      │                                  │   │
│  │  aliasConfig ──► path-resolver ──► resolvedPaths        │   │
│  │                      │                                  │   │
│  │  re-exports ──► reexport-tracer ──► finalUsages[]       │   │
│  │                      │                                  │   │
│  │  results ──► usage-tracker ──► TreeItem[] ──► Sidebar   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Types

```typescript
// types.ts

interface ExportInfo {
  name: string;           // 导出名 (export default 的 name 是变量名)
  kind: 'named' | 'default';
  line: number;           // 行号 (1-based)
  specifier?: string;     // re-export 来源路径
}

interface ImportInfo {
  file: string;           // 文件绝对路径
  imports: string[];      // import 了哪些导出名
  line: number;           // import 语句行号
  isReExport: boolean;    // 是否是 re-export
  reExportFrom?: string;  // re-export 的来源路径
}

interface UsageResult {
  exportName: string;     // 导出名
  file: string;           // 使用文件绝对路径
  line: number;           // 使用行号
  context?: string;       // 该行代码内容 (用于预览)
  isReExport: boolean;    // 是否是 re-export 引用
  depth: number;          // re-export 链深度 (0 = 直接引用)
}

interface AliasConfig {
  [alias: string]: string; // '@' → '/project/src'
}

interface DynamicImportInfo {
  file: string;   // 发起动态 import 的文件绝对路径
  line: number;   // import() 调用所在行号
}
```

## Export Parser

解析目标文件的 AST，提取所有 export 语句。

```typescript
// parser/export-parser.ts

function parseExports(filePath: string): ExportInfo[] {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf-8'),
    ts.ScriptTarget.Latest,
    true
  );

  const exports: ExportInfo[] = [];

  ts.forEachChild(source, (node) => {
    // export const A = ...
    // export function B() {}
    // export class C {}
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
      // export { A, B as C }
      for (const element of node.exportClause.elements) {
        exports.push({
          name: element.name.text,
          kind: 'named',
          line: getLine(source, node)
        });
      }
    }

    // export default xxx
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      // 提取 default 后面的标识符名
      if (ts.isIdentifier(node.expression)) {
        exports.push({
          name: node.expression.text,
          kind: 'default',
          line: getLine(source, node)
        });
      }
    }

    // export const A = ... (VariableStatement)
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          exports.push({
            name: decl.name.text,
            kind: 'named',
            line: getLine(source, node)
          });
        }
      }
    }

    // export { A } from './other' (re-export)
    // export { A as B } from './other'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const from = node.moduleSpecifier.text;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push({
            name: element.name.text,
            kind: 'named',
            line: getLine(source, node),
            specifier: from
          });
        }
      }
    }
  });

  return exports;
}
```

## Import Scanner

扫描项目文件的 import 语句，找出引用了目标文件的 import。

```typescript
// parser/import-scanner.ts

function scanImports(
  projectFiles: string[],
  targetPath: string,
  aliasConfig: AliasConfig,
  gitignorePatterns: string[]
): ImportInfo[] {
  const results: ImportInfo[] = [];

  for (const file of projectFiles) {
    // 跳过 .gitignore 中的文件
    if (isIgnored(file, gitignorePatterns)) continue;
    // 跳过目标文件自身
    if (path.resolve(file) === path.resolve(targetPath)) continue;

    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf-8'),
      ts.ScriptTarget.Latest,
      true
    );

    ts.forEachChild(source, (node) => {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return;
      if (!node.moduleSpecifier) return;

      const fromPath = node.moduleSpecifier.text;
      const resolved = resolveAlias(fromPath, file, aliasConfig);

      if (resolved !== path.resolve(targetPath)) return;

      // 提取 import 的导出名
      const imports: string[] = [];

      if (node.importClause) {
        // import A from './helper' → default import
        if (node.importClause.name) {
          imports.push(node.importClause.name.text);
        }
        // import { A, B } from './helper' → named imports
        if (node.importClause.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            imports.push(element.name.text);
          }
        }
      }

      const isReExport = ts.isExportDeclaration(node);

      results.push({
        file: path.resolve(file),
        imports,
        line: getLine(source, node),
        isReExport,
        reExportFrom: isReExport ? fromPath : undefined
      });
    });
  }

  return results;
}
```

## Dynamic Import Scanner

扫描项目文件的动态 `import()` 调用，找出对目标文件的动态引用。仅做文件级匹配，不追踪具体使用了哪些导出。

```typescript
// parser/dynamic-import-scanner.ts

interface DynamicImportInfo {
  file: string;   // 发起动态 import 的文件
  line: number;   // import() 调用所在行
}

function scanDynamicImports(
  projectFiles: string[],
  targetPath: string,
  aliasConfig: AliasConfig,
  gitignorePatterns: string[]
): DynamicImportInfo[] {
  const results: DynamicImportInfo[] = [];

  for (const file of projectFiles) {
    if (isIgnored(file, gitignorePatterns)) continue;
    if (path.resolve(file) === path.resolve(targetPath)) continue;

    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf-8'),
      ts.ScriptTarget.Latest,
      true
    );

    ts.forEachChild(source, function visit(node) {
      // 查找 import() 动态调用:
      //   import('./helper')
      //   import('./helper').then(...)
      //   await import('./helper')
      if (ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length > 0 &&
          ts.isStringLiteral(node.arguments[0])) {

        const fromPath = node.arguments[0].text;
        const resolved = resolveAlias(fromPath, file, aliasConfig);

        if (resolved === path.resolve(targetPath)) {
          results.push({
            file: path.resolve(file),
            line: getLine(source, node)
          });
        }
      }

      // 递归遍历所有子节点
      ts.forEachChild(node, visit);
    });
  }

  return results;
}
```

## Path Resolver + Alias Reader

```typescript
// resolver/path-resolver.ts

function resolveAlias(
  fromPath: string,
  currentFile: string,
  aliasConfig: AliasConfig
): string {
  // 相对路径直接解析
  if (fromPath.startsWith('.')) {
    return path.resolve(path.dirname(currentFile), fromPath);
  }

  // 匹配别名
  for (const [alias, target] of Object.entries(aliasConfig)) {
    const aliasPattern = alias.replace(/\*$/, '');
    if (fromPath.startsWith(aliasPattern)) {
      const rest = fromPath.slice(aliasPattern.length);
      const resolvedTarget = target.replace(/\*$/, '');
      return path.resolve(projectRoot, resolvedTarget + rest);
    }
  }

  // node_modules 或无法解析
  return fromPath;
}
```

```typescript
// resolver/alias-merger.ts

function buildAliasConfig(): AliasConfig {
  const config: AliasConfig = {};

  // 1. 用户手动配置 (最高优先级)
  const userConfig = vscode.workspace.getConfiguration('findExport');
  Object.assign(config, userConfig.get('aliases', {}));

  // 2. tsconfig paths
  const tsconfigAliases = readTsconfigPaths();
  for (const [key, val] of Object.entries(tsconfigAliases)) {
    if (!(key in config)) config[key] = val;
  }

  // 3. vite alias
  const viteAliases = readViteConfig();
  for (const [key, val] of Object.entries(viteAliases)) {
    if (!(key in config)) config[key] = val;
  }

  // 4. webpack alias
  const webpackAliases = readWebpackConfig();
  for (const [key, val] of Object.entries(webpackAliases)) {
    if (!(key in config)) config[key] = val;
  }

  return config;
}
```

### Webpack Config Reader

```typescript
// resolver/webpack-config-reader.ts

function readWebpackConfig(): AliasConfig {
  const aliases: AliasConfig = {};

  // Step 1: 从 package.json scripts 找 --config 入口
  const configPaths = findWebpackConfigPaths();

  // Step 2: 对每个配置文件追踪 require 链，提取 resolve.alias
  for (const configPath of configPaths) {
    const alias = extractAliasFromConfig(configPath);
    Object.assign(aliases, alias);
  }

  return aliases;
}

function findWebpackConfigPaths(): string[] {
  const results: string[] = [];

  // 从 package.json scripts 找 --config
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  for (const script of Object.values(pkg.scripts || {})) {
    const match = (script as string).match(/--config\s+(\S+)/);
    if (match) {
      results.push(path.resolve(match[1]));
    }
  }

  // 扫描常见位置
  const commonPaths = [
    'webpack.config.js',
    'webpack.config.ts',
    'config/webpack.base.js',
    'config/webpack.common.js',
    'build/webpack.config.js',
  ];
  for (const p of commonPaths) {
    const full = path.resolve(p);
    if (fs.existsSync(full) && !results.includes(full)) {
      results.push(full);
    }
  }

  return results;
}

function extractAliasFromConfig(configPath: string): AliasConfig {
  const aliases: AliasConfig = {};

  // 读取文件内容
  const content = fs.readFileSync(configPath, 'utf-8');
  const source = ts.createSourceFile(
    configPath, content, ts.ScriptTarget.Latest, true
  );

  // 追踪 require() 引入的其他配置文件
  const requires: string[] = [];
  ts.forEachChild(source, (node) => {
    // const base = require('./webpack.base')
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isCallExpression(decl.initializer) &&
            decl.initializer.expression.text === 'require' &&
            decl.initializer.arguments.length > 0 &&
            ts.isStringLiteral(decl.initializer.arguments[0])) {
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

  // 递归解析 require 的文件
  for (const req of requires) {
    Object.assign(aliases, extractAliasFromConfig(req));
  }

  // 提取当前文件的 resolve.alias
  // AST 遍历找到 resolve: { alias: { ... } }
  // 静态字符串值直接使用
  // path.resolve(__dirname, '..') 静态计算
  extractAliasFromAST(source, aliases, configPath);

  return aliases;
}
```

## Re-export Tracer

```typescript
// tracker/reexport-tracer.ts

function traceReExports(
  initialImports: ImportInfo[],
  projectFiles: string[],
  aliasConfig: AliasConfig,
  gitignorePatterns: string[]
): Map<string, UsageResult[]> {
  const results = new Map<string, UsageResult[]>();
  const visited = new Set<string>(); // 防止循环

  function trace(file: string, exportNames: string[], depth: number) {
    if (visited.has(file)) return;
    visited.add(file);

    const imports = scanImports(projectFiles, file, aliasConfig, gitignorePatterns);

    for (const imp of imports) {
      const matchedNames = imp.imports.filter(n => exportNames.includes(n));

      if (imp.isReExport) {
        // re-export: 继续追踪
        trace(imp.file, matchedNames, depth + 1);
      } else {
        // 最终使用点: 记录结果
        for (const name of matchedNames) {
          if (!results.has(name)) results.set(name, []);
          results.get(name)!.push({
            exportName: name,
            file: imp.file,
            line: imp.line,
            isReExport: false,
            depth
          });
        }
      }
    }
  }

  // 对每个直接引用开始追踪
  for (const imp of initialImports) {
    if (imp.isReExport) {
      trace(imp.file, imp.imports, 1);
    } else {
      for (const name of imp.imports) {
        if (!results.has(name)) results.set(name, []);
        results.get(name)!.push({
          exportName: name,
          file: imp.file,
          line: imp.line,
          isReExport: false,
          depth: 0
        });
      }
    }
  }

  return results;
}
```

## Sidebar Provider

```typescript
// ui/sidebar-provider.ts

class FindExportProvider implements vscode.TreeDataProvider<ExportTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ExportTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private results: Map<string, UsageResult[]> = new Map();
  private fileReferences: ImportInfo[] = []; // 静态 re-export 引用
  private dynamicReferences: DynamicImportInfo[] = []; // 动态 import() 引用
  private targetFile: string = '';

  refresh(
    targetFile: string,
    results: Map<string, UsageResult[]>,
    fileRefs: ImportInfo[],
    dynamicRefs: DynamicImportInfo[]
  ) {
    this.targetFile = targetFile;
    this.results = results;
    this.fileReferences = fileRefs;
    this.dynamicReferences = dynamicRefs;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ExportTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExportTreeItem): ExportTreeItem[] {
    if (!element) {
      // 根节点: 目标文件
      const items: ExportTreeItem[] = [];

      // 文件级静态引用 (re-export)
      if (this.fileReferences.length > 0) {
        const refNode = new ExportTreeItem(
          '🌐 被静态引用',
          vscode.TreeItemCollapsibleState.Expanded
        );
        refNode.contextValue = 'fileReferences';
        items.push(refNode);
      }

      // 文件级动态引用 (import())
      if (this.dynamicReferences.length > 0) {
        const dynNode = new ExportTreeItem(
          '🔄 被动态引用',
          vscode.TreeItemCollapsibleState.Expanded
        );
        dynNode.contextValue = 'dynamicReferences';
        items.push(dynNode);
      }

      // 每个导出一个节点
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

    // 子节点: 静态引用位置
    if (element.contextValue === 'fileReferences') {
      return this.fileReferences.map(ref => {
        const relPath = vscode.workspace.asRelativePath(ref.file);
        const item = new ExportTreeItem(
          `${relPath}:${ref.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [ref.file, ref.line]
        };
        return item;
      });
    }

    // 子节点: 动态引用位置
    if (element.contextValue === 'dynamicReferences') {
      return this.dynamicReferences.map(ref => {
        const relPath = vscode.workspace.asRelativePath(ref.file);
        const item = new ExportTreeItem(
          `${relPath}:${ref.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [ref.file, ref.line]
        };
        return item;
      });
    }

    if (element.contextValue === 'export') {
      const name = element.label.replace(/📦 | \(\d+\)/g, '');
      const usages = this.results.get(name) || [];
      return usages.map(usage => {
        const relPath = vscode.workspace.asRelativePath(usage.file);
        const item = new ExportTreeItem(
          `${relPath}:${usage.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [usage.file, usage.line]
        };
        return item;
      });
    }

    return [];
  }
}
```

## Highlight

```typescript
// ui/highlight.ts

const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.3)',
  isWholeLine: true
});

function highlightLine(editor: vscode.TextEditor, line: number) {
  const range = new vscode.Range(line - 1, 0, line - 1, 0);
  editor.setDecorations(highlightDecoration, [range]);

  // 3 秒后自动清除
  setTimeout(() => {
    editor.setDecorations(highlightDecoration, []);
  }, 3000);
}
```

## .gitignore Handling

```typescript
// resolver/gitignore-reader.ts

function readGitignorePatterns(projectRoot: string): string[] {
  const patterns: string[] = [];
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) return patterns;

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed);
    }
  }

  return patterns;
}

function isIgnored(filePath: string, patterns: string[]): boolean {
  const relativePath = path.relative(projectRoot, filePath);
  return patterns.some(pattern => minimatch(relativePath, pattern));
}
```

## Extension Manifest

```jsonc
// package.json (relevant parts)
{
  "activationEvents": [],  // onCommand 激活，不需要预定义事件
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
          "description": "Manual path alias configuration (overrides auto-detection)"
        }
      }
    }
  }
}
```
