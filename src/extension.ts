import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { WBCompletionProvider } from './providers/wbCompletionProvider';
import { WBHoverProvider } from './providers/wbHoverProvider';


export function activate(context: vscode.ExtensionContext) {
  const webviewManager = new WebviewManager(context);
  webviewManager.initialize();

    context.subscriptions.push(
        // автодополнение компонент/атрибутов
        vscode.languages.registerCompletionItemProvider(
          { language: 'markdown', scheme: 'file' },
          new WBCompletionProvider(),
          ':' // триггер по двоеточию
        ),
        // hover-подсказки для атрибутов и компонентов
        vscode.languages.registerHoverProvider(
          { language: 'markdown', scheme: 'file' },
          new WBHoverProvider()
        )
      ); 
}

export function deactivate() { }