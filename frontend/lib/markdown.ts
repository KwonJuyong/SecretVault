import { marked } from 'marked';

export function isHtmlContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return trimmed.startsWith('<') || trimmed.includes('</p>') || trimmed.includes('</h');
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p></p>';
  try {
    return marked.parse(markdown, { async: false }) as string;
  } catch {
    return `<p>${markdown.replace(/\n/g, '</p><p>')}</p>`;
  }
}
