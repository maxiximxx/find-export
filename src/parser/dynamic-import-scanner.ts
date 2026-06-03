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
