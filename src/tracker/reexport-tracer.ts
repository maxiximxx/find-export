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
