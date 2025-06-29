import * as vscode from 'vscode';
import { WebviewManager } from './webviewManager';
import { WBCompletionProvider } from './providers/wbCompletionProvider';

export function activate(context: vscode.ExtensionContext) {
  const webviewManager = new WebviewManager(context);
  webviewManager.initialize();

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      'markdown',
      new WBCompletionProvider(),
      ':'
    )
  );
}

export function deactivate() { }