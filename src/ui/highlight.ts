import * as vscode from 'vscode';

const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.3)',
  isWholeLine: true,
});

let highlightTimeout: NodeJS.Timeout | undefined;

export async function openFileAndHighlight(
  filePath: string,
  line: number
): Promise<void> {
  try {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    // Jump to line (0-based)
    const position = new vscode.Position(line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );

    // Highlight the line
    const range = new vscode.Range(line - 1, 0, line - 1, 0);
    editor.setDecorations(highlightDecoration, [range]);

    // Clear previous timeout
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }

    // Auto-clear highlight after 3 seconds
    highlightTimeout = setTimeout(() => {
      editor.setDecorations(highlightDecoration, []);
    }, 3000);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
  }
}
