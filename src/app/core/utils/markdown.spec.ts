import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings, paragraphs, lists and checkboxes', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** and *it* text\ncontinues.\n\n- one\n- [x] done\n- [ ] todo\n\n1. first\n2. second');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<p>Some <strong>bold</strong> and <em>it</em> text continues.</p>');
    expect(html).toContain('<ul><li>one</li><li><span class="check">☑</span> done</li><li><span class="check">☐</span> todo</li></ul>');
    expect(html).toContain('<ol><li>first</li><li>second</li></ol>');
  });

  it('renders tables, code blocks and quotes', () => {
    const html = renderMarkdown('| Plan | Price |\n|---|---|\n| Standard | 150 RON |\n\n```\nnpm run db:backup <x>\n```\n\n> Keep backups off this disk');
    expect(html).toContain('<thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Standard</td><td>150 RON</td></tr></tbody>');
    expect(html).toContain('<pre><code>npm run db:backup &lt;x&gt;</code></pre>');
    expect(html).toContain('<blockquote>Keep backups off this disk</blockquote>');
  });

  it('escapes HTML and only allows safe links', () => {
    const html = renderMarkdown('<script>alert(1)</script> [ok](https://vinit.ro) [bad](javascript:alert(1)) [app](/tools/salons) `<b>`');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<a href="https://vinit.ro" target="_blank" rel="noopener noreferrer">ok</a>');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('<a href="/tools/salons">app</a>');
    expect(html).toContain('<code>&lt;b&gt;</code>');
  });
});
