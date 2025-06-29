import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { WBCompletionProvider } from './providers/wbCompletionProvider';
import { WBHoverProvider } from './providers/wbHoverProvider';


export function activate(context: vscode.ExtensionContext) {
  const webviewManager = new WebviewManager(context);
  webviewManager.initialize();

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'markdown', scheme: 'file' },
      new WBCompletionProvider(),
      ':' // автозапуск после символа :
    )
  );

    const hoverProv = new WBHoverProvider();
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        { language: 'markdown', scheme: 'file' },
        hoverProv
      ),
      vscode.languages.registerCompletionItemProvider(
        { language: 'markdown', scheme: 'file' },
        hoverProv,
        '"', "'" // автодополнение значений внутри кавычек
      )
    );  
}

export function deactivate() { }