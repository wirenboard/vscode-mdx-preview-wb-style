import * as vscode from 'vscode';
import snippets from '../../snippets/markdown.json';

export class WBCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.ProviderResult<vscode.CompletionItem[]> {

        const text = document.lineAt(position).text.slice(0, position.character);
        // триггер — ввод двоеточия и начало имени компонента
        const m = text.match(/:([a-z0-9-]*)$/i);
        if (!m) return undefined;
        const prefixTyped = m[1]; // то, что после двоеточия

        return Object.values(snippets)
            .map(sn => {
                const name = sn.prefix.replace(/^wb-comp-/, '');
                return { sn, name };
            })
            .filter(({ name }) => name.startsWith(prefixTyped))
            .map(({ sn, name }) => {
                // Вставляем тело сниппета, но меняем тег :wb-comp-… на :<имя>
                const raw = Array.isArray(sn.body) ? sn.body.join('\n') : sn.body;
                const textInsert = raw.replace(/:wb-comp-/g, ':');

                const item = new vscode.CompletionItem(
                    name,
                    vscode.CompletionItemKind.Snippet
                );
                item.insertText = new vscode.SnippetString(textInsert);
                item.detail = sn.description;
                return item;
            });
    }
}
