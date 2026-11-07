/**
 * Small Markdown renderer for the wiki: headings, paragraphs, lists (with [ ] / [x] checkboxes),
 * tables, code blocks, quotes, rules, **bold**, *italic*, `code` and links.
 * Everything is HTML-escaped first; links only allow http(s), mailto and in-app paths. Angular's
 * sanitizer runs on top when the result is bound with [innerHTML].
 */

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SAFE_URL = /^(https?:\/\/|mailto:|\/|#)/i;

/** Inline formatting on already-escaped text. */
function inline(text: string): string {
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label: string, url: string) => {
    const href = url.replace(/&amp;/g, '&');
    if (!SAFE_URL.test(href)) return m;
    const external = /^https?:/i.test(href);
    return `<a href="${escape(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, pre: string, url: string) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(escape(para.join(' ')))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      html.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length + 1;
      html.push(`<h${level}>${inline(escape(heading[2].trim()))}</h${level}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      html.push('<hr />');
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
      i--;
      html.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(escape(c))}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_, ci) => `<td>${inline(escape(r[ci] ?? ''))}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const quote: string[] = [];
      for (; i < lines.length && /^\s*>\s?/.test(lines[i]); i++) quote.push(lines[i].replace(/^\s*>\s?/, ''));
      i--;
      html.push(`<blockquote>${inline(escape(quote.join(' ')))}</blockquote>`);
      continue;
    }
    const item = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const tag = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      const check = /^\[( |x|X)\]\s+(.*)$/.exec(item[2]);
      list.items.push(check ? `<span class="check">${check[1].trim() ? '☑' : '☐'}</span> ${inline(escape(check[2]))}` : inline(escape(item[2])));
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flush();
  return html.join('\n');
}
