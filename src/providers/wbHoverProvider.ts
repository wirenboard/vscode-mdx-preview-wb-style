import * as vscode from 'vscode';
import componentDefs from '../../snippets/components.json';
import templateDefs from '../../snippets/templates.json';

interface AttrInfo {
  description: string;
  default?: string;
  values?: string[];
}

interface CompInfo {
  description: string;
  attributes: string[];
}

const attributeDocs: Record<string, AttrInfo> = {};
const componentDocs: Record<string, CompInfo> = {};


Object.entries(componentDefs).forEach(([compName, compDef]: [string, any]) => {
  componentDocs[compName] = {
    description: compDef.description,
    attributes: compDef.attributes ? Object.keys(compDef.attributes) : []
  };
  if (compDef.attributes) {
    Object.entries(compDef.attributes).forEach(([attrName, attrDef]: [string, any]) => {
      attributeDocs[attrName] = {
        description: attrDef.description,
        default: attrDef.default,
        values: attrDef.values
      };
    });
  }
});


const templateDocs: Record<string, CompInfo> = {};
Object.entries(templateDefs).forEach(([key, tpl]: [string, any]) => {
  const m = key.match(/^wbs-md-(.+)$/);
  if (!m) return;
  const name = m[1];
  const firstLine = Array.isArray(tpl.body) ? tpl.body[0] : tpl.body;

  const attrs = [...firstLine.matchAll(/(\w+)=/g)].map(([_, attr]) => attr);
  templateDocs[name] = {
    description: tpl.description,
    attributes: attrs
  };
});

export class WBHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {

    const attrRange = document.getWordRangeAtPosition(position, /[a-zA-Z-]+/);
    if (attrRange) {
      const attr = document.getText(attrRange);
      const info = attributeDocs[attr];
      if (info) {
        const md = new vscode.MarkdownString(
          `**${attr}** — ${info.description}\n\n` +
          `**Значения:** ${info.values?.join(', ') ?? '—'}  \n` +
          `**По умолчанию:** ${info.default ?? '—'}`
        );
        md.isTrusted = true;
        return new vscode.Hover(md, attrRange);
      }
    }


    const compRange = document.getWordRangeAtPosition(position, /[a-z][\w-]*/i);
    if (compRange) {
      const start = compRange.start;
      const line = document.lineAt(start.line).text;
      if (start.character > 0 && line[start.character - 1] === ':') {
        const name = document.getText(compRange);
        const cInfo = componentDocs[name] || templateDocs[name];
        if (cInfo) {
          let mdStr = `**:${name}** — ${cInfo.description}\n\n`;
          if (cInfo.attributes.length) {
            mdStr += `**Атрибуты:** ${cInfo.attributes.join(', ')}`;
          }
          const md = new vscode.MarkdownString(mdStr);
          md.isTrusted = true;
          return new vscode.Hover(md, compRange);
        }
      }
    }

    return;
  }
}
