import * as vscode from 'vscode';

const highlightDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255, 255, 0, 0.3)',
  isWholeLine: true,
});

let lastHighlightedEditor: vscode.TextEditor | undefined;

export async function openFileAndHighlight(
  filePath: string,
  line: number,
  importedNames?: string[]
): Promise<void> {
  try {
    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    // Clear previous highlight
    clearHighlight();

    // Jump to line (0-based)
    const position = new vscode.Position(line - 1, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      new vscode.Range(position, position),
      vscode.TextEditorRevealType.InCenter
    );

    // Collect lines to highlight: import line + usage lines
    const highlightLines = new Set<number>();
    highlightLines.add(line - 1); // import line (0-based)

    // Find usage lines for each imported name (skip import/export lines)
    if (importedNames && importedNames.length > 0) {
      const text = doc.getText();
      const lines = text.split('\n');
      for (let i = line; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        // Skip import/export statements
        if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) continue;
        for (const name of importedNames) {
          const regex = new RegExp(`\\b${name}\\b`);
          if (regex.test(lines[i])) {
            highlightLines.add(i);
          }
        }
      }
    }

    const ranges = Array.from(highlightLines).map(
      (l) => new vscode.Range(l, 0, l, 0)
    );
    editor.setDecorations(highlightDecoration, ranges);
    lastHighlightedEditor = editor;
  } catch {
    vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
  }
}

export function clearHighlight(): void {
  if (lastHighlightedEditor) {
    lastHighlightedEditor.setDecorations(highlightDecoration, []);
    lastHighlightedEditor = undefined;
  }
}
