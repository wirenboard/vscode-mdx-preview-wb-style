import * as vscode from 'vscode';
import * as path from 'path';
import componentDefs from '../../snippets/components.json';
import templateDefs  from '../../snippets/templates.json';

interface AttrInfo {
  description: string;
  default?: string;
  values?: string[];
}
interface CompInfo {
  description: string;
  attributes: string[];
}
interface TemplateInfo extends CompInfo {
  path?: string;
}

function globToRegExp(glob: string): RegExp {
  const parts = glob.replace(/\\/g, '/').split('/').map(part => {
    if (part === '**') return '.*';
    const esc = part.replace(/[-\\^$+?.()|[\]{}]/g, '\\$&');
    return esc.replace(/\*/g, '[^/]*');
  });
  return new RegExp('^' + parts.join('/') + '$');
}

const componentDocs:        Record<string,CompInfo>            = {};
const componentAttributeDocs:Record<string,Record<string,AttrInfo>> = {};
const templateDocs:         Record<string,TemplateInfo>        = {};
const templateAttributeDocs:Record<string,Record<string,AttrInfo>> = {};

Object.values(componentDefs).forEach(def => {
  const { description, docs } = def as any;
  const bodyLines = Array.isArray(def.body) ? def.body : [def.body];
  const m = /^:([a-z][\w-]*)\{/i.exec(String(bodyLines[0]));
  if (!m) return;
  const name = m[1];
  const attrs = docs.attributes ? Object.keys(docs.attributes) : [];
  componentDocs[name] = { description, attributes: attrs };
  componentAttributeDocs[name] = docs.attributes || {};
});

Object.values(templateDefs).forEach(def => {
  const { description, docs } = def as any;
  const mName = /^wbs-md-(.+)$/.exec(def.prefix as string);
  if (!mName) return;
  const name = mName[1];
  templateDocs[name] = {
    description,
    attributes: docs.attributes ? Object.keys(docs.attributes) : [],
    path: docs.path
  };
  templateAttributeDocs[name] = docs.attributes || {};
});

if (templateDocs['article']) {
  templateDocs['solution']     = templateDocs['article'];
  templateDocs['article-link'] = templateDocs['article'];
  templateAttributeDocs['solution']     = templateAttributeDocs['article'];
  templateAttributeDocs['article-link'] = templateAttributeDocs['article'];
}
if (templateDocs['integrator']) {
  templateDocs['partner'] = {
    description: 'Партнёр',
    attributes: [...templateDocs['integrator'].attributes],
    path: templateDocs['integrator'].path
  };
  templateAttributeDocs['partner'] = templateAttributeDocs['integrator'];
}

export class WBHoverProvider implements vscode.HoverProvider {
  private findWorkspaceRoot(uri: vscode.Uri): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    return folders.find(f => uri.fsPath.startsWith(f.uri.fsPath + path.sep))?.uri.fsPath
        || folders[0].uri.fsPath;
  }
  private findFrontmatterEnd(doc: vscode.TextDocument): number {
    if (doc.lineAt(0).text.trim() !== '---') return -1;
    for (let i = 1; i < doc.lineCount; i++) {
      if (doc.lineAt(i).text.trim() === '---') return i;
    }
    return -1;
  }
  private hasBodyContent(doc: vscode.TextDocument, fmEnd: number): boolean {
    for (let i = fmEnd + 1; i < doc.lineCount; i++) {
      if (doc.lineAt(i).text.trim()) return true;
    }
    return false;
  }

  private resolveTemplateType(relPath: string): string | undefined {
    const cleanPath = relPath.replace(/^\/|\/$/g, '');
    const pathParts = cleanPath.split('/');

        for (const [name, info] of Object.entries(templateDocs)) {
      if (!info.path) continue;

      const pattern = info.path
        .replace(/^\/|\/$/g, '')
        .replace(/^\*\*\//, '')
        .replace(/\/\*\*$/, '');
      const patternParts = pattern.split('/');
      const lastPatternIndex = patternParts.length - 1;

      for (let i = 0; i <= pathParts.length - patternParts.length; i++) {
        let matches = true;

        for (let j = 0; j < patternParts.length; j++) {
          const pathPart = pathParts[i + j];
          const patternPart = patternParts[j];

          if (!globToRegExp(patternPart).test(pathPart)) {
            matches = false;
            break;
        }
      }

      if (matches) return name;
      }
    }
    return undefined;
      }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    const fmEnd = this.findFrontmatterEnd(document);
    if (fmEnd > 0 && position.line > 0 && position.line <= fmEnd) {
        const range = document.getWordRangeAtPosition(position, /[\w-]+(?=\s*:)/);
      if (!range) return;

          const key = document.getText(range);
      const root = this.findWorkspaceRoot(document.uri);
      let tplName: string | undefined;
      if (root) {
        const rel = path.relative(root, document.uri.fsPath).replace(/\\/g, '/');
        tplName = this.resolveTemplateType(rel);
        }

      if (tplName) {
        const info = templateAttributeDocs[tplName]?.[key];
        if (info) {
          const possible = Array.isArray(info.values) ? info.values.join(', ') : '—';
          const md = new vscode.MarkdownString(
            `**${key}** — ${info.description}\n\n` +
            `**Возможные значения:** ${possible}  \n` +
            `**По умолчанию:** ${info.default ?? '—'}`
          );
          md.isTrusted = true;
          return new vscode.Hover(md, range);
        }
    return;
  }

      const md = new vscode.MarkdownString(
        `⚠️ Не удалось определить тип документа\n\n` +
        `Проверьте что файл находится в одной из поддерживаемых директорий:\n` +
        `- articles/\n- solutions/\n- integrators/\n- jobs/include/`
      );
      md.isTrusted = true;
      return new vscode.Hover(md, range);
}

    const attrRange = document.getWordRangeAtPosition(position, /[A-Za-z-]+(?=\=)/);
    if (attrRange) {
      let compName: string | undefined;
      for (let ln = position.line; ln >= 0; ln--) {
        const m = /:([a-z][\w-]*)\{/.exec(document.lineAt(ln).text);
        if (m) { compName = m[1]; break; }
      }
      if (compName) {
        const key = document.getText(attrRange);
        const info = componentAttributeDocs[compName]?.[key];
        if (info) {
          const possible = Array.isArray(info.values) ? info.values.join(', ') : '—';
          const md = new vscode.MarkdownString(
            `**${key}** — ${info.description}\n\n` +
            `**Возможные значения:** ${possible}\n` +
            `**По умолчанию:** ${info.default ?? '—'}`
          );
          md.isTrusted = true;
          return new vscode.Hover(md, attrRange);
        }
      }
    }

    const compRange = document.getWordRangeAtPosition(position, /[a-z][\w-]*/i);
    if (compRange) {
      const before = document.lineAt(compRange.start.line).text.charAt(compRange.start.character - 1);
      if (before === ':') {
        const name = document.getText(compRange);
        const info = componentDocs[name];
        if (info) {
          let txt = `**:${name}** — ${info.description}\n\n`;
          if (info.attributes.length) txt += `**Атрибуты:** ${info.attributes.join(', ')}`;
          const md = new vscode.MarkdownString(txt);
          md.isTrusted = true;
          return new vscode.Hover(md, compRange);
        }
      }
    }

    return;
  }
}
