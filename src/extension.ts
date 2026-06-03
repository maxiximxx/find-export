import * as vscode from 'vscode';
import { FindExportProvider } from './ui/sidebar-provider';
import { openFileAndHighlight } from './ui/highlight';
import { searchUsages } from './tracker/usage-tracker';

let sidebarProvider: FindExportProvider;

export function activate(context: vscode.ExtensionContext) {
  // Register sidebar TreeView
  sidebarProvider = new FindExportProvider();
  const treeView = vscode.window.createTreeView('findExportResults', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Register search command
  const searchCommand = vscode.commands.registerCommand(
    'findExport.search',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const document = editor.document;
      const languageId = document.languageId;

      // Only support JS/TS files
      const supportedLanguages = [
        'typescript',
        'javascript',
        'typescriptreact',
        'javascriptreact',
      ];
      if (!supportedLanguages.includes(languageId)) {
        vscode.window.showWarningMessage(
          'Find Export only supports TypeScript and JavaScript files'
        );
        return;
      }

      const filePath = document.fileName;

      // Check if there's selected text
      const selection = editor.selection;
      let selectedText: string | undefined;
      if (!selection.isEmpty) {
        selectedText = document.getText(selection).trim();
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Finding exports...',
          cancellable: false,
        },
        async (_progress) => {
          try {
            const result = await searchUsages(filePath, selectedText);

            // Check if any results
            const totalUsages = Array.from(result.usages.values()).reduce(
              (sum, arr) => sum + arr.length,
              0
            );
            const totalRefs =
              result.fileReferences.length + result.dynamicReferences.length;

            if (totalUsages === 0 && totalRefs === 0) {
              vscode.window.showInformationMessage(
                selectedText
                  ? `No usages found for export "${selectedText}"`
                  : 'No usages found for this file\'s exports'
              );
              sidebarProvider.clear();
              return;
            }

            // Update sidebar
            sidebarProvider.refresh(result);

            // Focus the sidebar view
            await vscode.commands.executeCommand(
              'findExportResults.focus'
            );
          } catch (err: any) {
            vscode.window.showErrorMessage(
              `Find Export error: ${err.message}`
            );
          }
        }
      );
    }
  );
  context.subscriptions.push(searchCommand);

  // Register open file command (for sidebar item clicks)
  const openFileCommand = vscode.commands.registerCommand(
    'findExport.openFile',
    async (filePath: string, line: number, importedNames?: string[]) => {
      await openFileAndHighlight(filePath, line, importedNames);
    }
  );
  context.subscriptions.push(openFileCommand);
}

export function deactivate() {}
