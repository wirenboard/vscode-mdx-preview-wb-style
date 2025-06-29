import * as vscode from 'vscode';

interface AttrInfo {
  description: string;
  default: string;
  values?: string[];
}

const attributeDocs: Record<string, AttrInfo> = {
  width: {
    description: 'Ширина компонента (например, "300px" или "50%")',
    default: '100%',
    values: ['100px', '200px', '300px', '50%', '100%']
  },
  height: {
    description: 'Высота компонента (например, "200px" или "auto")',
    default: 'auto',
    values: ['100px', '200px', 'auto']
  },
  src: {
    description: 'URL изображения или видео',
    default: ''
  },
  caption: {
    description: 'Подпись к изображению',
    default: ''
  },
  url: {
    description: 'Ссылка на видео',
    default: ''
  },
  data: {
    description: 'JSON-массив с данными для галереи',
    default: '[]'
  },
  float: {
    description: 'Выравнивание компонента',
    default: 'none',
    values: ['left', 'right', 'none']
  }
};

interface CompInfo {
  description: string;
  attributes?: string[];
}

const componentDocs: Record<string, CompInfo> = {
  photo: {
    description: 'Компонент для вставки одиночного фото.',
    attributes: ['src', 'caption', 'width', 'height', 'float']
  },
  gallery: {
    description: 'Компонент для вставки галереи изображений.',
    attributes: ['data']
  },
  'video-player': {
    description: 'Компонент видеоплеера.',
    attributes: ['url', 'width', 'height', 'cover']
  },
  'video-gallery': {
    description: 'Компонент видеогалереи.',
    attributes: ['data']
  },
  spoiler: {
    description: 'Компонент спойлера.',
    attributes: ['title']
  },
  include: {
    description: 'Компонент включения внешнего файла.',
    attributes: ['path']
  }
};

export class WBHoverProvider implements vscode.HoverProvider, vscode.CompletionItemProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.Hover> {
    // 1) Hover по атрибутам
    const attrRange = document.getWordRangeAtPosition(position, /[a-zA-Z-]+/);
    if (attrRange) {
      const attr = document.getText(attrRange);
      const aInfo = attributeDocs[attr];
      if (aInfo) {
        const md = new vscode.MarkdownString(
          `**${attr}** — ${aInfo.description}\n\n` +
          `**Значения:** ${aInfo.values?.join(', ') ?? '—'}  \n` +
          `**По умолчанию:** ${aInfo.default}`
        );
        md.isTrusted = true;
        return new vscode.Hover(md, attrRange);
      }
    }

    // 2) Hover по самому компоненту — слово должно идти после ":"
    const compRange = document.getWordRangeAtPosition(position, /[a-z][\w-]*/i);
    if (compRange) {
      const start = compRange.start;
      const line = document.lineAt(start.line).text;
      if (start.character > 0 && line[start.character - 1] === ':') {
        const name = document.getText(compRange);
        const cInfo = componentDocs[name];
        if (cInfo) {
          let markdown = `**:${name}** — ${cInfo.description}\n\n`;
          if (cInfo.attributes) {
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

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const line = document.lineAt(position).text.substr(0, position.character);
    const m = line.match(/(\w+)\s*=\s*['"]([^'"]*)$/);
    if (!m) return;
    const attr = m[1];
    const info = attributeDocs[attr];
    if (!info?.values) return;
    return info.values.map(val => {
      const item = new vscode.CompletionItem(val, vscode.CompletionItemKind.Value);
      item.insertText = val;
      return item;
    });
  }
}
