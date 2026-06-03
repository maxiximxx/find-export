import * as vscode from 'vscode';
import * as path from 'path';
import { ExportInfo, UsageResult, ImportInfo, DynamicImportInfo } from '../types';
import { SearchResult } from '../tracker/usage-tracker';
import { clearHighlight } from './highlight';

export class ExportTreeItem extends vscode.TreeItem {
  exportName?: string;

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

  private allExports: ExportInfo[] = [];
  private results: Map<string, UsageResult[]> = new Map();
  private staticRefs: ImportInfo[] = [];      // directImports + fileReferences
  private dynamicRefs: DynamicImportInfo[] = [];
  private targetFile: string = '';

  refresh(searchResult: SearchResult) {
    clearHighlight();
    this.targetFile = searchResult.targetFile;
    this.allExports = searchResult.exports;
    this.results = searchResult.usages;
    // Merge direct imports and re-exports into one "静态引用" list
    this.staticRefs = [...searchResult.directImports, ...searchResult.fileReferences];
    this.dynamicRefs = searchResult.dynamicReferences;
    this._onDidChangeTreeData.fire(undefined);
  }

  clear() {
    clearHighlight();
    this.targetFile = '';
    this.allExports = [];
    this.results = new Map();
    this.staticRefs = [];
    this.dynamicRefs = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ExportTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExportTreeItem): ExportTreeItem[] {
    if (!element) {
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

      // Static references (always show, collapsed by default)
      const staticNode = new ExportTreeItem(
        `🌐 静态引用 (${this.staticRefs.length})`,
        this.staticRefs.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );
      staticNode.contextValue = 'staticRefs';
      items.push(staticNode);

      // Dynamic references (always show, collapsed by default)
      const dynNode = new ExportTreeItem(
        `🔄 动态引用 (${this.dynamicRefs.length})`,
        this.dynamicRefs.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
      );
      dynNode.contextValue = 'dynamicRefs';
      items.push(dynNode);

      // Export groups (show ALL exports, even those with no usages)
      for (const exp of this.allExports) {
        const usages = this.results.get(exp.name) || [];
        const exportNode = new ExportTreeItem(
          `📦 ${exp.name} (${usages.length})`,
          usages.length > 0
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None
        );
        exportNode.contextValue = 'export';
        exportNode.exportName = exp.name;
        if (usages.length === 0) {
          exportNode.description = '未找到使用';
          exportNode.iconPath = new vscode.ThemeIcon('info');
        }
        items.push(exportNode);
      }

      return items;
    }

    // Children of static references
    if (element.contextValue === 'staticRefs') {
      return this.staticRefs.map((ref) => {
        const relPath = vscode.workspace.asRelativePath(ref.file);
        // Show local names in description
        const displayNames = ref.imports.map((name) => {
          if (name === 'default' && ref.defaultLocalName) return ref.defaultLocalName;
          if (ref.renamedImports?.[name]) return ref.renamedImports[name];
          return name;
        });
        const importsStr = displayNames.length > 0 ? ` {${displayNames.join(', ')}}` : '';
        const item = new ExportTreeItem(
          `${relPath}:${ref.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        item.description = importsStr;
        // Use local names for highlighting
        const highlightNames = ref.imports.map((name) => {
          if (name === 'default' && ref.defaultLocalName) return ref.defaultLocalName;
          if (ref.renamedImports?.[name]) return ref.renamedImports[name];
          return name;
        });
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [ref.file, ref.line, highlightNames],
        };
        item.contextValue = 'usage';
        return item;
      });
    }

    // Children of dynamic references
    if (element.contextValue === 'dynamicRefs') {
      return this.dynamicRefs.map((ref) => {
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
      const name = element.exportName || '';
      const usages = this.results.get(name) || [];
      return usages.map((usage) => {
        const relPath = vscode.workspace.asRelativePath(usage.file);
        const item = new ExportTreeItem(
          `${relPath}:${usage.line}`,
          vscode.TreeItemCollapsibleState.None
        );
        // Use localName for highlighting if available (default imports), otherwise use exportName
        const highlightName = usage.localName || usage.exportName;
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [usage.file, usage.line, [highlightName]],
        };
        item.contextValue = 'usage';
        return item;
      });
    }

    return [];
  }
}
