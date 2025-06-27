import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import * as Handlebars from 'handlebars';

const md = new MarkdownIt({ html: true });
Handlebars.registerHelper('md', (text: string) => {
  const html = md.render(text);
  return new Handlebars.SafeString(html);
});

let previewPanel: vscode.WebviewPanel | undefined;
let previewDocumentUri: vscode.Uri | undefined;

let mainTemplate: HandlebarsTemplateDelegate;
let photoTemplate: HandlebarsTemplateDelegate;
let galleryTemplate: HandlebarsTemplateDelegate;
let videoPlayerTemplate: HandlebarsTemplateDelegate;
let videoGalleryTemplate: HandlebarsTemplateDelegate;
let frontmatterTemplate: HandlebarsTemplateDelegate;

export function activate(context: vscode.ExtensionContext) {
  const templatesDir = path.join(context.extensionPath, 'templates');
  mainTemplate = Handlebars.compile(fs.readFileSync(path.join(templatesDir, 'main.html'), 'utf8'));
  photoTemplate = Handlebars.compile(fs.readFileSync(path.join(templatesDir, 'photo.html'), 'utf8'));
  galleryTemplate = Handlebars.compile(fs.readFileSync(path.join(templatesDir, 'gallery.html'), 'utf8'));
  videoPlayerTemplate = Handlebars.compile(fs.readFileSync(path.join(templatesDir, 'video-player.html'), 'utf8'));
  videoGalleryTemplate = Handlebars.compile(fs.readFileSync(path.join(templatesDir, 'video-gallery.html'), 'utf8'));
  frontmatterTemplate = Handlebars.compile(fs.readFileSync(path.join(templatesDir, 'frontmatter.html'), 'utf8'));

  Handlebars.registerHelper('isTitle', (key) => key === 'title');
  Handlebars.registerHelper('isImage', (key) => ['cover', 'logo'].includes(String(key)));
  Handlebars.registerHelper('isCover', (key) => key === 'cover');

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (previewPanel && previewDocumentUri?.toString() === document.uri.toString()) {
        updatePreview(document, context);
      }
    })
  );

  const previewCommand = vscode.commands.registerCommand(
    'mdx-preview.showPreview',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('Нет открытого MD-файла');
        return;
      }
      previewDocumentUri = editor.document.uri;
      previewPanel = vscode.window.createWebviewPanel(
        'mdxPreview',
        'MDX Preview',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(previewDocumentUri, '..'),
            vscode.Uri.file(path.join(context.extensionPath, 'media')),
            vscode.Uri.file(path.join(context.extensionPath, 'templates'))
          ]
        }
      );
      updatePreview(editor.document, context);
    }
  );
  context.subscriptions.push(previewCommand);
}

function updatePreview(document: vscode.TextDocument, context: vscode.ExtensionContext) {
  if (!previewPanel) return;
  previewPanel.webview.html = renderWithComponents(
    document.getText(),
    previewPanel.webview,
    document.uri,
    context
  );
}

type ComponentRenderer = (
  attributes: Record<string, string>,
  webview: vscode.Webview,
  documentUri: vscode.Uri
) => string;

function resolveRelativePath(webview: vscode.Webview, documentUri: vscode.Uri, relativePath: string): string {
  return relativePath
    ? webview.asWebviewUri(vscode.Uri.joinPath(documentUri, '..', relativePath)).toString()
    : '';
}

