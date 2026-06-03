import * as ts from 'typescript';
import * as fs from 'fs';
import { ExportInfo } from '../types';

function getLine(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (
    modifiers?.some(
      (m: ts.Modifier) => m.kind === ts.SyntaxKind.ExportKeyword
    ) ?? false
  );
}

function hasDefaultModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (
    modifiers?.some(
      (m: ts.Modifier) => m.kind === ts.SyntaxKind.DefaultKeyword
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
  const seen = new Set<string>();

  ts.forEachChild(source, (node) => {
    // export { A, B as default }
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const name = element.name.text;
          if (!seen.has(name)) {
            seen.add(name);
            exports.push({
              name,
              kind: name === 'default' ? 'default' : 'named',
              line: getLine(source, node),
            });
          }
        }
      }
    }

    // export default xxx
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      let name: string | undefined;

      if (ts.isIdentifier(node.expression)) {
        // export default Index
        name = node.expression.text;
      } else if (ts.isCallExpression(node.expression)) {
        // export default forwardRef(Index) / memo(Component)
        const args = node.expression.arguments;
        if (args.length === 1 && ts.isIdentifier(args[0])) {
          name = args[0].text;
        }
      }

      if (!name) name = 'default';
      if (!seen.has(name)) {
        seen.add(name);
        exports.push({ name, kind: 'default', line: getLine(source, node) });
      }
    }

    // export const A = ... / export function B() {} / export class C {}
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const name = decl.name.text;
          if (!seen.has(name)) {
            seen.add(name);
            exports.push({ name, kind: 'named', line: getLine(source, node) });
          }
        }
      }
    }

    // export function B() {} or export default function B() {}
    if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
      if (node.name) {
        const name = node.name.text;
        if (!seen.has(name)) {
          seen.add(name);
          exports.push({
            name,
            kind: hasDefaultModifier(node) ? 'default' : 'named',
            line: getLine(source, node),
          });
        }
      }
    }

    // export class C {} or export default class C {}
    if (ts.isClassDeclaration(node) && hasExportModifier(node)) {
      if (node.name) {
        const name = node.name.text;
        if (!seen.has(name)) {
          seen.add(name);
          exports.push({
            name,
            kind: hasDefaultModifier(node) ? 'default' : 'named',
            line: getLine(source, node),
          });
        }
      }
    }

    // export { A as default } from './other'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const from = (node.moduleSpecifier as ts.StringLiteral).text;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const name = element.name.text;
          if (!seen.has(name)) {
            seen.add(name);
            exports.push({
              name,
              kind: name === 'default' ? 'default' : 'named',
              line: getLine(source, node),
              specifier: from,
            });
          }
        }
      }
    }
  });

  return exports;
}
