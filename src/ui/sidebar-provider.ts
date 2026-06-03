import * as vscode from 'vscode';
import * as path from 'path';
import { UsageResult, ImportInfo, DynamicImportInfo } from '../types';
import { SearchResult } from '../tracker/usage-tracker';

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

  private results: Map<string, UsageResult[]> = new Map();
  private fileReferences: ImportInfo[] = [];
  private dynamicReferences: DynamicImportInfo[] = [];
  private targetFile: string = '';

  refresh(searchResult: SearchResult) {
    this.targetFile = searchResult.targetFile;
    this.results = searchResult.usages;
    this.fileReferences = searchResult.fileReferences;
    this.dynamicReferences = searchResult.dynamicReferences;
    this._onDidChangeTreeData.fire(undefined);
  }

  clear() {
    this.targetFile = '';
    this.results = new Map();
    this.fileReferences = [];
    this.dynamicReferences = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ExportTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ExportTreeItem): ExportTreeItem[] {
    if (!element) {
      // Root: show target file name + top-level groups
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

      // Static file references (re-exports)
      if (this.fileReferences.length > 0) {
        const refNode = new ExportTreeItem(
          `🌐 被静态引用 (${this.fileReferences.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        refNode.contextValue = 'fileReferences';
        items.push(refNode);
      }

      // Dynamic import() references
      if (this.dynamicReferences.length > 0) {
        const dynNode = new ExportTreeItem(
          `🔄 被动态引用 (${this.dynamicReferences.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        dynNode.contextValue = 'dynamicReferences';
        items.push(dynNode);
      }

      // Export groups
      for (const [name, usages] of this.results) {
        const exportNode = new ExportTreeItem(
          `📦 ${name} (${usages.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        exportNode.contextValue = 'export';
        exportNode.exportName = name;
        items.push(exportNode);
      }

      return items;
    }

    // Children of static references
    if (element.contextValue === 'fileReferences') {
      return this.fileReferences.map((ref) => {
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

    // Children of dynamic references
    if (element.contextValue === 'dynamicReferences') {
      return this.dynamicReferences.map((ref) => {
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
        item.command = {
          command: 'findExport.openFile',
          title: 'Open',
          arguments: [usage.file, usage.line],
        };
        item.contextValue = 'usage';
        return item;
      });
    }

    return [];
  }
}