const componentRenderers: Record<string, ComponentRenderer> = {
  photo: (attrs, webview, docUri) => {
    return photoTemplate({
      src: resolveRelativePath(webview, docUri, attrs.src),
      alt: attrs.alt || '',
      caption: attrs.caption,
      width: normalizeSize(attrs.width, '500px'),
      floatClass: attrs.float ? `float-${attrs.float}` : ''
    });
  },

  gallery: (attrs, webview, docUri) => {
    const rawImages = JSON.parse(attrs.data || '[]');
    const images = rawImages.map(([src, alt]: [string, string]) => ({
      src: resolveRelativePath(webview, docUri, src),
      alt: alt || '',
      caption: alt
    }));
    return galleryTemplate({ images });
  },

  'video-player': (attrs, webview, docUri) => {
    return videoPlayerTemplate({
      url: attrs.url,
      width: normalizeSize(attrs.width, '500px'),
      height: normalizeSize(attrs.height, '280px'),
      floatClass: attrs.float ? `float-${attrs.float}` : '',
      cover: attrs.cover ? resolveRelativePath(webview, docUri, attrs.cover) : '',
      coverIsSet: !!attrs.cover
    });
  },

  'video-gallery': (attrs, webview, docUri) => {
    try {
      const rawItems = JSON.parse(attrs.data || '[]') as Array<[string, string?, string?]>;
      const videos = rawItems.map(([url, caption, cover]) => ({
        url: String(url),
        caption: caption || '',
        cover: cover ? resolveRelativePath(webview, docUri, String(cover)) : '',
        coverIsSet: !!cover,
        hasCaption: !!caption
      }));
      return videoGalleryTemplate({ videos });
    } catch (error) {
      console.error('Invalid video gallery data:', error);
      return videoGalleryTemplate({ videos: [] });
    }
  },

  frontmatter: (attrs, webview, docUri) => {
    const items: Record<string, string> = {};
    let title = '';

    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'title') {
        title = value;
      } else {
        items[key] = ['cover', 'logo'].includes(key)
          ? resolveRelativePath(webview, docUri, value)
          : value;
      }
    }

    return frontmatterTemplate({
      title,
      cover: attrs.cover ? resolveRelativePath(webview, docUri, attrs.cover) : '',
      items
    }) + '\n\n'; //fixed render bug
  }
};

function normalizeSize(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return /\d$/.test(trimmed) ? `${trimmed}px` : trimmed;
}

function parseFrontmatter(text: string): { content: string; attributes: Record<string, string> } | null {
  const frontmatterMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!frontmatterMatch) return null;

  const attributes: Record<string, string> = {};
  const frontmatterContent = frontmatterMatch[1];

  for (const line of frontmatterContent.split('\n')) {
    const match = line.match(/^(\w+):\s*(.*)/);
    if (match) {
      const [, key, value] = match;
      attributes[key] = value.replace(/^['"](.*)['"]$/, '$1').trim();
    }
  }

  return {
    content: text.slice(frontmatterMatch[0].length),
    attributes
  };
}

function parseComponentAttributes(inner: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of inner.matchAll(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]*))/g)) {
    const [, key, doubleQuoted, singleQuoted, unquoted] = match;
    attributes[key] = (doubleQuoted ?? singleQuoted ?? unquoted).trim();
  }
  return attributes;
}

function processComponents(text: string, webview: vscode.Webview, documentUri: vscode.Uri): string {
  return text.replace(/:([\w-]+)\{([\s\S]*?)\}/g, (match, componentName, inner) => {
    const renderer = componentRenderers[componentName];
    if (!renderer) return match;

    const attributes = parseComponentAttributes(inner);
    return renderer(attributes, webview, documentUri);
  });
}

function preprocessMarkdown(
  text: string,
  webview: vscode.Webview,
  documentUri: vscode.Uri
): string {
  const frontmatterData = parseFrontmatter(text);
  const processedText = frontmatterData?.content || text;

  let frontmatterHtml = '';
  if (frontmatterData && componentRenderers.frontmatter) {
    frontmatterHtml = componentRenderers.frontmatter(
      frontmatterData.attributes, 
      webview, 
      documentUri
    );
  }

  const withComponents = processComponents(processedText, webview, documentUri);

  return frontmatterHtml + withComponents;
}

function renderWithComponents(
  markdown: string,
  webview: vscode.Webview,
  documentUri: vscode.Uri,
  context: vscode.ExtensionContext
): string {
  const processedMarkdown = preprocessMarkdown(markdown, webview, documentUri);
  const styles = fs.readFileSync(
    path.join(context.extensionPath, 'media', 'styles.css'),
    'utf8'
  );

  return mainTemplate({
    styles,
    content: processedMarkdown
  });
}

export function deactivate() { }