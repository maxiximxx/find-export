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
        if (/^webpack(\.\w+)?\.config\.[jt]s$/.test(f)) {
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
  if (ts.isStringLiteral(node)) {
    const val = node.text;
    if (path.isAbsolute(val)) return val;
    return path.resolve(projectRoot, val);
  }

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
          return undefined;
        }
      }
      return path.resolve(...args);
    }
  }

  return undefined;
}
