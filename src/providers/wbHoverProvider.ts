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
const templateDocs: Record<string, CompInfo> = {};

/**
 * Из JSON-дефиниций (components.json или templates.json) заполняет:
 *  - targetDocs: описание компонентов/шаблонов
 *  - attributeDocs: описание атрибутов
 */
function loadDefinitions(defs: Record<string, any>, targetDocs: Record<string, CompInfo>) {
  for (const key of Object.keys(defs)) {
    const def = defs[key];
    // тело сниппета может быть строкой или массивом строк
    const bodyLines = Array.isArray(def.body) ? def.body : [def.body];
    const firstLine = String(bodyLines[0]);
    const m = firstLine.match(/^:([a-z][\w-]*)\{/i);
    if (!m) {
      continue;
    }
    const name = m[1]; // реальное имя компонента/шаблона

    // Собираем описание компонента/шаблона
    const attrs = def.attributes && typeof def.attributes === 'object'
      ? Object.keys(def.attributes)
      : [];
    targetDocs[name] = {
      description: String(def.description),
      attributes: attrs
    };

    // Собираем описание атрибутов
    if (def.attributes && typeof def.attributes === 'object') {
      for (const attrName of Object.keys(def.attributes)) {
        const attrDef = def.attributes[attrName];
        attributeDocs[attrName] = {
          description: String(attrDef.description),
          default: attrDef.default,
          values: Array.isArray(attrDef.values) ? attrDef.values : undefined
        };
      }
    }
  }
}

// Загружаем компоненты и шаблоны
loadDefinitions(componentDefs, componentDocs);
loadDefinitions(templateDefs, templateDocs);

export class WBHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    // 1) Hover по атрибутам
    const attrRange = document.getWordRangeAtPosition(position, /[a-zA-Z-]+/);
    if (attrRange) {
      const attr = document.getText(attrRange);
      const info = attributeDocs[attr];
      if (info) {
        const md = new vscode.MarkdownString(
          `**${attr}** — ${info.description}\n\n` +
          `**Возможные значения:** ${info.values?.join(', ') ?? '—'}  \n` +
          `**По умолчанию:** ${info.default ?? '—'}`
        );
        md.isTrusted = true;
        return new vscode.Hover(md, attrRange);
      }
    }

    // 2) Hover по компоненту или шаблону (должен быть префикс ":")
    const compRange = document.getWordRangeAtPosition(position, /[a-z][\w-]*/i);
    if (compRange) {
      const start = compRange.start;
      const line = document.lineAt(start.line).text;
      if (start.character > 0 && line[start.character - 1] === ':') {
        const name = document.getText(compRange);
        const cInfo = componentDocs[name] || templateDocs[name];
        if (cInfo) {
          let markdown = `**:${name}** — ${cInfo.description}\n\n`;
          if (cInfo.attributes.length) {
            markdown += `**Атрибуты:** ${cInfo.attributes.join(', ')}`;
          }
          const md = new vscode.MarkdownString(markdown);
          md.isTrusted = true;
          return new vscode.Hover(md, compRange);
        }
      }
    }

    return;
  }
}
