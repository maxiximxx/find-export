import * as vscode from 'vscode';
import * as path from 'path';
import {
  ExportInfo,
  ImportInfo,
  UsageResult,
  DynamicImportInfo,
} from '../types';
import { parseExports } from '../parser/export-parser';
import { scanImports } from '../parser/import-scanner';
import { scanDynamicImports } from '../parser/dynamic-import-scanner';
import { readGitignorePatterns, isIgnored } from '../resolver/gitignore-reader';
import { buildAliasConfig } from '../resolver/alias-merger';
import { traceReExports } from './reexport-tracer';

export interface SearchResult {
  targetFile: string;
  exports: ExportInfo[];
  usages: Map<string, UsageResult[]>;  // exportName → usage list
  directImports: ImportInfo[];          // direct static imports
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

  // Find the default export name (if any) for matching default imports
  const defaultExport = exports.find((e) => e.kind === 'default');
  const defaultExportName = defaultExport?.name;

  // Add direct usages
  for (const imp of directImports) {
    for (const name of imp.imports) {
      // Default imports use 'default' as marker, match to actual default export name
      const exportName = name === 'default' && defaultExportName ? defaultExportName : name;
      // Get local name for highlighting
      const localName = name === 'default'
        ? imp.defaultLocalName
        : imp.renamedImports?.[name];
      if (!usages.has(exportName)) usages.set(exportName, []);
      usages.get(exportName)!.push({
        exportName,
        file: imp.file,
        line: imp.line,
        isReExport: false,
        depth: 0,
        localName,
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
      directImports,
      fileReferences,
      dynamicReferences,
      filteredExportName,
    };
  }

  return {
    targetFile,
    exports,
    usages,
    directImports,
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
    // Additional gitignore filtering
    if (!isIgnored(filePath, gitignorePatterns, projectRoot)) {
      files.push(filePath);
    }
  }

  return files;
}
