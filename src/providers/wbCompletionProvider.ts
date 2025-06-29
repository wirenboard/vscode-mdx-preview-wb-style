import * as vscode from 'vscode';
import snippets from '../../snippets/components.json';

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
                // 1) Извлекаем реальное имя компонента из первой строки сниппета
                const firstLine = Array.isArray(sn.body) ? sn.body[0] : sn.body;
                const m = firstLine.match(/^:([a-z][\w-]*)\{/i);
                const name = m ? m[1] : sn.prefix.replace(/^wbs-comp-/, '');
                return { sn, name };
            })
            // 2) Фильтруем по тому, что после ":" уже введено
            .filter(({ name }) => name.startsWith(prefixTyped))
            .map(({ sn, name }) => {
                // 3) Формируем вставку без ведущего ":", чтобы не дублировать
                const raw = Array.isArray(sn.body) ? sn.body.join('\n') : sn.body;
                const insertText = raw.replace(/^:+/, '');

                const item = new vscode.CompletionItem(
                    name,
                    vscode.CompletionItemKind.Snippet
                );
                item.insertText = new vscode.SnippetString(insertText);
                item.detail = sn.description;
                return item;
            });
    }
}
