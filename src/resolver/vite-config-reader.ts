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

  extractAliasFromAST(source, aliases);

  return aliases;
}

function extractAliasFromAST(
  source: ts.SourceFile,
  aliases: AliasConfig
): void {
  function visit(node: ts.Node) {
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
      if (name === 'alias' && ts.isArrayLiteralExpression(node.initializer)) {
        for (const element of node.initializer.elements) {
          if (ts.isObjectLiteralExpression(element)) {
            let findVal: string | undefined;
            let replacementVal: string | undefined;
            for (const prop of element.properties) {
              if (ts.isPropertyAssignment(prop)) {
                const propName = prop.name.getText(source);
                if (propName === 'find') {
                  findVal = extractStringValue(prop.initializer, source);
                } else if (propName === 'replacement') {
                  replacementVal = extractStringValue(prop.initializer, source);
                }
              }
            }
            if (findVal && replacementVal) {
              aliases[findVal] = replacementVal;
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
  if (ts.isStringLiteral(node)) {
    return node.text;
  }

  if (ts.isCallExpression(node)) {
    const expr = node.expression.getText(source);
    if (expr === 'path.resolve' || expr === 'path.join') {
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
