import * as vscode from 'vscode';
import * as snippets from '../../snippets/markdown.json';

export class WBCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);

        return Object.entries(snippets)
            .filter(([_, snippet]) => snippet.prefix.startsWith('wb-comp-'))
            .map(([name, snippet]) => {
                const item = new vscode.CompletionItem(
                    name.replace('WB Component ', ''),
                    vscode.CompletionItemKind.Class
                );
                item.documentation = new vscode.MarkdownString(snippet.description);
                const body = typeof snippet.body === 'string' ? [snippet.body] : snippet.body;
                item.insertText = new vscode.SnippetString(body.join('\n'));
                return item;
            });
    }
}