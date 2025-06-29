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

// Раздельные хранилища
const componentAttributeDocs: Record<string, AttrInfo> = {};
const componentDocs:        Record<string, CompInfo> = {};
const templateAttributeDocs: Record<string, AttrInfo> = {};
const templateDocs:         Record<string, CompInfo> = {};

/**
 * Заполняет предметную и attribute-документацию из JSON-сниппетов
 * @param defs           объект из components.json или templates.json
 * @param targetDocs     куда класть CompInfo
 * @param targetAttrDocs куда класть AttrInfo
 */
function loadDefinitions(
  defs: Record<string, any>,
  targetDocs: Record<string, CompInfo>,
  targetAttrDocs: Record<string, AttrInfo>
) {
  Object.keys(defs).forEach(key => {
    const def = defs[key];
    // первая строка тела сниппета, например "---" или ":photo{"
    const bodyLines: string[] = Array.isArray(def.body) ? def.body : [def.body];
    const first = String(bodyLines[0]);
    // по шаблону frontmatter ищем "# key:" или по компонентам ":name{"
    const mComp = /^:([a-z][\w-]*)\{/i.exec(first);
    const mTpl  = /^---$/i.exec(first) ? true : false;

    // если это компонент (":name{")
    if (mComp) {
      const name = mComp[1];
      const attrs = def.attributes && typeof def.attributes === 'object'
        ? Object.keys(def.attributes)
        : [];
      targetDocs[name] = {
        description: String(def.description),
        attributes: attrs
      };
      if (def.attributes && typeof def.attributes === 'object') {
        Object.keys(def.attributes).forEach(attrName => {
          const attrDef = def.attributes[attrName];
          const info: AttrInfo = { description: String(attrDef.description) };
          if (attrDef.default !== undefined) info.default = attrDef.default;
          if (Array.isArray(attrDef.values))  info.values  = attrDef.values;
          targetAttrDocs[attrName] = info;
        });
      }
    }
    // если это frontmatter-template ("---" в первой строке)
    else if (mTpl) {
      // для шаблонов будем итерировать дальше уже в provideHover
      // просто занесём описание, атрибуты добавятся из def.attributes
      const nameFromPrefix = /^wbs-md-(.+)$/.exec(def.prefix as string);
      if (nameFromPrefix) {
        const name = nameFromPrefix[1];
        const attrs = def.attributes && typeof def.attributes === 'object'
          ? Object.keys(def.attributes)
          : [];
        targetDocs[name] = {
          description: String(def.description),
          attributes: attrs
        };
        if (def.attributes && typeof def.attributes === 'object') {
          Object.keys(def.attributes).forEach(attrName => {
            const attrDef = def.attributes[attrName];
            const info: AttrInfo = { description: String(attrDef.description) };
            if (attrDef.default !== undefined) info.default = attrDef.default;
            if (Array.isArray(attrDef.values))  info.values  = attrDef.values;
            targetAttrDocs[attrName] = info;
          });
        }
      }
    }
  });
}

// заполняем обе базы
loadDefinitions(componentDefs, componentDocs,        componentAttributeDocs);
loadDefinitions(templateDefs,  templateDocs,         templateAttributeDocs);

export class WBHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    // находим границы frontmatter
    let fmEnd = -1;
    if (document.lineAt(0).text.trim() === '---') {
      for (let i = 1; i < document.lineCount; i++) {
        if (document.lineAt(i).text.trim() === '---') {
          fmEnd = i;
          break;
        }
      }
    }

    // 1) если мы в YAML-frontmatter — ищем только среди templateAttributeDocs
    if (fmEnd > 0 && position.line > 0 && position.line <= fmEnd) {
      const keyRange = document.getWordRangeAtPosition(position, /[\w-]+(?=\s*:)/);
      if (keyRange) {
        const key = document.getText(keyRange);
        const info = templateAttributeDocs[key];
        if (info) {
          const md = new vscode.MarkdownString(
            `**${key}** — ${info.description}\n\n` +
            `**Возможные значения:** ${info.values ? info.values.join(', ') : '—'}  \n` +
            `**По умолчанию:** ${info.default ?? '—'}`
          );
          md.isTrusted = true;
          return new vscode.Hover(md, keyRange);
        }
      }
      return;
    }

    // 2) Hover по атрибутам компонентов в теле MD
    const attrRange = document.getWordRangeAtPosition(position, /[a-zA-Z-]+(?=\=)/);
    if (attrRange) {
      const attr = document.getText(attrRange);
      const info = componentAttributeDocs[attr];
      if (info) {
        const md = new vscode.MarkdownString(
          `**${attr}** — ${info.description}\n\n` +
          `**Возможные значения:** ${info.values ? info.values.join(', ') : '—'}  \n` +
          `**По умолчанию:** ${info.default ?? '—'}`
        );
        md.isTrusted = true;
        return new vscode.Hover(md, attrRange);
      }
    }

    // 3) Hover по самим компонентам в теле MD
    const compRange = document.getWordRangeAtPosition(position, /[a-z][\w-]*/i);
    if (compRange) {
      const start = compRange.start.character;
      const line  = document.lineAt(compRange.start.line).text;
      if (start > 0 && line.charAt(start - 1) === ':') {
        const name = document.getText(compRange);
        const info = componentDocs[name];
        if (info) {
          let txt = `**:${name}** — ${info.description}\n\n`;
          if (info.attributes.length) {
            txt += `**Атрибуты:** ${info.attributes.join(', ')}`;
          }
          const md = new vscode.MarkdownString(txt);
          md.isTrusted = true;
          return new vscode.Hover(md, compRange);
        }
      }
    }

    return;
  }
}
