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
