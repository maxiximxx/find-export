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
    if (isIgnored(file, gitignorePatterns, projectRoot)) { continue; }
    // Skip target file itself
    if (path.resolve(file) === resolvedTarget) { continue; }

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
        const fromPath = (node.moduleSpecifier as ts.StringLiteral).text;
        const resolved = resolveAlias(fromPath, file, aliasConfig, projectRoot);

        if (resolved !== resolvedTarget) return;

        const imports: string[] = [];
        let defaultLocalName: string | undefined;
        const renamedImports: Record<string, string> = {};

        if (node.importClause) {
          // import A from './helper' → default import
          if (node.importClause.name) {
            imports.push('default');
            defaultLocalName = node.importClause.name.text;
          }
          // import { A, B as C } from './helper' → named imports
          if (
            node.importClause.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings)
          ) {
            for (const element of node.importClause.namedBindings.elements) {
              // element.propertyName = export name (before 'as')
              // element.name = local name (after 'as', or same if no rename)
              const exportName = element.propertyName
                ? element.propertyName.text
                : element.name.text;
              const localName = element.name.text;
              imports.push(exportName);
              if (exportName !== localName) {
                renamedImports[exportName] = localName;
              }
            }
          }
        }

        results.push({
          file: path.resolve(file),
          imports,
          line: getLine(source, node),
          isReExport: false,
          defaultLocalName,
          renamedImports: Object.keys(renamedImports).length > 0 ? renamedImports : undefined,
        });
      }

      // export { A } from './file' (re-export)
      // export { A as B } from './file'
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const fromPath = (node.moduleSpecifier as ts.StringLiteral).text;
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
